/**
 * Traduzione delle risposte RPC nel modello di dominio (§47).
 *
 * Il rischio reale non è il mapping di un campo: è che una risposta parziale
 * o un errore applicativo diventino uno zero, un elenco vuoto o un successo.
 * §38 lo vieta — «Empty deve derivare da una lettura riuscita» — e §40 chiede
 * che le API distinguano internamente non autorizzato, non trovato, errore
 * tecnico e conflitto di stato.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const {
  InvitesAccessError,
  createMemberInvite,
  fetchInvitesCenter,
  fetchInvitesPage,
  fetchMyInvite,
  respondToMemberInvite,
  searchInviteCandidates,
  toInvitesError,
} = await import("./invites-service");

function ok(rows: unknown) {
  return Promise.resolve({ data: rows, error: null });
}

function fail(message: string) {
  return Promise.resolve({ data: null, error: { message } });
}

beforeEach(() => {
  rpc.mockReset();
});

describe("composizione del Centro — §12", () => {
  it("tiene null un conteggio non leggibile invece di azzerarlo", async () => {
    rpc.mockReturnValue(
      ok([
        {
          access_verified_at: "2026-09-24T09:00:00Z",
          can_cancel: false,
          can_invite: false,
          can_view_requests: false,
          can_view_sent: true,
          club_id: "club-1",
          club_is_verified: true,
          club_logo_url: null,
          club_name: "AC Como",
          data_revision: 1,
          requests_pending_count: null,
          scope_label: null,
          sent_pending_count: 2,
        },
      ]),
    );

    const center = await fetchInvitesCenter("club-1");

    expect(center.requestsPendingCount).toBeNull();
    expect(center.sentPendingCount).toBe(2);
    expect(center.canViewRequests).toBe(false);
  });

  it("una risposta vuota è un rifiuto, non un centro senza dati", async () => {
    rpc.mockReturnValue(ok([]));

    await expect(fetchInvitesCenter("club-1")).rejects.toBeInstanceOf(
      InvitesAccessError,
    );
  });
});

describe("pagina — §13, §16", () => {
  const ROW = {
    context_label: "Prima squadra",
    is_unread: false,
    next_cursor: "cursor-1",
    person_avatar_url: null,
    person_name: "Mario Rossi",
    person_profile_id: "p1",
    record_id: "inv-1",
    record_kind: "invite",
    role_label: "Calciatore",
    scope_type: "team",
    state: "pending",
    state_at: "2026-09-24T09:00:00Z",
    team_id: "t1",
    team_is_inactive: false,
  };

  it("scarta una riga che non sa leggere invece di inventarla", async () => {
    rpc.mockReturnValue(ok([ROW, { ...ROW, record_id: null }, { ...ROW, state: "boh" }]));

    const result = await fetchInvitesPage({
      clubId: "club-1",
      filter: { kind: "all" },
      section: "pending",
      tab: "sent",
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].personName).toBe("Mario Rossi");
  });

  /**
   * §13: «Una pagina piena può avere un seguito; una pagina corta no.» La
   * fine non si deduce dall'assenza del cursore, che il server emette su
   * ogni riga.
   */
  it("deduce il seguito dalla dimensione della pagina, non dal cursore", async () => {
    rpc.mockReturnValue(ok([ROW]));

    const short = await fetchInvitesPage({
      clubId: "club-1",
      filter: { kind: "all" },
      limit: 20,
      section: "pending",
      tab: "sent",
    });

    expect(short.hasMore).toBe(false);
    expect(short.nextCursor).toBe("cursor-1");

    rpc.mockReturnValue(ok([ROW, ROW]));

    const full = await fetchInvitesPage({
      clubId: "club-1",
      filter: { kind: "all" },
      limit: 2,
      section: "pending",
      tab: "sent",
    });

    expect(full.hasMore).toBe(true);
  });

  /**
   * §14, §40: «modalità ALL oppure TEAM_SET con lista di Team ID». Il client
   * non manda mai un insieme vuoto che il server leggerebbe come "nessun
   * risultato".
   */
  it("traduce il filtro nel modello di §40", async () => {
    rpc.mockReturnValue(ok([]));

    await fetchInvitesPage({
      clubId: "club-1",
      filter: { kind: "all" },
      section: "pending",
      tab: "sent",
    });

    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_scope_mode: "all",
      p_team_ids: null,
    });

    await fetchInvitesPage({
      clubId: "club-1",
      filter: { kind: "teams", teamIds: ["t3", "t4"] },
      section: "recent",
      tab: "received",
    });

    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_scope_mode: "teams",
      p_section: "recent",
      p_tab: "received",
      p_team_ids: ["t3", "t4"],
    });
  });
});

describe("ricerca — §17, §41", () => {
  it("scarta una riga senza tipologia eleggibile", async () => {
    rpc.mockReturnValue(
      ok([
        {
          avatar_url: null,
          city: "Milano",
          full_name: "Mario Rossi",
          profile_id: "p1",
          profile_type: "player",
          specialty: null,
          total_count: 2,
        },
        {
          avatar_url: null,
          city: "Como",
          full_name: "Luca Tifoso",
          profile_id: "p2",
          profile_type: "fan",
          specialty: null,
          total_count: 2,
        },
      ]),
    );

    const result = await searchInviteCandidates({
      clubId: "club-1",
      query: "Mario",
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].profileType).toBe("player");
    expect(result.total).toBe(2);
  });
});

describe("codici di errore — §38, §40", () => {
  /**
   * I codici si sovrappongono per prefisso: `INVITE_ALREADY_PENDING` e
   * `INVITE_ALREADY_ACCEPTED` condividono dieci caratteri. Un match
   * sull'ordine di dichiarazione avrebbe confuso i due messaggi di §25 e
   * §26, che dicono cose diverse.
   */
  it("riconosce il codice più specifico quando i prefissi si sovrappongono", () => {
    expect(toInvitesError({ message: "INVITE_ALREADY_PENDING" }).code).toBe(
      "INVITE_ALREADY_PENDING",
    );
    expect(toInvitesError({ message: "INVITE_ALREADY_ACCEPTED" }).code).toBe(
      "INVITE_ALREADY_ACCEPTED",
    );
    expect(toInvitesError({ message: "INVITE_ALREADY_LINKED" }).code).toBe(
      "INVITE_ALREADY_LINKED",
    );
  });

  it("un messaggio sconosciuto non diventa un codice inventato", () => {
    expect(toInvitesError({ message: "boom" }).code).toBe("UNKNOWN");
  });

  it("propaga il codice del duplicato al chiamante", async () => {
    rpc.mockReturnValue(fail('new row violates: INVITE_ALREADY_PENDING'));

    await expect(
      createMemberInvite({
        clubId: "club-1",
        customRole: null,
        operationKey: "k",
        profileId: "p1",
        roleId: "player",
        scopeType: "team",
        teamId: "t1",
      }),
    ).rejects.toMatchObject({ code: "INVITE_ALREADY_PENDING" });
  });
});

describe("risposta del destinatario — §29, §33", () => {
  it("manda solo invito, azione e metadata tecnici", async () => {
    rpc.mockReturnValue(
      ok({ already_applied: false, invite_id: "inv-1", revision: 2, status: "accepted" }),
    );

    await respondToMemberInvite({
      accept: true,
      inviteId: "inv-1",
      operationKey: "k",
      revision: 1,
    });

    /* §29: «La risposta non può alterare destinatario, società, profilo,
       ruolo, custom, ambito o Team.» Il payload non ne ha nemmeno la forma. */
    expect(Object.keys(rpc.mock.calls[0][1]).sort()).toEqual([
      "p_accept",
      "p_expected_revision",
      "p_idempotency_key",
      "p_invite_id",
    ]);
  });

  it("riporta un esito storico come già applicato", async () => {
    rpc.mockReturnValue(
      ok({
        already_applied: true,
        assignment_id: "a-1",
        invite_id: "inv-1",
        resolved_at: "2026-09-24T09:00:00Z",
        revision: 3,
        status: "accepted",
      }),
    );

    const result = await respondToMemberInvite({
      accept: true,
      inviteId: "inv-1",
      operationKey: "k",
      revision: 3,
    });

    expect(result.alreadyApplied).toBe(true);
    expect(result.state).toBe("accepted");
    expect(result.assignmentId).toBe("a-1");
  });
});

describe("dettaglio personale — §28, §33", () => {
  it("distingue azionabile, stato e incarico ancora attivo", async () => {
    rpc.mockReturnValue(
      ok([
        {
          assignment_active: false,
          can_respond: false,
          club_city: "Como",
          club_id: "club-1",
          club_is_verified: true,
          club_logo_url: null,
          club_name: "AC Como",
          context_label: "Prima squadra",
          created_at: "2026-09-24T09:00:00Z",
          invite_id: "inv-1",
          profile_type: "player",
          resolved_at: "2026-09-25T09:00:00Z",
          revision: 2,
          role_label: "Calciatore",
          scope_type: "team",
          state: "cancelled",
          team_id: "t1",
          team_name: "Prima squadra",
        },
      ]),
    );

    const invite = await fetchMyInvite("inv-1");

    expect(invite.state).toBe("cancelled");
    expect(invite.canRespond).toBe(false);
    expect(invite.assignmentActive).toBe(false);
  });
});
