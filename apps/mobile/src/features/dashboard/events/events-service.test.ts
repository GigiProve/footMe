/**
 * Traduzione delle RPC eventi nel modello (DAS-REV-28 §21, §24).
 *
 * Il rischio non è un campo mappato male: è un rifiuto autorizzativo che
 * diventa lista vuota, un errore di rete scambiato per un 403, o i codici per
 * campo persi per strada.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const {
  SelectionEventsError,
  fetchSelectionEventEditor,
  fetchSelectionEventsCenter,
  fetchSelectionEventsPage,
  publishSelectionEvent,
  saveSelectionEventDraft,
  toSelectionEventsError,
} = await import("./events-service");

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const fail = (message: string) => Promise.resolve({ data: null, error: { message } });

beforeEach(() => rpc.mockReset());

describe("errori", () => {
  it("codici per campo da INVALID e NOT_PUBLISHABLE", () => {
    const invalid = toSelectionEventsError({ message: "SELECTION_EVENT_INVALID:years_inverted,capacity_invalid" });
    const blocked = toSelectionEventsError({ message: "SELECTION_EVENT_NOT_PUBLISHABLE:type_missing,start_past" });

    expect([invalid.code, invalid.fields]).toEqual(["SELECTION_EVENT_INVALID", ["years_inverted", "capacity_invalid"]]);
    expect(blocked.fields).toEqual(["type_missing", "start_past"]);
  });

  it("§24: un rifiuto non è un errore di rete, e viceversa", () => {
    expect(toSelectionEventsError({ message: "SELECTION_EVENT_NOT_AUTHORIZED" }).isAuthorization).toBe(true);
    const network = toSelectionEventsError(new TypeError("Network request failed"));

    expect([network.code, network.isAuthorization, network.isTransport]).toEqual(["NETWORK", false, true]);
  });

  it("squadra archiviata diventa errore del campo squadra", () => {
    expect(toSelectionEventsError({ message: "TEAM_NOT_ACTIVE" }).fields).toEqual(["team_inactive"]);
  });
});

describe("letture", () => {
  it("centro: capability e limiti dal server", async () => {
    rpc.mockReturnValueOnce(
      ok([
        {
          access_verified_at: "2026-09-13T10:00:00Z",
          can_create: false,
          club_id: "c1",
          club_is_verified: true,
          club_logo_url: null,
          club_name: "AC Como",
          limits: { title: 100 },
          scope_label: "Primavera",
          timezone_name: "Europe/Rome",
        },
      ]),
    );

    const center = await fetchSelectionEventsCenter("c1");

    expect([center.canCreate, center.scopeLabel, center.limits.title, center.limits.description]).toEqual([
      false,
      "Primavera",
      100,
      2000,
    ]);
  });

  it("QA-002: rifiuto del Centro propagato, mai lista vuota", async () => {
    rpc.mockReturnValueOnce(fail("SELECTION_EVENTS_NOT_AUTHORIZED"));

    await expect(fetchSelectionEventsCenter("c1")).rejects.toBeInstanceOf(SelectionEventsError);
  });

  it("pagina: has_more e cursore dall'ultima riga, conteggi null preservati", async () => {
    rpc.mockReturnValueOnce(
      ok([
        { can_edit: true, confirmed_count: null, counts_available: false, event_id: "d1", event_type: null, has_more: true, next_cursor: "c-1", start_date: null, start_time: null, status: "draft", team_id: "t1", team_name: "Primavera", title: null, timezone_name: "Europe/Rome" },
      ]),
    );

    const page = await fetchSelectionEventsPage({ clubId: "c1", section: "drafts" });

    expect([page.hasMore, page.nextCursor, page.rows[0].confirmedCount, page.rows[0].title]).toEqual([true, "c-1", null, null]);
    expect(rpc).toHaveBeenCalledWith("fetch_selection_events_page", expect.objectContaining({ p_section: "drafts" }));
  });

  it("editor: orari HH:MM e anni come testo del form", async () => {
    rpc.mockReturnValueOnce(
      ok([{ birth_year_from: 2008, birth_year_to: 2009, can_edit: true, can_publish: true, event_id: "e4", max_participants: 50, start_date: "2026-09-30", start_time: "15:00:00", status: "draft", team_id: "t1", version: 4 }]),
    );

    const editor = await fetchSelectionEventEditor("e4");

    expect([editor.values.startTime, editor.values.birthYearFrom, editor.values.maxParticipants, editor.version]).toEqual([
      "15:00",
      "2008",
      "50",
      4,
    ]);
  });
});

describe("comandi", () => {
  it("salva bozza: patch, versione e chiave passate così come sono", async () => {
    rpc.mockReturnValueOnce(ok([{ event_id: "e4", replayed: false, status: "draft", version: 2 }]));

    const result = await saveSelectionEventDraft({
      clubId: "c1",
      eventId: "e4",
      expectedVersion: 1,
      idempotencyKey: "k",
      patch: { title: "x" },
    });

    expect(result).toEqual({ eventId: "e4", replayed: false, status: "draft", version: 2 });
    expect(rpc).toHaveBeenCalledWith("save_selection_event_draft", {
      p_club_id: "c1",
      p_event_id: "e4",
      p_expected_version: 1,
      p_idempotency_key: "k",
      p_patch: { title: "x" },
    });
  });

  it("pubblica: conflitto di versione riconoscibile", async () => {
    rpc.mockReturnValueOnce(fail("SELECTION_EVENT_VERSION_CONFLICT"));

    await expect(publishSelectionEvent({ eventId: "e4", expectedVersion: 1, idempotencyKey: "k" })).rejects.toMatchObject({
      code: "SELECTION_EVENT_VERSION_CONFLICT",
    });
  });
});
