import { describe, expect, it } from "vitest";

import {
  defaultOnboardingFormState,
  getOnboardingProgress,
  getPreviousOnboardingStep,
  normalizeOnboardingDraft,
  validateOnboardingStep,
} from "./onboarding-form";

describe("onboarding-form", () => {
  it("maps missing required base fields to field-level errors", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      role: "club_admin",
    });

    expect(errors).toMatchObject({
      birthDate: "Seleziona la data di nascita.",
      clubCity: "Inserisci la città della società.",
      clubName: "Inserisci il nome della società.",
      clubRegion: "Seleziona la regione della società.",
      domicile: "Inserisci il domicilio.",
      firstName: "Inserisci il nome.",
      lastName: "Inserisci il cognome.",
      nationality: "Seleziona la nazionalità.",
      residence: "Inserisci la residenza.",
    });
  });

  it("validates the details step through the centralized bio validator", () => {
    const errors = validateOnboardingStep("details", {
      ...defaultOnboardingFormState,
      bio: "Troppo corta",
    });

    expect(errors).toEqual({
      bio: "La bio deve contenere almeno 20 caratteri.",
    });
  });

  it("normalizes invalid persisted steps and clears transient upload state", () => {
    const draft = normalizeOnboardingDraft({
      currentStep: "unexpected-step" as never,
      firstName: "Marco",
      uploadingField: "avatar",
    });

    expect(draft.currentStep).toBe("role");
    expect(draft.firstName).toBe("Marco");
    expect(draft.uploadingField).toBeNull();
  });

  it("reports progress and previous-step fallback for the completion screen", () => {
    expect(getOnboardingProgress("complete")).toMatchObject({
      percentage: 100,
      stepIndex: 3,
      totalSteps: 4,
    });
    expect(getPreviousOnboardingStep("complete", "details")).toBe("details");
    expect(getPreviousOnboardingStep("complete", "decision")).toBe("decision");
  });
});
