import type { OnboardingVisibleStep } from "../onboarding-form";

/**
 * Contatore mostrato nell'header (§G).
 *
 * La scelta del macro-ruolo è una fase preliminare: non entra nel conteggio.
 * Una volta scelto il ruolo il contatore appartiene al ramo, quindi la sua
 * lunghezza cambia legittimamente da un profilo all'altro.
 */
export function getOnboardingCounter(
  visibleSteps: OnboardingVisibleStep[],
  stepIndex: number,
) {
  const countedSteps = visibleSteps.filter((entry) => entry.step !== "role");
  const roleOffset = visibleSteps.length - countedSteps.length;
  const current = stepIndex - roleOffset + 1;

  return {
    current: Math.min(Math.max(current, 1), Math.max(countedSteps.length, 1)),
    label: visibleSteps[stepIndex]?.label ?? "",
    total: countedSteps.length,
  };
}
