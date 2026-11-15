import { describe, expect, it } from "vitest";

import {
  buildDestination,
  buildDestinations,
  composeStatusOf,
  deliveredConversationIds,
  deliveryCount,
  deliveryKeyOf,
  evaluateBatch,
  isMalformedInputError,
  mergeOutcomes,
  newShareId,
  planDestinations,
  recipientsToRetry,
  transientFailureOutcomes,
  unroutableOutcomes,
  withAliasedOutcomes,
} from "./share-batch";
import type { ShareDeliveryOutcome, ShareRecipient } from "./share-types";

const BATCH = "11111111-1111-4111-8111-111111111111";

function recipient(overrides: Partial<ShareRecipient> = {}): ShareRecipient {
  return {
    available: true,
    avatarUrl: null,
    clubId: null,
    contextLabel: null,
    conversationId: null,
    displayName: "Marco Bianchi",
    groupAvatarPath: null,
    isVerified: false,
    key: "conv:c1",
    kind: "direct",
    participantCount: null,
    profileId: null,
    role: null,
    ...overrides,
  };
}

function outcome(key: string, overrides: Partial<ShareDeliveryOutcome> = {}): ShareDeliveryOutcome {
  return {
    conversationId: "c1",
    deliveryKey: deliveryKeyOf(BATCH, key),
    messageId: "m1",
    ok: true,
    retryable: false,
    ...overrides,
  };
}

const marco = recipient({ conversationId: "c1", key: "conv:c1" });
const luca = recipient({ displayName: "Luca", key: "profile:p2", kind: "person", profileId: "p2" });
const staff = recipient({
  conversationId: "g1",
  displayName: "Staff",
  key: "conv:g1",
  kind: "group",
});

describe("newShareId", () => {
  it("è un UUID v4 diverso a ogni batch", () => {
    const first = newShareId();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newShareId()).not.toBe(first);
  });
});

describe("destinazioni (§53, §128)", () => {
  it("la delivery_key è <batch>:<recipientKey>, una per destinazione", () => {
    expect(deliveryKeyOf(BATCH, "conv:c1")).toBe(`${BATCH}:conv:c1`);
  });

  it("DIRECT e GROUP esistenti vanno come conversazione", () => {
    expect(buildDestination(marco, BATCH)).toEqual({
      conversation_id: "c1",
      delivery_key: `${BATCH}:conv:c1`,
      kind: "conversation",
    });
    expect(buildDestination(staff, BATCH)?.kind).toBe("conversation");
  });

  it("una persona senza DIRECT va come profilo (get-or-create sul server)", () => {
    expect(buildDestination(luca, BATCH)).toEqual({
      delivery_key: `${BATCH}:profile:p2`,
      kind: "profile",
      profile_id: "p2",
    });
  });

  it("un Media è un profilo; una Società va come profilo del titolare, mai come club (D1)", () => {
    const media = recipient({ key: "profile:m1", kind: "media", profileId: "m1" });
    const club = recipient({
      clubId: "club-1",
      key: "club:club-1",
      kind: "club",
      profileId: "owner-1",
    });

    expect(buildDestination(media, BATCH)?.kind).toBe("profile");
    expect(buildDestination(club, BATCH)).toEqual({
      delivery_key: `${BATCH}:club:club-1`,
      kind: "profile",
      profile_id: "owner-1",
    });
  });

  it("una Società senza titolare non ha destinazione", () => {
    expect(
      buildDestination(recipient({ key: "club:c", kind: "club", profileId: null }), BATCH),
    ).toBeNull();
  });

  it("persona P e Società di cui P è titolare sono una sola consegna (dedup per profile_id)", () => {
    const person = recipient({ key: "profile:owner-1", kind: "person", profileId: "owner-1" });
    const club = recipient({ key: "club:club-1", kind: "club", profileId: "owner-1" });
    const plan = planDestinations([person, club, marco], BATCH);

    expect(plan.destinations.map((d) => d.delivery_key)).toEqual([
      `${BATCH}:profile:owner-1`,
      `${BATCH}:conv:c1`,
    ]);
    expect(plan.aliases).toEqual({
      [`${BATCH}:club:club-1`]: `${BATCH}:profile:owner-1`,
    });
  });

  it("DIRECT con P e Società di cui P è titolare sono una sola consegna (identità profile:<P>)", () => {
    const direct = recipient({
      conversationId: "c-owner",
      key: "conv:c-owner",
      kind: "direct",
      profileId: "owner-1",
    });
    const club = recipient({ key: "club:club-1", kind: "club", profileId: "owner-1" });
    const plan = planDestinations([direct, club], BATCH);

    expect(plan.destinations).toEqual([
      { conversation_id: "c-owner", delivery_key: `${BATCH}:conv:c-owner`, kind: "conversation" },
    ]);
    expect(plan.aliases).toEqual({ [`${BATCH}:club:club-1`]: `${BATCH}:conv:c-owner` });
    // L'ordine non cambia il numero di consegne.
    expect(planDestinations([club, direct], BATCH).destinations).toHaveLength(1);
    expect(deliveryCount([direct, club], BATCH)).toBe(1);
  });

  it("un GROUP non si deduplica con nessuna persona", () => {
    expect(deliveryCount([staff, marco, luca], BATCH)).toBe(3);
  });

  it("le righe senza destinazione contano comunque come una voce", () => {
    const broken = recipient({ conversationId: null, key: "conv:x" });

    expect(deliveryCount([marco, broken], BATCH)).toBe(2);
  });

  it("la valutazione conta le consegne deduplicate: P + Società di P riuscite = «Inviato» a 1", () => {
    const direct = recipient({ conversationId: "c-owner", key: "conv:c-owner", profileId: "owner-1" });
    const club = recipient({ key: "club:club-1", kind: "club", profileId: "owner-1" });
    const outcomes = mergeOutcomes(new Map(), [outcome("conv:c-owner")]);
    const result = evaluateBatch([direct, club], BATCH, outcomes);

    expect(result).toMatchObject({ kind: "success", okCount: 1, total: 1 });
    expect(result.statuses).toEqual({ "club:club-1": "sent", "conv:c-owner": "sent" });
  });

  it("la riga scartata dal dedup eredita l'esito di quella che la copre", () => {
    const person = recipient({ key: "profile:owner-1", kind: "person", profileId: "owner-1" });
    const club = recipient({ key: "club:club-1", kind: "club", profileId: "owner-1" });
    const { aliases } = planDestinations([person, club], BATCH);
    const outcomes = mergeOutcomes(
      new Map(),
      withAliasedOutcomes([outcome("profile:owner-1")], aliases),
    );

    expect(evaluateBatch([person, club], BATCH, outcomes).kind).toBe("success");
  });

  it("un errore Postgres 22023 non è ritentabile, un errore di rete sì", () => {
    expect(isMalformedInputError({ code: "22023", message: "x" })).toBe(true);
    expect(isMalformedInputError({ code: "08006" })).toBe(false);
    expect(isMalformedInputError(new Error("rete"))).toBe(false);
    expect(isMalformedInputError(null)).toBe(false);
    expect(transientFailureOutcomes(buildDestinations([marco], BATCH), false)[0].retryable).toBe(false);
  });

  it("una riga senza l'identificativo del suo tipo non ha destinazione", () => {
    const broken = recipient({ conversationId: null, key: "conv:x" });

    expect(buildDestination(broken, BATCH)).toBeNull();
    expect(buildDestinations([marco, broken], BATCH)).toHaveLength(1);
  });

  it("un multi-select non crea un gruppo: N destinazioni separate (§70–§73)", () => {
    const destinations = buildDestinations([marco, luca, staff], BATCH);

    expect(destinations.map((d) => d.kind)).toEqual(["conversation", "profile", "conversation"]);
    expect(new Set(destinations.map((d) => d.delivery_key)).size).toBe(3);
  });

  it("le chiavi sono stabili tra un tentativo e il successivo (§129)", () => {
    expect(buildDestinations([marco, luca], BATCH)).toEqual(buildDestinations([marco, luca], BATCH));
  });
});

describe("evaluateBatch (§135–§139, §216)", () => {
  it("tutte riuscite → successo", () => {
    const outcomes = mergeOutcomes(new Map(), [outcome("conv:c1"), outcome("profile:p2")]);
    const result = evaluateBatch([marco, luca], BATCH, outcomes);

    expect(result.kind).toBe("success");
    expect(result.okCount).toBe(2);
  });

  it("nessuna riuscita → errore totale; «Riprova» solo se qualcuna è ritentabile", () => {
    const retryable = mergeOutcomes(new Map(), [
      outcome("conv:c1", { ok: false, retryable: true }),
    ]);
    const final = mergeOutcomes(new Map(), [outcome("conv:c1", { ok: false, retryable: false })]);

    expect(composeStatusOf(evaluateBatch([marco], BATCH, retryable))).toEqual({
      canRetry: true,
      kind: "failed",
    });
    expect(composeStatusOf(evaluateBatch([marco], BATCH, final))).toEqual({
      canRetry: false,
      kind: "failed",
    });
  });

  it("alcune riuscite → parziale: 2 di 3, 1 non riuscito (§139)", () => {
    const outcomes = mergeOutcomes(new Map(), [
      outcome("conv:c1"),
      outcome("profile:p2"),
      outcome("conv:g1", { ok: false, retryable: true }),
    ]);
    const result = evaluateBatch([marco, luca, staff], BATCH, outcomes);

    expect(result).toMatchObject({
      failedCount: 1,
      kind: "partial",
      okCount: 2,
      retryableCount: 1,
      total: 3,
    });
    expect(result.statuses).toEqual({
      "conv:c1": "sent",
      "conv:g1": "retryable",
      "profile:p2": "sent",
    });
  });

  it("un fallimento non ritentabile (blocco, gruppo chiuso) non propone «Riprova» (§216)", () => {
    const outcomes = mergeOutcomes(new Map(), [
      outcome("conv:c1"),
      outcome("conv:g1", { ok: false, retryable: false }),
    ]);
    const result = evaluateBatch([marco, staff], BATCH, outcomes);

    expect(result).toMatchObject({ kind: "partial", retryableCount: 0 });
    expect(composeStatusOf(result)).toMatchObject({ kind: "partial", retryCount: 0 });
  });

  it("una destinazione senza esito non si dichiara inviata", () => {
    const result = evaluateBatch([marco, luca], BATCH, mergeOutcomes(new Map(), [outcome("conv:c1")]));

    expect(result.kind).toBe("partial");
    expect(result.statuses["profile:p2"]).toBe("retryable");
  });
});

describe("retry selettivo (§141–§143, §200)", () => {
  it("rimanda solo i falliti ritentabili", () => {
    const outcomes = mergeOutcomes(new Map(), [
      outcome("conv:c1"),
      outcome("profile:p2", { ok: false, retryable: true }),
      outcome("conv:g1", { ok: false, retryable: false }),
    ]);
    const evaluation = evaluateBatch([marco, luca, staff], BATCH, outcomes);

    expect(recipientsToRetry([marco, luca, staff], evaluation)).toEqual([luca]);
  });

  it("un esito riuscito non viene mai sovrascritto da un fallimento successivo", () => {
    const first = mergeOutcomes(new Map(), [outcome("conv:c1")]);
    const second = mergeOutcomes(first, [outcome("conv:c1", { ok: false, retryable: true })]);

    expect(second.get(deliveryKeyOf(BATCH, "conv:c1"))?.ok).toBe(true);
  });

  it("dopo il retry riuscito il batch diventa un successo con le stesse chiavi", () => {
    const first = mergeOutcomes(new Map(), [
      outcome("conv:c1"),
      outcome("profile:p2", { ok: false, retryable: true }),
    ]);
    const second = mergeOutcomes(first, [outcome("profile:p2")]);

    expect(evaluateBatch([marco, luca], BATCH, second).kind).toBe("success");
  });

  it("un guasto di rete segna ritentabili le destinazioni rimandate, con le stesse chiavi (§129)", () => {
    const destinations = buildDestinations([marco, luca], BATCH);
    const outcomes = transientFailureOutcomes(destinations);

    expect(outcomes.map((o) => o.deliveryKey)).toEqual(destinations.map((d) => d.delivery_key));
    expect(outcomes.every((o) => !o.ok && o.retryable)).toBe(true);
  });

  it("una riga senza destinazione è un fallimento definitivo, non un riprova", () => {
    const broken = recipient({ conversationId: null, key: "conv:x" });
    const outcomes = mergeOutcomes(new Map(), unroutableOutcomes([marco, broken], BATCH));

    expect(evaluateBatch([broken], BATCH, outcomes)).toMatchObject({ kind: "failed", retryableCount: 0 });
  });
});

describe("deliveredConversationIds", () => {
  it("elenca una volta sola le chat realmente raggiunte", () => {
    expect(
      deliveredConversationIds({
        outcomes: [
          outcome("a", { conversationId: "c1" }),
          outcome("b", { conversationId: "c1" }),
          outcome("c", { conversationId: "c2" }),
          outcome("d", { conversationId: "c3", ok: false }),
        ],
        status: "partial",
      }),
    ).toEqual(["c1", "c2"]);
  });
});
