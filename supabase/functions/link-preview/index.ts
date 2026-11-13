/**
 * HOM-06.1 §73–§80, §207 — Edge Function `link-preview`.
 *
 * Il client manda `{ url }`, la funzione recupera i metadata lato server (§76),
 * li persiste in `link_preview_snapshots` (§80) e restituisce `snapshot_id`:
 * `publish_post` referenzia lo snapshot per id e non accetta mai metadata dal
 * client (§207). Il service role vive SOLO qui, mai nel client mobile.
 *
 * Contratto: WireLinkPreviewResult (apps/mobile/src/features/post-composer/
 * composer-types.ts). Risponde sempre 200 con uno status ('ok' | 'unavailable' |
 * 'blocked' | 'invalid'); 401 senza un JWT utente valido, 405 per metodi diversi
 * da POST. La preview non blocca mai il publish (§89): il client tratta ogni
 * status diverso da 'ok' come «Anteprima non disponibile».
 *
 * Deploy: `supabase functions deploy link-preview` (verify_jwt resta attivo di
 * default; il JWT si ricontrolla comunque qui con auth.getUser).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { guardedFetchHtml } from "./guarded-fetch.ts";
import { parseLinkMeta } from "./html-meta.ts";
import { NegativeCache, SlidingWindowLimiter } from "./rate-limit.ts";
import { displayDomain, normalizeUrl, parseHttpsUrl } from "./url-normalize.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
  resolveDns(name: string, type: "A" | "AAAA"): Promise<string[]>;
};

const DEFAULT_TTL_HOURS = 24;

// Limiti d'uso (§77). Il tetto sugli snapshot è per utente e sta nel database;
// quello sui tentativi e la cache dei fallimenti vivono nella memoria
// dell'isolate (best effort, vedi rate-limit.ts).
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_SNAPSHOTS_PER_WINDOW = 30;
const MAX_ATTEMPTS_PER_WINDOW = 60;
const FAILURE_TTL_MS = 60 * 1000;

const attempts = new SlidingWindowLimiter(MAX_ATTEMPTS_PER_WINDOW, RATE_WINDOW_MS);
const failures = new NegativeCache<"blocked" | "unavailable">(FAILURE_TTL_MS);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function resolveAll(hostname: string): Promise<string[]> {
  const settled = await Promise.allSettled([Deno.resolveDns(hostname, "A"), Deno.resolveDns(hostname, "AAAA")]);
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

type SnapshotRow = {
  id: string;
  original_url: string;
  final_url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  favicon_url: string | null;
  domain: string;
  site_name: string | null;
};

function okResult(row: SnapshotRow, originalUrl: string) {
  return {
    status: "ok" as const,
    snapshot_id: row.id,
    original_url: originalUrl,
    final_url: row.final_url,
    title: row.title,
    description: row.description,
    image_url: row.image_url,
    favicon_url: row.favicon_url,
    domain: row.domain,
    site_name: row.site_name,
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "misconfigured" }, 500);
  }
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  // Un JWT utente valido, non la sola anon key: getUser lo verifica sul server auth.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(authorization.slice(7).trim());
  if (userError || !userData.user) {
    return json({ error: "unauthorized" }, 401);
  }
  const userId = userData.user.id;

  let rawUrl: unknown;
  try {
    rawUrl = ((await request.json()) as { url?: unknown })?.url;
  } catch {
    return json({ status: "invalid", original_url: "", domain: null });
  }
  if (typeof rawUrl !== "string") {
    return json({ status: "invalid", original_url: "", domain: null });
  }

  // Lo schema si scrive minuscolo: il CHECK del database è '^https://' e
  // publish_post confronta l'URL con la stessa riscrittura.
  const original = rawUrl.trim().replace(/^https:\/\//i, "https://");
  const parsed = parseHttpsUrl(original);
  const domain = parsed.ok ? displayDomain(parsed.url.toString()) : null;
  const normalized = normalizeUrl(original);
  if (!parsed.ok || normalized === null) {
    return json({
      status: parsed.ok || parsed.reason === "invalid" ? "invalid" : "blocked",
      original_url: original.slice(0, 2048),
      domain,
    });
  }

  // Il service role scrive e legge gli snapshot (RLS attiva, nessuna policy per i client).
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: ttlRow } = await admin
    .from("app_policy_settings")
    .select("value")
    .eq("key", "post_composer.link_snapshot_ttl_hours")
    .maybeSingle();
  const ttlHours = Number(ttlRow?.value ?? DEFAULT_TTL_HOURS);
  const since = new Date(Date.now() - (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : DEFAULT_TTL_HOURS) * 3_600_000);

  const columns = "id, original_url, final_url, title, description, image_url, favicon_url, domain, site_name";

  // §80: niente scraping a ogni richiesta. Uno snapshot recente dello stesso URL
  // normalizzato si riusa (§88: stesso URL = stessa preview).
  const { data: cached } = await admin
    .from("link_preview_snapshots")
    .select(columns)
    .eq("normalized_url", normalized)
    .gte("fetched_at", since.toISOString())
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cached) {
    return json(okResult(cached as SnapshotRow, original));
  }

  // Un URL che ha appena fallito non si rilancia (fetch + DNS) per qualche
  // decina di secondi: vale per chiunque lo chieda, e non consuma il limite.
  const knownFailure = failures.get(normalized);
  if (knownFailure) {
    return json({ status: knownFailure, original_url: original, domain });
  }

  // Limite per utente (§77): oltre MAX_SNAPSHOTS_PER_WINDOW snapshot nuovi in
  // 10 minuti — contati nel database, quindi validi fra isolate — e oltre
  // MAX_ATTEMPTS_PER_WINDOW tentativi (anche falliti) per isolate. La risposta è
  // 'unavailable': la preview non blocca mai il publish (§89).
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count: recentSnapshots } = await admin
    .from("link_preview_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("fetched_by", userId)
    .gte("fetched_at", windowStart);
  if ((recentSnapshots ?? 0) >= MAX_SNAPSHOTS_PER_WINDOW || !attempts.take(userId)) {
    return json({ status: "unavailable", original_url: original, domain });
  }

  const fetched = await guardedFetchHtml(original, {
    resolve: resolveAll,
    fetch: (url, init) => fetch(url, init),
  });
  if (fetched.status !== "ok") {
    if (fetched.status !== "invalid") {
      failures.set(normalized, fetched.status);
    }
    return json({ status: fetched.status, original_url: original, domain });
  }

  const meta = parseLinkMeta(fetched.html, fetched.finalUrl);
  // Una pagina senza titolo, descrizione né immagine non ha niente da mostrare.
  if (meta.title === null && meta.description === null && meta.imageUrl === null) {
    failures.set(normalized, "unavailable");
    return json({ status: "unavailable", original_url: original, domain });
  }

  const finalDomain = displayDomain(fetched.finalUrl) || domain || "";
  const { data: inserted, error: insertError } = await admin
    .from("link_preview_snapshots")
    .insert({
      normalized_url: normalized,
      original_url: original,
      final_url: fetched.finalUrl,
      title: meta.title,
      description: meta.description,
      image_url: meta.imageUrl,
      favicon_url: meta.faviconUrl,
      domain: finalDomain,
      site_name: meta.siteName,
      fetched_by: userId,
    })
    .select(columns)
    .single();

  if (insertError || !inserted) {
    return json({ status: "unavailable", original_url: original, domain });
  }

  return json(okResult(inserted as SnapshotRow, original));
});
