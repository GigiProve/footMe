/**
 * Servizio di «Non mi interessa»: nomi delle RPC e dei parametri del contratto, mapper con
 * default sicuri, nessun finto successo su una risposta ignota (HOM-11 §37–§53, §166, §177).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchFeedbackReasons,
  mapMarkResult,
  mapReasons,
  markContentNotInterested,
  setNotInterestedReason,
  undoNotInterested,
} from "./feed-feedback-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

beforeEach(() => mocks.rpc.mockReset());

describe("mapReasons — §47–§49", () => {
  it("passa da snake_case a camelCase e tiene solo righe con id ed etichetta", () => {
    expect(
      mapReasons([
        { label: "Non è rilevante per me", reason_id: "not_relevant", sort_order: 3 },
        { label: "Altro", reason_id: "other", sort_order: 4 },
        { label: "  ", reason_id: "vuota", sort_order: 5 },
        { reason_id: "senza_label" },
        { label: "Senza id" },
        null,
      ]),
    ).toEqual([
      { label: "Non è rilevante per me", reasonId: "not_relevant", sortOrder: 3 },
      { label: "Altro", reasonId: "other", sortOrder: 4 },
    ]);
  });

  it("una risposta che non è un array vale «nessun motivo», senza sollevare", () => {
    expect(mapReasons(null)).toEqual([]);
    expect(mapReasons({})).toEqual([]);
  });
});

describe("mapMarkResult — §51, §177", () => {
  it("legge stato e feedback_id", () => {
    expect(mapMarkResult({ feedback_id: "f-1", status: "recorded" })).toEqual({
      feedbackId: "f-1",
      status: "recorded",
    });
    expect(mapMarkResult([{ feedback_id: "f-1", status: "already_recorded" }])).toEqual({
      feedbackId: "f-1",
      status: "already_recorded",
    });
  });

  it("unavailable e not_allowed non portano necessariamente un id", () => {
    expect(mapMarkResult({ status: "unavailable" })).toEqual({ feedbackId: null, status: "unavailable" });
    expect(mapMarkResult({ status: "not_allowed" })).toEqual({ feedbackId: null, status: "not_allowed" });
  });

  it("uno stato ignoto o una risposta vuota solleva: non si finge un successo (§51)", () => {
    expect(() => mapMarkResult({ status: "boh" })).toThrow();
    expect(() => mapMarkResult(null)).toThrow();
  });
});

describe("RPC", () => {
  it("fetch_feed_feedback_reasons: nessun parametro, motivi dal server", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ label: "Altro", reason_id: "other", sort_order: 4 }],
      error: null,
    });

    await expect(fetchFeedbackReasons()).resolves.toEqual([
      { label: "Altro", reasonId: "other", sortOrder: 4 },
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_feed_feedback_reasons");
  });

  it("mark_content_not_interested: chiave, target, origin; l'autore NON viaggia dal client (§180)", async () => {
    mocks.rpc.mockResolvedValue({ data: { feedback_id: "f-1", status: "recorded" }, error: null });

    const result = await markContentNotInterested({
      contentId: "p-1",
      contentType: "profile_post",
      operationKey: "op-1",
      origin: "HOME_PER_TE",
      reposter: null,
    });

    expect(result).toEqual({ feedbackId: "f-1", status: "recorded" });
    expect(mocks.rpc).toHaveBeenCalledWith("mark_content_not_interested", {
      p_content_id: "p-1",
      p_content_type: "profile_post",
      p_operation_key: "op-1",
      p_origin: "HOME_PER_TE",
      p_reposter_identity_id: null,
      p_reposter_identity_type: null,
    });
  });

  it("Simple Repost: passa il reposter, il target resta l'originale (§39, §146, D4)", async () => {
    mocks.rpc.mockResolvedValue({ data: { feedback_id: "f-2", status: "recorded" }, error: null });

    await markContentNotInterested({
      contentId: "orig-1",
      contentType: "club_media",
      operationKey: "op-2",
      origin: "HOME_PER_TE",
      reposter: { identityId: "p-9", identityType: "person" },
    });

    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_content_id: "orig-1",
      p_content_type: "club_media",
      p_reposter_identity_id: "p-9",
      p_reposter_identity_type: "person",
    });
  });

  it("un errore di rete risale: è chi ha nascosto a fare il rollback (§51)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("offline") });

    await expect(
      markContentNotInterested({
        contentId: "p-1",
        contentType: "club_media",
        operationKey: "op-1",
        origin: "HOME_PER_TE",
        reposter: null,
      }),
    ).rejects.toThrow("offline");
  });

  it("set_not_interested_reason: feedback e motivo (§50)", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "updated" }, error: null });

    await expect(setNotInterestedReason("f-1", "other")).resolves.toBe("updated");
    expect(mocks.rpc).toHaveBeenCalledWith("set_not_interested_reason", {
      p_feedback_id: "f-1",
      p_reason_id: "other",
    });
  });

  it("set_not_interested_reason: not_found e invalid_reason sono stati, uno ignoto solleva", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: "invalid_reason" }, error: null });
    await expect(setNotInterestedReason("f-1", "x")).resolves.toBe("invalid_reason");

    mocks.rpc.mockResolvedValueOnce({ data: { status: "boh" }, error: null });
    await expect(setNotInterestedReason("f-1", "x")).rejects.toThrow();
  });

  it("undo_not_interested: cancella la riga propria; idempotente (§34, §53)", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { status: "removed" }, error: null });
    await expect(undoNotInterested("f-1")).resolves.toBe("removed");
    expect(mocks.rpc).toHaveBeenCalledWith("undo_not_interested", { p_feedback_id: "f-1" });

    mocks.rpc.mockResolvedValueOnce({ data: { status: "not_found" }, error: null });
    await expect(undoNotInterested("f-1")).resolves.toBe("not_found");
  });

  it("nessuna RPC tocca Follow o Segnala: tre domini separati (§166–§167)", async () => {
    mocks.rpc.mockResolvedValue({ data: { feedback_id: "f-1", status: "recorded" }, error: null });

    await markContentNotInterested({
      contentId: "p-1",
      contentType: "club_media",
      operationKey: "op-1",
      origin: "HOME_PER_TE",
      reposter: null,
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual(["mark_content_not_interested"]);
  });
});
