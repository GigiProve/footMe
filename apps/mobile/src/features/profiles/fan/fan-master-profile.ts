/**
 * Modello del Master Profile Tifoso (REV-PROF-19).
 *
 * Qui vivono le tre decisioni che il rendering non deve prendere da solo:
 *
 *   • come si chiama pubblicamente questo ruolo — "Tifoso", sempre, qualunque
 *     sia l'identificativo tecnico persistito;
 *   • che cosa può fare chi sta guardando — capabilities esplicite, derivate
 *     dall'identità autenticata e dai permessi, mai dal fatto che il profilo
 *     sia stato aperto dalla voce Profilo della bottom navigation;
 *   • in quale tab finisce un contenuto — una regola di lettura sul tipo
 *     reale del record, non una copia del contenuto per tab.
 */
import {
  FAN_FOOTBALL_TYPE_OPTIONS,
  type FanFootballType,
} from "../../onboarding/community/fan-taxonomy";
import { INTEREST_CATEGORY_OPTIONS } from "../player-sports";

/**
 * Etichetta pubblica e localizzata del ruolo. "Appassionato" e "Appassionato
 * calcio dilettantistico" non esistono più come testo mostrato all'utente.
 */
export const FAN_ROLE_LABEL = "Tifoso";

/**
 * Identificativi tecnici storici che indicano lo stesso ruolo. L'enum del
 * database resta `fan`: non viene migrato solo per allinearlo alla label,
 * perché autenticazione, ricerca, analytics e permessi ci si appoggiano. Gli
 * altri valori sono difensivi, per payload provenienti da client o dati più
 * vecchi dell'enum attuale.
 */
const FAN_ROLE_IDS = new Set(["fan", "supporter", "enthusiast"]);

/** `true` quando l'identificativo tecnico indica il ruolo Tifoso. */
export function isFanRoleId(role: string | null | undefined): boolean {
  return typeof role === "string" && FAN_ROLE_IDS.has(role.trim().toLowerCase());
}

/**
 * Mapping identificativo tecnico → label pubblica. Restituisce `null` per i
 * ruoli che non sono il Tifoso, così il chiamante non finisce per etichettare
 * "Tifoso" un Media/Creator.
 */
export function formatFanRoleLabel(
  role: string | null | undefined,
): string | null {
  return isFanRoleId(role) ? FAN_ROLE_LABEL : null;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Che cosa può fare il viewer su questo profilo. Nascondere una CTA nel client
 * non sostituisce il controllo server-side: queste capabilities decidono che
 * cosa disegnare, i permessi veri restano nelle policy e nelle RPC.
 */
export type FanProfileCapabilities = {
  canBlockOrReport: boolean;
  canCreateContent: boolean;
  canEditProfile: boolean;
  canFollow: boolean;
  canMessage: boolean;
  /** Rimuovere o modificare un proprio contenuto dalla superficie profilo. */
  canModerateOwnContent: boolean;
  canShare: boolean;
};

export type FanCapabilityInput = {
  /** Account sospeso o altrimenti impossibilitato a pubblicare. */
  canPublish?: boolean;
  /** L'identità autenticata coincide con il profilo mostrato. */
  isOwner: boolean;
  /** Il viewer è autenticato: un ospite non segue e non messaggia. */
  isViewerAuthenticated?: boolean;
  /** Blocco in una delle due direzioni: nessuna azione sociale. */
  isBlocked?: boolean;
};

export function buildFanCapabilities({
  canPublish = true,
  isBlocked = false,
  isOwner,
  isViewerAuthenticated = true,
}: FanCapabilityInput): FanProfileCapabilities {
  const canActSocially = !isOwner && isViewerAuthenticated && !isBlocked;

  return {
    canBlockOrReport: canActSocially,
    canCreateContent: isOwner && canPublish,
    canEditProfile: isOwner,
    canFollow: canActSocially,
    canMessage: canActSocially,
    canModerateOwnContent: isOwner,
    canShare: true,
  };
}

// ---------------------------------------------------------------------------
// Mapping contenuto → tab
// ---------------------------------------------------------------------------

/**
 * Tipi che la Tribuna mostra. `proposal` è un content type già approvato per
 * il Tifoso e non più creabile: resta leggibile qui, che è la sua famiglia —
 * un contributo editoriale, non una foto — invece di sparire da ogni tab.
 */
const TRIBUNA_KINDS: ReadonlySet<string> = new Set([
  "opinion",
  "poll",
  "formation",
  "proposal",
]);

/** Tipi che la tab Media mostra. Foto e video, nient'altro. */
const MEDIA_KINDS: ReadonlySet<string> = new Set(["photo"]);

export function isFanTribunaKind(kind: string | null | undefined): boolean {
  return typeof kind === "string" && TRIBUNA_KINDS.has(kind);
}

export function isFanMediaKind(kind: string | null | undefined): boolean {
  return typeof kind === "string" && MEDIA_KINDS.has(kind);
}

/**
 * Dedup per id di contenuto. Pagine successive possono riconsegnare la coda
 * della pagina precedente quando qualcosa viene pubblicato durante lo scroll:
 * il record non va mostrato due volte, e non va nemmeno riscritto.
 */
export function dedupeFanContentById<T extends { id: string }>(
  items: readonly T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (!item?.id || seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    result.push(item);
  }

  return result;
}

/**
 * Ordinamento della Tribuna: dalla pubblicazione più recente alla meno
 * recente, sulla data canonica di pubblicazione. `created_at` interviene solo
 * quando la pubblicazione non ha una data, non per riordinare le modifiche.
 */
export function sortFanTribunaPosts<
  T extends { created_at: string; id: string; published_at: string | null },
>(posts: readonly T[]): T[] {
  return [...posts].sort((left, right) => {
    const byDate = (right.published_at ?? right.created_at).localeCompare(
      left.published_at ?? left.created_at,
    );

    return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
  });
}

// ---------------------------------------------------------------------------
// Tassonomie pubbliche della tab Info
// ---------------------------------------------------------------------------

const FOOTBALL_TYPE_LABELS = new Map<string, string>(
  FAN_FOOTBALL_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const FOOTBALL_TYPE_ORDER = FAN_FOOTBALL_TYPE_OPTIONS.map(
  (option) => option.value as string,
);

const CATEGORY_ORDER = INTEREST_CATEGORY_OPTIONS.map((option) => option.value);

const CATEGORY_LABELS = new Map<string, string>(
  INTEREST_CATEGORY_OPTIONS.map((option) => [
    option.value.toLowerCase(),
    option.label,
  ]),
);

export type FanInterestChip = {
  key: string;
  label: string;
};

/**
 * Interessi calcistici: ID canonici in ingresso, label localizzate in uscita,
 * nell'ordine ufficiale della tassonomia. Un valore che non appartiene più
 * alla tassonomia viene scartato: il profilo non deve mostrare
 * `professional` né un token orfano.
 */
export function buildFanInterestChips(
  values: readonly string[] | null | undefined,
): FanInterestChip[] {
  if (!values || values.length === 0) {
    return [];
  }

  const selected = new Set(
    values
      .filter((value): value is FanFootballType | string => typeof value === "string")
      .map((value) => value.trim()),
  );

  return FOOTBALL_TYPE_ORDER.filter((value) => selected.has(value)).map(
    (value) => ({
      key: value,
      label: FOOTBALL_TYPE_LABELS.get(value) ?? value,
    }),
  );
}

/**
 * Categorie seguite: normalizzate sul vocabolario sportivo condiviso, in
 * ordine di livello e senza duplicati. Un valore legacy che non corrisponde a
 * nessuna categorie nota viene preservato con la sua grafia — scartarlo
 * renderebbe silenziosamente invisibile un dato che l'utente ha scelto — e
 * finisce in coda, dopo le categorie riconosciute.
 */
export function buildFanCategoryChips(
  values: readonly string[] | null | undefined,
): FanInterestChip[] {
  if (!values || values.length === 0) {
    return [];
  }

  const known = new Map<string, string>();
  const unknown: string[] = [];
  const seenUnknown = new Set<string>();

  for (const raw of values) {
    const trimmed = typeof raw === "string" ? raw.trim() : "";

    if (!trimmed) {
      continue;
    }

    const canonical = CATEGORY_LABELS.get(trimmed.toLowerCase());

    if (canonical) {
      known.set(canonical, canonical);
      continue;
    }

    const dedupeKey = trimmed.toLowerCase();

    if (!seenUnknown.has(dedupeKey)) {
      seenUnknown.add(dedupeKey);
      unknown.push(trimmed);
    }
  }

  return [
    ...CATEGORY_ORDER.filter((category) => known.has(category)).map(
      (category) => ({ key: category, label: category }),
    ),
    ...unknown.map((label) => ({ key: `legacy:${label}`, label })),
  ];
}
