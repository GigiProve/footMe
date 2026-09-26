import { describe, expect, it } from "vitest";

import {
  getNationalityCategory,
} from "../profiles/profile-form-utils";
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
      nationality: "Questo campo è obbligatorio",
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
    });
    // residence only required when nationality is set to Italy
    expect(errors.residence).toBeUndefined();
    expect(errors.gender).toBeUndefined();
  });

  it("requires residence for Italian agents when nationality is IT", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      role: "agent",
      nationality: "IT",
      birthDate: "1990-01-01",
      firstName: "Marco",
      lastName: "Rossi",
      phoneNumber: "+393401234567",
    });

    expect(errors).toMatchObject({
      residence: "Questo campo è obbligatorio",
    });
  });

  it("requires the community path before entering the fan or media onboarding", () => {
    const errors = validateOnboardingStep("community_profile_type", {
      ...defaultOnboardingFormState,
      role: "fan",
    });

    expect(errors).toEqual({
      communityProfileType: "Seleziona il tipo di profilo per continuare.",
    });
  });

  it("validates the simplified media basic step", () => {
    const errors = validateOnboardingStep("media_basic", {
      ...defaultOnboardingFormState,
      role: "media",
    });

    expect(errors).toMatchObject({
      birthDate: "Questo campo è obbligatorio",
      firstName: "Questo campo è obbligatorio",
      lastName: "Questo campo è obbligatorio",
    });
    expect(errors.gender).toBeUndefined();
  });

  it("blocks invalid residence and phone values for Italian users", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "2001-03-11",
      firstName: "Marco",
      gender: "male",
      lastName: "Rossi",
      nationality: "IT",
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

  it("validates domicile when Italian user opts for a different domicile", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "2001-03-11",
      firstName: "Marco",
      gender: "male",
      lastName: "Rossi",
      nationality: "IT",
      role: "player",
      useResidenceForDomicile: false,
      domicile: "Milx",
      domicileRegion: "",
    });

    expect(errors).toMatchObject({
      domicile: "Seleziona una città valida dai suggerimenti.",
    });
  });

  it("skips domicile validation for Italian user when useResidenceForDomicile is true", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "2001-03-11",
      firstName: "Marco",
      gender: "male",
      lastName: "Rossi",
      nationality: "IT",
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

  // REV-ONB-06 §S, §U: la fascia è l'unico dato obbligatorio del portfolio.
  // Collegare calciatori resta facoltativo anche dichiarando "6–15".
  it("requires only the portfolio range for the procurator onboarding", () => {
    expect(
      validateOnboardingStep("agent_portfolio", {
        ...defaultOnboardingFormState,
        role: "agent",
      }),
    ).toEqual({
      agentPortfolioRange: "Seleziona la dimensione del portfolio.",
    });

    expect(
      validateOnboardingStep("agent_portfolio", {
        ...defaultOnboardingFormState,
        agentPortfolioRange: "6_15",
        role: "agent",
      }),
    ).toEqual({});
  });

  // REV-ONB-06 §I: a chi lavora per conto proprio non si chiede un'agenzia.
  it("skips the agency fields for an independent procurator", () => {
    expect(
      validateOnboardingStep("agent_professional", {
        ...defaultOnboardingFormState,
        role: "agent",
      }),
    ).toEqual({ agentProfessionalMode: "Seleziona come lavori." });

    expect(
      validateOnboardingStep("agent_professional", {
        ...defaultOnboardingFormState,
        agentProfessionalMode: "independent",
        role: "agent",
      }),
    ).toEqual({});

    expect(
      validateOnboardingStep("agent_professional", {
        ...defaultOnboardingFormState,
        agentProfessionalMode: "agency",
        role: "agent",
      }),
    ).toEqual({
      agentAgencyName: "Inserisci il nome dell'agenzia o dello studio.",
      agentAgencyRole: "Seleziona il tuo ruolo attuale.",
    });
  });

  // REV-ONB-06 §O: non avere un'abilitazione non è un errore.
  it("lets a procurator continue without a professional qualification", () => {
    expect(
      validateOnboardingStep("agent_qualification", {
        ...defaultOnboardingFormState,
        role: "agent",
      }),
    ).toEqual({});

    expect(
      validateOnboardingStep("agent_qualification", {
        ...defaultOnboardingFormState,
        agentIsFederationLicensed: true,
        role: "agent",
      }),
    ).toEqual({ agentFederation: "Seleziona la federazione o l'ente." });
  });

  /**
   * REV-ONB-08 §N: senza almeno una tipologia non c'è nulla da personalizzare,
   * quindi è l'unico obbligo dello step.
   */
  it("requires at least one kind of football before continuing", () => {
    expect(
      validateOnboardingStep("fan_football_types", {
        ...defaultOnboardingFormState,
        role: "fan",
      }),
    ).toEqual({
      fanFootballTypes: "Seleziona almeno una tipologia di calcio da seguire.",
    });

    expect(
      validateOnboardingStep("fan_football_types", {
        ...defaultOnboardingFormState,
        fanFootballTypes: ["amateur"],
        role: "fan",
      }),
    ).toEqual({});
  });

  /**
   * §R, §AL: "Tutta Italia" è già una risposta completa; le altre due
   * modalità valgono solo con il loro dettaglio.
   */
  it("requires the detail of the selected geographic mode", () => {
    expect(
      validateOnboardingStep("fan_territories", {
        ...defaultOnboardingFormState,
        role: "fan",
      }),
    ).toEqual({});

    expect(
      validateOnboardingStep("fan_territories", {
        ...defaultOnboardingFormState,
        fanGeoScope: "REGIONS",
        role: "fan",
      }),
    ).toEqual({ fanGeoScope: "Seleziona almeno una regione." });

    expect(
      validateOnboardingStep("fan_territories", {
        ...defaultOnboardingFormState,
        fanGeoScope: "PROVINCES",
        role: "fan",
      }),
    ).toEqual({ fanGeoScope: "Seleziona almeno una provincia." });

    expect(
      validateOnboardingStep("fan_territories", {
        ...defaultOnboardingFormState,
        fanGeoScope: "PROVINCES",
        fanProvinces: ["Milano"],
        role: "fan",
      }),
    ).toEqual({});
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
      stepIndex: 5,
      totalSteps: 6,
    });
    expect(getPreviousOnboardingStep("complete")).toBe("experience");
    expect(getPreviousOnboardingStep("complete", null, "club_admin")).toBe("club_profile");
    // REV-ONB-04 §AE, §AJ: il bivio "hai giocato?" è diventato la
    // multi-selezione "Esperienze precedenti", con due sotto-flussi opzionali.
    expect(getPreviousOnboardingStep("complete", null, "staff")).toBe("staff_previous_experiences");
    expect(getPreviousOnboardingStep("complete", "staff_coach_career", "staff")).toBe("staff_coach_career");
    expect(getPreviousOnboardingStep("complete", "staff_player_career", "staff")).toBe("staff_player_career");
    expect(getPreviousOnboardingStep("staff_player_career", "staff_coach_career", "staff")).toBe("staff_coach_career");
    expect(getPreviousOnboardingStep("staff_player_career", "staff_previous_experiences", "staff")).toBe("staff_previous_experiences");
  });

  // REV-ONB-06 §BF, §BG: la carriera da calciatore è condizionale e non
  // allunga il contatore; il Back rientra nel ramo davvero percorso.
  it("keeps the procurator counter stable across the optional career branch", () => {
    expect(getOnboardingProgress("base", "agent")).toMatchObject({
      stepIndex: 0,
      totalSteps: 9,
    });
    expect(
      getOnboardingProgress("agent_previous_experiences", "agent"),
    ).toMatchObject({ stepIndex: 6, totalSteps: 9 });
    expect(getOnboardingProgress("agent_player_career", "agent")).toMatchObject({
      stepIndex: 6,
      totalSteps: 9,
    });
    expect(getOnboardingProgress("agent_presentation", "agent")).toMatchObject({
      percentage: 100,
      stepIndex: 8,
      totalSteps: 9,
    });

    expect(
      getPreviousOnboardingStep(
        "agent_contact_preferences",
        "agent_previous_experiences",
        "agent",
      ),
    ).toBe("agent_previous_experiences");
    expect(
      getPreviousOnboardingStep(
        "agent_contact_preferences",
        "agent_player_career",
        "agent",
      ),
    ).toBe("agent_player_career");
    expect(getPreviousOnboardingStep("complete", null, "agent")).toBe(
      "agent_presentation",
    );
  });

  // REV-ONB-06 §BQ: una bozza del vecchio onboarding Agente rientra sul passo
  // Procuratore che raccoglie le stesse informazioni.
  it("migrates a legacy agent draft onto the procurator steps", () => {
    expect(getOnboardingProgress("agent_agency", "agent").currentStep?.step).toBe(
      "agent_professional",
    );
    expect(
      getOnboardingProgress("agent_verification", "agent").currentStep?.step,
    ).toBe("agent_qualification");
    expect(getOnboardingProgress("agent_players", "agent").currentStep?.step).toBe(
      "agent_portfolio",
    );
    expect(
      getOnboardingProgress("agent_football_experience", "agent").currentStep
        ?.step,
    ).toBe("agent_previous_experiences");
    expect(
      getOnboardingProgress("agent_availability", "agent").currentStep?.step,
    ).toBe("agent_contact_preferences");
    expect(getOnboardingProgress("agent_extra", "agent").currentStep?.step).toBe(
      "agent_presentation",
    );
  });

  /**
   * REV-ONB-07 §AM: i quattro sotto-flussi condividono la posizione di
   * "Altre esperienze nel calcio", così il contatore non cambia lunghezza a
   * seconda dei rami aperti.
   */
  it("maps the director sub-flows to the previous-experience progress group", () => {
    for (const step of [
      "director_player_career",
      "director_coach_career",
      "director_staff_career",
      "director_other_career",
    ] as const) {
      expect(getOnboardingProgress(step, "director")).toMatchObject({
        stepIndex: 8,
        totalSteps: 10,
      });
    }
  });

  /**
   * §AN: il Back rientra nel ramo davvero percorso, non in uno mai aperto.
   */
  it("returns the director back step to the sub-flow actually visited", () => {
    expect(
      getPreviousOnboardingStep(
        "director_extra",
        "director_coach_career",
        "director",
      ),
    ).toBe("director_coach_career");
    expect(
      getPreviousOnboardingStep(
        "director_extra",
        "director_previous_experiences",
        "director",
      ),
    ).toBe("director_previous_experiences");
    expect(
      getPreviousOnboardingStep(
        "director_staff_career",
        "director_player_career",
        "director",
      ),
    ).toBe("director_player_career");
    // Un ramo successivo non può essere il passo precedente di se stesso.
    expect(
      getPreviousOnboardingStep(
        "director_player_career",
        "director_other_career",
        "director",
      ),
    ).toBe("director_previous_experiences");
  });

  /**
   * §K, §AW: una bozza ferma su una schermata rimossa riprende dal passo che
   * oggi raccoglie le stesse informazioni.
   */
  it("migrates director drafts parked on removed steps", () => {
    expect(
      normalizeOnboardingDraft({ currentStep: "director_categories" })
        .currentStep,
    ).toBe("director_responsibilities");
    expect(
      normalizeOnboardingDraft({ currentStep: "director_market" }).currentStep,
    ).toBe("director_focus");
    expect(
      normalizeOnboardingDraft({ currentStep: "director_football_experience" })
        .currentStep,
    ).toBe("director_previous_experiences");
    expect(
      normalizeOnboardingDraft({ currentStep: "director_club_type" })
        .currentStep,
    ).toBe("director_extra");
  });

  it("derives director previous roles from the legacy football-experience flags", () => {
    expect(
      normalizeOnboardingDraft({
        directorHasPlayedFootball: true,
        directorOtherFootballRoles: ["Allenatore", "Preparatore atletico"],
      }).directorPreviousRoles,
    ).toEqual(["coach", "staff", "player"]);
  });

  it("normalizes director coach career draft entries with descriptions", () => {
    const draft = normalizeOnboardingDraft({
      directorCoachCareerEntries: [
        {
          category: "Under 17",
          description: "Gestione gruppo e sviluppo tecnico.",
          id: "director-coach-1",
          period: null,
          role: "Allenatore Under 17",
          seasonDetails: undefined as never,
          seasons: ["2018/2019"],
          teamName: "Como Academy",
          type: "SINGLE_SEASON",
        },
      ],
    });

    expect(draft.directorCoachCareerEntries).toEqual([
      expect.objectContaining({
        description: "Gestione gruppo e sviluppo tecnico.",
        seasonDetails: {},
      }),
    ]);
  });

  // ---------------------------------------------------------------------------
  // Nationality category classification
  // ---------------------------------------------------------------------------

  it("classifies Italy as 'italy'", () => {
    expect(getNationalityCategory("IT")).toBe("italy");
  });

  it("classifies EU member states as 'eu'", () => {
    expect(getNationalityCategory("DE")).toBe("eu");
    expect(getNationalityCategory("FR")).toBe("eu");
    expect(getNationalityCategory("ES")).toBe("eu");
    expect(getNationalityCategory("PT")).toBe("eu");
    expect(getNationalityCategory("SE")).toBe("eu");
  });

  it("classifies non-EU countries as 'non_eu'", () => {
    expect(getNationalityCategory("BR")).toBe("non_eu");
    expect(getNationalityCategory("US")).toBe("non_eu");
    expect(getNationalityCategory("AR")).toBe("non_eu");
    expect(getNationalityCategory("MA")).toBe("non_eu");
  });

  it("returns 'non_eu' for empty or null nationality codes", () => {
    expect(getNationalityCategory("")).toBe("non_eu");
    expect(getNationalityCategory(null)).toBe("non_eu");
    expect(getNationalityCategory(undefined)).toBe("non_eu");
  });

  // ---------------------------------------------------------------------------
  // EU/non-EU base step validation
  // ---------------------------------------------------------------------------

  it("requires international location fields for EU users", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "1990-01-01",
      firstName: "Carlos",
      gender: "male",
      lastName: "García",
      nationality: "ES",
      role: "player",
    });

    expect(errors).toMatchObject({
      residenceCountry: "Questo campo è obbligatorio",
      currentLocationCountry: "Questo campo è obbligatorio",
      currentLocationCity: "Questo campo è obbligatorio",
    });
    expect(errors.residence).toBeUndefined();
    expect(errors.domicile).toBeUndefined();
    expect(errors.legalStatus).toBeUndefined();
  });

  it("requires international location fields + legal status for non-EU users", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "1990-01-01",
      firstName: "João",
      gender: "male",
      lastName: "Silva",
      nationality: "BR",
      role: "player",
    });

    expect(errors).toMatchObject({
      residenceCountry: "Questo campo è obbligatorio",
      currentLocationCountry: "Questo campo è obbligatorio",
      currentLocationCity: "Questo campo è obbligatorio",
      legalStatus: "Questo campo è obbligatorio",
    });
    expect(errors.residence).toBeUndefined();
    expect(errors.domicile).toBeUndefined();
  });

  it("passes base validation for a fully filled EU user", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "1990-01-01",
      firstName: "Carlos",
      gender: "male",
      lastName: "García",
      nationality: "ES",
      residenceCountry: "ES",
      residenceCity: "Madrid",
      currentLocationCountry: "IT",
      currentLocationCity: "Milano",
      role: "player",
    });

    expect(errors).toEqual({});
  });

  it("passes base validation for a fully filled non-EU user", () => {
    const errors = validateOnboardingStep("base", {
      ...defaultOnboardingFormState,
      birthDate: "1990-01-01",
      firstName: "João",
      gender: "male",
      lastName: "Silva",
      nationality: "BR",
      residenceCountry: "BR",
      residenceCity: "São Paulo",
      currentLocationCountry: "IT",
      currentLocationCity: "Roma",
      legalStatus: "has_permit",
      role: "player",
    });

    expect(errors).toEqual({});
  });

  it("maps fan and media progress to the new community flows", () => {
    expect(getOnboardingProgress("community_profile_type", "fan")).toMatchObject({
      percentage: 20,
      stepIndex: 0,
      totalSteps: 5,
    });
    expect(getOnboardingProgress("media_channels", "media")).toMatchObject({
      percentage: 88,
      stepIndex: 6,
      totalSteps: 8,
    });
    expect(getPreviousOnboardingStep("complete", null, "fan")).toBe(
      "fan_territories",
    );
    expect(getPreviousOnboardingStep("complete", null, "media")).toBe(
      "media_collaborations",
    );
  });

  /**
   * REV-ONB-08 §AK, §AU: una bozza aperta con il vecchio flusso Appassionato
   * non deve ricominciare da zero né puntare a schermate rimosse.
   */
  it("migrates legacy fan drafts onto the master steps", () => {
    const draft = normalizeOnboardingDraft({
      currentStep: "fan_interests",
      lastCompletedStep: "fan_photo",
      role: "fan",
    });

    expect(draft.currentStep).toBe("fan_football_types");
    expect(draft.lastCompletedStep).toBe("photo");
    expect(draft.fanGeoScope).toBe("ITALY");
    expect(draft.fanFootballTypes).toEqual([]);
  });

  it("keeps only the known football types when rereading a draft", () => {
    const draft = normalizeOnboardingDraft({
      // Una bozza salvata è JSON: può contenere token che oggi non esistono più.
      fanFootballTypes: ["amateur", "serie-a", "women"] as never,
      role: "fan",
    });

    expect(draft.fanFootballTypes).toEqual(["amateur", "women"]);
  });
});
