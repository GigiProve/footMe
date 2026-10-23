/**
 * Traduzione delle risposte RPC nel modello del Centro (§22, §26).
 *
 * Il rischio reale non è il mapping di un campo, è che un aggregato non
 * autorizzato diventi uno zero, che un rifiuto autorizzativo diventi una
 * lista vuota, o che il client decida un perimetro che spetta al server.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const {
  PositionsAccessError,
  fetchPositionFilterOptions,
  fetchPositionsCenter,
  fetchPositionsPage,
  toPositionsError,
} = await import("./positions-service");

function ok(rows: unknown) {
  return Promise.resolve({ data: rows, error: null });
}

function fail(message: string) {
  return Promise.resolve({ data: null, error: { message } });
}

beforeEach(() => {
  rpc.mockReset();
});

describe("intestazione (§9)", () => {
  it("tiene distinte lettura Posizioni e lettura Candidature", async () => {
    rpc.mockReturnValue(
      ok([
        {
          access_verified_at: "2026-09-12T09:00:00Z",
          can_create: false,
          can_view_counts: false,
          club_id: "club-1",
          club_is_verified: true,
          club_logo_url: null,
          club_name: "AC Como",
          counts_scope_all: false,
          data_revision: "12",
          scope_label: "Primavera",
        },
      ]),
    );

    const center = await fetchPositionsCenter("club-1");

    expect(center.canCreate).toBe(false);
    expect(center.canViewCounts).toBe(false);
    expect(center.scopeLabel).toBe("Primavera");
    expect(center.clubIsVerified).toBe(true);
  });

  it("un rifiuto autorizzativo non diventa un centro vuoto", async () => {
    rpc.mockReturnValue(fail("POSITIONS_CENTER_NOT_AUTHORIZED"));

    await expect(fetchPositionsCenter("club-1")).rejects.toMatchObject({
      code: "POSITIONS_CENTER_NOT_AUTHORIZED",
    });
  });

  it("una risposta vuota non è un successo silenzioso", async () => {
    rpc.mockReturnValue(ok([]));

    await expect(fetchPositionsCenter("club-1")).rejects.toBeInstanceOf(
      PositionsAccessError,
    );
  });
});

describe("opzioni del filtro (§14)", () => {
  it("antepone «Tutte le posizioni» solo con più di un contesto", async () => {
    rpc.mockReturnValue(
      ok([
        { is_inactive: false, label: null, option_kind: "society", team_id: null },
        {
          is_inactive: false,
          label: "Primavera",
          option_kind: "team",
          team_id: "team-primavera",
        },
      ]),
    );

    const options = await fetchPositionFilterOptions({
      clubId: "club-1",
      group: "active",
    });

    expect(options.map((option) => option.kind)).toEqual([
      "all",
      "society",
      "team",
    ]);
  });

  it("con un solo contesto non offre un dropdown a una voce", async () => {
    rpc.mockReturnValue(
      ok([
        {
          is_inactive: false,
          label: "Primavera",
          option_kind: "team",
          team_id: "team-primavera",
        },
      ]),
    );

    const options = await fetchPositionFilterOptions({
      clubId: "club-1",
      group: "active",
    });

    expect(options).toHaveLength(1);
    expect(options[0].kind).toBe("team");
  });

  it("passa il gruppo al server invece di filtrare lato client", async () => {
    rpc.mockReturnValue(ok([]));

    await fetchPositionFilterOptions({ clubId: "club-1", group: "closed" });

    expect(rpc).toHaveBeenCalledWith("fetch_society_position_filters", {
      p_club_id: "club-1",
      p_group: "closed",
    });
  });
});

describe("pagina (§10, §16, §22)", () => {
  const baseRow = {
    applications_new: null,
    applications_total: null,
    as_of: "2026-09-12T10:00:00Z",
    closed_at: null,
    context_label: "Serie D",
    counts_available: false,
    next_cursor: "CURSORE",
    position_id: "pos-1",
    position_scope: "team",
    published_at: "2026-09-01T10:00:00Z",
    receiving_closed: false,
    role_required: "midfielder",
    season_label: null,
    sort_key: "0|1|pos-1",
    status: "published",
    target_role: "player",
    team_id: "team-1",
    team_is_inactive: false,
    team_name: "Prima squadra",
    title: "Centrocampista centrale",
    updated_at: "2026-09-01T10:00:00Z",
  };

  it("un aggregato non autorizzato resta null e non diventa zero", async () => {
    rpc.mockReturnValue(ok([baseRow]));

    const page = await fetchPositionsPage({
      clubId: "club-1",
      filter: { kind: "all" },
      group: "active",
    });

    expect(page.rows[0].countsAvailable).toBe(false);
    expect(page.rows[0].applicationsTotal).toBeNull();
    expect(page.rows[0].applicationsNew).toBeNull();
  });

  it("distingue uno zero confermato da un valore assente", async () => {
    rpc.mockReturnValue(
      ok([
        {
          ...baseRow,
          applications_new: 0,
          applications_total: 0,
          counts_available: true,
        },
      ]),
    );

    const page = await fetchPositionsPage({
      clubId: "club-1",
      filter: { kind: "all" },
      group: "active",
    });

    expect(page.rows[0].applicationsTotal).toBe(0);
    expect(page.rows[0].applicationsNew).toBe(0);
  });

  it("invia tipo di filtro e Team come due parametri distinti", async () => {
    rpc.mockReturnValue(ok([]));

    await fetchPositionsPage({
      clubId: "club-1",
      filter: {
        isInactive: false,
        kind: "team",
        label: "Primavera",
        teamId: "team-primavera",
      },
      group: "drafts",
    });

    expect(rpc).toHaveBeenCalledWith(
      "fetch_society_positions_page",
      expect.objectContaining({
        p_group: "drafts",
        p_scope: "team",
        p_team_id: "team-primavera",
      }),
    );
  });

  it("«Intera società» non viaggia come un Team ID nullo ambiguo", async () => {
    rpc.mockReturnValue(ok([]));

    await fetchPositionsPage({
      clubId: "club-1",
      filter: { kind: "society" },
      group: "active",
    });

    expect(rpc).toHaveBeenCalledWith(
      "fetch_society_positions_page",
      expect.objectContaining({ p_scope: "society", p_team_id: null }),
    );

    rpc.mockClear();
    rpc.mockReturnValue(ok([]));

    await fetchPositionsPage({
      clubId: "club-1",
      filter: { kind: "all" },
      group: "active",
    });

    expect(rpc).toHaveBeenCalledWith(
      "fetch_society_positions_page",
      expect.objectContaining({ p_scope: "all", p_team_id: null }),
    );
  });

  it("non dichiara altre pagine quando la pagina è corta", async () => {
    rpc.mockReturnValue(ok([baseRow]));

    const page = await fetchPositionsPage({
      clubId: "club-1",
      filter: { kind: "all" },
      group: "active",
      limit: 20,
    });

    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBe("CURSORE");
  });

  it("propaga il cursore opaco senza interpretarlo", async () => {
    rpc.mockReturnValue(ok([baseRow, baseRow]));

    const page = await fetchPositionsPage({
      clubId: "club-1",
      cursor: "PRECEDENTE",
      filter: { kind: "all" },
      group: "active",
      limit: 2,
    });

    expect(rpc).toHaveBeenCalledWith(
      "fetch_society_positions_page",
      expect.objectContaining({ p_cursor: "PRECEDENTE" }),
    );
    expect(page.hasMore).toBe(true);
    expect(page.asOf).toBe("2026-09-12T10:00:00Z");
  });

  it("scarta una riga senza identificativo invece di inventarlo", async () => {
    rpc.mockReturnValue(ok([{ ...baseRow, position_id: null }, baseRow]));

    const page = await fetchPositionsPage({
      clubId: "club-1",
      filter: { kind: "all" },
      group: "active",
    });

    expect(page.rows).toHaveLength(1);
  });
});

describe("classificazione degli errori (§26)", () => {
  it("riconosce il codice applicativo dentro il messaggio del driver", () => {
    expect(
      toPositionsError(new Error('error: POSITIONS_FILTER_NOT_AUTHORIZED')).code,
    ).toBe("POSITIONS_FILTER_NOT_AUTHORIZED");
  });

  it("un errore sconosciuto non viene scambiato per un rifiuto", () => {
    expect(toPositionsError(new Error("fetch failed")).code).toBe("UNKNOWN");
  });
});
