/**
 * Esperienze precedenti dello Staff tecnico (REV-ONB-04 §AE–§AK).
 *
 * È una selezione multipla, non un bivio: Allenatore e Calciatore possono
 * convivere. "Nessuna esperienza aggiuntiva" è l'unica opzione esclusiva e si
 * annulla a vicenda con le altre due (§AG).
 *
 * I sotto-flussi arricchiscono lo stesso profilo Staff: nessuna di queste
 * scelte cambia il tipo di profilo principale (§AK).
 */
import type { OnboardingStep } from "../onboarding-form";

export type StaffPreviousExperience = "coach" | "player" | "none";

/** Ordine consigliato dei sotto-flussi: prima l'Allenatore, poi il Calciatore (§AJ). */
const SUB_FLOW_ORDER: StaffPreviousExperience[] = ["coach", "player"];

/**
 * Applica una scelta alla selezione corrente.
 *
 * Toccare "Nessuna" spegne Allenatore e Calciatore; toccare Allenatore o
 * Calciatore spegne "Nessuna". Ritoccare una voce già attiva la deseleziona.
 */
export function toggleStaffPreviousExperience(
  selection: StaffPreviousExperience[],
  option: StaffPreviousExperience,
): StaffPreviousExperience[] {
  if (selection.includes(option)) {
    return selection.filter((entry) => entry !== option);
  }

  if (option === "none") {
    return ["none"];
  }

  const withoutNone = selection.filter((entry) => entry !== "none");

  return [...withoutNone, option];
}

/** Lettura della selezione dai flag del form. */
export function readStaffPreviousExperiences(form: {
  staffHasCoachedFootball: boolean;
  staffHasPlayedFootball: boolean;
  staffHasNoPreviousExperience: boolean;
}): StaffPreviousExperience[] {
  if (form.staffHasNoPreviousExperience) {
    return ["none"];
  }

  const selection: StaffPreviousExperience[] = [];

  if (form.staffHasCoachedFootball) {
    selection.push("coach");
  }

  if (form.staffHasPlayedFootball) {
    selection.push("player");
  }

  return selection;
}

/** Scrittura della selezione sui flag del form. */
export function buildStaffPreviousExperiencePatch(
  selection: StaffPreviousExperience[],
) {
  return {
    staffHasCoachedFootball: selection.includes("coach"),
    staffHasNoPreviousExperience: selection.includes("none"),
    staffHasPlayedFootball: selection.includes("player"),
  };
}

/**
 * Passo successivo alla schermata "Esperienze precedenti".
 *
 * `null` significa che non resta nessun sotto-flusso: si chiude l'onboarding.
 */
export function getNextStaffSubFlowStep(
  selection: StaffPreviousExperience[],
  completed: StaffPreviousExperience[] = [],
): OnboardingStep | null {
  const pending = SUB_FLOW_ORDER.find(
    (entry) => selection.includes(entry) && !completed.includes(entry),
  );

  if (pending === "coach") {
    return "staff_coach_career";
  }

  if (pending === "player") {
    return "staff_player_career";
  }

  return null;
}
