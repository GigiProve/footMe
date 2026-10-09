import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import type { DashboardIdentity } from "../dashboard-types";
import {
  clearDashboardCache,
  readDashboardCache,
  writeDashboardCache,
} from "./dashboard-cache";
import { ORG_ACCESS_WINDOW_MS, RETENTION_MS } from "./freshness-policy";

/**
 * Lettura e scrittura della cache con orologio controllato (§36).
 *
 * Qui si verificano le due invarianti che non si vedono dal tipo: una
 * lettura non rinnova i timestamp, e la finestra di accesso organizzativa
 * blocca anche un payload freschissimo.
 */

type Payload = { value: string };

function isPayload(value: unknown): value is Payload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Payload).value === "string"
  );
}

const T0 = Date.parse("2026-10-09T12:00:00.000Z");

function identity(overrides: Partial<DashboardIdentity> = {}): DashboardIdentity {
  return {
    avatarUrl: null,
    capabilities: ["dashboard_view"],
    id: "club-1",
    isOwner: true,
    isVerified: true,
    kind: "society",
    name: "AC Como",
    scopeLabel: null,
    ...overrides,
  };
}

async function seed(
  overrides: { accessVerifiedAt?: number; identity?: DashboardIdentity; now?: number } = {},
) {
  await writeDashboardCache<Payload>({
    accessVerifiedAt: overrides.accessVerifiedAt ?? T0,
    actorId: "actor-1",
    identity: overrides.identity ?? identity(),
    now: overrides.now ?? T0,
    payload: { value: "ok" },
    revision: 1,
  });
}

describe("dashboard cache", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("QA-23: rilegge i dati della stessa identità e ne riporta la freschezza", async () => {
    await seed();

    const result = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity(),
      isPayload,
      now: T0 + 10_000,
      provider: "operational",
    });

    expect(result.status).toBe("usable");

    if (result.status === "usable") {
      expect(result.record.payload.value).toBe("ok");
      expect(result.freshness).toBe("fresh");
    }
  });

  it("QA-24: non riusa il record di un altro actor", async () => {
    await seed();

    const result = await readDashboardCache<Payload>({
      actorId: "actor-2",
      identity: identity(),
      isPayload,
      now: T0,
      provider: "operational",
    });

    expect(result.status).toBe("unusable");
  });

  it("QA-20: uno scope ristretto non trova il record precedente", async () => {
    await seed();

    const result = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity({ capabilities: [] }),
      isPayload,
      now: T0,
      provider: "operational",
    });

    expect(result.status).toBe("unusable");
  });

  it("QA-29: oltre la finestra di accesso il payload non è mostrabile", async () => {
    await seed();

    const result = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity(),
      isPayload,
      // Dentro la scadenza rigida ma fuori dalla finestra di accesso: è il
      // caso che §15 impone di bloccare.
      now: T0 + ORG_ACCESS_WINDOW_MS,
      provider: "presentation",
    });

    expect(result.status).toBe("unusable");

    if (result.status === "unusable") {
      expect(result.reason).toBe("access_window_expired");
    }
  });

  it("l'identità personale non è soggetta alla finestra organizzativa", async () => {
    const person = identity({ id: "me", kind: "person" });
    await seed({ identity: person });

    const result = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: person,
      isPayload,
      now: T0 + ORG_ACCESS_WINDOW_MS,
      provider: "presentation",
    });

    expect(result.status).toBe("usable");
  });

  it("QA-25: una lettura non rinnova fetchedAt", async () => {
    await seed();

    await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity(),
      isPayload,
      now: T0 + 30_000,
      provider: "operational",
    });

    const second = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity(),
      isPayload,
      now: T0 + 90_000,
      provider: "operational",
    });

    expect(second.status).toBe("usable");

    if (second.status === "usable") {
      // Se la lettura precedente avesse rinnovato il timestamp, novanta
      // secondi dopo il record risulterebbe ancora fresco.
      expect(second.freshness).toBe("stale_usable");
      expect(second.record.fetchedAt).toBe(T0);
    }
  });

  it("QA-33: un record non decodificabile viene scartato senza eccezioni", async () => {
    await seed();

    const [key] = await AsyncStorage.getAllKeys();
    await AsyncStorage.setItem(key, "{ not json");

    const result = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity(),
      isPayload,
      now: T0,
      provider: "operational",
    });

    expect(result.status).toBe("unusable");
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });

  it("QA-34: oltre la retention il record viene rimosso dal disco", async () => {
    await seed();

    const result = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity(),
      isPayload,
      now: T0 + RETENTION_MS,
      provider: "presentation",
    });

    expect(result.status).toBe("unusable");
    expect(await AsyncStorage.getAllKeys()).toHaveLength(0);
  });

  it("QA-21: il logout rende subito inaccessibili le cache dell'actor", async () => {
    await seed();
    await seed({ identity: identity({ id: "club-2" }) });

    await clearDashboardCache({ actorId: "actor-1" });

    const result = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity(),
      isPayload,
      now: T0,
      provider: "operational",
    });

    expect(result.status).toBe("unusable");
    expect(await AsyncStorage.getAllKeys()).toHaveLength(0);
  });

  it("QA-19: una revoca può colpire una sola identità", async () => {
    await seed();
    await seed({ identity: identity({ id: "club-2" }) });

    await clearDashboardCache({ actorId: "actor-1", identityId: "club-1" });

    const revoked = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity(),
      isPayload,
      now: T0,
      provider: "operational",
    });

    const kept = await readDashboardCache<Payload>({
      actorId: "actor-1",
      identity: identity({ id: "club-2" }),
      isPayload,
      now: T0,
      provider: "operational",
    });

    expect(revoked.status).toBe("unusable");
    expect(kept.status).toBe("usable");
  });
});
