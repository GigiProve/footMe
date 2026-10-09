import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchApplicationDetail,
  fetchMyApplicationsPage,
} from "./applications-service";

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

/**
 * Il dettaglio legge due tabelle: la candidatura (con l'annuncio annidato) e
 * i suoi eventi. Il builder risponde alla prima `from` con la riga e alla
 * seconda con la timeline.
 */
function detailResponse(
  application: Record<string, unknown> | null,
  events: Record<string, unknown>[],
) {
  mocks.from.mockImplementation((table: string) => {
    if (table === "recruiting_applications") {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = () =>
        Promise.resolve({ data: application, error: null });
      return builder;
    }

    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.order = () => Promise.resolve({ data: events, error: null });
    return builder;
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
    outcome: null,
    position_accepting: true,
    role: "forward",
    status: "reviewing",
    team_name: "Prima squadra",
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

function detailRow(
  ad: Record<string, unknown> = {},
  overrides: Record<string, unknown> = {},
) {
  return {
    ad: {
      application_deadline_at: null,
      category: "Eccellenza",
      club: { id: "club1", logo_url: "logo.png", name: "AC Como" },
      id: "ad1",
      role_required: "forward",
      selection_completed_at: null,
      status: "published",
      team: { category: "Prima squadra", name: "Prima squadra" },
      title: "Attaccante Prima squadra",
      ...ad,
    },
    cover_message: null,
    created_at: "2026-09-01T10:00:00Z",
    id: "app1",
    status: "reviewing",
    ...overrides,
  };
}

describe("fetchApplicationDetail", () => {
  /**
   * Screen 02. L'annuncio è chiuso e la scadenza è passata, ma la selezione
   * continua: la candidatura resta attiva e il suo stato resta "reviewing".
   */
  it("keeps an application active when only the position is closed", async () => {
    detailResponse(
      detailRow({
        application_deadline_at: "2026-09-02T10:00:00Z",
        status: "closed",
      }),
      [],
    );

    const detail = await fetchApplicationDetail("p1", "app1");

    expect(detail?.group).toBe("active");
    expect(detail?.positionAccepting).toBe(false);
    expect(detail?.outcome).toBeNull();
    expect(detail?.concludedAt).toBeNull();
    expect(detail?.status).toBe("reviewing");
  });

  /**
   * Screen 03. La selezione è davvero conclusa: la candidatura esce dalle
   * attive conservando il proprio stato, e l'esito è il generico di §7
   * perché il dominio non ne conosce uno per candidato.
   */
  it("classifies a completed selection without inventing an outcome", async () => {
    detailResponse(
      detailRow({ selection_completed_at: "2026-09-10T12:00:00Z" }),
      [
        {
          event_kind: "selection_completed",
          id: "ev1",
          occurred_at: "2026-09-10T12:00:00Z",
          to_status: null,
        },
      ],
    );

    const detail = await fetchApplicationDetail("p1", "app1");

    expect(detail?.group).toBe("completed");
    expect(detail?.outcome).toBe("selection_completed");
    expect(detail?.concludedAt).toBe("2026-09-10T12:00:00Z");
    // §7: nessuna riscrittura dello stato reale in "Rifiutata".
    expect(detail?.status).toBe("reviewing");
  });

  /** §14: un esito terminale conosciuto vince sul generico. */
  it("prefers a canonical terminal outcome over the generic one", async () => {
    detailResponse(
      detailRow(
        { selection_completed_at: "2026-09-10T12:00:00Z" },
        { status: "rejected" },
      ),
      [
        {
          event_kind: "status_change",
          id: "ev1",
          occurred_at: "2026-09-08T12:00:00Z",
          to_status: "rejected",
        },
      ],
    );

    const detail = await fetchApplicationDetail("p1", "app1");

    expect(detail?.outcome).toBe("status");
    // La data è quella dell'evento reale, non quella dichiarata sull'annuncio.
    expect(detail?.concludedAt).toBe("2026-09-08T12:00:00Z");
  });

  /** §20: una candidatura non più accessibile non diventa una riga finta. */
  it("returns null when the application is no longer accessible", async () => {
    detailResponse(null, []);

    expect(await fetchApplicationDetail("p1", "app1")).toBeNull();
  });
});
