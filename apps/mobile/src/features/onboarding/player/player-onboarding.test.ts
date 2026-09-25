import { describe, expect, it } from "vitest";

import {
  defaultOnboardingFormState,
  validateOnboardingStep,
} from "../onboarding-form";
import {
  buildAvailabilityRecap,
  buildAvailabilitySummary,
  buildSelectionCountLabel,
  getAvailabilityErrorMessage,
  isAvailabilityComplete,
  resolveActiveAvailability,
  type GeographicAvailabilityDraft,
} from "./geographic-availability";
import {
  PITCH_SLOTS,
  getPitchSlotAccessibilityLabel,
  getPitchSlotState,
  getSecondaryPositionOptions,
  revalidateSecondaryPosition,
} from "./player-pitch-positions";

function draft(
  overrides: Partial<GeographicAvailabilityDraft> = {},
): GeographicAvailabilityDraft {
  return { mode: "ITALY", provinces: [], regions: [], ...overrides };
}

describe("disponibilità geografica", () => {
  it("su tutta Italia non lascia attive regioni o province", () => {
    const withLeftovers = draft({
      provinces: ["Milano"],
      regions: ["Lombardia"],
    });

    expect(resolveActiveAvailability(withLeftovers)).toEqual({
      provinces: [],
      regions: [],
    });
  });

  it("tiene attivo solo il livello della modalità scelta", () => {
    const regions = draft({
      mode: "REGIONS",
      provinces: ["Milano"],
      regions: ["Lombardia"],
    });
    const provinces = draft({
      mode: "PROVINCES",
      provinces: ["Milano"],
      regions: ["Lombardia"],
    });

    expect(resolveActiveAvailability(regions)).toEqual({
      provinces: [],
      regions: ["Lombardia"],
    });
    expect(resolveActiveAvailability(provinces)).toEqual({
      provinces: ["Milano"],
      regions: [],
    });
  });

  it("considera completa solo una modalità di dettaglio valorizzata", () => {
    expect(isAvailabilityComplete(draft())).toBe(true);
    expect(isAvailabilityComplete(draft({ mode: "REGIONS" }))).toBe(false);
    expect(
      isAvailabilityComplete(draft({ mode: "REGIONS", regions: ["Lazio"] })),
    ).toBe(true);
    expect(isAvailabilityComplete(draft({ mode: "PROVINCES" }))).toBe(false);
  });

  it("spiega cosa manca senza linguaggio tecnico", () => {
    expect(getAvailabilityErrorMessage(draft({ mode: "REGIONS" }))).toBe(
      "Seleziona almeno una regione.",
    );
    expect(getAvailabilityErrorMessage(draft({ mode: "PROVINCES" }))).toBe(
      "Seleziona almeno una provincia.",
    );
    expect(getAvailabilityErrorMessage(draft())).toBeUndefined();
  });

  it("riassume la selezione al singolare e al plurale", () => {
    expect(buildAvailabilitySummary(0, "regione")).toBeUndefined();
    expect(buildAvailabilitySummary(1, "regione")).toBe("1 regione selezionata");
    expect(buildAvailabilitySummary(3, "regione")).toBe(
      "3 regioni selezionate",
    );
    expect(buildAvailabilitySummary(3, "provincia")).toBe(
      "3 province selezionate",
    );
  });

  it("conta le voci scelte nella schermata di selezione", () => {
    expect(buildSelectionCountLabel(1, "provincia")).toBe(
      "Hai selezionato 1 provincia",
    );
    expect(buildSelectionCountLabel(3, "provincia")).toBe(
      "Hai selezionato 3 province",
    );
  });

  it("adatta il riepilogo alla modalità", () => {
    expect(buildAvailabilityRecap(draft())).toEqual({
      title: "Disponibile in tutta Italia",
    });
    expect(
      buildAvailabilityRecap(
        draft({ mode: "REGIONS", regions: ["Lombardia", "Piemonte"] }),
      ),
    ).toEqual({ detail: "Lombardia, Piemonte", title: "Disponibile in:" });
    expect(
      buildAvailabilityRecap(draft({ mode: "PROVINCES", provinces: ["Milano"] })),
    ).toEqual({ detail: "Milano", title: "Disponibile in:" });
  });
});

describe("campo da calcio e ruoli", () => {
  it("copre la tassonomia dei ruoli senza duplicare una posizione", () => {
    const positions = PITCH_SLOTS.map((slot) => slot.position);

    expect(new Set(positions).size).toBe(positions.length);
    expect(positions).toContain("goalkeeper");
    expect(positions).toContain("striker");
  });

  it("tiene ogni nodo dentro il rettangolo di gioco", () => {
    for (const slot of PITCH_SLOTS) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.x).toBeLessThanOrEqual(1);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeLessThanOrEqual(1);
    }
  });

  it("distingue principale, secondario e non selezionato", () => {
    expect(getPitchSlotState("striker", "striker", "")).toBe("primary");
    expect(getPitchSlotState("striker", "goalkeeper", "striker")).toBe(
      "secondary",
    );
    expect(getPitchSlotState("striker", "goalkeeper", "")).toBe("idle");
  });

  it("annuncia il ruolo, non la posizione sullo schermo", () => {
    expect(getPitchSlotAccessibilityLabel("striker", "primary")).toBe(
      "Attaccante — ruolo principale",
    );
    expect(getPitchSlotAccessibilityLabel("striker", "secondary")).toBe(
      "Attaccante — ruolo secondario",
    );
    expect(getPitchSlotAccessibilityLabel("striker", "idle")).toBe(
      "Attaccante — non selezionato",
    );
  });

  it("azzera il secondario quando coincide con il nuovo principale", () => {
    expect(revalidateSecondaryPosition("striker", "striker")).toBe("");
    expect(revalidateSecondaryPosition("striker", "goalkeeper")).toBe("striker");
    expect(revalidateSecondaryPosition("", "striker")).toBe("");
  });

  it("esclude il ruolo principale dalle opzioni del secondario", () => {
    const options = getSecondaryPositionOptions("striker");

    expect(options.some((option) => option.value === "striker")).toBe(false);
    expect(options).toHaveLength(PITCH_SLOTS.length - 1);
  });
});

describe("dati personali del Calciatore", () => {
  function baseForm(birthDate: string) {
    return {
      ...defaultOnboardingFormState,
      birthDate,
      firstName: "Alessandro",
      gender: "male" as const,
      lastName: "Rossi",
      nationality: "IT",
      residence: "Milano",
      role: "player" as const,
    };
  }

  it("rifiuta una data di nascita nel futuro", () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    const errors = validateOnboardingStep(
      "base",
      baseForm(nextYear.toISOString().slice(0, 10)),
    );

    expect(errors.birthDate).toBe(
      "La data di nascita non può essere nel futuro.",
    );
  });

  it("accetta una data di nascita passata", () => {
    const errors = validateOnboardingStep("base", baseForm("1998-06-12"));

    expect(errors.birthDate).toBeUndefined();
  });
});
