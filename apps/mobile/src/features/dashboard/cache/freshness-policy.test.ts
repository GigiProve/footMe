import { describe, expect, it } from "vitest";

import type { DashboardIdentity } from "../dashboard-types";
import { capabilitiesFingerprint, dashboardCacheKey } from "./dashboard-cache";
import {
  evaluateFreshness,
  isBeyondRetention,
  isOrgAccessWindowValid,
  HARD_EXPIRY_MS,
  ORG_ACCESS_WINDOW_MS,
  RETENTION_MS,
  STALE_MS,
} from "./freshness-policy";

/**
 * Freshness, scadenza rigida, finestra di accesso e retention (§36).
 *
 * Tutto con orologio controllato: §36 vieta esplicitamente di affidare questi
 * test ad attese reali.
 */

const T0 = Date.parse("2026-10-09T12:00:00.000Z");

function identity(
  overrides: Partial<DashboardIdentity> = {},
): DashboardIdentity {
  return {
    avatarUrl: null,
    capabilities: ["dashboard_view", "applications_view"],
    id: "club-1",
    isOwner: true,
    isVerified: true,
    kind: "society",
    name: "AC Como",
    scopeLabel: null,
    ...overrides,
  };
}

describe("evaluateFreshness", () => {
  it("applica intervalli distinti per provider", () => {
    // QA-25: i provider non condividono un TTL universale.
    expect(
      evaluateFreshness({
        fetchedAt: T0,
        now: T0 + STALE_MS.operational + 1,
        provider: "operational",
      }),
    ).toBe("stale_usable");

    expect(
      evaluateFreshness({
        fetchedAt: T0,
        now: T0 + STALE_MS.operational + 1,
        provider: "presentation",
      }),
    ).toBe("fresh");
  });

  it("oltre la scadenza rigida il payload non è utilizzabile", () => {
    // QA-26: un payload scaduto non è né affidabile né "vuoto".
    expect(
      evaluateFreshness({
        fetchedAt: T0,
        now: T0 + HARD_EXPIRY_MS.operational,
        provider: "operational",
      }),
    ).toBe("expired");
  });

  it("un orologio arretrato non prolunga la validità", () => {
    // QA-30: non si può stabilire la validità, quindi si rivalida.
    expect(
      evaluateFreshness({ fetchedAt: T0, now: T0 - 1, provider: "operational" }),
    ).toBe("expired");
  });
});

describe("isOrgAccessWindowValid", () => {
  it("vale entro i quindici minuti dall'ultima verifica server-side", () => {
    expect(
      isOrgAccessWindowValid({ accessVerifiedAt: T0, now: T0 + 60_000 }),
    ).toBe(true);
  });

  it("scade esattamente alla fine della finestra", () => {
    // QA-29: oltre la finestra i dati privati non si mostrano più.
    expect(
      isOrgAccessWindowValid({
        accessVerifiedAt: T0,
        now: T0 + ORG_ACCESS_WINDOW_MS,
      }),
    ).toBe(false);
  });

  it("un orologio arretrato accorcia la finestra invece di estenderla", () => {
    expect(
      isOrgAccessWindowValid({ accessVerifiedAt: T0, now: T0 - 1 }),
    ).toBe(false);
  });

  it("la finestra di accesso è più breve della retention", () => {
    // La separazione è il punto di §15: 24 ore di retention non sono 24 ore
    // di visualizzazione.
    expect(ORG_ACCESS_WINDOW_MS).toBeLessThan(RETENTION_MS);
  });
});

describe("isBeyondRetention", () => {
  it("rimuove dal disco i payload oltre le 24 ore", () => {
    expect(isBeyondRetention({ fetchedAt: T0, now: T0 + RETENTION_MS })).toBe(
      true,
    );
    expect(
      isBeyondRetention({ fetchedAt: T0, now: T0 + RETENTION_MS - 1 }),
    ).toBe(false);
  });
});

describe("dashboardCacheKey", () => {
  it("separa actor, identità, tipo e contesto di autorizzazione", () => {
    // QA-24: un record di altro account, identità o scope non si riusa.
    const a = dashboardCacheKey({ actorId: "actor-1", identity: identity() });
    const b = dashboardCacheKey({ actorId: "actor-2", identity: identity() });
    const c = dashboardCacheKey({
      actorId: "actor-1",
      identity: identity({ id: "club-2" }),
    });

    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("uno scope ristretto produce una chiave diversa", () => {
    // QA-20: le righe e i conteggi precedenti non restano visibili.
    const full = dashboardCacheKey({ actorId: "actor-1", identity: identity() });
    const narrowed = dashboardCacheKey({
      actorId: "actor-1",
      identity: identity({ capabilities: ["dashboard_view"] }),
    });

    expect(full).not.toBe(narrowed);
  });

  it("il nome visualizzato non entra nella chiave", () => {
    // §14 lo vieta: due Società omonime non devono condividere un record, e
    // una rinominata non deve invalidarlo.
    const before = dashboardCacheKey({
      actorId: "actor-1",
      identity: identity({ name: "AC Como" }),
    });
    const after = dashboardCacheKey({
      actorId: "actor-1",
      identity: identity({ name: "Como 1907" }),
    });

    expect(before).toBe(after);
  });

  it("il fingerprint delle capability è indipendente dall'ordine", () => {
    expect(
      capabilitiesFingerprint(
        identity({ capabilities: ["applications_view", "dashboard_view"] }),
      ),
    ).toBe(
      capabilitiesFingerprint(
        identity({ capabilities: ["dashboard_view", "applications_view"] }),
      ),
    );
  });
});
