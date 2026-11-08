/**
 * Modello della landing pubblica di un evento (DAS-REV-29 §10–§12, §24, §25).
 *
 * Derivazioni pure, senza React né react-native né API di un runtime: la
 * landing è un renderer lato server indipendente dall'host (§24, «stesso
 * link, app o pagina web»), e questo file decide **cosa** si mostra per ogni
 * `public_state` della matrice (§11–§12) senza sapere come lo si disegna.
 *
 * Il payload della RPC `fetch_public_selection_event` si legge con un mapper
 * tollerante ad allowlist (§24): ogni chiave non prevista — partecipanti,
 * richieste in attesa, messaggi di decisione — resta fuori dal modello e quindi
 * non può finire nella pagina. Qualunque forma inattesa vale «non disponibile».
 *
 * Date e orari sono civili nel fuso dell'evento (§15): si formattano così come
 * arrivano, mai attraverso il fuso del server o del browser.
 */
import { eventContextLine, formatCivilDate, formatTime } from "../events-presentation";
import type { ConfirmationMode, SelectionEventType } from "../events-types";

/** §24: stesso vincolo della RPC, così un id malformato non arriva al DB. */
export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export type LandingPlatform = "ios" | "android" | "other";

export type PublicState =
  | "open"
  | "open_full_manual"
  | "full"
  | "closed"
  | "cancelled"
  | "completed";

const PUBLIC_STATES: readonly PublicState[] = [
  "open",
  "open_full_manual",
  "full",
  "closed",
  "cancelled",
  "completed",
];

const EVENT_TYPES: readonly SelectionEventType[] = ["tryout", "stage", "open_day"];

export type PublicEvent = {
  state: "available";
  publicId: string;
  version: number | null;
  club: { name: string; logoUrl: string | null; isVerified: boolean };
  eventType: SelectionEventType | null;
  title: string;
  teamName: string | null;
  flyer: { path: string; width: number; height: number } | null;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  description: string | null;
  requirementsInfo: string | null;
  birthYearFrom: number | null;
  birthYearTo: number | null;
  registrationDeadlineDate: string | null;
  registrationDeadlineTime: string | null;
  confirmationMode: ConfirmationMode | null;
  maxParticipants: number | null;
  confirmedCount: number | null;
  availability: {
    registrationOpen: boolean;
    hasExplicitDeadline: boolean;
    publicState: PublicState;
    nextTransitionAt: string | null;
  };
  serverNow: string | null;
};

export type ParsedPublicEvent = PublicEvent | { state: "unavailable" };

const UNAVAILABLE = { state: "unavailable" } as const;

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Testo lungo: si conservano gli a capo interni, si tolgono solo i bordi. */
function longText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.replace(/^\s+|\s+$/g, "") : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function positiveInteger(value: unknown): number | null {
  const n = integer(value);
  return n !== null && n > 0 ? n : null;
}

/** Il server manda giorni civili `YYYY-MM-DD`: niente altro passa. */
function civilDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function civilTime(value: unknown): string | null {
  return typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value) ? value : null;
}

function timestamp(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

/**
 * Solo URL http(s) assoluti finiscono in un attributo. Un `javascript:` nel
 * logo o in un link di store viene scartato, non solo escapato.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Il flyer già risolto può essere anche un'immagine inline (anteprima). */
function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value)
    ? value
    : safeHttpUrl(value);
}

function parseFlyer(value: unknown): PublicEvent["flyer"] {
  const flyer = asObject(value);
  const path = text(flyer?.path);

  if (!flyer || !path || path.split("/").some((part) => !part || part === "." || part === "..")) {
    return null;
  }

  const width = positiveInteger(flyer.width);
  const height = positiveInteger(flyer.height);

  /* §11: il box riserva il rapporto reale. Senza misure si usa il 4:5 del
     formato locandina, così la pagina non salta quando l'immagine arriva. */
  return width && height ? { height, path, width } : { height: 1350, path, width: 1080 };
}

/**
 * RPC → modello. Tollerante: campi opzionali assenti diventano `null`; manca
 * un campo che la matrice richiede (id, stato pubblico) e l'evento è
 * «non disponibile», come per un id inesistente (§24: nessuna distinzione
 * osservabile).
 */
export function parsePublicEvent(json: unknown): ParsedPublicEvent {
  const root = asObject(json);

  if (!root || root.state !== "available") {
    return UNAVAILABLE;
  }

  const publicId = typeof root.public_id === "string" ? root.public_id : null;
  const availability = asObject(root.availability);
  const publicState = PUBLIC_STATES.find((state) => state === availability?.public_state);

  if (!publicId || !PUBLIC_ID_PATTERN.test(publicId) || !availability || !publicState) {
    return UNAVAILABLE;
  }

  const club = asObject(root.club);
  const eventType = EVENT_TYPES.find((type) => type === root.event_type) ?? null;
  const confirmationMode =
    root.confirmation_mode === "automatic" || root.confirmation_mode === "manual"
      ? root.confirmation_mode
      : null;
  const maxParticipants = positiveInteger(root.max_participants);
  const confirmed = integer(root.confirmed_count);

  return {
    availability: {
      hasExplicitDeadline: availability.has_explicit_deadline === true,
      nextTransitionAt: timestamp(availability.next_transition_at),
      publicState,
      registrationOpen: availability.registration_open === true,
    },
    birthYearFrom: positiveInteger(root.birth_year_from),
    birthYearTo: positiveInteger(root.birth_year_to),
    club: {
      isVerified: club?.is_verified === true,
      logoUrl: safeHttpUrl(club?.logo_url),
      name: text(club?.name) ?? "",
    },
    confirmationMode,
    /* §12: il conteggio esiste solo accanto a un limite. */
    confirmedCount: maxParticipants !== null && confirmed !== null && confirmed >= 0 ? confirmed : null,
    description: longText(root.description),
    endTime: civilTime(root.end_time),
    eventType,
    flyer: parseFlyer(root.flyer),
    maxParticipants,
    publicId,
    registrationDeadlineDate: civilDate(root.registration_deadline_date),
    registrationDeadlineTime: civilTime(root.registration_deadline_time),
    requirementsInfo: longText(root.requirements_info),
    serverNow: timestamp(root.server_now),
    startDate: civilDate(root.start_date),
    startTime: civilTime(root.start_time),
    state: "available",
    teamName: text(root.team_name),
    title: text(root.title) ?? "",
    venueAddress: text(root.venue_address),
    venueName: text(root.venue_name),
    version: integer(root.version),
  };
}

/* ── CTA ─────────────────────────────────────────────────────────────── */

export type StoreLink = { href: string; label: string; store: "ios" | "android" };

/**
 * Dove porta un pulsante. `stores`: nessuna destinazione unica (desktop, o
 * manca il link della piattaforma) → si mostrano i link ufficiali
 * configurati senza sceglierne uno. `disabled`: nessun link configurato.
 */
export type CtaTarget =
  | { href: string; kind: "link" }
  | { kind: "stores"; links: StoreLink[] }
  | { kind: "disabled"; reason: string };

export type LandingCta = { label: string; target: CtaTarget };

export type LandingLinksContext = {
  androidStoreUrl?: string | null;
  discoverUrl?: string | null;
  iosStoreUrl?: string | null;
  platform: LandingPlatform;
  webOrigin: string;
};

export type LandingContext = LandingLinksContext & {
  appScheme: string;
  /** URL già firmato (o immagine inline in anteprima); `null` = senza immagine. */
  flyerUrl?: string | null;
};

export const LANDING_COPY = {
  appRequired: "L’iscrizione si completa nell’app PROLINK.",
  brand: "PROLINK",
  discover: "Scopri PROLINK",
  downloadAndRegister: "Scarica PROLINK e iscriviti",
  downloadAndRequest: "Scarica PROLINK e richiedi",
  downloadUnavailable: "Il download di PROLINK non è ancora disponibile.",
  installHint: "Dopo l’installazione, riapri questo link per tornare all’evento.",
  loadError: "Impossibile caricare l’evento. Riprova.",
  manualConfirmation: "La Società conferma ogni partecipazione.",
  openInApp: "Apri nell’app",
  retry: "Riprova",
  unavailableText: "Questo contenuto non è disponibile.",
  unavailableTitle: "Contenuto non disponibile",
} as const;

export type NoticeIcon = "warning" | "people" | "lock" | "alert" | "flag";

export type LandingNotice = { icon: NoticeIcon; text: string; title: string };

/** §12: card di stato per ogni `public_state` che non è «aperto». */
const NOTICES: Partial<Record<PublicState, LandingNotice>> = {
  cancelled: {
    icon: "alert",
    text: "Questo evento non è più disponibile per la partecipazione.",
    title: "Evento annullato",
  },
  closed: {
    icon: "lock",
    text: "Il termine per inviare nuove richieste è trascorso.",
    title: "Iscrizioni chiuse",
  },
  completed: {
    icon: "flag",
    text: "Le iscrizioni a questo evento sono terminate.",
    title: "Evento concluso",
  },
  full: {
    icon: "people",
    text: "L’evento ha raggiunto il numero massimo di partecipanti.",
    title: "Posti esauriti",
  },
  open_full_manual: {
    icon: "warning",
    text: "Puoi inviare una richiesta. La partecipazione richiede un posto libero e la conferma della Società.",
    title: "Posti esauriti",
  },
};

function storeLinks(ctx: LandingLinksContext): StoreLink[] {
  const ios = safeHttpUrl(ctx.iosStoreUrl);
  const android = safeHttpUrl(ctx.androidStoreUrl);

  return [
    ...(ios ? [{ href: ios, label: "App Store", store: "ios" as const }] : []),
    ...(android ? [{ href: android, label: "Google Play", store: "android" as const }] : []),
  ];
}

/** Lo store della piattaforma rilevata, se configurato; altrimenti i link ufficiali. */
export function downloadTarget(ctx: LandingLinksContext): CtaTarget {
  const links = storeLinks(ctx);
  const own = links.find((link) => link.store === ctx.platform);

  if (own) {
    return { href: own.href, kind: "link" };
  }

  return links.length
    ? { kind: "stores", links }
    : { kind: "disabled", reason: LANDING_COPY.downloadUnavailable };
}

/** «Scopri PROLINK»: la pagina di presentazione se esiste, sennò lo store. */
export function discoverTarget(ctx: LandingLinksContext): CtaTarget {
  const discover = safeHttpUrl(ctx.discoverUrl);
  return discover ? { href: discover, kind: "link" } : downloadTarget(ctx);
}

/** I link ufficiali da proporre se «Apri nell’app» non apre nulla. */
export function fallbackStoreLinks(ctx: LandingLinksContext): StoreLink[] {
  const links = storeLinks(ctx);
  const own = links.filter((link) => link.store === ctx.platform);
  return own.length ? own : links;
}

/* ── Vista ───────────────────────────────────────────────────────────── */

export type LandingView = {
  birthYears: string | null;
  canonicalUrl: string;
  club: { initial: string; isVerified: boolean; logoUrl: string | null; name: string };
  deadline: string | null;
  description: string | null;
  documentTitle: string;
  flyer: { alt: string; height: number; url: string; width: number } | null;
  footnote: string | null;
  /** Copy statica accanto al download (§24: niente redirect automatici). */
  installHint: string | null;
  manualNote: string | null;
  notice: LandingNotice | null;
  og: { description: string; image: string | null; title: string; url: string };
  /** `null` se la matrice non prevede «Apri nell’app» per questo stato. */
  openInApp: { fallbackLinks: StoreLink[]; href: string; label: string } | null;
  participants: string | null;
  primary: LandingCta;
  publicId: string;
  requirements: string | null;
  subtitle: string;
  title: string;
  venue: { address: string | null; name: string | null } | null;
  when: { date: string; time: string | null } | null;
};

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

export function canonicalEventUrl(webOrigin: string, publicId: string): string {
  return `${trimOrigin(webOrigin)}/event/${publicId}`;
}

/** «2008 – 2009», o un anno solo quando coincidono (§12). */
export function birthYearsLabel(from: number | null, to: number | null): string | null {
  if (from === null && to === null) {
    return null;
  }

  if (from === null || to === null || from === to) {
    return String(from ?? to);
  }

  return `${Math.min(from, to)} – ${Math.max(from, to)}`;
}

/** «15:00 – 18:00», o solo l'inizio; la fine è facoltativa. */
export function timeRangeLabel(start: string | null, end: string | null): string | null {
  const from = formatTime(start);
  const to = formatTime(end);

  if (!from) {
    return null;
  }

  return to ? `${from} – ${to}` : from;
}

/** «32 / 50 partecipanti confermati»: solo con un limite, mai «illimitati». */
export function participantsLabel(event: Pick<PublicEvent, "confirmedCount" | "maxParticipants">): string | null {
  return event.maxParticipants !== null && event.confirmedCount !== null
    ? `${event.confirmedCount} / ${event.maxParticipants} partecipanti confermati`
    : null;
}

/** «Iscrizioni entro 28 settembre · 23:59»: solo con termine esplicito e iscrizioni aperte. */
export function deadlineLabel(event: PublicEvent): string | null {
  if (!event.availability.hasExplicitDeadline || !event.availability.registrationOpen) {
    return null;
  }

  const startYear = event.startDate ? Number(event.startDate.slice(0, 4)) : undefined;
  const date = formatCivilDate(event.registrationDeadlineDate, { currentYear: startYear });

  if (!date) {
    return null;
  }

  const time = formatTime(event.registrationDeadlineTime);
  return `Iscrizioni entro ${time ? `${date} · ${time}` : date}`;
}

function displayTitle(event: PublicEvent): string {
  return event.title || "Evento senza titolo";
}

/**
 * Matrice §11–§12: blocchi e CTA per stato. Funzione pura; il chiamante
 * passa la piattaforma, i link configurati e l'URL del flyer già firmato.
 */
export function landingView(event: PublicEvent, ctx: LandingContext): LandingView {
  const title = displayTitle(event);
  const subtitle = eventContextLine({ eventType: event.eventType, teamName: event.teamName ?? "" });
  const date = formatCivilDate(event.startDate, { withYear: true });
  const time = timeRangeLabel(event.startTime, event.endTime);
  const flyerUrl = event.flyer ? safeImageUrl(ctx.flyerUrl) : null;
  const canonicalUrl = canonicalEventUrl(ctx.webOrigin, event.publicId);
  const state = event.availability.publicState;
  const canRequest = state === "open" || state === "open_full_manual";

  const primary: LandingCta =
    state === "open"
      ? { label: LANDING_COPY.downloadAndRegister, target: downloadTarget(ctx) }
      : state === "open_full_manual"
        ? { label: LANDING_COPY.downloadAndRequest, target: downloadTarget(ctx) }
        : { label: LANDING_COPY.discover, target: discoverTarget(ctx) };

  const ogImage =
    (flyerUrl && safeHttpUrl(flyerUrl)) || event.club.logoUrl || null;

  return {
    birthYears: birthYearsLabel(event.birthYearFrom, event.birthYearTo),
    canonicalUrl,
    club: {
      initial: (event.club.name.trim()[0] ?? "?").toLocaleUpperCase("it-IT"),
      isVerified: event.club.isVerified,
      logoUrl: event.club.logoUrl,
      name: event.club.name,
    },
    deadline: canRequest ? deadlineLabel(event) : null,
    description: event.description,
    documentTitle: [title, event.club.name].filter(Boolean).join(" · ") + ` – ${LANDING_COPY.brand}`,
    flyer:
      event.flyer && flyerUrl
        ? {
            alt: `Locandina dell’evento ${title}`,
            height: event.flyer.height,
            url: flyerUrl,
            width: event.flyer.width,
          }
        : null,
    footnote: state === "open" ? LANDING_COPY.appRequired : null,
    installHint: canRequest && primary.target.kind !== "disabled" ? LANDING_COPY.installHint : null,
    manualNote: state === "open" && event.confirmationMode === "manual" ? LANDING_COPY.manualConfirmation : null,
    notice: NOTICES[state] ?? null,
    og: {
      /* §24: solo dati pubblici — data, squadra, luogo. */
      description: [date, event.teamName, event.venueName].filter(Boolean).join(" · "),
      image: ogImage,
      title: [title, event.club.name].filter(Boolean).join(" · "),
      url: canonicalUrl,
    },
    openInApp: canRequest
      ? {
          fallbackLinks: fallbackStoreLinks(ctx),
          href: `${ctx.appScheme}://event/${event.publicId}`,
          label: LANDING_COPY.openInApp,
        }
      : null,
    participants: participantsLabel(event),
    primary,
    publicId: event.publicId,
    requirements: event.requirementsInfo,
    subtitle,
    title,
    venue:
      event.venueName || event.venueAddress
        ? { address: event.venueAddress, name: event.venueName }
        : null,
    when: date ? { date, time } : null,
  };
}

/**
 * §24: la pagina resta in cache al massimo 60 s e mai oltre il prossimo
 * confine della matrice (scadenza, inizio, fine). Il «adesso» è quello del
 * server che ha calcolato lo stato, non l'orologio dell'host.
 */
export function cacheMaxAgeSeconds(event: PublicEvent, fallbackNowMs: number): number {
  const next = event.availability.nextTransitionAt;

  if (!next) {
    return 60;
  }

  const now = event.serverNow ? Date.parse(event.serverNow) : fallbackNowMs;
  const seconds = Math.floor((Date.parse(next) - now) / 1000);

  return Math.max(0, Math.min(60, seconds));
}

export function detectPlatform(userAgent: string | null | undefined): LandingPlatform {
  const ua = userAgent ?? "";

  if (/Android/i.test(ua)) {
    return "android";
  }

  /* iPadOS si presenta come «Macintosh»: resta ambiguo, quindi «other». */
  return /\b(iPhone|iPad|iPod)\b/.test(ua) ? "ios" : "other";
}
