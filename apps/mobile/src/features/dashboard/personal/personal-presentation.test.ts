import { describe, expect, it } from "vitest";

import {
  MAX_PROMOTED_DEADLINES,
  aggregateRequirements,
  dedupeById,
  dedupePreview,
  selectApplicationPreviews,
  formatDeadlineDetailLabel,
  formatDeadlineRowLabel,
  formatUpdateLabel,
  hasSignificantUpdate,
  recentUpdatesBudget,
  SUGGESTION_COPY,
} from "./personal-presentation";

/**
 * DAS-REV-03 §29. Il clock è sempre un parametro: nessun test dipende dalla
 * data reale del giorno, come §28 richiede per i casi limite del cutoff.
 */

describe("recentUpdatesBudget", () => {
  it("gives the updates only the slots the priorities left (§6)", () => {
    expect(recentUpdatesBudget(0)).toBe(2);
    expect(recentUpdatesBudget(1)).toBe(2);
    // Due scadenze più un requisito saturano il budget Foundation di tre.
    expect(recentUpdatesBudget(2)).toBe(1);
    expect(recentUpdatesBudget(3)).toBe(0);
  });

  it("never goes negative when the priorities exceed the budget", () => {
    expect(recentUpdatesBudget(5)).toBe(0);
  });

  it("caps at two even with an empty priority list", () => {
    expect(recentUpdatesBudget(0)).toBeLessThanOrEqual(2);
    expect(MAX_PROMOTED_DEADLINES).toBe(2);
  });
});

describe("formatDeadlineRowLabel", () => {
  it("uses the verb of the real action type (§17)", () => {
    const at = "2026-09-15T10:00:00Z";

    expect(
      formatDeadlineRowLabel(at, { actionType: "apply", timeZone: "UTC" }),
    ).toBe("Candidature entro il 15 settembre");

    expect(
      formatDeadlineRowLabel(at, { actionType: "register", timeZone: "UTC" }),
    ).toBe("Iscrizioni entro il 15 settembre");
  });

  it("reads the date in the declared timezone, not the device one", () => {
    // 23:30 a Roma il 15 settembre è ancora il 15, non il 16.
    const label = formatDeadlineRowLabel("2026-09-15T21:30:00Z", {
      timeZone: "Europe/Rome",
    });

    expect(label).toBe("Candidature entro il 15 settembre");
  });

  it("returns null for an unreadable instant instead of inventing one", () => {
    expect(formatDeadlineRowLabel("non-una-data")).toBeNull();
  });

  it("never produces a countdown or an urgency phrase (§14)", () => {
    const label =
      formatDeadlineRowLabel("2026-09-15T10:00:00Z", { timeZone: "UTC" }) ?? "";

    expect(label).not.toMatch(/rimast|ultima|scade fra|giorni/i);
  });
});

describe("formatDeadlineDetailLabel", () => {
  it("adds the year, and the time only when it changes the decision (§14)", () => {
    expect(
      formatDeadlineDetailLabel("2026-09-15T00:00:00Z", { timeZone: "UTC" }),
    ).toBe("Candidature entro il 15 settembre 2026");

    expect(
      formatDeadlineDetailLabel("2026-09-15T18:00:00Z", { timeZone: "UTC" }),
    ).toBe("Candidature entro il 15 settembre 2026, ore 18:00 (UTC)");
  });

  it("omits the zone when the opportunity did not declare one", () => {
    const label = formatDeadlineDetailLabel("2026-09-15T18:00:00Z") ?? "";

    expect(label).not.toContain("(");
  });
});

describe("formatUpdateLabel", () => {
  const noon = new Date(2026, 8, 15, 12, 0, 0).getTime();

  it("uses calendar days, not 24-hour differences", () => {
    const yesterdayLate = new Date(2026, 8, 14, 23, 50, 0).toISOString();

    expect(formatUpdateLabel(yesterdayLate, noon)).toBe("Aggiornata ieri");
  });

  it("labels the same calendar day as today", () => {
    const earlier = new Date(2026, 8, 15, 1, 0, 0).toISOString();

    expect(formatUpdateLabel(earlier, noon)).toBe("Aggiornata oggi");
  });

  it("falls back to the date beyond yesterday", () => {
    const older = new Date(2026, 8, 11, 9, 0, 0).toISOString();

    expect(formatUpdateLabel(older, noon)).toBe("Aggiornata il 11 settembre");
  });

  it("returns null for an unreadable instant", () => {
    expect(formatUpdateLabel("niente", noon)).toBeNull();
  });
});

describe("hasSignificantUpdate", () => {
  it("is false for a just-sent application (§9)", () => {
    expect(
      hasSignificantUpdate({
        createdAt: "2026-09-15T10:00:00Z",
        lastEventAt: null,
      }),
    ).toBe(false);
  });

  it("is false when the only event precedes or equals the submission", () => {
    expect(
      hasSignificantUpdate({
        createdAt: "2026-09-15T10:00:00Z",
        lastEventAt: "2026-09-15T10:00:00Z",
      }),
    ).toBe(false);
  });

  it("is true for a real transition after the submission", () => {
    expect(
      hasSignificantUpdate({
        createdAt: "2026-09-15T10:00:00Z",
        lastEventAt: "2026-09-16T08:00:00Z",
      }),
    ).toBe(true);
  });
});

describe("dedupePreview", () => {
  const items = [{ id: "a" }, { id: "b" }];

  it("removes only what is already shown above, by canonical id (§12)", () => {
    const outcome = dedupePreview(
      items,
      (item) => item.id,
      new Set(["a"]),
    );

    expect(outcome.items).toEqual([{ id: "b" }]);
    expect(outcome.collapsed).toBe(false);
  });

  it("flags the module as collapsed when everything was already shown", () => {
    const outcome = dedupePreview(
      items,
      (item) => item.id,
      new Set(["a", "b"]),
    );

    expect(outcome.items).toEqual([]);
    expect(outcome.collapsed).toBe(true);
  });

  it("is not collapsed when the module was genuinely empty", () => {
    const outcome = dedupePreview([], (item: { id: string }) => item.id, new Set());

    expect(outcome.collapsed).toBe(false);
  });

  it("leaves the underlying list untouched", () => {
    dedupeById(items, (item) => item.id, new Set(["a", "b"]));

    expect(items).toHaveLength(2);
  });
});

describe("aggregateRequirements", () => {
  const roleRequirement = {
    description: "Indica il tuo ruolo principale.",
    href: "/profile/coach-edit/technical",
    key: "coach_primary_role",
  };

  it("returns null when nothing is missing", () => {
    expect(aggregateRequirements([])).toBeNull();
  });

  it("keeps the specific copy and destination for a single requirement", () => {
    expect(aggregateRequirements([roleRequirement])).toEqual({
      description: "Indica il tuo ruolo principale.",
      href: "/profile/coach-edit/technical",
    });
  });

  it("merges several requirements into one item pointing at the role hub (§13)", () => {
    const aggregated = aggregateRequirements(
      [
        roleRequirement,
        {
          description: "Indica la categoria.",
          href: "/profile/coach-edit/opportunities",
          key: "coach_category",
        },
      ],
      "/profile/coach-edit",
    );

    expect(aggregated).toEqual({
      description: "Completa 2 informazioni obbligatorie del profilo.",
      href: "/profile/coach-edit",
    });
  });

  it("never lists the requirements as a checklist", () => {
    const aggregated = aggregateRequirements(
      [roleRequirement, { ...roleRequirement, key: "second" }],
      "/profile/coach-edit",
    );

    expect(aggregated?.description).not.toContain("ruolo principale");
  });
});

describe("selectApplicationPreviews", () => {
  const app = (id: string) => ({ id });

  /**
   * §8: «normalmente si mostrano due preview, anche con sette candidature
   * attive; il massimo di preview è tre». La fonte ne manda tre, il widget ne
   * mostra due — e il conteggio resta affare del dominio (§8).
   */
  it("shows two previews even when the source sends three", () => {
    const outcome = selectApplicationPreviews(
      [app("a"), app("b"), app("c")],
      (item) => item.id,
      new Set<string>(),
    );

    expect(outcome.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(outcome.collapsed).toBe(false);
  });

  /**
   * §10: «Quando una candidatura è già presentata in Aggiornamenti recenti
   * […] evitare di ripeterne inutilmente la row nelle preview ordinarie. Se
   * possibile mostrare altre candidature eleggibili entro il limite.»
   *
   * È lo screen 03: AC Como è in alto come conclusione, e il modulo mostra
   * Varese e Pro Sesto invece di lasciare un posto vuoto.
   */
  it("fills the freed slot with another eligible application", () => {
    const outcome = selectApplicationPreviews(
      [app("como"), app("varese"), app("prosesto")],
      (item) => item.id,
      new Set(["como"]),
    );

    expect(outcome.items.map((item) => item.id)).toEqual([
      "varese",
      "prosesto",
    ]);
    expect(outcome.collapsed).toBe(false);
  });

  /**
   * §10: tutte già promosse non è un empty del dominio — «non mostrare un
   * falso empty», il modulo si riduce all'accesso alla lista completa.
   */
  it("collapses instead of faking an empty module", () => {
    const outcome = selectApplicationPreviews(
      [app("a"), app("b")],
      (item) => item.id,
      new Set(["a", "b"]),
    );

    expect(outcome.items).toEqual([]);
    expect(outcome.collapsed).toBe(true);
  });

  /** Nessuna candidatura non è "collapsed": è un empty vero. */
  it("does not collapse an actually empty list", () => {
    const outcome = selectApplicationPreviews(
      [] as { id: string }[],
      (item) => item.id,
      new Set<string>(),
    );

    expect(outcome.collapsed).toBe(false);
  });
});

/**
 * Copy dei suggerimenti facoltativi (DAS-REV-06 §8).
 *
 * Sono le quattro stringhe letterali della task: titolo a parte — lo porta il
 * registro dei moduli — indicazione, beneficio e CTA stanno qui.
 */
describe("SUGGESTION_COPY", () => {
  it("usa la copy letterale del master per le aree", () => {
    expect(SUGGESTION_COPY.availability_areas).toEqual({
      actionLabel: "Imposta aree",
      body: "Aiuta le società a trovarti nelle zone che hai scelto.",
      description: "Indica le aree in cui sei disponibile.",
      icon: "location-outline",
    });
  });

  it("non ha copy per una chiave che il dominio non emette", () => {
    // §23: «Non inventare un requisito per riempire lo spazio.» Una chiave
    // sconosciuta fa sparire il modulo, non comparire una card vuota.
    expect(SUGGESTION_COPY.profilo_completo).toBeUndefined();
  });

  it("non promette un completamento né lo misura", () => {
    const copy = Object.values(SUGGESTION_COPY)
      .flatMap((entry) => [entry.actionLabel, entry.body, entry.description])
      .join(" ")
      .toLowerCase();

    for (const forbidden of ["profilo completo", "%", "punteggio", "ottimo lavoro"]) {
      expect(copy).not.toContain(forbidden);
    }
  });
});
