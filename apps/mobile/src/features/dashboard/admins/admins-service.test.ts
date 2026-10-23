/**
 * Traduzione delle risposte RPC nel modello di dominio.
 *
 * Il rischio reale non è il mapping di un campo: è che una risposta parziale
 * o un errore applicativo diventino uno zero, un elenco vuoto o un successo.
 * §21 lo vieta esplicitamente — «Non restituire semplicemente una lista vuota
 * per mascherare qualsiasi failure».
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const {
  AdminAccessError,
  fetchAdminCenter,
  fetchAdminInvitePublic,
  fetchAdminInvites,
  fetchAdmins,
  resolveAdminInviteBinding,
  searchAdminCandidates,
  toAdminError,
} = await import("./admins-service");

function ok(rows: unknown) {
  return Promise.resolve({ data: rows, error: null });
}

beforeEach(() => {
  rpc.mockReset();
});

describe("composizione del centro (§7.3)", () => {
  it("tiene null un conteggio non leggibile invece di azzerarlo", async () => {
    rpc.mockReturnValue(
      ok([
        {
          access_verified_at: "2026-10-11T09:00:00Z",
          admins_count: null,
          can_invite: false,
          can_open_roles: false,
          can_view_admins: false,
          can_view_invites: true,
          club_id: "club-1",
          club_is_verified: true,
          club_logo_url: null,
          club_name: "AC Como",
          data_revision: "12",
          invites_pending_count: 1,
          scope_label: null,
        },
      ]),
    );

    const center = await fetchAdminCenter("club-1");

    expect(center.adminsCount).toBeNull();
    expect(center.invitesPendingCount).toBe(1);
    expect(center.canViewAdmins).toBe(false);
    expect(center.dataRevision).toBe(12);
  });

  it("una risposta vuota è un accesso negato, non un centro senza dati", async () => {
    rpc.mockReturnValue(ok([]));

    await expect(fetchAdminCenter("club-1")).rejects.toMatchObject({
      code: "ADMIN_CENTER_NOT_AUTHORIZED",
    });
  });
});

describe("totali delle liste (§7.1, §21)", () => {
  it("usa il totale del server, non la lunghezza della pagina", async () => {
    rpc.mockReturnValue(
      ok([
        {
          avatar_url: null,
          full_name: "Marco Rossi",
          is_owner: true,
          profile_id: "p1",
          role_label: "Owner",
          scope_label: "Accesso completo",
          total_count: "4",
        },
        {
          avatar_url: null,
          full_name: "Luca Bianchi",
          is_owner: false,
          profile_id: "p2",
          role_label: "Direttore sportivo",
          scope_label: "Intera società",
          total_count: "4",
        },
      ]),
    );

    const page = await fetchAdmins({ clubId: "club-1", limit: 2 });

    expect(page.rows).toHaveLength(2);
    expect(page.total).toBe(4);
  });

  it("scarta una riga senza identificativo invece di inventarne uno", async () => {
    rpc.mockReturnValue(
      ok([
        { full_name: "Senza id", profile_id: null, total_count: 1 },
        {
          full_name: "Paolo Neri",
          is_owner: false,
          profile_id: "p3",
          role_label: "Team manager",
          total_count: 1,
        },
      ]),
    );

    const page = await fetchAdmins({ clubId: "club-1" });

    expect(page.rows.map((row) => row.profileId)).toEqual(["p3"]);
  });

  it("un invito senza canale riconoscibile non entra nella lista", async () => {
    rpc.mockReturnValue(
      ok([
        { invite_id: "i1", recipient_kind: "boh", total_count: 2 },
        {
          created_at: "2026-10-11T09:00:00Z",
          email_display: "giulia@example.com",
          expires_at: "2026-10-18T09:00:00Z",
          invite_id: "i2",
          recipient_kind: "email",
          revision: 3,
          role_label: "Responsabile recruiting",
          scope_label: "Primavera",
          total_count: 2,
        },
      ]),
    );

    const page = await fetchAdminInvites({ clubId: "club-1" });

    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({
      emailDisplay: "giulia@example.com",
      inviteId: "i2",
      recipientKind: "email",
      revision: 3,
    });
    expect(page.total).toBe(2);
  });
});

describe("ricerca dei destinatari (§8)", () => {
  it("conserva lo stato amministrativo e scarta uno stato sconosciuto", async () => {
    rpc.mockReturnValue(
      ok([
        {
          admin_role: null,
          admin_status: "eligible",
          full_name: "Luca Romano",
          profile_id: "p1",
          role: "director",
          total_count: 3,
        },
        {
          admin_role: "Direttore sportivo",
          admin_status: "already_admin",
          full_name: "Luca Bianchi",
          profile_id: "p2",
          role: "club_admin",
          total_count: 3,
        },
        {
          admin_status: "chissà",
          full_name: "Ignoto",
          profile_id: "p9",
          total_count: 3,
        },
      ]),
    );

    const page = await searchAdminCandidates({
      clubId: "club-1",
      query: "Luca",
    });

    expect(page.rows.map((row) => row.status)).toEqual([
      "eligible",
      "already_admin",
    ]);
    expect(page.rows[1].adminRole).toBe("Direttore sportivo");
  });
});

describe("landing e binding (§13, §15)", () => {
  it("uno stato diverso da valid non espone nulla della Società", async () => {
    rpc.mockReturnValue(ok([{ state: "unavailable" }]));

    await expect(fetchAdminInvitePublic("tok")).resolves.toEqual({
      state: "unavailable",
    });
  });

  it("uno stato di binding sconosciuto vale non disponibile, mai valido", async () => {
    rpc.mockReturnValue(ok([{ invite_id: "i1", state: "inventato" }]));

    await expect(resolveAdminInviteBinding("tok")).resolves.toEqual({
      inviteId: null,
      state: "unavailable",
    });
  });

  it("un account diverso non riceve nessun invite_id", async () => {
    rpc.mockReturnValue(ok([{ invite_id: null, state: "wrong_account" }]));

    await expect(resolveAdminInviteBinding("tok")).resolves.toEqual({
      inviteId: null,
      state: "wrong_account",
    });
  });
});

describe("codici d'errore applicativi", () => {
  it("riconosce il codice dentro il messaggio del driver", () => {
    expect(
      toAdminError(new Error('rpc error: ADMIN_INVITE_ALREADY_PENDING')).code,
    ).toBe("ADMIN_INVITE_ALREADY_PENDING");
  });

  it("non confonde un errore sconosciuto con un rifiuto autorizzativo", () => {
    expect(toAdminError(new Error("boom")).code).toBe("UNKNOWN");
  });

  it("lascia passare un AdminAccessError senza riclassificarlo", () => {
    const original = new AdminAccessError("RATE_LIMIT");

    expect(toAdminError(original)).toBe(original);
  });
});
