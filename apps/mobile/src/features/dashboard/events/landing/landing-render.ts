/**
 * HTML della landing pubblica di un evento (DAS-REV-29 §10–§12, §24, §25).
 *
 * Stringhe pure, nessun DOM e nessun framework: il documento si produce lato
 * server su qualunque runtime edge (§24). Mobile-first, colonna centrata su
 * desktop, pulsanti a pillola alti almeno 44 px, card a raggio 16 (§25).
 *
 * Sicurezza (§24): ogni testo e ogni attributo dinamico passa da `escapeHtml`;
 * il payload JSON non entra mai nella pagina; lo script è statico (nessun
 * dato interpolato), quindi la CSP lo autorizza per hash.
 */
import {
  LANDING_COPY,
  discoverTarget,
  type CtaTarget,
  type LandingCta,
  type LandingLinksContext,
  type LandingView,
  type NoticeIcon,
  type StoreLink,
} from "./landing-model";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const e = escapeHtml;

/* ── Icone (decorative: il testo accanto le spiega) ──────────────────── */

const ICON_PATHS: Record<NoticeIcon | "calendar" | "pin" | "document" | "error", string> = {
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.5h.01"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  document:
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M14 3l5 5h-5z"/><circle cx="17" cy="17" r="4"/><path d="M14.2 19.8l5.6-5.6"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.5h.01"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  people:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.2c2.6.2 4.5 2.1 4.5 5.3"/>',
  pin: '<path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  warning: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5"/><path d="M12 17.5h.01"/>',
};

function icon(name: keyof typeof ICON_PATHS, className = "icon"): string {
  return `<svg class="${className}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name]}</svg>`;
}

const VERIFIED_BADGE =
  '<svg class="verified" viewBox="0 0 24 24" width="16" height="16" role="img" aria-label="Società verificata" focusable="false"><title>Società verificata</title><circle cx="12" cy="12" r="11" fill="#1B4FD8"/><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ── Stile ───────────────────────────────────────────────────────────── */

const STYLE = `
:root{--text:#111111;--meta:#686868;--blue:#1B4FD8;--border:#E5E7EB;--card:#F4F5F7;--error:#C62828;--bg:#FFFFFF}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:15px;line-height:1.45;overflow-wrap:anywhere}
main{max-width:480px;margin:0 auto;padding:16px 16px 40px}
.wordmark{margin:4px 0 20px;font-size:20px;font-weight:900;letter-spacing:.02em;color:var(--text)}
.club{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-weight:600}
.club-logo,.club-initial{width:32px;height:32px;border-radius:50%;flex:none}
.club-logo{object-fit:contain;background:var(--bg);border:1px solid var(--border)}
.club-initial{display:flex;align-items:center;justify-content:center;background:var(--card);border:1px solid var(--border);color:var(--meta);font-weight:700}
.verified{flex:none}
.flyer{position:relative;width:100%;margin:0 0 16px;border-radius:16px;overflow:hidden;background:var(--card);border:1px solid var(--border)}
.flyer img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
h1{margin:0;font-size:22px;line-height:1.25;font-weight:800;color:var(--text)}
.subtitle{margin:2px 0 14px;color:var(--meta)}
.facts{margin:0 0 16px;padding:0}
.fact{display:flex;gap:12px;align-items:flex-start;padding:5px 0}
.fact dt{flex:none;display:flex;padding-top:1px;color:var(--text)}
.fact dd{margin:0;min-width:0}
.meta{color:var(--meta)}
.block{margin:0 0 14px}
.block h2{margin:0 0 2px;font-size:15px;font-weight:700}
.block p{margin:0;white-space:pre-line}
.notice{display:flex;gap:12px;align-items:flex-start;margin:0 0 16px;padding:14px 16px;border-radius:16px;background:var(--card)}
.notice .icon{flex:none;width:24px;height:24px;color:var(--text)}
.notice h2{margin:0 0 2px;font-size:15px;font-weight:700}
.notice p{margin:0;color:var(--meta);font-size:14px}
.deadline{margin:0 0 4px;color:var(--meta);font-size:14px}
.actions{display:flex;flex-direction:column;gap:12px;margin:20px 0 0}
.btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;padding:10px 20px;border-radius:999px;border:1px solid var(--blue);font:inherit;font-weight:700;text-align:center;text-decoration:none}
.btn-primary{background:var(--blue);color:#FFFFFF}
.btn-secondary{background:var(--bg);color:var(--blue)}
.btn-disabled{background:var(--card);border-color:var(--border);color:var(--meta);cursor:not-allowed}
.btn:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.stores{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
.stores li{flex:1 1 140px}
.note{margin:0;color:var(--meta);font-size:13px;text-align:center}
.fallback{display:flex;flex-direction:column;gap:8px;padding:14px 16px;border:1px solid var(--border);border-radius:16px}
.fallback[hidden]{display:none}
.empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:56px 8px 8px}
.empty .icon{width:56px;height:56px;color:var(--meta);margin-bottom:16px}
.empty .icon.error{color:var(--error)}
.empty h1{font-size:20px}
.empty p{margin:6px 0 0;color:var(--meta)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;

/**
 * Progressive enhancement di «Apri nell’app» (§24). Il link funziona da solo;
 * lo script, se gira, mostra i link ufficiali quando dopo ~1,5 s la pagina è
 * ancora in primo piano (l'app non si è aperta). Nessun redirect automatico,
 * nessun loop, nessun accesso agli appunti, nessun tracciamento.
 * Statico per contratto: la CSP lo autorizza per hash.
 */
export const LANDING_SCRIPT =
  '(function(){var a=document.getElementById("prolink-open-app"),f=document.getElementById("prolink-open-fallback");if(!a||!f)return;a.addEventListener("click",function(){var left=false;function away(){left=true}document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")away()},{once:true});window.addEventListener("pagehide",away,{once:true});window.setTimeout(function(){if(!left&&document.visibilityState==="visible"){f.hidden=false}},1500)})})();';

/* ── Pezzi ───────────────────────────────────────────────────────────── */

type HeadMeta = {
  canonicalUrl?: string;
  description: string;
  image?: string | null;
  noindex?: boolean;
  ogTitle?: string;
  title: string;
};

function head(meta: HeadMeta): string {
  const tags = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="color-scheme" content="light">',
    '<meta name="format-detection" content="telephone=no">',
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}">`,
  ];

  if (meta.noindex) {
    tags.push('<meta name="robots" content="noindex">');
  }

  if (meta.canonicalUrl) {
    tags.push(`<link rel="canonical" href="${e(meta.canonicalUrl)}">`);
  }

  if (meta.ogTitle) {
    tags.push(
      '<meta property="og:type" content="website">',
      `<meta property="og:site_name" content="${LANDING_COPY.brand}">`,
      `<meta property="og:title" content="${e(meta.ogTitle)}">`,
      `<meta property="og:description" content="${e(meta.description)}">`,
      ...(meta.canonicalUrl ? [`<meta property="og:url" content="${e(meta.canonicalUrl)}">`] : []),
      ...(meta.image ? [`<meta property="og:image" content="${e(meta.image)}">`] : []),
      `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}">`,
      `<meta name="twitter:title" content="${e(meta.ogTitle)}">`,
      `<meta name="twitter:description" content="${e(meta.description)}">`,
      ...(meta.image ? [`<meta name="twitter:image" content="${e(meta.image)}">`] : []),
    );
  }

  return `<head>\n${tags.join("\n")}\n<style>${STYLE}</style>\n</head>`;
}

function documentShell(meta: HeadMeta, body: string, withScript = false): string {
  return [
    "<!doctype html>",
    '<html lang="it">',
    head(meta),
    "<body>",
    `<main>\n<p class="wordmark">${LANDING_COPY.brand}</p>\n${body}\n</main>`,
    withScript ? `<script>${LANDING_SCRIPT}</script>` : "",
    "</body>",
    "</html>",
  ]
    .filter(Boolean)
    .join("\n");
}

function storeList(links: StoreLink[], id?: string): string {
  const items = links
    .map(
      (link) =>
        `<li><a class="btn btn-secondary" href="${e(link.href)}" rel="noopener">${e(link.label)}</a></li>`,
    )
    .join("");

  return `<ul class="stores"${id ? ` id="${id}"` : ""} aria-label="Link ufficiali per scaricare PROLINK">${items}</ul>`;
}

/**
 * Il pulsante primario. Con una destinazione unica è un link; senza
 * (desktop, o store della piattaforma non configurato) rimanda ai link
 * ufficiali mostrati subito sotto, senza sceglierne uno (§24); senza alcun
 * link è disabilitato con il motivo.
 */
function primaryCta(cta: LandingCta): string {
  return ctaButton(cta.label, cta.target, "prolink-stores");
}

function ctaButton(label: string, target: CtaTarget, storesId: string): string {
  if (target.kind === "link") {
    return `<a class="btn btn-primary" href="${e(target.href)}" rel="noopener">${e(label)}</a>`;
  }

  if (target.kind === "stores") {
    return [
      `<a class="btn btn-primary" href="#${storesId}">${e(label)}</a>`,
      storeList(target.links, storesId),
    ].join("\n");
  }

  return [
    `<span class="btn btn-disabled" role="link" aria-disabled="true">${e(label)}</span>`,
    `<p class="note">${e(target.reason)}</p>`,
  ].join("\n");
}

function fact(iconName: "calendar" | "pin" | "people", label: string, lines: string[]): string {
  const [first, ...rest] = lines;
  return `<div class="fact"><dt>${icon(iconName)}<span class="sr-only">${e(label)}</span></dt><dd>${e(first ?? "")}${rest
    .map((line) => `<br>${e(line)}`)
    .join("")}</dd></div>`;
}

function clubRow(view: LandingView): string {
  if (!view.club.name) {
    return "";
  }

  const avatar = view.club.logoUrl
    ? `<img class="club-logo" src="${e(view.club.logoUrl)}" alt="Logo di ${e(view.club.name)}" width="32" height="32" decoding="async">`
    : `<span class="club-initial" aria-hidden="true">${e(view.club.initial)}</span>`;

  return `<div class="club">${avatar}<span>${e(view.club.name)}</span>${view.club.isVerified ? VERIFIED_BADGE : ""}</div>`;
}

function flyerBlock(view: LandingView): string {
  if (!view.flyer) {
    return "";
  }

  const { alt, height, url, width } = view.flyer;
  /* §11: rapporto riservato prima del caricamento, nessun ritaglio. */
  return `<figure class="flyer" style="aspect-ratio:${width} / ${height}"><img src="${e(url)}" alt="${e(alt)}" width="${width}" height="${height}" loading="lazy" decoding="async"></figure>`;
}

function textBlock(title: string, body: string | null): string {
  return body ? `<section class="block"><h2>${e(title)}</h2><p>${e(body)}</p></section>` : "";
}

function noticeBlock(view: LandingView): string {
  if (!view.notice) {
    return "";
  }

  return `<section class="notice" role="status">${icon(view.notice.icon)}<div><h2>${e(view.notice.title)}</h2><p>${e(view.notice.text)}</p></div></section>`;
}

function actions(view: LandingView): string {
  const parts: string[] = [];

  if (view.manualNote) {
    parts.push(`<p class="note">${e(view.manualNote)}</p>`);
  }

  parts.push(primaryCta(view.primary));

  if (view.openInApp) {
    parts.push(
      `<a class="btn btn-secondary" id="prolink-open-app" href="${e(view.openInApp.href)}">${e(view.openInApp.label)}</a>`,
    );
    const links = view.openInApp.fallbackLinks;
    parts.push(
      `<div class="fallback" id="prolink-open-fallback" hidden>${links.length ? storeList(links) : ""}<p class="note">${e(LANDING_COPY.installHint)}</p></div>`,
    );
  }

  if (view.footnote) {
    parts.push(`<p class="note">${e(view.footnote)}</p>`);
  }

  if (view.installHint) {
    parts.push(`<p class="note">${e(view.installHint)}</p>`);
  }

  return `<div class="actions">${parts.join("\n")}</div>`;
}

/* ── Documenti ───────────────────────────────────────────────────────── */

export function renderLanding(view: LandingView): string {
  const facts = [
    view.when ? fact("calendar", "Data e orario", [view.when.date, ...(view.when.time ? [view.when.time] : [])]) : "",
    view.venue
      ? fact("pin", "Luogo", [view.venue.name, view.venue.address].filter((line): line is string => Boolean(line)))
      : "",
    view.participants ? fact("people", "Partecipanti", [view.participants]) : "",
  ].filter(Boolean);

  const birthYears = view.birthYears
    ? `<section class="block"><h2 class="meta">Anni di nascita di riferimento</h2><p class="meta">${e(view.birthYears)}</p></section>`
    : "";

  const body = [
    clubRow(view),
    flyerBlock(view),
    `<h1>${e(view.title)}</h1>`,
    view.subtitle ? `<p class="subtitle">${e(view.subtitle)}</p>` : "",
    facts.length ? `<dl class="facts">${facts.join("")}</dl>` : "",
    noticeBlock(view),
    birthYears,
    textBlock("Descrizione", view.description),
    textBlock("Requisiti e informazioni", view.requirements),
    view.deadline ? `<p class="deadline">${e(view.deadline)}</p>` : "",
    actions(view),
  ]
    .filter(Boolean)
    .join("\n");

  return documentShell(
    {
      canonicalUrl: view.canonicalUrl,
      description: view.og.description || view.og.title,
      image: view.og.image,
      ogTitle: view.og.title,
      title: view.documentTitle,
    },
    body,
    Boolean(view.openInApp),
  );
}

/**
 * §24, schermata 20: nessun titolo, Società o altro dato dell'evento —
 * identica per id inesistente, bozza, privato o rimosso.
 */
export function renderUnavailable(ctx: LandingLinksContext): string {
  const body = [
    `<div class="empty">${icon("document")}<h1>${LANDING_COPY.unavailableTitle}</h1><p>${LANDING_COPY.unavailableText}</p></div>`,
    `<div class="actions">${ctaButton(LANDING_COPY.discover, discoverTarget(ctx), "prolink-stores")}</div>`,
  ].join("\n");

  return documentShell(
    {
      description: LANDING_COPY.unavailableText,
      noindex: true,
      title: `${LANDING_COPY.unavailableTitle} – ${LANDING_COPY.brand}`,
    },
    body,
  );
}

/**
 * Errore di caricamento (rete, 5xx): distinto da «non disponibile», perché
 * l'evento potrebbe esistere. `retryHref` è il percorso già validato.
 */
export function renderLoadError(ctx: { retryHref: string }): string {
  const body = [
    `<div class="empty" role="alert">${icon("error", "icon error")}<h1>${LANDING_COPY.loadError}</h1></div>`,
    `<div class="actions"><a class="btn btn-primary" href="${e(ctx.retryHref)}">${LANDING_COPY.retry}</a></div>`,
  ].join("\n");

  return documentShell(
    { description: LANDING_COPY.loadError, noindex: true, title: `${LANDING_COPY.brand}` },
    body,
  );
}
