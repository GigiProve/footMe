import { describe, expect, it } from "vitest";

import type { DashboardCapability, DashboardIdentity } from "../dashboard-types";
import {
  comparePriorities,
  dedupeSignals,
  isPriorityEligible,
  rankPriorities,
  MAX_VISIBLE_PRIORITIES,
} from "./priority-ranking";
import { PRIORITY_REGISTRY } from "./priority-registry";
import type { PrioritySignal, ResolvedPriority } from "./priority-types";

/**
 * Regole con il rischio di regressione più alto (§36): comparatore,
 * aggregazione, dedup, limite visuale, eligibility prima del ranking.
 *
 * Il tempo è sempre un parametro: nessun test dipende dall'orologio reale.
 */

const NOW = Date.parse("2026-10-09T12:00:00.000Z");

function society(
  capabilities: DashboardCapability[] = ["applications_view"],
): DashboardIdentity {
  return {
    avatarUrl: null,
    capabilities,
    id: "club-1",
    isOwner: true,
    isVerified: true,
    kind: "society",
    name: "AC Como",
    scopeLabel: null,
  };
}

function signal(overrides: Partial<PrioritySignal> = {}): PrioritySignal {
  return {
    aggregationKey: "new_applications:club-1:ad-1",
    contextLabel: "Attaccante · Prima squadra",
    count: 5,
    deadlineAt: null,
    impact: null,
    occurredAt: "2026-10-09T10:00:00.000Z",
    revision: 1,
    targetId: "ad-1",
    targetKind: "position",
    typeId: "new_applications",
    ...overrides,
  };
}

function resolved(
  typeId: keyof typeof PRIORITY_REGISTRY,
  overrides: Partial<PrioritySignal> = {},
): ResolvedPriority {
  const definition = PRIORITY_REGISTRY[typeId];
  const built = signal({ typeId, ...overrides });

  return {
    actionLabel: definition.actionLabel,
    contextLabel: built.contextLabel,
    definition,
    href: definition.targetHref(built),
    key: built.aggregationKey,
    signal: built,
    title: definition.title(built),
  };
}

describe("comparePriorities", () => {
  it("mette il livello operativo più alto davanti a una novità più recente", () => {
    // QA-09: un problema operativo di livello superiore precede una novità
    // più recente.
    const attention = resolved("publication_failed", {
      aggregationKey: "publication_failed:club-1:post-1",
      occurredAt: "2026-10-01T10:00:00.000Z",
    });
    const relevant = resolved("new_applications", {
      occurredAt: "2026-10-09T11:59:00.000Z",
    });

    expect(comparePriorities(attention, relevant, NOW)).toBeLessThan(0);
  });

  it("a parità di livello preferisce l'azione all'informazione", () => {
    const action = resolved("new_applications");
    const info: ResolvedPriority = {
      ...resolved("new_applications", { aggregationKey: "other" }),
      definition: { ...PRIORITY_REGISTRY.new_applications, nature: "info" },
    };

    expect(comparePriorities(action, info, NOW)).toBeLessThan(0);
  });

  it("non fa sembrare imminente una scadenza assente", () => {
    const withDeadline = resolved("new_applications", {
      aggregationKey: "a",
      deadlineAt: "2026-10-10T12:00:00.000Z",
    });
    const withoutDeadline = resolved("new_applications", {
      aggregationKey: "b",
      deadlineAt: null,
    });

    // Stesso livello, stessa natura, stesso impatto, stessa recency: decide
    // la scadenza, e quella assente va dopo.
    expect(comparePriorities(withDeadline, withoutDeadline, NOW)).toBeLessThan(0);
    expect(comparePriorities(withoutDeadline, withDeadline, NOW)).toBeGreaterThan(0);
  });

  it("usa l'identificativo stabile come spareggio finale", () => {
    const a = resolved("new_applications", { aggregationKey: "aaa" });
    const b = resolved("new_applications", { aggregationKey: "bbb" });

    expect(comparePriorities(a, b, NOW)).toBeLessThan(0);
    // Deterministico in entrambe le direzioni: non dipende dall'ordine di
    // arrivo (QA-07).
    expect(comparePriorities(b, a, NOW)).toBeGreaterThan(0);
  });

  it("non cambia esito al variare dell'ordine di input", () => {
    const items = [
      resolved("new_applications", { aggregationKey: "c" }),
      resolved("new_applications", { aggregationKey: "a" }),
      resolved("new_applications", { aggregationKey: "b" }),
    ];

    const forward = [...items].sort((x, y) => comparePriorities(x, y, NOW));
    const backward = [...items]
      .reverse()
      .sort((x, y) => comparePriorities(x, y, NOW));

    expect(forward.map((item) => item.key)).toEqual(
      backward.map((item) => item.key),
    );
  });
});

describe("dedupeSignals", () => {
  it("non incrementa due volte lo stesso evento consegnato da fonti diverse", () => {
    // QA-08: lo stesso evento via query e realtime.
    const deduped = dedupeSignals([
      signal({ count: 5, revision: 1 }),
      signal({ count: 5, revision: 2 }),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].count).toBe(5);
  });

  it("tiene la revisione più alta", () => {
    const deduped = dedupeSignals([
      signal({ count: 2, revision: 9 }),
      signal({ count: 5, revision: 3 }),
    ]);

    expect(deduped[0].count).toBe(2);
  });
});

describe("isPriorityEligible", () => {
  it("esclude chi non ha la capability, prima di qualunque ranking", () => {
    // QA-13: nessuna priorità, nessun conteggio per un actor senza accesso
    // alle candidature.
    expect(isPriorityEligible(signal(), society([]))).toBe(false);
    expect(isPriorityEligible(signal(), society())).toBe(true);
  });

  it("esclude un tipo la cui destinazione non è disponibile", () => {
    // `publication_failed` dipende da `society_scheduled_content`, che
    // `dashboard-features` tiene non disponibile: il contratto esiste, il
    // dominio no.
    expect(
      isPriorityEligible(
        signal({ typeId: "publication_failed" }),
        society(["applications_view", "content_view"]),
      ),
    ).toBe(false);
  });

  it("esclude un conteggio a zero", () => {
    expect(isPriorityEligible(signal({ count: 0 }), society())).toBe(false);
  });
});

describe("rankPriorities", () => {
  const base = {
    eligibleModuleIds: ["society_applications"] as const,
    identity: society(),
    now: NOW,
  };

  it("QA-02: cinque candidature producono una priorità aggregata e promuovono il modulo", () => {
    const result = rankPriorities({ ...base, signals: [signal({ count: 5 })] });

    expect(result.visible).toHaveLength(1);
    expect(result.visible[0].title).toBe("5 nuove candidature");
    expect(result.promotedModuleId).toBe("society_applications");
  });

  it("QA-03: da cinque a due resta la stessa priorità con lo stesso id", () => {
    const five = rankPriorities({ ...base, signals: [signal({ count: 5 })] });
    const two = rankPriorities({ ...base, signals: [signal({ count: 2 })] });

    expect(two.visible[0].key).toBe(five.visible[0].key);
    expect(two.visible[0].title).toBe("2 nuove candidature");
  });

  it("QA-04: a zero la priorità sparisce e nessun modulo resta promosso", () => {
    const result = rankPriorities({ ...base, signals: [signal({ count: 0 })] });

    expect(result.visible).toHaveLength(0);
    expect(result.promotedModuleId).toBeNull();
    expect(result.totalEligible).toBe(0);
  });

  it("QA-06: cinque candidate, tre visibili, un solo modulo principale", () => {
    const signals = [1, 2, 3, 4, 5].map((index) =>
      signal({
        aggregationKey: `new_applications:club-1:ad-${index}`,
        occurredAt: `2026-10-0${index}T10:00:00.000Z`,
        targetId: `ad-${index}`,
      }),
    );

    const result = rankPriorities({ ...base, signals });

    expect(result.visible).toHaveLength(MAX_VISIBLE_PRIORITIES);
    // Il totale si calcola dopo eligibility e dedup, prima del limite (§9).
    expect(result.totalEligible).toBe(5);
    expect(result.hiddenByLimit).toBe(2);
    expect(result.promotedModuleId).toBe("society_applications");
  });

  it("il titolo è singolare con una sola candidatura", () => {
    const result = rankPriorities({ ...base, signals: [signal({ count: 1 })] });

    expect(result.visible[0].title).toBe("1 nuova candidatura");
  });

  it("non promuove un modulo che non è nella composizione", () => {
    const result = rankPriorities({
      ...base,
      eligibleModuleIds: [],
      signals: [signal()],
    });

    expect(result.visible).toHaveLength(1);
    expect(result.promotedModuleId).toBeNull();
  });

  it("non espone priorità di una capability revocata, nemmeno dalla cache", () => {
    const result = rankPriorities({
      ...base,
      identity: society([]),
      signals: [signal()],
    });

    expect(result.visible).toHaveLength(0);
    expect(result.totalEligible).toBe(0);
  });

  it("apre la destinazione canonica della Posizione, non una lista Dashboard", () => {
    const result = rankPriorities({ ...base, signals: [signal()] });

    expect(result.visible[0].href).toBe("/position/ad-1");
    expect(result.visible[0].actionLabel).toBe("Valuta candidature");
  });
});
