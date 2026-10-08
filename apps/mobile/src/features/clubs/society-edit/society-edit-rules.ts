/**
 * Regole dell'editor Società (REV-PROF-18).
 *
 * Funzioni pure, tutte testate: sono i punti in cui la task è prescrittiva —
 * validazioni, limiti, pluralizzazione dei contatori, derivazione delle
 * categorie giovanili — e stanno fuori dai componenti perché le stesse regole
 * valgono per il form, per il riepilogo dell'hub e per i test.
 *
 * Le validazioni esistono anche nel database: qui servono a dare un errore
 * vicino al campo, là a non poter essere aggirate.
 */
import {
  clubStructureHasFirstTeam,
  clubStructureHasYouth,
  type ClubStructure,
} from "../../onboarding/club/club-structure";
import { CLUB_SOCIAL_COLOR_OPTIONS } from "../../onboarding/club/club-taxonomy";
import {
  isEmailValid,
  isWebsiteValid,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
  normalizeWebsiteInput,
} from "../../profiles/profile-form-utils";

export const SOCIETY_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Massimo di colori sociali. L'onboarding non ne dichiara uno, quindi vale il
 * limite della task (§"Colori sociali").
 */
export const SOCIETY_MAX_COLORS = 3;

/** Nessun club italiano nasce prima: il minimo non esclude i club storici. */
export const SOCIETY_MIN_FOUNDING_YEAR = 1850;

/* ------------------------------------------------------------------ */
/* Denominazione                                                       */
/* ------------------------------------------------------------------ */

/**
 * Spazi esterni via, spazi ripetuti ridotti a uno. Maiuscole, apostrofi,
 * accenti e sigle (ASD, SSD, FC) restano come l'utente li ha scritti: non è
 * compito dell'editor decidere come si chiama un club.
 */
export function normalizeClubName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateClubName(value: string): string | null {
  return normalizeClubName(value).length === 0
    ? "Inserisci la denominazione del club."
    : null;
}

/* ------------------------------------------------------------------ */
/* Anno di fondazione                                                  */
/* ------------------------------------------------------------------ */

/** Solo cifre, al massimo quattro: la tastiera numerica non basta da sola. */
export function normalizeFoundingYearInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function validateFoundingYear(
  value: string,
  now: Date = new Date(),
): string | null {
  const trimmed = value.trim();

  // Campo facoltativo: un club che non conosce il proprio anno non è un errore.
  if (trimmed.length === 0) {
    return null;
  }

  if (!/^\d{4}$/.test(trimmed)) {
    return "Inserisci un anno di fondazione valido.";
  }

  const year = Number(trimmed);

  if (year > now.getFullYear()) {
    return "L'anno di fondazione non può essere futuro.";
  }

  if (year < SOCIETY_MIN_FOUNDING_YEAR) {
    return "Inserisci un anno di fondazione valido.";
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Colori sociali                                                      */
/* ------------------------------------------------------------------ */

const KNOWN_COLOR_VALUES = new Set(
  CLUB_SOCIAL_COLOR_OPTIONS.map((option) => option.value),
);

/**
 * `clubs.club_colors` è un testo ("Giallo, Blu"): è il formato che onboarding
 * e Master Profile già leggono, e cambiarlo qui spezzerebbe entrambi. Il
 * parsing conserva l'ordine e tiene anche i valori non più in tassonomia:
 * un colore salvato da un flusso precedente non si perde in lettura.
 */
export function parseSocietyColors(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  const seen = new Set<string>();

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      const key = entry.toLocaleLowerCase("it");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function serializeSocietyColors(values: readonly string[]): string {
  return values.join(", ");
}

/**
 * Solo il massimo. L'onboarding Società non chiede i colori — `club_colors` è
 * nullable e `mapClubDataValidationError` non li valida — quindi l'editor non
 * può pretenderli: un club registrato prima di REV-ONB-05 non riuscirebbe più
 * a correggere nemmeno la propria denominazione.
 */
export function validateSocietyColors(values: readonly string[]): string | null {
  if (values.length > SOCIETY_MAX_COLORS) {
    return "Hai raggiunto il numero massimo di colori sociali.";
  }

  return null;
}

/** I colori sconosciuti restano leggibili, ma non vanno proposti come scelte. */
export function isKnownSocietyColor(value: string): boolean {
  return KNOWN_COLOR_VALUES.has(value);
}

/* ------------------------------------------------------------------ */
/* Struttura del club                                                  */
/* ------------------------------------------------------------------ */

export type SocietyStructureConflict =
  | "first_team_active"
  | "youth_teams_active"
  | null;

/**
 * Una struttura è incoerente quando contraddice le squadre attive. Non si
 * corregge archiviando squadre: si blocca il salvataggio e si manda l'utente
 * alla gestione Squadre, l'unico posto in cui una squadra nasce o si chiude.
 */
export function detectStructureConflict(
  structure: ClubStructure,
  teams: { hasFirstTeam: boolean; hasYouthTeams: boolean },
): SocietyStructureConflict {
  if (structure === "first_team_only" && teams.hasYouthTeams) {
    return "youth_teams_active";
  }

  if (structure === "youth_only" && teams.hasFirstTeam) {
    return "first_team_active";
  }

  return null;
}

export function describeStructureConflict(
  conflict: SocietyStructureConflict,
): string | null {
  if (conflict === "youth_teams_active") {
    return "Sono presenti squadre giovanili attive. Gestiscile prima di modificare la struttura del club.";
  }

  if (conflict === "first_team_active") {
    return "È presente una prima squadra attiva. Gestiscila prima di modificare la struttura del club.";
  }

  return null;
}

/** La categoria si chiede solo a chi ha una prima squadra. */
export function shouldAskFirstTeamCategory(structure: ClubStructure): boolean {
  return clubStructureHasFirstTeam(structure);
}

export function validateSportProfile(
  structure: ClubStructure,
  category: string,
): string | null {
  if (!structure) {
    return "Seleziona la struttura del club.";
  }

  if (shouldAskFirstTeamCategory(structure) && category.trim().length === 0) {
    return "Seleziona la categoria della prima squadra.";
  }

  return null;
}

/**
 * Richiamo non bloccante: la struttura prevede un settore giovanile che non
 * ha ancora squadre. Si salva lo stesso e non si creano team vuoti.
 */
export function shouldInviteToCreateYouthTeams(
  structure: ClubStructure,
  teams: { hasYouthTeams: boolean },
): boolean {
  return clubStructureHasYouth(structure) && !teams.hasYouthTeams;
}

/* ------------------------------------------------------------------ */
/* Sede e impianto                                                     */
/* ------------------------------------------------------------------ */

export function validateVenue(input: {
  city: string;
  headquartersAddress: string;
  region: string;
}): string | null {
  if (input.city.trim().length === 0 || input.region.trim().length === 0) {
    return "Seleziona una città valida.";
  }

  return null;
}

/**
 * Indirizzo dell'impianto quando il toggle è attivo: è la sede, non una sua
 * copia scritta accanto. Con il toggle spento resta il valore dedicato.
 */
export function resolveVenueAddress(input: {
  fieldAddress: string;
  headquartersAddress: string;
  sameAsHeadquarters: boolean;
}): string {
  return input.sameAsHeadquarters
    ? input.headquartersAddress.trim()
    : input.fieldAddress.trim();
}

/* ------------------------------------------------------------------ */
/* Descrizione                                                         */
/* ------------------------------------------------------------------ */

/**
 * Niente markup, niente script, niente righe vuote a catena: la descrizione
 * finisce nella tab Info come testo, e deve restare testo anche se incollata
 * da una pagina web. Gli a capo legittimi si conservano.
 */
export function sanitizeSocietyDescription(value: string): string {
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

export function validateSocietyDescription(value: string): string | null {
  return sanitizeSocietyDescription(value).length > SOCIETY_DESCRIPTION_MAX_LENGTH
    ? "La descrizione non può superare 500 caratteri."
    : null;
}

/* ------------------------------------------------------------------ */
/* Contatti pubblici                                                   */
/* ------------------------------------------------------------------ */

/**
 * I cinque canali che il Master Profile Società mostra davvero.
 *
 * `clubs` porta anche `tiktok` e `youtube`, ma nessuna superficie li
 * pubblica: un interruttore di visibilità su un canale invisibile sarebbe una
 * promessa che il prodotto non mantiene. I valori restano nel database e non
 * vengono toccati da questo editor.
 */
export type SocietyContactKey =
  | "email"
  | "facebook"
  | "instagram"
  | "phone"
  | "website";

/** Un numero pubblicabile: almeno otto cifre, con prefisso facoltativo. */
function normalizeSocietyPhone(value: string): string {
  const trimmed = value.trim().replace(/[\s.\-()]/g, "");

  return /^\+?\d{8,15}$/.test(trimmed) ? value.trim() : "";
}

/**
 * Normalizzatori per canale. Un risultato vuoto significa "non
 * pubblicabile": non è un errore se il campo è vuoto, lo è se contiene
 * qualcosa che non si può usare come contatto.
 */
export const SOCIETY_CONTACT_NORMALIZERS: Record<
  SocietyContactKey,
  (value: string) => string
> = {
  email: (value) => (isEmailValid(value) ? normalizeContactEmail(value) : ""),
  facebook: normalizeFacebookInput,
  instagram: normalizeInstagramInput,
  phone: normalizeSocietyPhone,
  website: (value) => (isWebsiteValid(value) ? normalizeWebsiteInput(value) : ""),
};

export type SocietyContactsDraft = {
  values: Record<SocietyContactKey, string>;
  visibility: Record<SocietyContactKey, boolean>;
};

/**
 * Un contatto è pubblico solo se ha un valore valido e il toggle acceso. È la
 * stessa regola con cui il database costruisce il payload pubblico, e la
 * stessa con cui l'hub conta "n contatti visibili": tenerne due diverse
 * significherebbe mostrare un numero che il profilo non conferma.
 */
export function countVisibleContacts(draft: SocietyContactsDraft): number {
  return (Object.keys(SOCIETY_CONTACT_NORMALIZERS) as SocietyContactKey[]).filter(
    (key) =>
      draft.visibility[key] &&
      SOCIETY_CONTACT_NORMALIZERS[key](draft.values[key] ?? "").length > 0,
  ).length;
}

export const SOCIETY_CONTACT_INVALID_MESSAGES: Record<SocietyContactKey, string> =
  {
    email: "Inserisci un indirizzo email valido.",
    facebook: "Inserisci un profilo Facebook valido.",
    instagram: "Inserisci un profilo Instagram valido.",
    phone: "Inserisci un numero di telefono valido.",
    website: "Inserisci un sito web valido.",
  };

/** Primo canale acceso con un valore non pubblicabile, o `null`. */
export function findInvalidVisibleContact(
  draft: SocietyContactsDraft,
): SocietyContactKey | null {
  return (
    (Object.keys(SOCIETY_CONTACT_NORMALIZERS) as SocietyContactKey[]).find(
      (key) =>
        draft.visibility[key] &&
        SOCIETY_CONTACT_NORMALIZERS[key](draft.values[key] ?? "").length === 0,
    ) ?? null
  );
}
