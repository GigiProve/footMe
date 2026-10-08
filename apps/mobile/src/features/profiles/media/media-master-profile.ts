/**
 * Modello del Master Profile Media/Creator (REV-PROF-21).
 *
 * Qui vivono le decisioni che il rendering non deve prendere da solo:
 *
 *   • che cosa può fare chi sta guardando — capabilities che arrivano dal
 *     backend e vengono solo normalizzate qui, mai dedotte dal fatto che il
 *     profilo sia stato aperto dalla voce Profilo della bottom navigation;
 *   • come si compone il descrittore editoriale, a partire dalla tassonomia
 *     canonica di REV-ONB-09 e non da un'etichetta fissa;
 *   • in quale tab finisce un contenuto — una regola di lettura sul `kind`
 *     reale del record, non una copia del contenuto per tab;
 *   • quando un URL esterno è apribile.
 *
 * Nessuna di queste funzioni conosce il proprietario del profilo: il Master
 * Profile rappresenta la realtà editoriale, e il nome, la residenza o
 * l'avatar di chi la amministra non sono un fallback pubblico.
 */
import {
  formatMediaCreatorType,
  isMediaCreatorType,
  type MediaCreatorType,
} from "../../onboarding/community/media-taxonomy";

/** Le quattro tab, in quest'ordine. Articoli è sempre la prima. */
export type MediaProfileTab = "articles" | "tribuna" | "media" | "info";

export const MEDIA_PROFILE_TABS: readonly MediaProfileTab[] = [
  "articles",
  "tribuna",
  "media",
  "info",
];

export const MEDIA_PROFILE_INITIAL_TAB: MediaProfileTab = "articles";

/** Tab valida o niente: un valore sconosciuto non apre una tab inesistente. */
export function parseMediaProfileTab(
  value: string | undefined,
): MediaProfileTab | undefined {
  return MEDIA_PROFILE_TABS.includes(value as MediaProfileTab)
    ? (value as MediaProfileTab)
    : undefined;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Che cosa può fare il viewer su questa realtà editoriale. I valori arrivano
 * da `fetch_public_media_profile`: nascondere una CTA nel client non sostituisce
 * il controllo server-side, e queste capabilities decidono soltanto che cosa
 * disegnare.
 */
export type MediaProfileCapabilities = {
  canAddMedia: boolean;
  canBlock: boolean;
  canCreateTribunaContent: boolean;
  canEditProfile: boolean;
  canFollow: boolean;
  canManageTribunaContent: boolean;
  canMessage: boolean;
  canPublishArticle: boolean;
  canReport: boolean;
  canShare: boolean;
  canViewWebsite: boolean;
};

/**
 * Capabilities di chi non ha ancora ricevuto risposta dal backend, o la cui
 * richiesta è fallita: nessuna azione. Una CTA che compare prima dei permessi
 * e scompare dopo è peggio di una CTA che arriva un istante più tardi.
 */
export const MEDIA_PROFILE_NO_CAPABILITIES: MediaProfileCapabilities = {
  canAddMedia: false,
  canBlock: false,
  canCreateTribunaContent: false,
  canEditProfile: false,
  canFollow: false,
  canManageTribunaContent: false,
  canMessage: false,
  canPublishArticle: false,
  canReport: false,
  canShare: true,
  canViewWebsite: false,
};

type RawCapabilities = Record<string, unknown>;

/**
 * Normalizzazione del blocco `viewer` della RPC. Tutto ciò che non è
 * esplicitamente `true` vale `false`: un permesso assente non è un permesso
 * concesso.
 */
export function normalizeMediaCapabilities(
  raw: RawCapabilities | null | undefined,
): MediaProfileCapabilities {
  if (!raw) {
    return MEDIA_PROFILE_NO_CAPABILITIES;
  }

  const flag = (key: string) => raw[key] === true;

  return {
    canAddMedia: flag("can_add_media"),
    canBlock: flag("can_block"),
    canCreateTribunaContent: flag("can_create_tribuna_content"),
    canEditProfile: flag("can_edit_profile"),
    canFollow: flag("can_follow"),
    canManageTribunaContent: flag("can_manage_tribuna_content"),
    canMessage: flag("can_message"),
    canPublishArticle: flag("can_publish_article"),
    canReport: flag("can_report"),
    canShare: raw.can_share !== false,
    canViewWebsite: flag("can_view_website"),
  };
}

// ---------------------------------------------------------------------------
// Identità editoriale
// ---------------------------------------------------------------------------

/**
 * Prima metà del descrittore: la tipologia strutturata di REV-ONB-09.
 * "Altro" porta il testo scritto dall'utente; i profili anteriori alla task
 * non hanno `creator_type` e ricadono sul testo libero storico, che non viene
 * reinterpretato — se non dice niente di utile, il descrittore resta vuoto
 * invece di inventare "Testata giornalistica".
 */
export function formatMediaEntityType(entity: {
  affiliationType?: string | null;
  creatorType?: string | null;
  creatorTypeOther?: string | null;
  editorialType?: string | null;
}): string | null {
  if (entity.creatorType === "other") {
    return normalizeLabel(entity.creatorTypeOther);
  }

  if (isMediaCreatorType(entity.creatorType)) {
    return (
      formatMediaCreatorType(entity.creatorType as MediaCreatorType) || null
    );
  }

  return (
    normalizeLabel(entity.editorialType) ??
    normalizeLabel(entity.affiliationType)
  );
}

/**
 * Seconda metà del descrittore, mostrata solo quando esiste un attributo
 * canonico equivalente e distinto dal primo. L'ambito calcistico principale
 * è quello: "Testata giornalistica · Calcio dilettantistico". Niente
 * "Media sportivo" fisso per tutte le realtà.
 */
export function formatMediaEntityQualifier(
  entity: { focusAreas?: readonly string[] | null },
  typeLabel: string | null,
): string | null {
  const first = normalizeLabel(entity.focusAreas?.[0]);

  if (!first || !typeLabel) {
    return first;
  }

  return first.toLowerCase() === typeLabel.toLowerCase() ? null : first;
}

/**
 * Riepilogo pubblico delle aree editoriali: "Lombardia · Piemonte · Liguria".
 * Sono i territori dichiarati dalla realtà, non la residenza di chi la
 * amministra — per quello non esiste nessun fallback qui dentro.
 */
export function formatMediaCoverageAreas(
  territories: readonly string[] | null | undefined,
): string | null {
  const unique = normalizeUniqueLabels(territories);

  return unique.length > 0 ? unique.join(" · ") : null;
}

/** REV-PROF-22: etichetta della copertura nazionale, in un posto solo. */
export const MEDIA_COVERAGE_ALL_ITALY_LABEL = "Tutta Italia";

export type MediaCoverageScope = "ITALY" | "REGIONS" | "PROVINCES";

/**
 * Aree effettivamente coperte, risolte dalla modalità (REV-PROF-22, Screen 6).
 *
 * Le due liste non vengono mai fuse: la modalità dice quale delle due è
 * quella attiva, e l'altra resta nel database senza comparire da nessuna
 * parte. "Tutta Italia" non è una lista vuota — è una dichiarazione, e si
 * legge come tale.
 *
 * Una realtà che non ha ancora scelto una modalità ricade sui territori
 * storici: erano già pubblici prima di questa task, e non diventano
 * "Tutta Italia" per effetto di una colonna nuova.
 */
export function resolveMediaCoverageAreas(entity: {
  coverageScope?: MediaCoverageScope | null;
  coveredProvinces?: readonly string[] | null;
  coveredTerritories?: readonly string[] | null;
}): string[] {
  if (entity.coverageScope === "ITALY") {
    return [MEDIA_COVERAGE_ALL_ITALY_LABEL];
  }

  return normalizeUniqueLabels(
    entity.coverageScope === "PROVINCES"
      ? entity.coveredProvinces
      : entity.coveredTerritories,
  );
}

/**
 * Nome pubblico della realtà. Assente, resta assente: il nome e cognome del
 * proprietario non sono un nome editoriale e non lo diventano per riempire
 * un header.
 */
export function formatMediaEntityName(
  entityName: string | null | undefined,
): string | null {
  return normalizeLabel(entityName);
}

/** Monogramma per il logo mancante: due lettere dalle prime due parole. */
export function buildMediaEntityInitials(name: string | null): string {
  const words = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return "·";
  }

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

// ---------------------------------------------------------------------------
// Tassonomie della tab Info
// ---------------------------------------------------------------------------

export type MediaInfoChip = {
  key: string;
  label: string;
};

/**
 * Ambiti calcistici, tipi di contenuto e territori restano tre elenchi
 * distinti: la task vieta esplicitamente di confonderli, e la vecchia riga
 * unica che li concatenava tutti — "Calcio locale • Notizie • Lombardia" —
 * non esiste più.
 */
export function buildMediaInfoChips(
  values: readonly string[] | null | undefined,
): MediaInfoChip[] {
  return normalizeUniqueLabels(values).map((label, index) => ({
    key: `${index}-${label}`,
    label,
  }));
}

/**
 * Copertura editoriale "estesa": competizioni, squadre e temi seguiti sono
 * attributi dichiarati nell'onboarding storico e restano pubblicabili, ma
 * sotto la loro sezione e non fusi con gli ambiti.
 */
export function buildMediaCoverageTopics(entity: {
  coveredCompetitions?: readonly string[] | null;
  coveredTeams?: readonly string[] | null;
  coveredTopics?: readonly string[] | null;
}): MediaInfoChip[] {
  return buildMediaInfoChips([
    ...(entity.coveredCompetitions ?? []),
    ...(entity.coveredTeams ?? []),
    ...(entity.coveredTopics ?? []),
  ]);
}

// ---------------------------------------------------------------------------
// URL esterni
// ---------------------------------------------------------------------------

const HTTP_SCHEME_PATTERN = /^https?:\/\//i;
/**
 * Host con almeno un punto e un TLD alfabetico: `redazione` non è un
 * dominio, e promuoverlo a `https://redazione` produrrebbe un link che non
 * porta da nessuna parte.
 */
const SAFE_HOST_PATTERN = /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?::\d{1,5})?$/;

/**
 * Forma apribile di un URL pubblico, oppure `null`.
 *
 * Accetta un dominio senza protocollo, perché è così che l'onboarding lo fa
 * scrivere, e lo promuove a `https`. Rifiuta tutto il resto — `javascript:`,
 * `data:`, `file:`, schemi custom — senza provare a correggerlo: un URL che
 * non si capisce non si apre.
 */
export function normalizeExternalUrl(
  value: string | null | undefined,
): string | null {
  const trimmed = normalizeLabel(value);

  if (!trimmed) {
    return null;
  }

  // Uno schema già presente deve essere http(s). `javascript:alert(1)` non
  // diventa `https://javascript:alert(1)`: viene scartato.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);

  if (hasScheme && !HTTP_SCHEME_PATTERN.test(trimmed)) {
    return null;
  }

  const candidate = hasScheme
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;

  if (/\s/.test(candidate)) {
    return null;
  }

  const host = candidate.replace(HTTP_SCHEME_PATTERN, "").split(/[/?#]/)[0];

  return host && SAFE_HOST_PATTERN.test(host) ? candidate : null;
}

/** Dominio leggibile di una fonte esterna: "dominio.it", senza `www.`. */
export function formatExternalDomain(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeExternalUrl(value);

  if (!normalized) {
    return null;
  }

  const host = normalized
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/)[0]
    ?.replace(/^www\./i, "");

  return host ? host.toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------

function normalizeLabel(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/** Deduplica preservando l'ordine scelto dall'utente. */
function normalizeUniqueLabels(
  values: readonly string[] | null | undefined,
): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const label = normalizeLabel(value);

    if (!label) {
      continue;
    }

    const key = label.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(label);
  }

  return result;
}

/**
 * Dedup per id di contenuto. Pagine successive possono riconsegnare la coda
 * della pagina precedente quando qualcosa viene pubblicato durante lo scroll:
 * la lista non deve mostrare due volte la stessa card.
 */
export function dedupeMediaContentById<T extends { id: string }>(
  items: readonly T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    result.push(item);
  }

  return result;
}
