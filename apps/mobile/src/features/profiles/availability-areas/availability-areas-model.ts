/**
 * Disponibilità geografica — modello canonico condiviso (DAS-REV-06 §10–§17).
 *
 * «Onboarding, Modifica profilo e Dashboard devono usare la stessa fonte
 * canonica delle aree» (§11). Questo file è quella fonte per il client: le tre
 * modalità, la risoluzione delle selezioni attive, le validazioni e la ricerca
 * stanno qui e in nessun altro posto.
 *
 * Rispetto a `onboarding/player/geographic-availability.ts`, che resta la
 * logica del wizard, cambia una cosa sola ma decisiva: **la modalità può
 * essere assente**. §16 chiede di distinguere "dato realmente assente" da
 * "l'utente ha scelto Tutta Italia", e il modello persistito non lo permetteva:
 * `player_profiles.availability_type` è `not null default 'ITALY'` e
 * l'onboarding parte da `"ITALY"` senza che nessuno lo scelga. Da qui il
 * `mode: AvailabilityAreasMode | null` e, sul database, la colonna
 * `availability_configured_at`: una configurazione vale solo se qualcuno l'ha
 * confermata.
 *
 * Nessuna macroarea, nessun raggio, nessun "vicino a me": §10 li vieta tutti.
 */
import type { AvailabilityType } from "../../onboarding/onboarding-form";
import {
  PROVINCE_OPTIONS,
  PROVINCE_REGIONS,
  REGION_OPTIONS,
  isValidProvince,
  isValidRegion,
  normalizeLookupValue,
  type SelectOption,
} from "../profile-form-utils";

/** Le tre modalità del master. Lo stesso vocabolario già persistito. */
export type AvailabilityAreasMode = AvailabilityType;

export type AvailabilityAreasDraft = {
  /** `null` = nessuna modalità scelta. Non è un sinonimo di `"ITALY"`. */
  mode: AvailabilityAreasMode | null;
  provinces: string[];
  regions: string[];
};

/** Selezioni effettivamente persistite per la modalità corrente (§16). */
export type ActiveAreas = {
  provinces: string[];
  regions: string[];
};

export type AvailabilityAreasValidationError = {
  /** Controllo accanto al quale mostrare l'errore (§17). */
  field: "mode" | "provinces" | "regions";
  message: string;
};

export const AVAILABILITY_AREAS_COPY = {
  title: "Dove sei disponibile?",
  subtitle: "Indica dove valuteresti nuove opportunità.",
  save: "Salva modifiche",
  saved: "Modifiche salvate.",
  loadError: "Non è stato possibile caricare le aree. Riprova.",
  saveError: "Non è stato possibile salvare le modifiche. Riprova.",
} as const;

type ModePresentation = {
  /** Microcopy sotto le selezioni (§13, §14, §15). */
  hint: string;
  mode: AvailabilityAreasMode;
  searchPlaceholder?: string;
  title: string;
};

/**
 * Le tre modalità nell'ordine del master, con la copy letterale della task.
 * L'ordine è dato — non va derivato dallo stato corrente, altrimenti la
 * schermata cambia forma a ogni tap.
 */
export const AVAILABILITY_AREAS_MODES: readonly ModePresentation[] = [
  {
    hint: "Le società potranno trovarti nelle province selezionate.",
    mode: "PROVINCES",
    searchPlaceholder: "Cerca una provincia",
    title: "Province specifiche",
  },
  {
    hint: "Valuti opportunità in tutte le province delle regioni selezionate.",
    mode: "REGIONS",
    searchPlaceholder: "Cerca una regione",
    title: "Una o più regioni",
  },
  {
    hint: "Valuti opportunità in tutta Italia.",
    mode: "ITALY",
    title: "Tutta Italia",
  },
] as const;

/**
 * Modalità persistita → modalità del modello.
 *
 * `ALL_ITALY` è un valore legacy equivalente a `ITALY` (lo normalizzavano già
 * tre punti diversi del progetto). Qualunque altro valore, stringa vuota
 * inclusa, significa "non configurata": §16 vieta di spacciare una
 * configurazione vuota per dato reale.
 */
export function normalizeAvailabilityAreasMode(
  value: string | null | undefined,
): AvailabilityAreasMode | null {
  if (value === "REGIONS" || value === "PROVINCES" || value === "ITALY") {
    return value;
  }

  return value === "ALL_ITALY" ? "ITALY" : null;
}

/**
 * Selezioni attive della modalità corrente.
 *
 * È questa la forma che va persistita: la bozza può contenere di più, perché
 * §16 consente di «ripristinare le selezioni precedenti durante la stessa
 * sessione di modifica». Il payload non le vede mai.
 */
export function resolveActiveAreas(draft: AvailabilityAreasDraft): ActiveAreas {
  if (draft.mode === "REGIONS") {
    return { provinces: [], regions: dedupeAreas(draft.regions) };
  }

  if (draft.mode === "PROVINCES") {
    return { provinces: dedupeAreas(draft.provinces), regions: [] };
  }

  return { provinces: [], regions: [] };
}

/** Rimuove i duplicati conservando l'ordine di selezione. */
export function dedupeAreas(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Aggiunge o rimuove un'area dalla modalità corrente.
 *
 * Chip e checkbox passano entrambi da qui: §13 chiede che «rimuovere un chip
 * aggiorni lo stesso draft del checkbox», e due funzioni separate sarebbero
 * due stati che possono divergere.
 */
export function toggleArea(values: readonly string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

/**
 * Validazione del draft (§17), nell'ordine in cui l'utente la incontra.
 *
 * Non valida la coerenza fra modalità e selezioni non attive: quelle non
 * finiscono nel payload, quindi un draft con regioni "residue" e modalità
 * Province è legittimo.
 */
export function validateAvailabilityAreas(
  draft: AvailabilityAreasDraft,
): AvailabilityAreasValidationError | null {
  if (draft.mode === null) {
    return {
      field: "mode",
      message: "Seleziona una modalità di disponibilità.",
    };
  }

  const active = resolveActiveAreas(draft);

  if (draft.mode === "PROVINCES") {
    if (active.provinces.length === 0) {
      return { field: "provinces", message: "Seleziona almeno una provincia." };
    }

    if (!active.provinces.every(isValidProvince)) {
      return { field: "provinces", message: UNKNOWN_AREAS_MESSAGE };
    }
  }

  if (draft.mode === "REGIONS") {
    if (active.regions.length === 0) {
      return { field: "regions", message: "Seleziona almeno una regione." };
    }

    if (!active.regions.every(isValidRegion)) {
      return { field: "regions", message: UNKNOWN_AREAS_MESSAGE };
    }
  }

  return null;
}

export const UNKNOWN_AREAS_MESSAGE =
  "Alcune aree non sono più disponibili. Controlla la selezione.";

/**
 * Due configurazioni rappresentano la stessa disponibilità.
 *
 * Confronta la modalità e le sole selezioni **attive**, come insiemi: passare
 * a Regioni e tornare a Province non è una modifica se le province sono le
 * stesse, e riordinare i chip nemmeno. Serve a decidere "dirty", quindi
 * dev'essere esattamente la stessa nozione che il backend persisterebbe.
 */
export function areAvailabilityAreasEqual(
  left: AvailabilityAreasDraft,
  right: AvailabilityAreasDraft,
): boolean {
  if (left.mode !== right.mode) {
    return false;
  }

  const a = resolveActiveAreas(left);
  const b = resolveActiveAreas(right);

  return (
    isSameAreaSet(a.provinces, b.provinces) &&
    isSameAreaSet(a.regions, b.regions)
  );
}

function isSameAreaSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const set = new Set(left);

  return right.every((value) => set.has(value));
}

/**
 * Un'area della tassonomia, con il metadato che la disambigua.
 *
 * Per le province è la regione — «Bergamo · Lombardia» (§13). Per le regioni
 * non c'è nulla da disambiguare e il campo resta assente.
 */
export type AvailabilityAreaOption = {
  label: string;
  metadata?: string;
  value: string;
};

const PROVINCE_AREA_OPTIONS: AvailabilityAreaOption[] = PROVINCE_OPTIONS.map(
  (option: SelectOption) => ({
    label: option.label,
    metadata: PROVINCE_REGIONS[option.value],
    value: option.value,
  }),
);

const REGION_AREA_OPTIONS: AvailabilityAreaOption[] = REGION_OPTIONS.map(
  (option: SelectOption) => ({ label: option.label, value: option.value }),
);

/** Tassonomia completa della modalità. Mai una lista ridotta (§17). */
export function listAreaOptions(
  mode: AvailabilityAreasMode,
): AvailabilityAreaOption[] {
  if (mode === "PROVINCES") {
    return PROVINCE_AREA_OPTIONS;
  }

  if (mode === "REGIONS") {
    return REGION_AREA_OPTIONS;
  }

  return [];
}

const NORMALIZED_AREA_OPTIONS: Record<
  "PROVINCES" | "REGIONS",
  { normalized: string; option: AvailabilityAreaOption }[]
> = {
  PROVINCES: PROVINCE_AREA_OPTIONS.map((option) => ({
    normalized: normalizeLookupValue(option.value),
    option,
  })),
  REGIONS: REGION_AREA_OPTIONS.map((option) => ({
    normalized: normalizeLookupValue(option.value),
    option,
  })),
};

/**
 * Filtro testuale della tassonomia (§17).
 *
 * Usa la normalizzazione condivisa — maiuscole, accenti e punteggiatura non
 * contano, così "emilia romagna" trova "Emilia-Romagna" e "forli" trova
 * "Forlì-Cesena". Query vuota = tassonomia intera, nell'ordine ufficiale: il
 * filtro non riordina e non rimuove nulla dalle selezioni.
 */
export function searchAreaOptions(
  mode: AvailabilityAreasMode,
  query: string,
): AvailabilityAreaOption[] {
  if (mode === "ITALY") {
    return [];
  }

  const normalizedQuery = normalizeLookupValue(query);
  const entries = NORMALIZED_AREA_OPTIONS[mode];

  if (!normalizedQuery) {
    return entries.map((entry) => entry.option);
  }

  return entries
    .filter((entry) => entry.normalized.includes(normalizedQuery))
    .map((entry) => entry.option);
}

/**
 * Etichette ordinate come la tassonomia, per i chip delle selezioni.
 *
 * I chip seguono l'ordine ufficiale e non quello di selezione: con dieci
 * province, un elenco che si riordina a ogni tap è illeggibile.
 */
export function orderAreasByTaxonomy(
  mode: AvailabilityAreasMode,
  values: readonly string[],
): string[] {
  const selected = new Set(values);
  const known = listAreaOptions(mode)
    .filter((option) => selected.has(option.value))
    .map((option) => option.value);

  /*
    Un valore fuori tassonomia (dato legacy, provincia soppressa) non viene
    nascosto: §24 vieta le conversioni distruttive, e l'utente deve poterlo
    vedere e rimuovere. Finisce in coda, dopo le aree riconosciute.
  */
  const unknown = values.filter((value) => !known.includes(value));

  return [...known, ...unknown];
}
