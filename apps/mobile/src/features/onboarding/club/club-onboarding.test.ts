import { describe, expect, it } from "vitest";

import {
  defaultOnboardingFormState,
  getNextOnboardingStep,
  getOnboardingProgress,
  getOnboardingVisibleSteps,
  getPreviousOnboardingStep,
  normalizeOnboardingDraft,
  validateOnboardingStep,
  type OnboardingFormState,
} from "../onboarding-form";
import { getOnboardingCounter } from "../ui";
import {
  buildClubStructurePatch,
  deriveLegacyClubStructure,
  type ClubStructure,
} from "./club-structure";
import { normalizeClubChannelValue } from "./club-channels";
import { CLUB_YOUTH_CATEGORY_OPTIONS } from "./club-taxonomy";

function clubForm(patch: Partial<OnboardingFormState> = {}): OnboardingFormState {
  return {
    ...defaultOnboardingFormState,
    role: "club_admin",
    ...patch,
  };
}

function stepsFor(structure: ClubStructure) {
  return getOnboardingVisibleSteps("club_admin", structure).map(
    (entry) => entry.step,
  );
}

describe("REV-ONB-05 — flusso condizionale della Società (§S)", () => {
  it("mostra la Prima squadra e salta il vivaio per FIRST_TEAM_ONLY", () => {
    expect(stepsFor("first_team_only")).toEqual([
      "role",
      "club_representative",
      "club_data",
      "club_structure",
      "club_first_team",
      "club_contacts",
      "club_profile",
    ]);
  });

  it("mostra entrambi gli step per FIRST_TEAM_AND_YOUTH", () => {
    expect(stepsFor("first_team_and_youth")).toContain("club_first_team");
    expect(stepsFor("first_team_and_youth")).toContain("club_youth");
  });

  it("non chiede mai la Prima squadra per YOUTH_ONLY (§Q)", () => {
    const steps = stepsFor("youth_only");

    expect(steps).not.toContain("club_first_team");
    expect(steps).toContain("club_youth");
  });

  it("dallo step Struttura va al vivaio quando non c'è una prima squadra", () => {
    expect(
      getNextOnboardingStep("club_structure", "club_admin", "youth_only"),
    ).toBe("club_youth");
    expect(
      getNextOnboardingStep("club_structure", "club_admin", "first_team_only"),
    ).toBe("club_first_team");
  });

  it("torna indietro sul ramo davvero percorso (§AQ)", () => {
    expect(
      getPreviousOnboardingStep("club_youth", null, "club_admin", "youth_only"),
    ).toBe("club_structure");
    expect(
      getPreviousOnboardingStep(
        "club_youth",
        null,
        "club_admin",
        "first_team_and_youth",
      ),
    ).toBe("club_first_team");
  });
});

describe("REV-ONB-05 — progress indicator (§AP, §BR)", () => {
  it("conta gli step del ramo scelto, senza la scelta profilo", () => {
    const withYouth = getOnboardingCounter(
      getOnboardingVisibleSteps("club_admin", "first_team_and_youth"),
      getOnboardingProgress("club_contacts", "club_admin", "first_team_and_youth")
        .stepIndex,
    );

    expect(withYouth).toMatchObject({ current: 6, label: "Sede e contatti", total: 7 });

    const youthOnly = getOnboardingCounter(
      getOnboardingVisibleSteps("club_admin", "youth_only"),
      getOnboardingProgress("club_contacts", "club_admin", "youth_only").stepIndex,
    );

    // Lo stesso step, un ramo più corto: senza Prima squadra scala di uno.
    expect(youthOnly).toMatchObject({ current: 5, total: 6 });
  });

  it("non supera mai il totale sull'ultimo step di ogni ramo", () => {
    (["first_team_only", "first_team_and_youth", "youth_only"] as const).forEach(
      (structure) => {
        const visible = getOnboardingVisibleSteps("club_admin", structure);
        const counter = getOnboardingCounter(
          visible,
          getOnboardingProgress("club_profile", "club_admin", structure).stepIndex,
        );

        expect(counter.current).toBe(counter.total);
      },
    );
  });
});

describe("REV-ONB-05 — cambio struttura (§T)", () => {
  it("azzera la categoria di prima squadra passando a solo vivaio", () => {
    const patch = buildClubStructurePatch("youth_only");

    expect(patch).toMatchObject({
      clubCategory: "",
      clubHasYouthSector: true,
      clubStructure: "youth_only",
    });
    expect(patch).not.toHaveProperty("clubYouthCategories");
  });

  it("azzera le categorie giovanili passando a sola prima squadra", () => {
    const patch = buildClubStructurePatch("first_team_only");

    expect(patch).toMatchObject({
      clubHasYouthSector: false,
      clubStructure: "first_team_only",
      clubYouthCategories: [],
    });
    expect(patch).not.toHaveProperty("clubCategory");
  });
});

describe("REV-ONB-05 — validazioni (§AY, §AZ)", () => {
  it("richiede nome società e un anno di fondazione plausibile", () => {
    expect(validateOnboardingStep("club_data", clubForm())).toMatchObject({
      clubName: "Inserisci il nome della società.",
    });

    expect(
      validateOnboardingStep(
        "club_data",
        clubForm({ clubFoundingYear: "3200", clubName: "ASD Calcio Milano" }),
      ),
    ).toHaveProperty("clubFoundingYear");

    expect(
      validateOnboardingStep(
        "club_data",
        clubForm({ clubFoundingYear: "1999", clubName: "ASD Calcio Milano" }),
      ),
    ).toEqual({});
  });

  it("richiede la struttura, la categoria e almeno una categoria giovanile", () => {
    expect(validateOnboardingStep("club_structure", clubForm())).toMatchObject({
      clubStructure: "Seleziona la struttura del club.",
    });

    expect(validateOnboardingStep("club_first_team", clubForm())).toMatchObject({
      clubCategory: "Seleziona la categoria della prima squadra.",
    });

    expect(validateOnboardingStep("club_youth", clubForm())).toMatchObject({
      clubYouthCategories:
        "Seleziona almeno una categoria del settore giovanile.",
    });

    expect(
      validateOnboardingStep(
        "club_youth",
        clubForm({ clubYouthCategories: ["Allievi"] }),
      ),
    ).toEqual({});
  });

  it("richiede una città normalizzata e lascia facoltativi i recapiti", () => {
    expect(validateOnboardingStep("club_contacts", clubForm())).toMatchObject({
      clubCity: "Scegli la città della società.",
    });

    expect(
      validateOnboardingStep(
        "club_contacts",
        clubForm({ clubCity: "Milano", clubRegion: "Lombardia" }),
      ),
    ).toEqual({});
  });

  it("non blocca mai l'ultimo step: i campi facoltativi restano vuoti (§AN)", () => {
    expect(validateOnboardingStep("club_profile", clubForm())).toEqual({});
  });
});

describe("REV-ONB-05 — dati legacy (§BC)", () => {
  it("ricostruisce la struttura dai segnali del vecchio onboarding", () => {
    expect(
      deriveLegacyClubStructure({
        clubCategory: "Eccellenza",
        clubHasYouthSector: false,
      }),
    ).toBe("first_team_only");

    expect(
      deriveLegacyClubStructure({
        clubCategory: "Eccellenza",
        clubHasYouthSector: true,
      }),
    ).toBe("first_team_and_youth");

    expect(
      deriveLegacyClubStructure({
        clubCategory: "",
        clubHasYouthSector: true,
        clubYouthCategories: ["Allievi"],
      }),
    ).toBe("youth_only");

    expect(deriveLegacyClubStructure({})).toBe("");
  });

  it("normalizza una bozza legacy senza perdere i dati già inseriti", () => {
    const draft = normalizeOnboardingDraft({
      clubCategory: "Promozione",
      clubHasYouthSector: true,
      clubName: "ASD Calcio Milano",
      clubYouthCategories: ["Allievi"],
      role: "club_admin",
    });

    expect(draft.clubStructure).toBe("first_team_and_youth");
    expect(draft.clubName).toBe("ASD Calcio Milano");
    expect(draft.clubYouthCategories).toEqual(["Allievi"]);
  });
});

describe("REV-ONB-05 — tassonomia e canali (§Y, §AM)", () => {
  it("usa le macro-categorie del vivaio, non l'elenco delle annate", () => {
    expect(CLUB_YOUTH_CATEGORY_OPTIONS.map((option) => option.value)).toEqual([
      "Primavera",
      "Juniores",
      "Allievi",
      "Giovanissimi",
      "Attività di base",
    ]);
  });

  it("accetta sia URL completi sia username", () => {
    expect(normalizeClubChannelValue("website", "www.societa.it")).toBe(
      "https://www.societa.it",
    );
    expect(normalizeClubChannelValue("website", "https://societa.it")).toBe(
      "https://societa.it",
    );
    expect(normalizeClubChannelValue("instagram", "societa")).toBe("@societa");
    expect(normalizeClubChannelValue("instagram", "@societa")).toBe("@societa");
    expect(
      normalizeClubChannelValue("instagram", "https://instagram.com/societa"),
    ).toBe("https://instagram.com/societa");
    expect(normalizeClubChannelValue("website", "  ")).toBe("");
  });
});
