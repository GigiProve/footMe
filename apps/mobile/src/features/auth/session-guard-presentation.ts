/**
 * Guardia di sessione comune — derivazioni PURE (HOM-15 §293–§297).
 *
 *  • §293, §294, §296: un URL condiviso o un deep link non bypassa permessi né
 *    sessione. Prima di HOM-15 solo le tab e il profilo pubblico controllavano
 *    la sessione; dettaglio contenuto, Società, Mi piace, composer, Segnala,
 *    statistiche, notifiche e chat montavano anche senza. La regola ora è una
 *    sola: ogni route è protetta tranne l'elenco esplicito qui sotto.
 *  • Pubbliche per contratto: l'avvio (`/`), l'accesso `(auth)`, la landing
 *    dell'evento (DAS-REV-29 §12, proiezione anonima) e le landing degli inviti
 *    con token (REV-PROF-14, DAS-REV-11 §18, DAS-REV-13 §13, DAS-REV-20 §19),
 *    che hanno già il loro percorso verso welcome/sign-in con token pendente.
 *  • `(onboarding)` e `(admin)` hanno una guardia di ruolo propria nel layout:
 *    qui si lasciano passare.
 *  • §297: il target originario si ricorda solo quando è un path interno
 *    sicuro (inizia con «/», niente schema/host, niente route di accesso), e
 *    solo per chi arriva senza sessione — un logout non deve riportare
 *    l'account successivo dove stava il precedente.
 */

export const SIGN_IN_HREF = "/(auth)/sign-in";
export const ONBOARDING_HREF = "/(onboarding)/profile";

/** Primo segmento delle route raggiungibili senza sessione. */
const PUBLIC_ROOTS: readonly string[] = [
  "(auth)",
  // DAS-REV-29 §12: link pubblico dell'evento, vista anonima senza sessione.
  "event",
  // Landing degli inviti con token: mettono da parte il token e portano all'accesso.
  "assistito-invite",
  "society-invite",
  "team-invite",
  // Schermate di sistema di Expo Router (route inesistente, sitemap di sviluppo).
  "+not-found",
  "_sitemap",
];

/** DAS-REV-13 §13: dentro `admin-invite` solo la landing del token è pubblica, non il composer. */
const PUBLIC_NESTED: Readonly<Record<string, string>> = {
  "admin-invite": "[token]",
};

/** Gruppi con una guardia di ruolo nel proprio layout (sessione + onboarding / admin). */
const SELF_GUARDED_ROOTS: readonly string[] = ["(onboarding)", "(admin)"];

export type RouteAccess = "public" | "self_guarded" | "protected";

export function routeAccess(segments: readonly string[]): RouteAccess {
  const [root, child] = segments;

  // `/` (app/index.tsx) smista da sé fra welcome, admin, onboarding e tab.
  if (!root || PUBLIC_ROOTS.includes(root)) {
    return "public";
  }
  if (PUBLIC_NESTED[root] !== undefined && PUBLIC_NESTED[root] === child) {
    return "public";
  }
  if (SELF_GUARDED_ROOTS.includes(root)) {
    return "self_guarded";
  }
  return "protected";
}

export type SessionGuardInput = {
  segments: readonly string[];
  isLoading: boolean;
  hasSession: boolean;
  needsOnboarding: boolean;
  /** La sessione c'era al passaggio precedente: questa assenza è un logout o una scadenza. */
  hadSession: boolean;
};

export type SessionGuardDecision =
  | { kind: "allow" }
  | { kind: "wait" }
  | { kind: "redirect"; href: string; rememberTarget: boolean };

export function decideSessionGuard(input: SessionGuardInput): SessionGuardDecision {
  if (routeAccess(input.segments) !== "protected") {
    return { kind: "allow" };
  }
  if (input.isLoading) {
    return { kind: "wait" };
  }
  if (!input.hasSession) {
    return { href: SIGN_IN_HREF, kind: "redirect", rememberTarget: !input.hadSession };
  }
  // Lo stesso gate onboarding delle tab: un deep link non salta il profilo da completare.
  if (input.needsOnboarding) {
    return { href: ONBOARDING_HREF, kind: "redirect", rememberTarget: true };
  }
  return { kind: "allow" };
}

/** Path di accesso/onboarding come li riporta `usePathname` (senza gruppi). */
const AUTH_PATHS: readonly string[] = ["/sign-in", "/sign-up", "/welcome", "/forgot-password"];

const MAX_TARGET_LENGTH = 512;

/**
 * §297: un target ripristinabile è un path interno. Rifiuta schema/host
 * (`https://`, `//host`, `footme://`), backslash, caratteri di controllo, la
 * radice (non c'è nulla da riprendere) e le route di accesso o dei gruppi
 * con guardia propria. Si rivalida anche in lettura: lo storage non è fidato.
 */
export function isSafeInternalTarget(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 2 || value.length > MAX_TARGET_LENGTH) {
    return false;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return false;
  }
  if (value.includes("\\") || value.includes("://") || /[\u0000-\u001f\u007f\s]/.test(value)) {
    return false;
  }

  const path = value.split(/[?#]/)[0];
  if (path === "/" || AUTH_PATHS.includes(path)) {
    return false;
  }
  return !path.startsWith("/(auth)") && !path.startsWith("/(onboarding)") && !path.startsWith("/(admin)");
}

type SearchParams = Record<string, string | string[] | undefined>;

/** I nomi dei parametri dinamici (`[id]`, `[...rest]`) già presenti nel path. */
function dynamicParamNames(segments: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const segment of segments) {
    const match = /^\[(?:\.\.\.)?([^\]]+)\]$/.exec(segment);
    if (match) {
      names.add(match[1]);
    }
  }
  return names;
}

/**
 * Il target da ricordare: path corrente più la query (origin, focus, commento…),
 * senza i parametri dinamici che il path contiene già. `null` se non è sicuro.
 */
export function pendingTargetForRoute(
  pathname: string,
  segments: readonly string[],
  params: SearchParams,
): string | null {
  const inPath = dynamicParamNames(segments);
  const query: string[] = [];

  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (inPath.has(key) || value === undefined) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
    }
  }

  const target = query.length > 0 ? `${pathname}?${query.join("&")}` : pathname;
  return isSafeInternalTarget(target) ? target : null;
}
