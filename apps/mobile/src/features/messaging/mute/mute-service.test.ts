/**
 * RPC dello stato Notifiche (DAS-REV-34 §9, §24): il client manda solo scelta,
 * operation id e periodo osservato; l'errore del server passa intatto.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchConversationNotificationState, setConversationMute } from "./mute-service";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({ supabase: { rpc: rpcMock } }));

const row = {
  can_change: true,
  conversation_id: "c1",
  conversation_type: "group",
  is_muted: true,
  mute_option: "8h",
  muted_until: "2026-11-17T20:00:00Z",
  period_id: "p1",
  state_version: 3,
};

beforeEach(() => {
  rpcMock.mockReset();
});

describe("fetchConversationNotificationState", () => {
  it("legge lo stato della conversazione e lo normalizza", async () => {
    rpcMock.mockResolvedValue({ data: row, error: null });

    await expect(fetchConversationNotificationState("c1")).resolves.toMatchObject({
      isMuted: true,
      muteOption: "8h",
      periodId: "p1",
      stateVersion: 3,
    });
    expect(rpcMock).toHaveBeenCalledWith("fetch_conversation_notification_state", { p_conversation_id: "c1" });
  });

  it("NOT_MEMBER passa come errore: nessuno stato fittizio per un non partecipante", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "NOT_MEMBER" } });

    await expect(fetchConversationNotificationState("c1")).rejects.toMatchObject({ message: "NOT_MEMBER" });
  });

  it("un payload non interpretabile è un errore, non uno stato inventato", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(fetchConversationNotificationState("c1")).rejects.toThrow();
  });
});

describe("setConversationMute", () => {
  it("manda scelta, id dell'intento e periodo; mai destinatario né scadenza", async () => {
    rpcMock.mockResolvedValue({ data: row, error: null });

    const state = await setConversationMute({
      choice: "8h",
      conversationId: "c1",
      operationId: "op-1",
      periodId: "p1",
    });

    expect(rpcMock).toHaveBeenCalledWith("set_conversation_mute", {
      p_conversation_id: "c1",
      p_operation_id: "op-1",
      p_option: "8h",
      p_period_id: "p1",
    });
    expect(state.stateVersion).toBe(3);
  });

  it("DIRECT: periodo null", async () => {
    rpcMock.mockResolvedValue({ data: { ...row, conversation_type: "direct", period_id: null }, error: null });

    await setConversationMute({ choice: "active", conversationId: "c1", operationId: "op-2", periodId: null });

    expect(rpcMock.mock.calls[0][1]).toMatchObject({ p_option: "active", p_period_id: null });
  });

  it("rilancia il rifiuto del server", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "PERIOD_ENDED" } });

    await expect(
      setConversationMute({ choice: "1h", conversationId: "c1", operationId: "op-3", periodId: "p0" }),
    ).rejects.toMatchObject({ message: "PERIOD_ENDED" });
  });
});
