/**
 * Perdita d'accesso e cache (DAS-REV-33 §17, §26): le query in volo si
 * annullano **prima** di essere rimosse, così una risposta tardiva non
 * ripopola dati che il viewer non può più leggere.
 */
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { MESSAGING_QK } from "../../../messaging/messaging-keys";
import { GROUPS_QK } from "../groups-keys";
import { invalidateGroupQueries, purgeGroupQueries } from "./group-cache";

const chatPurge = vi.hoisted(() => ({ purgeConversationCache: vi.fn(async () => {}) }));

vi.mock("../../../messaging/use-group-chat-access", () => chatPurge);

const ACTOR = "actor-1";
const CONVERSATION = "conv-1";
const OTHER = "conv-2";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

const client = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });

describe("purgeGroupQueries", () => {
  it("annulla le richieste prima di rimuovere le query", async () => {
    const queryClient = client();
    const cancel = vi.spyOn(queryClient, "cancelQueries");
    const remove = vi.spyOn(queryClient, "removeQueries");

    await purgeGroupQueries(queryClient, ACTOR, CONVERSATION);

    expect(cancel).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(Math.max(...cancel.mock.invocationCallOrder)).toBeLessThan(Math.min(...remove.mock.invocationCallOrder));
    expect(chatPurge.purgeConversationCache).toHaveBeenCalledWith(queryClient, CONVERSATION);
  });

  it("una risposta tardiva non ripopola la cache", async () => {
    const queryClient = client();
    const key = GROUPS_QK.management(ACTOR, CONVERSATION);
    const late = deferred<{ name: string }>();

    const inFlight = queryClient.fetchQuery({ queryFn: () => late.promise, queryKey: key }).catch(() => null);

    await purgeGroupQueries(queryClient, ACTOR, CONVERSATION);

    late.resolve({ name: "Staff Primavera" });
    await inFlight;

    expect(queryClient.getQueryData(key)).toBeUndefined();
    expect(queryClient.getQueryCache().find({ queryKey: key })).toBeUndefined();
  });

  it("rimuove ogni proiezione della conversazione e nessuna di un'altra", async () => {
    const queryClient = client();
    const mine = [
      GROUPS_QK.management(ACTOR, CONVERSATION),
      GROUPS_QK.members(ACTOR, CONVERSATION, ""),
      GROUPS_QK.eligible(ACTOR, CONVERSATION, "ri"),
      GROUPS_QK.teamOptions(ACTOR, CONVERSATION),
      GROUPS_QK.handover(ACTOR, CONVERSATION, ""),
      GROUPS_QK.detail(ACTOR, "club-1", CONVERSATION),
    ];
    const others = [GROUPS_QK.management(ACTOR, OTHER), GROUPS_QK.detail(ACTOR, "club-1", OTHER)];

    [...mine, ...others].forEach((key) => queryClient.setQueryData(key, { ok: true }));

    await purgeGroupQueries(queryClient, ACTOR, CONVERSATION);

    mine.forEach((key) => expect(queryClient.getQueryData(key)).toBeUndefined());
    others.forEach((key) => expect(queryClient.getQueryData(key)).toEqual({ ok: true }));
  });

  it("le liste per Società e l'Inbox si rileggono, non si rimuovono", async () => {
    const queryClient = client();
    const lists = [GROUPS_QK.center(ACTOR, "club-1", ""), GROUPS_QK.archived(ACTOR, "club-1", ""), MESSAGING_QK.inbox(ACTOR)];

    lists.forEach((key) => queryClient.setQueryData(key, { rows: [] }));

    await purgeGroupQueries(queryClient, ACTOR, CONVERSATION);

    lists.forEach((key) => {
      expect(queryClient.getQueryData(key)).toEqual({ rows: [] });
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    });
  });
});

describe("invalidateGroupQueries", () => {
  it("dopo un comando riuscito marca da rileggere ogni superficie dello stesso gruppo", async () => {
    const queryClient = client();
    const keys = [
      GROUPS_QK.management(ACTOR, CONVERSATION),
      GROUPS_QK.members(ACTOR, CONVERSATION, ""),
      GROUPS_QK.detail(ACTOR, "club-1", CONVERSATION),
      GROUPS_QK.center(ACTOR, "club-1", ""),
      MESSAGING_QK.inbox(ACTOR),
      MESSAGING_QK.groupMeta(CONVERSATION),
    ];

    keys.forEach((key) => queryClient.setQueryData(key, { ok: true }));
    queryClient.setQueryData(GROUPS_QK.management(ACTOR, OTHER), { ok: true });

    await invalidateGroupQueries(queryClient, ACTOR, CONVERSATION);

    keys.forEach((key) => expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(GROUPS_QK.management(ACTOR, OTHER))?.isInvalidated).toBe(false);
  });
});
