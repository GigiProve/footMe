import { describe, expect, it } from "vitest";

import { getOnboardingVisibleSteps } from "../onboarding-form";
import {
  buildDateSelectorValue,
  buildSeasonOptions,
  formatDateSelectorValue,
  parseDateSelectorValue,
} from "./date-selector-utils";
import { buildSelectionSummary } from "./OnboardingMultiSelectField";
import { normalizeStepperInput } from "./NumericStepperInput";
import { getOnboardingCounter } from "./onboarding-counter";

describe("getOnboardingCounter", () => {
  it("esclude la scelta del ruolo dal conteggio del ramo", () => {
    const steps = getOnboardingVisibleSteps("player");
    const hasRoleStep = steps.some((entry) => entry.step === "role");

    expect(hasRoleStep).toBe(true);
    // Il primo step dopo il ruolo è "1 di N", non "2 di N+1".
    expect(getOnboardingCounter(steps, 1)).toMatchObject({
      current: 1,
      total: steps.length - 1,
    });
  });

  it("tiene il conteggio dentro i limiti anche sul ruolo stesso", () => {
    const steps = getOnboardingVisibleSteps("player");

    expect(getOnboardingCounter(steps, 0).current).toBe(1);
    expect(getOnboardingCounter(steps, steps.length + 5).current).toBe(
      steps.length - 1,
    );
  });

  it("ammette lunghezze diverse fra un ruolo e l'altro", () => {
    const player = getOnboardingCounter(getOnboardingVisibleSteps("player"), 1);
    const coach = getOnboardingCounter(getOnboardingVisibleSteps("coach"), 1);

    expect(player.total).not.toBe(coach.total);
  });
});

describe("normalizeStepperInput", () => {
  it("accetta un numero digitato a mano", () => {
    expect(normalizeStepperInput("12")).toBe(12);
  });

  it("rifiuta i caratteri non numerici", () => {
    expect(normalizeStepperInput("1a2")).toBe(12);
    expect(normalizeStepperInput("abc")).toBe(0);
  });

  it("normalizza gli zeri iniziali", () => {
    expect(normalizeStepperInput("007")).toBe(7);
  });

  it("non scende sotto il minimo né supera il massimo", () => {
    expect(normalizeStepperInput("", { min: 0 })).toBe(0);
    expect(normalizeStepperInput("500", { max: 99 })).toBe(99);
  });
});

describe("buildSelectionSummary", () => {
  it("resta vuoto senza selezione", () => {
    expect(buildSelectionSummary([])).toBe("");
  });

  it("elenca le prime tre voci e sintetizza il resto", () => {
    expect(
      buildSelectionSummary(["Serie D", "Eccellenza", "Promozione"]),
    ).toBe("Serie D, Eccellenza, Promozione");
    expect(
      buildSelectionSummary([
        "Serie D",
        "Eccellenza",
        "Promozione",
        "Prima categoria",
        "Seconda categoria",
      ]),
    ).toBe("Serie D, Eccellenza, Promozione +2");
  });
});

describe("date-selector-utils", () => {
  it("compone e rilegge il valore canonico di ogni modalità", () => {
    expect(
      buildDateSelectorValue("date", { day: 12, month: 1, year: 2026 }),
    ).toBe("2026-01-12");
    expect(buildDateSelectorValue("monthYear", { month: 2, year: 2026 })).toBe(
      "2026-02",
    );
    expect(buildDateSelectorValue("year", { year: 2026 })).toBe("2026");
    expect(buildDateSelectorValue("season", { season: "2023/24" })).toBe(
      "2023/24",
    );

    expect(parseDateSelectorValue("date", "2026-01-12")).toEqual({
      day: 12,
      month: 1,
      year: 2026,
    });
  });

  it("resta vuoto quando la data è incompleta", () => {
    expect(buildDateSelectorValue("date", { month: 1, year: 2026 })).toBe("");
    expect(buildDateSelectorValue("monthYear", { year: 2026 })).toBe("");
  });

  it("formata il valore in italiano", () => {
    expect(formatDateSelectorValue("date", "2026-01-12")).toBe(
      "12 gennaio 2026",
    );
    expect(formatDateSelectorValue("monthYear", "2026-02")).toBe(
      "Febbraio 2026",
    );
    expect(formatDateSelectorValue("year", "2026")).toBe("2026");
    expect(formatDateSelectorValue("season", "2023/24")).toBe("2023/24");
    expect(formatDateSelectorValue("date", "")).toBe("");
  });

  it("genera stagioni discendenti a cavallo del decennio", () => {
    expect(buildSeasonOptions(3, 2026)).toEqual([
      "2026/27",
      "2025/26",
      "2024/25",
    ]);
    expect(buildSeasonOptions(1, 2099)).toEqual(["2099/00"]);
  });
});
