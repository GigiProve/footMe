import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: rpcMock } }));

import {
  fetchShareRecipients,
  mapShareOutcome,
  mapShareRecipient,
  mapShareRecipientsPage,
  mapShareSendResult,
  recordContentShareEvent,
  sendContentShare,
} from "./share-service";

beforeEach(() => {
  rpcMock.mockReset();
});

describe("mapShareRecipient (contratto search_share_recipients)", () => {
  const raw = {
    available: true,
    avatar_url: "https://cdn.test/a.jpg",
    club_id: null,
    context_label: "AC Como",
    conversation_id: "c1",
    display_name: "Marco Bianchi",
    group_avatar_path: null,
    is_verified: true,
    participant_count: null,
    profile_id: "p1",
    recipient_key: "conv:c1",
    role: "coach",
    kind: "direct",
  };

  it("mappa snake_case in camelCase", () => {
    expect(mapShareRecipient(raw)).toEqual({
      available: true,
      avatarUrl: "https://cdn.test/a.jpg",
      clubId: null,
      contextLabel: "AC Como",
      conversationId: "c1",
      displayName: "Marco Bianchi",
      groupAvatarPath: null,
      isVerified: true,
      key: "conv:c1",
      kind: "direct",
      participantCount: null,
      profileId: "p1",
      role: "coach",
    });
  });

  it("solo `available: false` esplicito chiude la riga", () => {
    expect(mapShareRecipient({ ...raw, available: false })?.available).toBe(false);
    expect(mapShareRecipient({ ...raw, available: undefined })?.available).toBe(true);
    expect(mapShareRecipient({ ...raw, available: null })?.available).toBe(true);
  });

  it("scarta le righe senza chiave, nome o tipo riconoscibile", () => {
    expect(mapShareRecipient({ ...raw, recipient_key: null })).toBeNull();
    expect(mapShareRecipient({ ...raw, display_name: "" })).toBeNull();
    expect(mapShareRecipient({ ...raw, kind: "broadcast" })).toBeNull();
    expect(mapShareRecipient({ ...raw, kind: "communication" })).toBeNull();
    expect(mapShareRecipient(null)).toBeNull();
  });

  it("una Società porta il profilo del titolare; senza titolare è non disponibile", () => {
    const club = { ...raw, club_id: "club-1", kind: "club", recipient_key: "club:club-1" };

    expect(mapShareRecipient({ ...club, profile_id: "owner-1" })).toMatchObject({
      available: true,
      clubId: "club-1",
      profileId: "owner-1",
    });
    expect(mapShareRecipient({ ...club, profile_id: null })?.available).toBe(false);
  });

  it("legge il numero di partecipanti dei gruppi", () => {
    expect(
      mapShareRecipient({ ...raw, kind: "group", participant_count: 8, recipient_key: "conv:g" })
        ?.participantCount,
    ).toBe(8);
  });

  it("la pagina porta cursore e righe valide", () => {
    expect(
      mapShareRecipientsPage({ items: [raw, { kind: "x" }], next_cursor: "abc" }),
    ).toMatchObject({ items: [{ key: "conv:c1" }], nextCursor: "abc" });
    expect(mapShareRecipientsPage(null)).toEqual({ items: [], nextCursor: null });
  });
});

describe("mapShareOutcome / mapShareSendResult (contratto send_content_share)", () => {
  it("mappa un esito riuscito, mai ritentabile", () => {
    expect(
      mapShareOutcome({
        conversation_id: "c1",
        delivery_key: "b:conv:c1",
        message_id: "m1",
        ok: true,
        retryable: true,
      }),
    ).toEqual({
      conversationId: "c1",
      deliveryKey: "b:conv:c1",
      messageId: "m1",
      ok: true,
      retryable: false,
    });
  });

  it("un fallimento è ritentabile solo se il server lo dice (§216)", () => {
    expect(mapShareOutcome({ delivery_key: "k", ok: false, retryable: true })?.retryable).toBe(true);
    expect(mapShareOutcome({ delivery_key: "k", ok: false, retryable: false })?.retryable).toBe(false);
    expect(mapShareOutcome({ delivery_key: "k", ok: false })?.retryable).toBe(false);
  });

  it("scarta un esito senza delivery_key", () => {
    expect(mapShareOutcome({ ok: true })).toBeNull();
  });

  it("usa lo status dichiarato dal server", () => {
    expect(
      mapShareSendResult({ outcomes: [], status: "content_unavailable" }),
    ).toEqual({ outcomes: [], status: "content_unavailable" });
  });

  it("deriva lo status dagli esiti se manca o è sconosciuto", () => {
    const outcomes = [
      { delivery_key: "a", ok: true },
      { delivery_key: "b", ok: false, retryable: true },
    ];

    expect(mapShareSendResult({ outcomes, status: "boh" }).status).toBe("partial");
    expect(mapShareSendResult({ outcomes: [outcomes[0]] }).status).toBe("ok");
    expect(mapShareSendResult({ outcomes: [outcomes[1]] }).status).toBe("failed");
    expect(mapShareSendResult(null)).toEqual({ outcomes: [], status: "failed" });
  });
});

describe("RPC", () => {
  it("fetchShareRecipients chiama search_share_recipients con cursore e query ripulita", async () => {
    rpcMock.mockResolvedValue({ data: { items: [], next_cursor: null }, error: null });

    await fetchShareRecipients({ cursor: "c-2", query: "  marco " });

    expect(rpcMock).toHaveBeenCalledWith("search_share_recipients", {
      p_cursor: "c-2",
      p_limit: 20,
      p_query: "marco",
    });
  });

  it("fetchShareRecipients propaga l'errore alla UI (che mostra «Riprova»)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("rete") });

    await expect(fetchShareRecipients({ cursor: null, query: "" })).rejects.toThrow("rete");
  });

  it("sendContentShare manda il batch in una sola chiamata, con testo ripulito e senza snapshot", async () => {
    rpcMock.mockResolvedValue({
      data: { outcomes: [{ delivery_key: "b:conv:c1", ok: true }], status: "ok" },
      error: null,
    });

    const result = await sendContentShare({
      batchId: "batch-1",
      contentId: "content-1",
      contentType: "club_media",
      destinations: [
        { conversation_id: "c1", delivery_key: "batch-1:conv:c1", kind: "conversation" },
      ],
      text: "  Guarda questo  ",
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("send_content_share", {
      p_batch_id: "batch-1",
      p_content_id: "content-1",
      p_content_type: "club_media",
      p_destinations: [
        { conversation_id: "c1", delivery_key: "batch-1:conv:c1", kind: "conversation" },
      ],
      p_text: "Guarda questo",
    });
    // Lo snapshot lo costruisce il server (§100): il client non lo manda.
    expect(Object.keys(rpcMock.mock.calls[0][1])).not.toContain("p_snapshot");
    expect(result.status).toBe("ok");
  });

  it("il testo può essere vuoto (§88)", async () => {
    rpcMock.mockResolvedValue({ data: { outcomes: [], status: "failed" }, error: null });

    await sendContentShare({
      batchId: "b",
      contentId: "c",
      contentType: "profile_post",
      destinations: [],
      text: "   ",
    });

    expect(rpcMock.mock.calls[0][1].p_text).toBe("");
  });

  it("sendContentShare propaga un errore di rete (il chiamante lo tratta come ritentabile)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("timeout") });

    await expect(
      sendContentShare({
        batchId: "b",
        contentId: "c",
        contentType: "club_media",
        destinations: [],
        text: "",
      }),
    ).rejects.toThrow("timeout");
  });

  it("recordContentShareEvent usa l'id evento per l'idempotenza", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await recordContentShareEvent({
      contentId: "c",
      contentType: "club_media",
      eventId: "e-1",
      kind: "copy_link",
    });

    expect(rpcMock).toHaveBeenCalledWith("record_content_share_event", {
      p_content_id: "c",
      p_content_type: "club_media",
      p_event_id: "e-1",
      p_kind: "copy_link",
    });
  });
});
