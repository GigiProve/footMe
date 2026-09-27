/**
 * Vocabolario del ramo Media / Creator (REV-ONB-09 §11–§20, §29, §30).
 *
 * Il sotto-profilo si qualifica con poche informazioni davvero utili: che
 * realtà rappresenta, che contenuti produce, che calcio racconta. La
 * tipologia è l'unico dato che deve restare strutturato (§13): contenuti e
 * ambiti continuano a viaggiare come etichette, perché è così che il profilo
 * Media li mostra e che i profili già registrati li hanno salvati (§30).
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

// ---------------------------------------------------------------------------
// Tipologia Media / Creator (§11–§14)
// ---------------------------------------------------------------------------

export type MediaCreatorType =
  | "social_page"
  | "news_outlet"
  | "editorial_project"
  | "independent_creator"
  | "podcast_format"
  | "other";

export type MediaCreatorTypeOption = {
  value: MediaCreatorType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/**
 * §11: card verticali leggere, icona piccola e secondaria rispetto al nome.
 * La microcopy esiste per distinguere una testata registrata da una pagina
 * social, non per decorare.
 */
export const MEDIA_CREATOR_TYPE_OPTIONS: MediaCreatorTypeOption[] = [
  {
    description: "Pagina Instagram, TikTok o social dedicata al calcio.",
    icon: "phone-portrait-outline",
    label: "Pagina social",
    value: "social_page",
  },
  {
    description:
      "Testata sportiva nazionale o locale che pubblica contenuti sul calcio.",
    icon: "newspaper-outline",
    label: "Testata giornalistica",
    value: "news_outlet",
  },
  {
    description: "Portale o progetto indipendente strutturato dedicato al calcio.",
    icon: "globe-outline",
    label: "Progetto editoriale",
    value: "editorial_project",
  },
  {
    description: "Crei contenuti con il tuo nome o con un brand personale.",
    icon: "person-outline",
    label: "Creator indipendente",
    value: "independent_creator",
  },
  {
    description: "Podcast, format YouTube, trasmissione o progetto seriale.",
    icon: "mic-outline",
    label: "Podcast / format",
    value: "podcast_format",
  },
  {
    description: "Per realtà che non rientrano nelle categorie precedenti.",
    icon: "ellipsis-horizontal-outline",
    label: "Altro",
    value: "other",
  },
];

const MEDIA_CREATOR_TYPE_VALUES = new Set<string>(
  MEDIA_CREATOR_TYPE_OPTIONS.map((option) => option.value),
);

export function isMediaCreatorType(value: unknown): value is MediaCreatorType {
  return typeof value === "string" && MEDIA_CREATOR_TYPE_VALUES.has(value);
}

/**
 * §30: i profili nati prima di REV-ONB-09 hanno solo `editorial_type` /
 * `affiliation_type`, testo libero. Una bozza che li contiene rientra sulla
 * categoria strutturata equivalente invece di ripartire da vuota.
 */
export function coerceMediaCreatorType(
  value: unknown,
): MediaCreatorType | "" {
  if (isMediaCreatorType(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (normalized.includes("testata") || normalized.includes("giornal")) {
    return "news_outlet";
  }

  if (normalized.includes("podcast") || normalized.includes("format")) {
    return "podcast_format";
  }

  if (normalized.includes("creator") || normalized.includes("influencer")) {
    return "independent_creator";
  }

  if (normalized.includes("progetto") || normalized.includes("portale")) {
    return "editorial_project";
  }

  if (normalized.includes("pagina") || normalized.includes("social")) {
    return "social_page";
  }

  return "";
}

export function formatMediaCreatorType(
  value: MediaCreatorType | "" | null | undefined,
): string {
  return (
    MEDIA_CREATOR_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
    ""
  );
}

/**
 * CER-05 / HOME-01 leggono `media_profiles.media_kind` con un vocabolario più
 * corto (testata | giornalista | creator | pagina | ufficiale). La mappa vive
 * anche nel DB, come trigger: qui serve a non far viaggiare un valore
 * incoerente dal client.
 */
export function mediaKindFromCreatorType(value: MediaCreatorType | ""): string {
  switch (value) {
    case "news_outlet":
      return "testata";
    case "editorial_project":
      return "testata";
    case "independent_creator":
      return "creator";
    case "podcast_format":
      return "creator";
    case "social_page":
      return "pagina";
    default:
      return "pagina";
  }
}

// ---------------------------------------------------------------------------
// Tipi di contenuti (§17, §18)
// ---------------------------------------------------------------------------

export const MEDIA_CONTENT_TYPE_OPTIONS = [
  "Notizie",
  "Partite e risultati",
  "Highlights",
  "Analisi",
  "Interviste",
  "Osservazione giocatori",
  "Contenuti social",
  "Foto",
  "Video",
  "Altro",
] as const;

// ---------------------------------------------------------------------------
// Ambito calcistico (§19, §20)
// ---------------------------------------------------------------------------

/**
 * §19: multi-selezione. Un progetto può raccontare contemporaneamente il
 * calcio dilettantistico, quello giovanile e il calciomercato — non esiste un
 * settore unico da dichiarare.
 */
export const MEDIA_SCOPE_OPTIONS = [
  "Calcio locale",
  "Calcio dilettantistico",
  "Calcio giovanile",
  "Calcio professionistico",
  "Calciomercato",
  "Calcio generale",
] as const;

/**
 * §30: le etichette precedenti coprivano gli stessi ambiti con altri nomi.
 * Una bozza salvata con il vecchio vocabolario rientra sulla voce corrente
 * invece di perdere la selezione.
 */
const LEGACY_MEDIA_SCOPES: Record<string, string> = {
  Giovanile: "Calcio giovanile",
  Mercato: "Calciomercato",
  Professionistico: "Calcio professionistico",
  "Settore giovanile": "Calcio giovanile",
};

export function normalizeMediaScopes(
  values: readonly string[] | null | undefined,
): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  const known = new Set<string>(MEDIA_SCOPE_OPTIONS);
  const result: string[] = [];

  for (const value of values) {
    const mapped = LEGACY_MEDIA_SCOPES[value] ?? value;

    if (known.has(mapped) && !result.includes(mapped)) {
      result.push(mapped);
    }
  }

  return result;
}

export function normalizeMediaContentTypes(
  values: readonly string[] | null | undefined,
): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  const known = new Set<string>(MEDIA_CONTENT_TYPE_OPTIONS);

  return values.filter(
    (value, index) => known.has(value) && values.indexOf(value) === index,
  );
}

/** Le opzioni chip del Master vogliono `{ label, value }`. */
export function toChipOptions<T extends string>(
  values: readonly T[],
): { label: T; value: T }[] {
  return values.map((value) => ({ label: value, value }));
}
