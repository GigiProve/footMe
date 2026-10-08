/**
 * Tassonomie del Procuratore (REV-ONB-06).
 *
 * Il profilo continua a chiamarsi `agent` nel modello dati — l'enum legacy
 * resta quello (§B) — ma la UI espone soltanto "Procuratore". Qui vivono i
 * valori strutturati che il backend salva: le label sono testo di prodotto e
 * possono cambiare, i `value` no.
 */
import { COUNTRY_OPTIONS } from "../../profiles/profile-form-utils";

export type AgentProfessionalMode = "" | "independent" | "agency";

export type AgentPortfolioRange =
  | ""
  | "none"
  | "1_5"
  | "6_15"
  | "16_30"
  | "30_plus";

export type AgentActivityScope =
  | "professional"
  | "amateur"
  | "youth"
  | "free_agents"
  | "international";

/** §H: come lavora il procuratore. Scelta singola, mai due identità. */
export const AGENT_PROFESSIONAL_MODE_OPTIONS: {
  description: string;
  label: string;
  value: Exclude<AgentProfessionalMode, "">;
}[] = [
  {
    description: "Opero per conto mio",
    label: "Indipendente",
    value: "independent",
  },
  {
    description: "Faccio parte di un'agenzia o di uno studio",
    label: "Agenzia / Studio",
    value: "agency",
  },
];

/** §J: il ruolo in agenzia esce da una lista, non da un campo libero. */
export const AGENT_AGENCY_ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Founder", value: "Founder" },
  { label: "Partner", value: "Partner" },
  { label: "Procuratore", value: "Procuratore" },
  { label: "Collaboratore", value: "Collaboratore" },
  { label: "Altro", value: "Altro" },
];

/**
 * §Q: federazioni ed enti riconosciuti. L'elenco è centralizzato e
 * ricercabile: non è la lista chiusa di tre voci del vecchio onboarding.
 */
export const AGENT_FEDERATION_OPTIONS: { label: string; value: string }[] = [
  { label: "FIGC — Federazione Italiana Giuoco Calcio", value: "FIGC" },
  { label: "FIGC — Settore Giovanile e Scolastico", value: "FIGC SGS" },
  { label: "FIFA", value: "FIFA" },
  { label: "UEFA", value: "UEFA" },
  { label: "AIACS — Associazione Italiana Procuratori Calciatori", value: "AIACS" },
  { label: "ASFC — Associazione Svizzera Football Club", value: "ASFC" },
  { label: "SFV/ASF — Federazione Svizzera di Calcio", value: "SFV-ASF" },
  { label: "FFF — Federazione Francese", value: "FFF" },
  { label: "RFEF — Federazione Spagnola", value: "RFEF" },
  { label: "The FA — Federazione Inglese", value: "THE-FA" },
  { label: "DFB — Federazione Tedesca", value: "DFB" },
  { label: "FPF — Federazione Portoghese", value: "FPF" },
  { label: "Altra federazione o ente", value: "OTHER" },
];

/** §S: fasce di portfolio. Il valore salvato è il token, non la label. */
export const AGENT_PORTFOLIO_RANGE_OPTIONS: {
  label: string;
  value: Exclude<AgentPortfolioRange, "">;
}[] = [
  { label: "Nessuno", value: "none" },
  { label: "1–5", value: "1_5" },
  { label: "6–15", value: "6_15" },
  { label: "16–30", value: "16_30" },
  { label: "Più di 30", value: "30_plus" },
];

/** §Y: ambiti di attività, categorie operative semplici e multi-select. */
export const AGENT_ACTIVITY_SCOPE_OPTIONS: {
  label: string;
  value: AgentActivityScope;
}[] = [
  { label: "Calcio professionistico", value: "professional" },
  { label: "Calcio dilettantistico", value: "amateur" },
  { label: "Settore giovanile", value: "youth" },
  { label: "Giocatori svincolati", value: "free_agents" },
  { label: "Mercato internazionale", value: "international" },
];

/**
 * Attività principali del Procuratore (REV-PROF-16, schermata 4).
 *
 * Non sono i mercati: un mercato dice *dove* si lavora (professionistico,
 * giovanile, estero), un'attività dice *cosa si fa*. Il profilo ne mostra al
 * massimo tre, ed è questa la tassonomia che le elenca — non un array di
 * stringhe dentro la schermata.
 *
 * Il `value` coincide con l'etichetta italiana perché la colonna che le
 * precedeva (`operational_focuses`) salvava proprio quelle stringhe: due voci
 * storiche — "Valorizzazione giovani" e "Gestione svincolati" — restano quindi
 * riconosciute senza bisogno di una tabella di conversione. Le altre voci
 * legacy non sono qui: la schermata le mostra solo al profilo che le ha già
 * selezionate, così può toglierle senza che diventino scelte nuove per tutti.
 */
export const AGENT_PRIMARY_ACTIVITY_OPTIONS: {
  icon: string;
  label: string;
  value: string;
}[] = [
  {
    icon: "person-outline",
    label: "Valorizzazione giovani",
    value: "Valorizzazione giovani",
  },
  { icon: "search-outline", label: "Scouting", value: "Scouting" },
  {
    icon: "swap-horizontal-outline",
    label: "Intermediazione",
    value: "Intermediazione",
  },
  {
    icon: "person-remove-outline",
    label: "Gestione svincolati",
    value: "Gestione svincolati",
  },
  {
    icon: "business-outline",
    label: "Relazioni con club",
    value: "Relazioni con club",
  },
  {
    icon: "globe-outline",
    label: "Mercato internazionale",
    value: "Mercato internazionale",
  },
];

/** REV-PROF-16: "Seleziona fino a 3 attività in evidenza." */
export const AGENT_PRIMARY_ACTIVITY_LIMIT = 3;

/**
 * Le attività selezionabili per un profilo: quelle canoniche più le voci
 * storiche che quel profilo ha già addosso.
 *
 * Una scelta fatta prima di questa tassonomia non deve diventare invisibile —
 * sarebbe un dato che risulta salvato e che nessuno può più togliere. Compare
 * in fondo, deselezionabile, e sparisce quando viene tolta.
 */
export function buildAgentActivityOptions(selected: readonly string[]): {
  icon: string;
  label: string;
  value: string;
}[] {
  const known = new Set(
    AGENT_PRIMARY_ACTIVITY_OPTIONS.map((option) => option.value),
  );
  const legacy = [...new Set(selected.map((value) => value.trim()))]
    .filter((value) => value.length > 0 && !known.has(value))
    .map((value) => ({ icon: "ellipse-outline", label: value, value }));

  return [...AGENT_PRIMARY_ACTIVITY_OPTIONS, ...legacy];
}

/** §AF: i paesi esteri riusano la tassonomia già condivisa dal profilo. */
export const AGENT_COUNTRY_OPTIONS = COUNTRY_OPTIONS.map((country) => ({
  label: country.name,
  value: country.code,
}));

/** §BB: le lingue più frequenti restano a vista, il resto dietro un selector. */
export const AGENT_COMMON_LANGUAGE_OPTIONS: { label: string; value: string }[] =
  [
    { label: "Italiano", value: "Italiano" },
    { label: "Inglese", value: "Inglese" },
    { label: "Francese", value: "Francese" },
    { label: "Spagnolo", value: "Spagnolo" },
    { label: "Tedesco", value: "Tedesco" },
    { label: "Portoghese", value: "Portoghese" },
  ];

const COMMON_LANGUAGE_VALUES = new Set(
  AGENT_COMMON_LANGUAGE_OPTIONS.map((option) => option.value),
);

export const AGENT_OTHER_LANGUAGE_OPTIONS: { label: string; value: string }[] =
  [
    "Olandese",
    "Russo",
    "Arabo",
    "Croato",
    "Serbo",
    "Albanese",
    "Rumeno",
    "Polacco",
    "Turco",
    "Greco",
    "Ucraino",
    "Svedese",
    "Norvegese",
    "Danese",
    "Giapponese",
    "Cinese",
    "Coreano",
  ].map((label) => ({ label, value: label }));

/** §BA: limite della bio, allineato al Profile model. */
export const AGENT_BIO_MAX_LENGTH = 1000;

/** §K: anni selezionabili per l'inizio attività. Mai un anno futuro. */
export const AGENT_START_YEAR_FIRST = 1960;

export function getAgentStartYearLast() {
  return new Date().getFullYear();
}

/** Le lingue selezionate che non stanno fra le chip sempre visibili. */
export function splitAgentLanguages(languages: string[]) {
  return {
    common: languages.filter((entry) => COMMON_LANGUAGE_VALUES.has(entry)),
    other: languages.filter((entry) => !COMMON_LANGUAGE_VALUES.has(entry)),
  };
}

/**
 * §BQ: compatibilità con il vecchio `managed_players_count`, che era una
 * label libera. Il dato nuovo è il range strutturato; questo ne conserva una
 * lettura per chi legge ancora la colonna legacy.
 */
export function toLegacyManagedPlayersCount(
  range: AgentPortfolioRange,
): string | null {
  if (range === "" || range === "none") {
    return null;
  }

  const option = AGENT_PORTFOLIO_RANGE_OPTIONS.find(
    (entry) => entry.value === range,
  );

  return option ? `${option.label} calciatori` : null;
}

/** Lettura inversa: un account legacy riapre l'onboarding con la sua fascia. */
export function fromLegacyManagedPlayersCount(
  value: string | null | undefined,
): AgentPortfolioRange {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("1-5") || normalized.startsWith("1–5")) {
    return "1_5";
  }

  if (normalized.startsWith("5-15") || normalized.startsWith("6-15") || normalized.startsWith("6–15")) {
    return "6_15";
  }

  if (normalized.startsWith("16-30") || normalized.startsWith("16–30")) {
    return "16_30";
  }

  if (normalized.startsWith("più di 30")) {
    return "30_plus";
  }

  // La vecchia fascia "15+" copriva tutto ciò che stava sopra 15: la si mappa
  // sulla più piccola fascia nuova che la contiene, senza gonfiarla.
  if (normalized.startsWith("15+")) {
    return "16_30";
  }

  return "";
}

/**
 * Paese della federazione, quando il dato esiste (REV-PROF-13 §"Licenza").
 *
 * Serve a costruire la pill "Licenza FIGC (Italia)" dal dato reale invece di
 * scriverne il testo: una federazione senza paese — FIFA, UEFA, un ente
 * dichiarato come "altro" — mostra la sola sigla, non un paese inventato.
 */
const AGENT_FEDERATION_COUNTRIES: Record<string, string> = {
  AIACS: "Italia",
  "ASFC": "Svizzera",
  DFB: "Germania",
  FFF: "Francia",
  FIGC: "Italia",
  "FIGC SGS": "Italia",
  FPF: "Portogallo",
  RFEF: "Spagna",
  "SFV-ASF": "Svizzera",
  "THE-FA": "Inghilterra",
};

/**
 * Etichetta della licenza mostrata nell'header e nei Dettagli.
 *
 * Restituisce `null` quando il procuratore non dichiara una licenza: un badge
 * assente è un dato che non c'è, non uno stato negativo da disegnare. Il
 * numero di licenza non passa mai di qui — resta nella sola schermata che lo
 * prevede.
 */
export function buildAgentLicenseLabel({
  federation,
  isLicensed,
}: {
  federation: string | null | undefined;
  isLicensed: boolean | null | undefined;
}): string | null {
  if (!isLicensed) {
    return null;
  }

  const code = federation?.trim();

  if (!code || code === "OTHER") {
    return "Licenza federale";
  }

  const country = AGENT_FEDERATION_COUNTRIES[code];

  return country ? `Licenza ${code} (${country})` : `Licenza ${code}`;
}
