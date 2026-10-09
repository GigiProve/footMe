import { describe, expect, it } from "vitest";

import type { DashboardIdentity } from "../dashboard-types";
import { PRIORITY_REGISTRY } from "../priority/priority-registry";
import { rankPriorities } from "../priority/priority-ranking";
import type { PrioritySignal } from "../priority/priority-types";

/**
 * Priorità della Dashboard personale (DAS-REV-03 §13, §15, §16, §29).
 *
 * Il ranking resta quello della Foundation: qui si verifica che i due tipi
 * nuovi vi si inseriscano con la precedenza giusta, che il budget regga e
 * che un dato facoltativo non entri in "Da gestire".
 */

const PERSON: DashboardIdentity = {
  avatarUrl: null,
  capabilities: [],
  id: "p1",
  isOwner: true,
  isVerified: false,
  kind: "person",
  name: "Luca",
  scopeLabel: null,
};

const NOW = Date.parse("2026-09-10T12:00:00Z");

function deadline(adId: string, at: string): PrioritySignal {
  return {
    aggregationKey: `saved_deadline:p1:${adId}`,
    contextLabel: null,
    count: 1,
    deadlineAt: at,
    impact: null,
    occurredAt: "2026-09-01T00:00:00Z",
    payload: { adTitle: `Provino ${adId}` },
    revision: 0,
    targetId: adId,
    targetKind: "position",
    typeId: "saved_deadline",
  };
}

function requirement(): PrioritySignal {
  return {
    aggregationKey: "profile_requirements_missing:p1",
    contextLabel: null,
    count: 1,
    deadlineAt: null,
    impact: null,
    occurredAt: "1970-01-01T00:00:00Z",
    payload: {
      hubHref: "/profile/coach-edit",
      requirements: [
        {
          description: "Indica il tuo ruolo principale.",
          href: "/profile/coach-edit/technical",
          key: "coach_primary_role",
        },
      ],
    },
    revision: 0,
    targetId: "p1",
    targetKind: "profile_section",
    typeId: "profile_requirements_missing",
  };
}

function rank(signals: PrioritySignal[]) {
  return rankPriorities({
    eligibleModuleIds: ["personal_applications", "personal_saved_positions"],
    identity: PERSON,
    now: NOW,
    signals,
  });
}

describe("registro delle priorità", () => {
  it("non contiene più availability_required (§19)", () => {
    // Le aree geografiche sono facoltative: un dato facoltativo non può
    // vivere in "Da gestire", e il suggerimento ha il suo modulo in fondo.
    expect(Object.keys(PRIORITY_REGISTRY)).not.toContain(
      "availability_required",
    );
  });

  it("non promuove alcun modulo per i tipi personali (§11)", () => {
    expect(PRIORITY_REGISTRY.saved_deadline.moduleId).toBeNull();
    expect(PRIORITY_REGISTRY.profile_requirements_missing.moduleId).toBeNull();
  });

  it("la scadenza apre la risorsa canonica, non una lista Dashboard", () => {
    const href = PRIORITY_REGISTRY.saved_deadline.targetHref(
      deadline("ad1", "2026-09-12T10:00:00Z"),
    );

    expect(href).toBe("/position/ad1");
  });

  it("un solo requisito apre la sezione esatta, più requisiti l'hub (§13)", () => {
    const single = requirement();

    expect(
      PRIORITY_REGISTRY.profile_requirements_missing.targetHref(single),
    ).toBe("/profile/coach-edit/technical");

    const many: PrioritySignal = {
      ...single,
      count: 2,
      payload: {
        hubHref: "/profile/coach-edit",
        requirements: [
          ...(single.payload?.requirements ?? []),
          {
            description: "Altro requisito.",
            href: "/profile/coach-edit/opportunities",
            key: "other",
          },
        ],
      },
    };

    expect(PRIORITY_REGISTRY.profile_requirements_missing.targetHref(many)).toBe(
      "/profile/coach-edit",
    );
  });
});

describe("ordinamento delle scadenze", () => {
  it("mette per prima la scadenza con il cutoff più vicino (§15)", () => {
    const result = rank([
      deadline("lontana", "2026-09-16T10:00:00Z"),
      deadline("vicina", "2026-09-15T10:00:00Z"),
    ]);

    expect(result.visible.map((item) => item.signal.targetId)).toEqual([
      "vicina",
      "lontana",
    ]);
  });

  it("a parità di cutoff lo spareggio è deterministico e stabile (§15)", () => {
    const same = "2026-09-15T10:00:00Z";
    const first = rank([deadline("b", same), deadline("a", same)]);
    const second = rank([deadline("a", same), deadline("b", same)]);

    expect(first.visible.map((item) => item.key)).toEqual(
      second.visible.map((item) => item.key),
    );
  });

  it("non duplica lo stesso evento consegnato due volte (§12)", () => {
    const signal = deadline("ad1", "2026-09-15T10:00:00Z");
    const result = rank([signal, { ...signal, revision: 1 }]);

    expect(result.visible).toHaveLength(1);
    expect(result.totalEligible).toBe(1);
  });
});

describe("budget dei segnali", () => {
  it("le azioni temporali e i requisiti occupano per primi il budget (§6)", () => {
    const result = rank([
      deadline("ad1", "2026-09-15T10:00:00Z"),
      deadline("ad2", "2026-09-16T10:00:00Z"),
      requirement(),
    ]);

    expect(result.visible).toHaveLength(3);
    expect(result.hiddenByLimit).toBe(0);
  });

  it("la scadenza precede il requisito, che non ha una finestra (§8)", () => {
    const result = rank([requirement(), deadline("ad1", "2026-09-15T10:00:00Z")]);

    expect(result.visible[0].definition.id).toBe("saved_deadline");
    expect(result.visible[1].definition.id).toBe("profile_requirements_missing");
  });
});

describe("presentazione", () => {
  it("le scadenze sono righe di gruppo, i requisiti una card (§16)", () => {
    expect(PRIORITY_REGISTRY.saved_deadline.presentation).toBe("row");
    expect(PRIORITY_REGISTRY.profile_requirements_missing.presentation).toBe(
      "card",
    );
  });

  it("il titolo della scadenza è l'opportunità, non il motivo", () => {
    const [first] = rank([deadline("ad1", "2026-09-15T10:00:00Z")]).visible;

    expect(first.title).toBe("Provino ad1");
  });

  it("senza titolo dell'annuncio ricade su società e squadra", () => {
    const signal = deadline("ad1", "2026-09-15T10:00:00Z");
    signal.payload = { clubName: "AC Como", teamName: "Under 19" };

    const [first] = rank([signal]).visible;

    expect(first.title).toBe("AC Como · Under 19");
  });
});
