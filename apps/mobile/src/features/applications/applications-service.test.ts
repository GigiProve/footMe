import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMyApplicationsPage } from "./applications-service";

/**
 * Accesso al dominio Candidature (DAS-REV-04 §6, §14, §18, §27).
 *
 * Il cuore di questi test è una sola regola: Attive / Concluse si decide su
 * fatti del dominio — stato terminale e conclusione della selezione — e mai
 * sulla disponibilità dell'annuncio. §6: «Chiudere una posizione alle nuove
 * candidature non conclude automaticamente le candidature già ricevute.»
 */

const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  const from = vi.fn();

  return { from, rpc };
});

vi.mock("../../lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function pageResponse(row: Record<string, unknown>) {
  mocks.rpc.mockReturnValue({
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  });
}

function listRow(overrides: Record<string, unknown> = {}) {
  return {
    ad_id: "ad1",
    category: "Eccellenza",
    club_logo_url: "logo.png",
    club_name: "AC Como",
    concluded_at: null,
    created_at: "2026-09-01T10:00:00Z",
    group: "active",
    id: "app1",
    last_event_id: null,
    latest_submitted_at: "2026-09-01T10:00:00Z",
    outcome: null,
    position_accepting: true,
    role: "forward",
    status: "reviewing",
    team_name: "Prima squadra",
    withdrawn_at: null,
    ...overrides,
  };
}

describe("fetchMyApplicationsPage", () => {
  it("asks the source for the requested group and cursor", async () => {
    pageResponse({ items: [], next_cursor: null });

    await fetchMyApplicationsPage("completed", "2026-09-10T12:00:00Z|app9");

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_my_applications_page", {
      p_cursor: "2026-09-10T12:00:00Z|app9",
      p_group: "completed",
      p_limit: 20,
    });
  });

  it("maps a concluded row with its real outcome and date", async () => {
    pageResponse({
      items: [
        listRow({
          concluded_at: "2026-09-10T12:00:00Z",
          group: "completed",
          outcome: "selection_completed",
          position_accepting: false,
          // §7: lo stato reale sopravvive alla conclusione della selezione.
          status: "reviewing",
        }),
      ],
      next_cursor: "2026-09-10T12:00:00Z|app1",
    });

    const page = await fetchMyApplicationsPage("completed", null);

    expect(page.items[0]).toMatchObject({
      concludedAt: "2026-09-10T12:00:00Z",
      group: "completed",
      outcome: "selection_completed",
      status: "reviewing",
    });
    expect(page.nextCursor).toBe("2026-09-10T12:00:00Z|app1");
  });

  /** §18: la fine della lista è l'assenza di cursore, non una pagina corta. */
  it("reports the end of the list as a missing cursor", async () => {
    pageResponse({ items: [listRow()], next_cursor: null });

    const page = await fetchMyApplicationsPage("active", null);

    expect(page.nextCursor).toBeNull();
  });

  /** §7: in dubbio la posizione accetta — un campo assente non la chiude. */
  it("does not infer a closed position from a missing field", async () => {
    const row = listRow();
    delete (row as Record<string, unknown>).position_accepting;
    pageResponse({ items: [row], next_cursor: null });

    const page = await fetchMyApplicationsPage("active", null);

    expect(page.items[0].positionAccepting).toBe(true);
  });

  /** Una risposta vuota non è un errore e non inventa righe. */
  it("survives a source that returns nothing", async () => {
    pageResponse({});

    const page = await fetchMyApplicationsPage("active", null);

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it("propagates the source error instead of showing an empty list", async () => {
    mocks.rpc.mockReturnValue({
      maybeSingle: () =>
        Promise.resolve({ data: null, error: new Error("boom") }),
    });

    await expect(fetchMyApplicationsPage("active", null)).rejects.toThrow(
      "boom",
    );
  });
});

/**
 * DAS-REV-23 §16, §19. Due fatti che la riga non sapeva distinguere:
 * la data dell'invio **corrente** e la data del ritiro.
 */
describe("le date del lifecycle nella riga", () => {
  it("porta la data dell'ultima submission, distinta dal primo invio", async () => {
    pageResponse({
      items: [
        listRow({
          created_at: "2026-09-13T10:00:00Z",
          latest_submitted_at: "2026-09-14T08:10:00Z",
        }),
      ],
      next_cursor: null,
    });

    const page = await fetchMyApplicationsPage("active", null);

    expect(page.items[0].createdAt).toBe("2026-09-13T10:00:00Z");
    expect(page.items[0].latestSubmittedAt).toBe("2026-09-14T08:10:00Z");
  });

  it("conserva la data del ritiro accanto a quella dell'invio", async () => {
    pageResponse({
      items: [
        listRow({
          concluded_at: "2026-09-14T08:05:00Z",
          group: "completed",
          outcome: "status",
          status: "withdrawn",
          withdrawn_at: "2026-09-14T08:05:00Z",
        }),
      ],
      next_cursor: null,
    });

    const page = await fetchMyApplicationsPage("completed", null);

    expect(page.items[0].withdrawnAt).toBe("2026-09-14T08:05:00Z");
    // §16: «La data di una riga Ritirata è la data reale del ritiro.»
    expect(page.items[0].concludedAt).toBe(page.items[0].withdrawnAt);
  });

  it("ricade sul primo invio quando il record non conosce la submission", async () => {
    // §32: un record anteriore a DAS-REV-22 non ha la colonna. Non si
    // inventa una data: vale quella che esiste.
    pageResponse({
      items: [listRow({ latest_submitted_at: null })],
      next_cursor: null,
    });

    const page = await fetchMyApplicationsPage("active", null);

    expect(page.items[0].latestSubmittedAt).toBe("2026-09-01T10:00:00Z");
  });
});
