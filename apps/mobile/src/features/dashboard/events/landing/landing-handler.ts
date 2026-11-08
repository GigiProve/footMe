/**
 * Handler HTTP della landing pubblica `GET /event/<publicId>` (DAS-REV-29
 * §10–§12, §24).
 *
 * Solo Fetch API standard (`Request` → `Response`): niente Node, niente Deno,
 * niente React. Le Edge Function di Supabase riscrivono `text/html` in
 * `text/plain` e il progetto non ha ancora un host web, quindi la landing è un
 * renderer indipendente dall'host da montare sull'origine web quando esisterà.
 *
 * §24, stati distinti e non confondibili:
 * - id malformato, percorso sconosciuto, `state: "unavailable"` → 404 con la
 *   pagina generica, `noindex`, nessun dato dell'evento;
 * - rete o 5xx dalla RPC → 503 «Impossibile caricare l’evento», mai in cache;
 * - evento disponibile → 200, anche se annullato o concluso.
 *
 * La RPC è chiamata con la sola chiave anon: la visibilità la decide il DB.
 */
import {
  PUBLIC_ID_PATTERN,
  cacheMaxAgeSeconds,
  detectPlatform,
  landingView,
  parsePublicEvent,
  type LandingLinksContext,
} from "./landing-model";
import { LANDING_SCRIPT, renderLanding, renderLoadError, renderUnavailable } from "./landing-render";

export type EventLandingConfig = {
  androidStoreUrl?: string;
  anonKey: string;
  /** Schema dell'app per «Apri nell’app»: oggi `footme`. */
  appScheme: string;
  discoverUrl?: string;
  iosStoreUrl?: string;
  supabaseUrl: string;
  webOrigin: string;
};

/** Iniettabili per i test; in produzione valgono i globali del runtime. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type EventLandingDeps = {
  fetch?: FetchLike;
  now?: () => number;
  timeoutMs?: number;
};

const FLYER_BUCKET = "selection-event-flyers";
/** §11, §24: firma breve (1 h) perché una revoca prevalga presto; la pagina resta in cache al massimo 60 s e a ogni rigenerazione firma di nuovo. */
const FLYER_SIGN_SECONDS = 3600;
const ROUTE = /^\/event\/([^/]+)\/?$/;

class LoadError extends Error {}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function sha256Base64(source: string): Promise<string | null> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;

  if (!subtle) {
    return null;
  }

  const digest = new Uint8Array(await subtle.digest("SHA-256", new TextEncoder().encode(source)));
  let binary = "";
  digest.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

/**
 * Difesa in profondità sopra l'escape: nessuno script inline oltre a quello
 * statico (autorizzato per hash), nessun form, nessun frame.
 */
function contentSecurityPolicy(scriptHash: string | null): string {
  return [
    "default-src 'none'",
    "img-src https: data:",
    "style-src 'unsafe-inline'",
    `script-src ${scriptHash ? `'sha256-${scriptHash}'` : "'none'"}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function createEventLandingHandler(
  config: EventLandingConfig,
  deps: EventLandingDeps = {},
): (req: Request) => Promise<Response> {
  const supabaseUrl = trimSlash(config.supabaseUrl);
  const doFetch: FetchLike = deps.fetch ?? ((url, init) => fetch(url, init));
  const now = deps.now ?? (() => Date.now());
  const timeoutMs = deps.timeoutMs ?? 8000;
  const authHeaders = {
    Authorization: `Bearer ${config.anonKey}`,
    apikey: config.anonKey,
  };
  let scriptHash: Promise<string | null> | null = null;

  async function post(url: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await doFetch(url, {
        body: JSON.stringify(body),
        headers: { ...authHeaders, "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchEvent(publicId: string): Promise<unknown> {
    let res: Response;

    try {
      res = await post(`${supabaseUrl}/rest/v1/rpc/fetch_public_selection_event`, {
        p_public_id: publicId,
      });
    } catch {
      throw new LoadError("network");
    }

    /* Un 4xx qui è configurazione rotta, non un evento inesistente: la
       pagina «non disponibile» la decide solo il payload della RPC. */
    if (!res.ok) {
      throw new LoadError(`status ${res.status}`);
    }

    try {
      return await res.json();
    } catch {
      throw new LoadError("body");
    }
  }

  /** QA-126: se la firma fallisce la pagina esce senza immagine, non in errore. */
  async function signFlyer(path: string): Promise<string | null> {
    try {
      const encoded = path.split("/").map(encodeURIComponent).join("/");
      const res = await post(`${supabaseUrl}/storage/v1/object/sign/${FLYER_BUCKET}/${encoded}`, {
        expiresIn: FLYER_SIGN_SECONDS,
      });

      if (!res.ok) {
        return null;
      }

      const json = (await res.json()) as { signedURL?: unknown };
      return typeof json.signedURL === "string" && json.signedURL.startsWith("/")
        ? `${supabaseUrl}/storage/v1${json.signedURL}`
        : null;
    } catch {
      return null;
    }
  }

  function html(
    body: string,
    status: number,
    extra: Record<string, string>,
    method: string,
    csp: string,
  ): Response {
    const headers = new Headers({
      "Content-Security-Policy": csp,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    });

    return new Response(method === "HEAD" ? null : body, { headers, status });
  }

  return async function handle(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();

    if (method !== "GET" && method !== "HEAD") {
      return new Response("Method Not Allowed", {
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
        status: 405,
      });
    }

    const platform = detectPlatform(req.headers.get("user-agent"));
    const links: LandingLinksContext = {
      androidStoreUrl: config.androidStoreUrl,
      discoverUrl: config.discoverUrl,
      iosStoreUrl: config.iosStoreUrl,
      platform,
      webOrigin: config.webOrigin,
    };
    const noScript = contentSecurityPolicy(null);
    /* I link dipendono dalla piattaforma: una cache condivisa deve saperlo. */
    const vary = { Vary: "User-Agent" };
    const unavailable = () =>
      html(
        renderUnavailable(links),
        404,
        { ...vary, "Cache-Control": "public, max-age=60, s-maxage=60", "X-Robots-Tag": "noindex" },
        method,
        noScript,
      );

    let pathname: string;

    try {
      pathname = new URL(req.url).pathname;
    } catch {
      return unavailable();
    }

    const publicId = ROUTE.exec(pathname)?.[1];

    if (!publicId || !PUBLIC_ID_PATTERN.test(publicId)) {
      return unavailable();
    }

    let payload: unknown;

    try {
      payload = await fetchEvent(publicId);
    } catch {
      return html(
        renderLoadError({ retryHref: `/event/${publicId}` }),
        503,
        { "Cache-Control": "no-store", "Retry-After": "30", "X-Robots-Tag": "noindex" },
        method,
        noScript,
      );
    }

    const event = parsePublicEvent(payload);

    /* Un payload di un altro evento non deve mai rispondere a questo link. */
    if (event.state !== "available" || event.publicId !== publicId) {
      return unavailable();
    }

    const flyerUrl = event.flyer ? await signFlyer(event.flyer.path) : null;
    const view = landingView(event, { ...links, appScheme: config.appScheme, flyerUrl });
    const maxAge = cacheMaxAgeSeconds(event, now());

    scriptHash ??= sha256Base64(LANDING_SCRIPT).catch(() => null);
    const csp = contentSecurityPolicy(view.openInApp ? await scriptHash : null);

    return html(
      renderLanding(view),
      200,
      { ...vary, "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}` },
      method,
      csp,
    );
  };
}
