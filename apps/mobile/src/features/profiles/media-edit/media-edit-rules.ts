/**
 * Regole della Modifica profilo Media/Creator (REV-PROF-22).
 *
 * Funzioni pure, nessuna query e nessun componente: qui vivono le decisioni
 * che devono dare lo stesso risultato nell'hub, nei moduli e nei test —
 * quante cose sono selezionate, che cosa è pubblicabile, che cosa è
 * valido.
 *
 * Tre confini che la task dichiara non negoziabili e che quindi sono
 * strutturali qui dentro:
 *
 *  - **Copertura**, **Tipi di contenuto** e **Aree coperte** sono tre domini
 *    distinti. Tre tassonomie, tre normalizzatori, tre colonne: non esiste
 *    una funzione che li fonda e non esiste una stringa concatenata che li
 *    rappresenti tutti.
 *  - Un **canale senza un valore valido non può essere pubblico**. La
 *    visibilità non è un dato indipendente: è una proprietà di un valore che
 *    esiste, e `normalizeMediaChannelValue` è l'unico giudice.
 *  - I **tipi di contenuto sono dichiarativi**. Selezionare "Podcast" o
 *    "Notizie" non accende nessuna capability: `can_publish_article` e
 *    compagni restano al permission domain di HOM-06.2, che questo file non
 *    conosce e non può toccare.
 *
 * I valori del mockup — TuttoDilettanti, Lombardia, i conteggi — non
 * compaiono da nessuna parte: sono esempi visuali.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

import {
  validateMediaChannel,
  type MediaChannelKey,
} from "../../onboarding/community/media-channels";
import {
  MEDIA_CONTENT_TYPE_OPTIONS,
  MEDIA_SCOPE_OPTIONS,
  isMediaCreatorType,
  type MediaCreatorType,
} from "../../onboarding/community/media-taxonomy";
import { MEDIA_PROJECT_DESCRIPTION_MAX_LENGTH } from "../../onboarding/community/MediaProjectStep";
import type { MediaCoverageScope } from "../media/media-master-profile";

/* ------------------------------------------------------------------ */
/* Nome della realtà                                                    */
/* ------------------------------------------------------------------ */

/**
 * Spazi esterni via, spazi ripetuti ridotti a uno. Accenti, apostrofi,
 * maiuscole e caratteri non latini restano come sono stati scritti: non è
 * compito dell'editor decidere come si chiama una testata.
 */
export function normalizeMediaEntityName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateMediaEntityName(value: string): string | null {
  if (normalizeMediaEntityName(value).length === 0) {
    return "Inserisci il nome della realtà.";
  }

  return /[<>]/.test(value) ? "Il nome non può contenere markup." : null;
}

export function validateMediaCreatorType(
  value: MediaCreatorType | "",
  otherLabel: string,
): string | null {
  if (!isMediaCreatorType(value)) {
    return "Seleziona il tipo di realtà.";
  }

  return value === "other" && otherLabel.trim().length === 0
    ? "Indica il tipo di realtà."
    : null;
}

/* ------------------------------------------------------------------ */
/* Descrizione pubblica                                                 */
/* ------------------------------------------------------------------ */

/**
 * Il limite è quello dell'onboarding, non un secondo limite dell'editor: lo
 * stesso testo attraversa REV-ONB-09, questa schermata, l'header e la tab
 * Info di REV-PROF-21, e due soglie diverse produrrebbero un testo che si
 * può scrivere in un posto e non nell'altro.
 *
 * Il mockup ne mostra 300. È un esempio visuale: il valore canonico del
 * repository è 400 e questa task non lo abbassa, perché abbassarlo
 * troncherebbe descrizioni già scritte in onboarding.
 */
export const MEDIA_DESCRIPTION_MAX_LENGTH = MEDIA_PROJECT_DESCRIPTION_MAX_LENGTH;

/**
 * Markup via, a capo preservati. Una presentazione editoriale ha dei
 * paragrafi, e appiattirli la rovinerebbe; eseguire un tag la renderebbe
 * pericolosa.
 */
export function sanitizeMediaDescription(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function validateMediaDescription(value: string): string | null {
  return sanitizeMediaDescription(value).length > MEDIA_DESCRIPTION_MAX_LENGTH
    ? `La descrizione non può superare ${MEDIA_DESCRIPTION_MAX_LENGTH} caratteri.`
    : null;
}

/* ------------------------------------------------------------------ */
/* Selezioni multiple: Copertura e Tipi di contenuto                    */
/* ------------------------------------------------------------------ */

export type MediaSelectionOption = {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
};

/**
 * Deduplica preservando l'ordine della tassonomia, non quello dei tocchi:
 * due sessioni che selezionano le stesse voci in ordine diverso salvano lo
 * stesso valore, e "non modificato" resta tale.
 *
 * I valori che la tassonomia non riconosce più non vengono cancellati: la
 * lettura non è il momento in cui si perde un dato storico. Escono in coda,
 * così l'owner li vede e decide.
 */
export function normalizeMediaSelection(
  values: readonly string[] | null | undefined,
  taxonomy: readonly string[],
): { known: string[]; deprecated: string[] } {
  const chosen = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = value?.trim();

    if (trimmed) {
      chosen.add(trimmed);
    }
  }

  const known = taxonomy.filter((entry) => chosen.has(entry));
  const deprecated = [...chosen].filter((entry) => !taxonomy.includes(entry));

  return { deprecated, known };
}

export function normalizeMediaScopeSelection(
  values: readonly string[] | null | undefined,
) {
  return normalizeMediaSelection(values, MEDIA_SCOPE_OPTIONS);
}

export function normalizeMediaContentTypeSelection(
  values: readonly string[] | null | undefined,
) {
  return normalizeMediaSelection(values, MEDIA_CONTENT_TYPE_OPTIONS);
}

/** Due insiemi uguali a meno dell'ordine. Serve a non salvare un non-cambio. */
export function sameMediaSelection(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const other = new Set(right);

  return left.every((entry) => other.has(entry));
}

/* ------------------------------------------------------------------ */
/* Canali ufficiali                                                     */
/* ------------------------------------------------------------------ */

export type MediaChannelDefinition = {
  icon: keyof typeof Ionicons.glyphMap;
  invalidMessage: string;
  key: MediaChannelKey;
  label: string;
  placeholder: string;
};

/**
 * I cinque canali di REV-ONB-09, nell'ordine del mockup. Telefono, email,
 * WhatsApp, Telegram, RSS e l'URL di un singolo articolo non sono canali
 * editoriali e non compaiono: aggiungerne uno qui significherebbe
 * pubblicarlo nel profilo.
 */
export const MEDIA_CHANNELS: readonly MediaChannelDefinition[] = [
  {
    icon: "globe-outline",
    invalidMessage: "Inserisci un sito web valido.",
    key: "website",
    label: "Sito web",
    placeholder: "www.esempio.it",
  },
  {
    icon: "logo-instagram",
    invalidMessage: "Inserisci un profilo Instagram valido.",
    key: "instagram",
    label: "Instagram",
    placeholder: "@username",
  },
  {
    icon: "logo-youtube",
    invalidMessage: "Inserisci un canale YouTube valido.",
    key: "youtube",
    label: "YouTube",
    placeholder: "@canale",
  },
  {
    icon: "logo-tiktok",
    invalidMessage: "Inserisci un profilo TikTok valido.",
    key: "tiktok",
    label: "TikTok",
    placeholder: "@username",
  },
  {
    icon: "logo-facebook",
    invalidMessage: "Inserisci una pagina Facebook valida.",
    key: "facebook",
    label: "Facebook",
    placeholder: "pagina",
  },
] as const;

export type MediaChannelForm = Record<MediaChannelKey, string> & {
  visibility: Record<MediaChannelKey, boolean>;
};

/**
 * Forma canonica di un canale, o stringa vuota. È l'unico giudice di
 * "pubblicabile": il normalizzatore è quello dell'onboarding, così un valore
 * accettato lì non viene rifiutato qui e viceversa.
 */
export function normalizeMediaChannelValue(
  key: MediaChannelKey,
  value: string,
): string {
  const result = validateMediaChannel(key, value);

  return result.isValid ? result.normalized : "";
}

/**
 * Primo canale acceso che non si può pubblicare, con il suo messaggio. La
 * schermata lo apre e lo segnala invece di salvare un link rotto.
 */
export function findUnpublishableMediaChannel(
  form: MediaChannelForm,
): MediaChannelDefinition | null {
  return (
    MEDIA_CHANNELS.find(
      (channel) =>
        form.visibility[channel.key] &&
        !normalizeMediaChannelValue(channel.key, form[channel.key]),
    ) ?? null
  );
}

/**
 * Canali che il Visitor vedrà davvero: presenti, validi, supportati e con la
 * visibilità accesa. È lo stesso conteggio che l'hub mostra, perché è la
 * stessa funzione.
 */
export function countVisibleMediaChannels(form: MediaChannelForm): number {
  return MEDIA_CHANNELS.filter(
    (channel) =>
      form.visibility[channel.key] &&
      normalizeMediaChannelValue(channel.key, form[channel.key]).length > 0,
  ).length;
}

/**
 * Valori da persistere. Due invarianti insieme, perché separate lascerebbero
 * uno stato impossibile:
 *
 *  - un valore scritto viene salvato nella sua forma canonica;
 *  - un canale senza valore valido esce con la visibilità spenta, non con un
 *    interruttore orfano acceso su niente.
 */
export function buildMediaChannelPatch(form: MediaChannelForm): {
  values: Record<MediaChannelKey, string>;
  visibility: Record<MediaChannelKey, boolean>;
} {
  const values = {} as Record<MediaChannelKey, string>;
  const visibility = {} as Record<MediaChannelKey, boolean>;

  for (const channel of MEDIA_CHANNELS) {
    const raw = form[channel.key].trim();
    const normalized = normalizeMediaChannelValue(channel.key, raw);

    // Un valore scritto ma non interpretabile resta all'utente così com'è:
    // cancellarglielo durante un salvataggio di un altro canale sarebbe una
    // perdita silenziosa.
    values[channel.key] = normalized || raw;
    visibility[channel.key] = normalized.length > 0 && form.visibility[channel.key];
  }

  return { values, visibility };
}

/* ------------------------------------------------------------------ */
/* Aree coperte                                                         */
/* ------------------------------------------------------------------ */

export type MediaAreasDraft = {
  provinces: string[];
  regions: string[];
  scope: MediaCoverageScope;
};

/** Le aree della modalità attiva. L'altra lista non viaggia e non si salva. */
export function resolveMediaAreasDraft(draft: MediaAreasDraft): {
  provinces: string[];
  regions: string[];
} {
  if (draft.scope === "REGIONS") {
    return { provinces: [], regions: dedupe(draft.regions) };
  }

  if (draft.scope === "PROVINCES") {
    return { provinces: dedupe(draft.provinces), regions: [] };
  }

  return { provinces: [], regions: [] };
}

/**
 * "Tutta Italia" è completa per definizione; le altre due modalità no: una
 * copertura regionale senza regioni non è una copertura.
 */
export function validateMediaAreas(draft: MediaAreasDraft): string | null {
  const active = resolveMediaAreasDraft(draft);

  if (draft.scope === "ITALY") {
    return null;
  }

  const selected =
    draft.scope === "REGIONS" ? active.regions : active.provinces;

  return selected.length === 0 ? "Seleziona almeno un'area di copertura." : null;
}

function dedupe(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }

  return result;
}
