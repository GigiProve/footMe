import { describe, expect, it } from "vitest";

import {
  defaultOnboardingFormState,
  getOnboardingProgress,
  getPreviousOnboardingStep,
  normalizeOnboardingDraft,
  validateOnboardingStep,
} from "./onboarding-form";

describe("onboarding-form", () => {
  it("requires an explicit role selection before continuing", () => {
    const errors = validateOnboardingStep("role", defaultOnboardingFormState);

    expect(errors).toEqual({
      role: "Seleziona un ruolo per continuare.",
    });
  });

  it("maps missing required base fields to field-level errors", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      role: "club_admin",
    });

    expect(errors).toMatchObject({
      birthDate: "Questo campo è obbligatorio",
      clubCity: "Questo campo è obbligatorio",
      clubName: "Questo campo è obbligatorio",
      clubRegion: "Questo campo è obbligatorio",
      firstName: "Questo campo è obbligatorio",
      gender: "Questo campo è obbligatorio",
      lastName: "Questo campo è obbligatorio",
    });
  });

  it("blocks invalid residence and phone values while allowing optional empty fields", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "2001-03-11",
      firstName: "Marco",
      gender: "male",
      lastName: "Rossi",
      phoneCountryCode: "+39",
      phoneNumber: "123",
      residence: "Milx",
      residenceRegion: "",
      role: "player",
    });

    expect(errors).toMatchObject({
      phoneNumber: "Inserisci un numero di cellulare valido.",
      residence: "Seleziona una città valida dai suggerimenti.",
    });
  });

  it("validates the details step through the centralized bio validator", () => {
    const errors = validateOnboardingStep("details", {
      ...defaultOnboardingFormState,
      bio: "Troppo corta",
      primaryPosition: "striker",
      role: "player",
    });

    expect(errors).toEqual({
      bio: "La bio deve contenere almeno 20 caratteri.",
    });
  });

  it("requires an explicit primary position selection for player details", () => {
    const errors = validateOnboardingStep("details", {
      ...defaultOnboardingFormState,
      bio: "Sono un centrocampista dinamico con esperienza tra prima squadra e juniores.",
      role: "player",
    });

    expect(errors).toEqual({
      primaryPosition: "Seleziona il ruolo principale per continuare.",
    });
  });

  it("normalizes invalid persisted steps and clears transient upload state", () => {
    const draft = normalizeOnboardingDraft({
      currentStep: "unexpected-step" as never,
      firstName: "Marco",
      secondaryPosition: "left_winger",
      uploadingField: "avatar",
    } as Partial<typeof defaultOnboardingFormState> & { secondaryPosition: string });

    expect(draft.currentStep).toBe("role");
    expect(draft.firstName).toBe("Marco");
    expect(draft.secondaryPositions).toEqual(["left_winger"]);
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
