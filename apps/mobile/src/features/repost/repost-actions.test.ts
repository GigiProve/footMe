import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";

import { performRemoveRepost, performSimpleRepost } from "./repost-actions";
import { REPOST_QK } from "./repost-keys";
import type { RepostState } from "./repost-types";

const mocks = vi.hoisted(() => ({ removeRepost: vi.fn(), repostContent: vi.fn() }));

vi.mock("./repost-service", () => ({
  removeRepost: mocks.removeRepost,
  repostContent: mocks.repostContent,
}));

const REF = { contentId: "c-1", contentType: "club_media" } as const;
const ACTOR = { id: "me", type: "person" } as const;
const KEY = REPOST_QK.state("me", "club_media", "c-1");

function state(hasSimpleRepost: boolean): RepostState {
  return {
    identities: [
      {
        avatarUrl: null,
        canPublishPost: true,
        canRepost: true,
        canSchedule: true,
        contextLabel: "Profilo personale",
        hasSimpleRepost,
        id: "me",
        isVerified: false,
        name: "Marco Bianchi",
        type: "person",
      },
      {
        avatarUrl: null,
        canPublishPost: true,
        canRepost: true,
        canSchedule: false,
        contextLabel: "Società",
        hasSimpleRepost: false,
        id: "club-1",
        isVerified: true,
        name: "AC Como",
        type: "society",
      },
    ],
    preview: null,
    repostable: true,
  };
}

function flagOf(client: QueryClient, id: string) {
  return client.getQueryData<RepostState>(KEY)?.identities.find((identity) => identity.id === id)?.hasSimpleRepost;
}

let client: QueryClient;
let events: AnalyticsEvent[];

beforeEach(() => {
  client = new QueryClient();
  events = [];
  setAnalyticsSink((event) => events.push(event));
  mocks.removeRepost.mockReset();
  mocks.repostContent.mockReset();
});

afterEach(() => {
  setAnalyticsSink(null);
  client.clear();
});

const input = () => ({ actor: ACTOR, operationKey: "op-1", profileId: "me", queryClient: client, ref: REF });

describe("performSimpleRepost (§63, §69–§72, §225, §234–§237)", () => {
  it("successo: stato locale «ripostato» solo per l'identità che agisce; la chiave è quella dell'azione", async () => {
    client.setQueryData(KEY, state(false));
    mocks.repostContent.mockResolvedValue({ repostId: "r1", status: "created" });

    const result = await performSimpleRepost(input());

    expect(result).toEqual({ ok: true, replayed: false });
    expect(mocks.repostContent).toHaveBeenCalledWith({
      identityId: "me",
      identityType: "person",
      operationKey: "op-1",
      ref: REF,
    });
    expect(flagOf(client, "me")).toBe(true);
    expect(flagOf(client, "club-1")).toBe(false);
  });

  it("è ottimistico: lo stato cambia PRIMA della risposta (§70)", async () => {
    client.setQueryData(KEY, state(false));
    let resolve!: (value: unknown) => void;
    mocks.repostContent.mockReturnValue(new Promise((done) => (resolve = done)));

    const pending = performSimpleRepost(input());

    expect(flagOf(client, "me")).toBe(true);

    resolve({ repostId: "r1", status: "created" });
    await pending;
  });

  it("already_reposted (altro device) vale successo: lo stato canonico è «ripostato» (§236–§237)", async () => {
    client.setQueryData(KEY, state(false));
    mocks.repostContent.mockResolvedValue({ repostId: "r0", status: "already_reposted" });

    await expect(performSimpleRepost(input())).resolves.toEqual({ ok: true, replayed: true });
    expect(flagOf(client, "me")).toBe(true);
  });

  it("errore di rete: rollback allo stato precedente e «error» (§72)", async () => {
    client.setQueryData(KEY, state(false));
    mocks.repostContent.mockRejectedValue(new Error("Network request failed"));

    const result = await performSimpleRepost(input());

    expect(result).toEqual({ failure: "error", ok: false });
    expect(flagOf(client, "me")).toBe(false);
    // Risposta persa: la richiesta potrebbe essere arrivata, lo stato in cache va riletto.
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
  });

  it("originale sparito prima del Repost: rollback e «unavailable» (§228–§229)", async () => {
    client.setQueryData(KEY, state(false));
    mocks.repostContent.mockResolvedValue({ repostId: null, status: "content_unavailable" });

    expect(await performSimpleRepost(input())).toEqual({ failure: "unavailable", ok: false });
    expect(flagOf(client, "me")).toBe(false);
  });

  it("permesso perso: rollback e «forbidden» (§225, §35)", async () => {
    client.setQueryData(KEY, state(false));
    mocks.repostContent.mockResolvedValue({ repostId: null, status: "forbidden" });

    expect(await performSimpleRepost(input())).toEqual({ failure: "forbidden", ok: false });
    expect(flagOf(client, "me")).toBe(false);
  });

  it("senza uno stato in cache non inventa nulla e non lancia", async () => {
    mocks.repostContent.mockRejectedValue(new Error("boom"));

    await expect(performSimpleRepost(input())).resolves.toEqual({ failure: "error", ok: false });
    expect(client.getQueryData(KEY)).toBeUndefined();
  });

  it("analytics: tentativo, poi un esito; mai testo né nomi (§269–§270)", async () => {
    client.setQueryData(KEY, state(false));
    mocks.repostContent.mockResolvedValue({ repostId: "r1", status: "created" });

    await performSimpleRepost(input());

    expect(events.map((event) => event.name)).toEqual(["simple_repost_attempt", "simple_repost_success"]);
    expect(events[1].props).toEqual({
      contentId: "c-1",
      contentType: "club_media",
      identityType: "person",
      replayed: false,
    });
  });

  it("analytics di un fallimento: una sola riga, col motivo", async () => {
    client.setQueryData(KEY, state(false));
    mocks.repostContent.mockRejectedValue(new Error("boom"));

    await performSimpleRepost(input());

    expect(events.map((event) => event.name)).toEqual(["simple_repost_attempt", "simple_repost_failure"]);
    expect(events[1].props).toMatchObject({ reason: "error" });
  });
});

describe("performRemoveRepost (§128–§131, §238)", () => {
  const removeInput = () => ({ actor: ACTOR, profileId: "me", queryClient: client, ref: REF });

  it("rimuove: stato locale «non ripostato», evento di rimozione", async () => {
    client.setQueryData(KEY, state(true));
    mocks.removeRepost.mockResolvedValue("removed");

    await expect(performRemoveRepost(removeInput())).resolves.toEqual({ ok: true });
    expect(mocks.removeRepost).toHaveBeenCalledWith({ identityId: "me", identityType: "person", ref: REF });
    expect(flagOf(client, "me")).toBe(false);
    expect(events.map((event) => event.name)).toEqual(["simple_repost_removed"]);
  });

  it("not_found (già rimosso da un altro device) vale successo e converge (§238)", async () => {
    client.setQueryData(KEY, state(true));
    mocks.removeRepost.mockResolvedValue("not_found");

    await expect(performRemoveRepost(removeInput())).resolves.toEqual({ ok: true });
    expect(flagOf(client, "me")).toBe(false);
  });

  it("errore: rollback, il Repost resta", async () => {
    client.setQueryData(KEY, state(true));
    mocks.removeRepost.mockRejectedValue(new Error("Network request failed"));

    await expect(performRemoveRepost(removeInput())).resolves.toEqual({ failure: "error", ok: false });
    expect(flagOf(client, "me")).toBe(true);
    expect(events).toEqual([]);
  });

  it("forbidden: rollback e «forbidden»", async () => {
    client.setQueryData(KEY, state(true));
    mocks.removeRepost.mockResolvedValue("forbidden");

    await expect(performRemoveRepost(removeInput())).resolves.toEqual({ failure: "forbidden", ok: false });
    expect(flagOf(client, "me")).toBe(true);
  });
});
