/**
 * Esperienze precedenti nel calcio del Procuratore (REV-ONB-06 §AI–§AM).
 *
 * È una selezione multipla e non un toggle che rivela una lista (§AI): i
 * ruoli convivono. "Nessuna esperienza precedente" è l'unica voce esclusiva
 * e si annulla a vicenda con le altre (§AK).
 *
 * Selezionare "Calciatore" è l'unica scelta che apre un sotto-flusso: la
 * carriera da calciatore di REV-ONB-02 (§AM). Per gli altri ruoli basta
 * registrare l'indicazione (§AT).
 */
import type { OnboardingStep } from "../onboarding-form";

export type AgentPreviousRole =
  | "player"
  | "coach"
  | "director"
  | "scout"
  | "staff"
  | "other"
  | "none";

export const AGENT_PREVIOUS_ROLE_OPTIONS: {
  description: string;
  label: string;
  value: AgentPreviousRole;
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
    description: "Hai ricoperto ruoli dirigenziali in un club.",
    label: "Direttore sportivo / Dirigente",
    value: "director",
  },
  {
    description: "Hai svolto attività di osservazione e valutazione.",
    label: "Scout",
    value: "scout",
  },
  {
    description: "Preparazione, match analysis, area medica.",
    label: "Staff tecnico",
    value: "staff",
  },
  {
    description: "Un altro ruolo nel mondo del calcio.",
    label: "Altro",
    value: "other",
  },
  {
    description: "Il tuo percorso inizia come procuratore.",
    label: "Nessuna esperienza precedente",
    value: "none",
  },
];

/**
 * Applica una scelta alla selezione corrente.
 *
 * Toccare "Nessuna esperienza precedente" spegne tutti gli altri ruoli;
 * toccare un ruolo spegne "Nessuna". Ritoccare una voce attiva la deseleziona.
 */
export function toggleAgentPreviousRole(
  selection: AgentPreviousRole[],
  option: AgentPreviousRole,
): AgentPreviousRole[] {
  if (selection.includes(option)) {
    return selection.filter((entry) => entry !== option);
  }

  if (option === "none") {
    return ["none"];
  }

  return [...selection.filter((entry) => entry !== "none"), option];
}

/** Lettura della selezione dai campi del form. */
export function readAgentPreviousRoles(form: {
  agentHasNoPreviousExperience: boolean;
  agentPreviousRoles: string[];
}): AgentPreviousRole[] {
  if (form.agentHasNoPreviousExperience) {
    return ["none"];
  }

  const known = new Set(
    AGENT_PREVIOUS_ROLE_OPTIONS.map((option) => option.value),
  );

  return form.agentPreviousRoles.filter(
    (entry): entry is AgentPreviousRole =>
      known.has(entry as AgentPreviousRole) && entry !== "none",
  );
}

/**
 * Scrittura della selezione sui campi del form.
 *
 * §BI: togliere "Calciatore" non deve lasciare esposta una carriera che
 * l'utente non dichiara più, quindi il ramo viene svuotato. Il flag legacy
 * `agentHasPlayedFootball` resta allineato alla selezione (§BQ).
 */
export function buildAgentPreviousRolesPatch(selection: AgentPreviousRole[]) {
  const hasPlayed = selection.includes("player");

  return {
    agentHasNoPreviousExperience: selection.includes("none"),
    agentHasOtherFootballExperience: selection.some(
      (entry) => entry !== "none" && entry !== "player",
    ),
    agentHasPlayedFootball: hasPlayed,
    agentPreviousRoles: selection.filter((entry) => entry !== "none"),
    ...(hasPlayed ? {} : { agentPlayerCareerEntries: [] }),
  };
}

/**
 * Passo successivo a "Esperienze precedenti".
 *
 * `null` quando non resta nessun sotto-flusso: si prosegue con "Opportunità
 * e contatti" (§BG).
 */
export function getNextAgentStepAfterPreviousRoles(
  selection: AgentPreviousRole[],
): OnboardingStep {
  return selection.includes("player")
    ? "agent_player_career"
    : "agent_contact_preferences";
}
