/**
 * "Altre esperienze nel calcio" del Dirigente (REV-ONB-07 §Z–§AH).
 *
 * Sostituisce il vecchio toggle "Ho altre esperienze nel calcio" seguito da
 * una lista di chip: qui la scelta è direttamente multipla (§Z) e zero
 * selezioni è una risposta valida — si prosegue senza dover dichiarare
 * "Nessuna" (§AB).
 *
 * Ogni ruolo selezionato apre il sotto-flusso già approvato quando esiste
 * (§AC–§AF); Scout, Arbitro, Procuratore e Altro condividono l'editor
 * generico, perché REV-ONB-07 non deve creare nuovi domini (§AG).
 */
import { DIRECTOR_SUB_FLOW_STEPS, type OnboardingStep } from "../onboarding-form";

export type DirectorPreviousRole =
  | "player"
  | "coach"
  | "staff"
  | "scout"
  | "agent"
  | "referee"
  | "other";

/**
 * §AA: "Procuratore" è il naming definitivo. "Agente" resta solo come valore
 * interno, coerente con l'enum `agent` del modello dati.
 */
export const DIRECTOR_PREVIOUS_ROLE_OPTIONS: {
  description: string;
  label: string;
  value: DirectorPreviousRole;
}[] = [
  {
    description: "Hai giocato a livello agonistico.",
    label: "Calciatore",
    value: "player",
  },
  {
    description: "Hai guidato una squadra in panchina.",
    label: "Allenatore",
    value: "coach",
  },
  {
    description: "Preparazione, match analysis, area medica.",
    label: "Staff tecnico",
    value: "staff",
  },
  {
    description: "Hai svolto attività di osservazione e valutazione.",
    label: "Scout",
    value: "scout",
  },
  {
    description: "Hai rappresentato calciatori o allenatori.",
    label: "Procuratore",
    value: "agent",
  },
  {
    description: "Hai diretto gare come ufficiale di gara.",
    label: "Arbitro",
    value: "referee",
  },
  {
    description: "Un altro ruolo nel mondo del calcio.",
    label: "Altro",
    value: "other",
  },
];

const KNOWN_ROLES = new Set(
  DIRECTOR_PREVIOUS_ROLE_OPTIONS.map((option) => option.value),
);

/**
 * Ruoli che non hanno un onboarding carriera dedicato e passano dall'editor
 * generico (§AG). Un solo passo per tutti: il ruolo si sceglie dentro la
 * singola esperienza.
 */
const GENERIC_ROLES: DirectorPreviousRole[] = [
  "scout",
  "agent",
  "referee",
  "other",
];

/**
 * Ordine dei sotto-flussi (§AC–§AG): prima i rami con un flusso approvato,
 * poi l'editor generico che raccoglie tutti gli altri ruoli insieme.
 */
const SUB_FLOW_MATCHES: Record<string, DirectorPreviousRole[]> = {
  director_coach_career: ["coach"],
  director_other_career: GENERIC_ROLES,
  director_player_career: ["player"],
  director_staff_career: ["staff"],
};

const SUB_FLOW_ORDER: {
  matches: DirectorPreviousRole[];
  step: OnboardingStep;
}[] = DIRECTOR_SUB_FLOW_STEPS.map((step) => ({
  matches: SUB_FLOW_MATCHES[step] ?? [],
  step,
}));

/** Applica una scelta alla selezione corrente. Ritoccare deseleziona. */
export function toggleDirectorPreviousRole(
  selection: DirectorPreviousRole[],
  option: DirectorPreviousRole,
): DirectorPreviousRole[] {
  return selection.includes(option)
    ? selection.filter((entry) => entry !== option)
    : [...selection, option];
}

/** Lettura della selezione dai campi del form. */
export function readDirectorPreviousRoles(form: {
  directorPreviousRoles: string[];
}): DirectorPreviousRole[] {
  return form.directorPreviousRoles.filter((entry): entry is DirectorPreviousRole =>
    KNOWN_ROLES.has(entry as DirectorPreviousRole),
  );
}

/**
 * Scrittura della selezione sui campi del form.
 *
 * §AN: togliere un ruolo invalida i dati che ne dipendono, quindi il ramo
 * corrispondente viene svuotato esplicitamente invece di restare appeso a una
 * dichiarazione che l'utente non fa più. I flag legacy restano allineati, così
 * un profilo già salvato continua a leggersi.
 */
export function buildDirectorPreviousRolesPatch(
  selection: DirectorPreviousRole[],
) {
  const hasPlayer = selection.includes("player");
  const hasCoach = selection.includes("coach");
  const hasStaff = selection.includes("staff");
  const hasGeneric = selection.some((entry) => GENERIC_ROLES.includes(entry));

  return {
    directorHasOtherFootballExperience: selection.length > 0,
    directorHasPlayedFootball: hasPlayer,
    directorPreviousRoles: selection,
    ...(hasPlayer ? {} : { directorPlayerCareerEntries: [] }),
    ...(hasCoach ? {} : { directorCoachCareerEntries: [] }),
    ...(hasStaff ? {} : { directorStaffCareerEntries: [] }),
    ...(hasGeneric ? {} : { directorOtherCareerEntries: [] }),
  };
}

/**
 * Primo sotto-flusso ancora da percorrere.
 *
 * `null` significa che non ne restano: si prosegue con "Informazioni
 * aggiuntive" (§AH). Zero selezioni salta direttamente tutti i rami (§AB).
 */
export function getNextDirectorSubFlowStep(
  selection: DirectorPreviousRole[],
  completed: OnboardingStep[] = [],
): OnboardingStep | null {
  const pending = SUB_FLOW_ORDER.find(
    (entry) =>
      entry.matches.some((role) => selection.includes(role)) &&
      !completed.includes(entry.step),
  );

  return pending?.step ?? null;
}

/**
 * Sotto-flusso precedente a quello indicato, fra quelli effettivamente
 * dichiarati. Serve al Back: si rientra nel ramo percorso, non in uno che
 * l'utente non ha mai aperto (§AN).
 */
export function getPreviousDirectorSubFlowStep(
  selection: DirectorPreviousRole[],
  step: OnboardingStep,
): OnboardingStep | null {
  const index = SUB_FLOW_ORDER.findIndex((entry) => entry.step === step);
  const searchable =
    index >= 0 ? SUB_FLOW_ORDER.slice(0, index) : SUB_FLOW_ORDER;

  for (let cursor = searchable.length - 1; cursor >= 0; cursor -= 1) {
    const entry = searchable[cursor];

    if (entry.matches.some((role) => selection.includes(role))) {
      return entry.step;
    }
  }

  return null;
}

/**
 * Ruoli selezionabili dentro l'editor generico (§AG): solo quelli davvero
 * dichiarati, così la lista non propone incarichi che l'utente non ha.
 */
export function getDirectorGenericRoleOptions(
  selection: DirectorPreviousRole[],
): { label: string; value: string }[] {
  const declared = DIRECTOR_PREVIOUS_ROLE_OPTIONS.filter(
    (option) =>
      GENERIC_ROLES.includes(option.value) && selection.includes(option.value),
  );

  const options = declared.length > 0 ? declared : DIRECTOR_PREVIOUS_ROLE_OPTIONS.filter(
    (option) => GENERIC_ROLES.includes(option.value),
  );

  return options.map((option) => ({
    label: option.label,
    value: option.label,
  }));
}
