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

  it("validates domicile when user opts for a different domicile", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "2001-03-11",
      firstName: "Marco",
      gender: "male",
      lastName: "Rossi",
      role: "player",
      useResidenceForDomicile: false,
      domicile: "Milx",
      domicileRegion: "",
    });

    expect(errors).toMatchObject({
      domicile: "Seleziona una città valida dai suggerimenti.",
    });
  });

  it("skips domicile validation when useResidenceForDomicile is true", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "2001-03-11",
      firstName: "Marco",
      gender: "male",
      lastName: "Rossi",
      role: "player",
      useResidenceForDomicile: true,
      domicile: "Milx",
      domicileRegion: "",
    });

    expect(errors).toEqual({});
  });

  it("requires primary position for player in technical step", () => {
    const errors = validateOnboardingStep("technical", {
      ...defaultOnboardingFormState,
      role: "player",
    });

    expect(errors).toEqual({
      primaryPosition: "Seleziona il ruolo principale per continuare.",
    });
  });

  it("passes technical validation when primary position is set", () => {
    const errors = validateOnboardingStep("technical", {
      ...defaultOnboardingFormState,
      primaryPosition: "striker",
      role: "player",
    });

    expect(errors).toEqual({});
  });

  it("still validates the legacy details step for backward compatibility", () => {
    const errors = validateOnboardingStep("details", {
      ...defaultOnboardingFormState,
      role: "player",
    });

    expect(errors).toEqual({
      primaryPosition: "Seleziona il ruolo principale per continuare.",
    });
  });

  it("normalizes invalid persisted steps and clears transient upload state", () => {
    // Backward compatibility: older drafts persisted one secondaryPosition string.
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
      stepIndex: 4,
      totalSteps: 5,
    });
    expect(getPreviousOnboardingStep("complete")).toBe("experience");
    expect(getPreviousOnboardingStep("complete", null, "club_admin")).toBe("club");
  });
});
