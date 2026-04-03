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
      role: "player",
    });

    expect(errors).toMatchObject({
      birthDate: "Questo campo è obbligatorio",
      firstName: "Questo campo è obbligatorio",
      gender: "Questo campo è obbligatorio",
      lastName: "Questo campo è obbligatorio",
    });
  });

  it("uses the Banani-aligned base validation for agents", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      role: "agent",
    });

    expect(errors).toMatchObject({
      birthDate: "Questo campo è obbligatorio",
      firstName: "Questo campo è obbligatorio",
      lastName: "Questo campo è obbligatorio",
      nationality: "Questo campo è obbligatorio",
      phoneNumber: "Questo campo è obbligatorio",
      residence: "Questo campo è obbligatorio",
    });
    expect(errors.gender).toBeUndefined();
  });

  it("requires the community profile type before entering fan or media onboarding", () => {
    const errors = validateOnboardingStep("community_profile_type", {
      ...defaultOnboardingFormState,
      role: "fan",
    });

    expect(errors).toEqual({
      communityProfileType: "Seleziona il tipo di profilo per continuare.",
    });
  });

  it("validates the simplified fan/media basic step", () => {
    const errors = validateOnboardingStep("fan_basic", {
      ...defaultOnboardingFormState,
      role: "fan",
    });

    expect(errors).toMatchObject({
      birthDate: "Questo campo è obbligatorio",
      firstName: "Questo campo è obbligatorio",
      lastName: "Questo campo è obbligatorio",
    });
    expect(errors.gender).toBeUndefined();
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

  it("requires at least one staff role before continuing", () => {
    const errors = validateOnboardingStep("staff_role", {
      ...defaultOnboardingFormState,
      role: "staff",
    });

    expect(errors).toEqual({
      staffRoles: "Seleziona almeno un ruolo per continuare.",
    });
  });

  it("requires a primary staff role when multiple roles are selected", () => {
    const errors = validateOnboardingStep("staff_role", {
      ...defaultOnboardingFormState,
      role: "staff",
      staffRoles: ["Preparatore atletico", "Match analyst"],
    });

    expect(errors).toEqual({
      staffPrimaryRole: "Seleziona il ruolo principale per continuare.",
    });
  });

  it("accepts a single staff role without extra primary-role friction", () => {
    const errors = validateOnboardingStep("staff_role", {
      ...defaultOnboardingFormState,
      role: "staff",
      staffPrimaryRole: "Preparatore atletico",
      staffRoles: ["Preparatore atletico"],
    });

    expect(errors).toEqual({});
  });

  it("requires portfolio data for the agent onboarding", () => {
    const errors = validateOnboardingStep("agent_portfolio", {
      ...defaultOnboardingFormState,
      role: "agent",
    });

    expect(errors).toEqual({
      agentMainPlayerRoles: "Seleziona almeno un ruolo principale.",
      agentPlayerTypes: "Seleziona almeno un profilo di calciatore.",
    });
  });

  it("requires fast interests before completing the fan onboarding", () => {
    const errors = validateOnboardingStep("fan_interests", {
      ...defaultOnboardingFormState,
      role: "fan",
    });

    expect(errors).toEqual({
      fanInterestCategories: "Seleziona almeno una categoria di interesse.",
      fanInterestRegions: "Seleziona almeno una regione di interesse.",
    });
  });

  it("requires media page details and editorial selections", () => {
    expect(
      validateOnboardingStep("media_entity", {
        ...defaultOnboardingFormState,
        role: "media",
      }),
    ).toEqual({
      mediaEntityName: "Inserisci il nome della tua pagina, testata o realtà.",
    });

    expect(
      validateOnboardingStep("media_content", {
        ...defaultOnboardingFormState,
        role: "media",
      }),
    ).toEqual({
      mediaContentTypes: "Seleziona almeno un tipo di contenuto.",
    });

    expect(
      validateOnboardingStep("media_focus", {
        ...defaultOnboardingFormState,
        role: "media",
      }),
    ).toEqual({
      mediaFocusAreas: "Seleziona almeno un ambito principale.",
    });
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
    expect(getPreviousOnboardingStep("complete", null, "club_admin")).toBe("club_profile");
    expect(getPreviousOnboardingStep("complete", null, "staff")).toBe("staff_player_career_toggle");
    expect(getPreviousOnboardingStep("complete", "staff_player_career", "staff")).toBe("staff_player_career");
  });

  it("maps agent optional substeps to the expected progress and back navigation", () => {
    expect(getOnboardingProgress("base", "agent")).toMatchObject({
      percentage: 13,
      stepIndex: 0,
      totalSteps: 8,
    });
    expect(getOnboardingProgress("agent_player_career", "agent")).toMatchObject({
      percentage: 63,
      stepIndex: 4,
      totalSteps: 8,
    });
    expect(getOnboardingProgress("agent_extra", "agent")).toMatchObject({
      percentage: 100,
      stepIndex: 7,
      totalSteps: 8,
    });
    expect(
      getPreviousOnboardingStep("agent_portfolio", "agent_player_career_toggle", "agent"),
    ).toBe("agent_player_career_toggle");
    expect(
      getPreviousOnboardingStep("agent_portfolio", "agent_player_career", "agent"),
    ).toBe("agent_player_career");
    expect(getPreviousOnboardingStep("complete", null, "agent")).toBe("agent_extra");
  });

  it("maps fan and media progress to the new community flows", () => {
    expect(getOnboardingProgress("community_profile_type", "fan")).toMatchObject({
      percentage: 25,
      stepIndex: 0,
      totalSteps: 4,
    });
    expect(getOnboardingProgress("media_channels", "media")).toMatchObject({
      percentage: 88,
      stepIndex: 6,
      totalSteps: 8,
    });
    expect(getPreviousOnboardingStep("complete", null, "fan")).toBe("fan_interests");
    expect(getPreviousOnboardingStep("complete", null, "media")).toBe(
      "media_collaborations",
    );
  });
});
