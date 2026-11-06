/**
 * join-links-service.test.ts
 *
 * Accesso ai dati e traduzione delle risposte RPC (§39, §40, §43).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const {
  JoinLinksAccessError,
  fetchAssignmentRoles,
  fetchJoinLinkPeoplePage,
  fetchJoinLinksCenter,
  fetchJoinLinksPage,
  fetchJoinLinkPublicContext,
  redeemJoinLink,
  toJoinLinksError,
  updateJoinLinkLimit,
  revokeJoinLink,
} = await import("./join-links-service");

function ok(rows: unknown) {
  return Promise.resolve({ data: rows, error: null });
}

beforeEach(() => {
  rpc.mockReset();
});

// ──────────────────────────────────────────────────────────────────────────
// §41 Centro autorizzato
// ──────────────────────────────────────────────────────────────────────────

describe("composizione del Centro — §41", () => {
  it("fetchJoinLinksCenter: array vuoto è rifiuto, non centro senza dati", async () => {
    rpc.mockReturnValue(ok([]));

    await expect(fetchJoinLinksCenter("club-1")).rejects.toBeInstanceOf(
      JoinLinksAccessError,
    );
  });

  it("fetchJoinLinksCenter: rifiuto ha codice JOIN_LINKS_CENTER_NOT_AUTHORIZED", async () => {
    rpc.mockReturnValue(ok([]));

    try {
      await fetchJoinLinksCenter("club-1");
      expect.fail("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(JoinLinksAccessError);
      expect((err as { code: string; detail: string | null }).code).toBe(
        "JOIN_LINKS_CENTER_NOT_AUTHORIZED",
      );
    }
  });

  it("fetchJoinLinksCenter: riga valida → centro con capability", async () => {
    rpc.mockReturnValue(
      ok([
        {
          access_verified_at: "2026-11-06T09:00:00Z",
          active_count: 5,
          can_create: true,
          can_manage: true,
          can_remove_role: false,
          can_revoke: true,
          can_view_people: true,
          club_id: "club-1",
          club_is_verified: true,
          club_logo_url: null,
          club_name: "AC Como",
          revoked_count: 2,
          scope_label: "Società",
        },
      ]),
    );

    const center = await fetchJoinLinksCenter("club-1");

    expect(center.clubName).toBe("AC Como");
    expect(center.canCreate).toBe(true);
    expect(center.canManage).toBe(true);
    expect(center.canRevoke).toBe(true);
    expect(center.activeCount).toBe(5);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §9, §27 Pagina di link
// ──────────────────────────────────────────────────────────────────────────

describe("pagina di link — §9, §27", () => {
  const ROW = {
    active_people: 3,
    allowed_profile_types: ["player", "coach"],
    availability: "available",
    completed_uses: 5,
    created_at: "2026-11-06T09:00:00Z",
    expires_on: null,
    link_id: "link-1",
    max_redemptions: null,
    next_cursor: "cursor-1",
    revoked_at: null,
    status: "active",
    team_id: "t1",
    team_name: "Prima squadra",
  };

  it("fetchJoinLinksPage: scarta riga senza link_id", async () => {
    rpc.mockReturnValue(ok([ROW, { ...ROW, link_id: null }]));

    const page = await fetchJoinLinksPage({
      clubId: "club-1",
      tab: "active",
    });

    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].id).toBe("link-1");
  });

  it("fetchJoinLinksPage: scarta riga senza team_id", async () => {
    rpc.mockReturnValue(ok([ROW, { ...ROW, team_id: null }]));

    const page = await fetchJoinLinksPage({
      clubId: "club-1",
      tab: "active",
    });

    expect(page.rows).toHaveLength(1);
  });

  it("fetchJoinLinksPage: availability sconosciuta degrada a 'structure'", async () => {
    rpc.mockReturnValue(
      ok([
        ROW,
        {
          ...ROW,
          link_id: "link-2",
          availability: "unknown_status",
        },
      ]),
    );

    const page = await fetchJoinLinksPage({
      clubId: "club-1",
      tab: "active",
    });

    expect(page.rows).toHaveLength(2);
    expect(page.rows[1].availability).toBe("structure");
  });

  it("fetchJoinLinksPage: hasMore dalla dimensione della pagina, non dal cursore", async () => {
    rpc.mockReturnValue(ok([ROW]));

    const short = await fetchJoinLinksPage({
      clubId: "club-1",
      limit: 20,
      tab: "active",
    });

    expect(short.hasMore).toBe(false);
    expect(short.nextCursor).toBe("cursor-1");

    rpc.mockReturnValue(ok([ROW, ROW]));

    const full = await fetchJoinLinksPage({
      clubId: "club-1",
      limit: 2,
      tab: "active",
    });

    expect(full.hasMore).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §33 Pagina persone
// ──────────────────────────────────────────────────────────────────────────

describe("pagina persone collegate — §33", () => {
  const ROW = {
    assignment_id: "a-1",
    avatar_url: null,
    connected_at: "2026-11-06T09:00:00Z",
    next_cursor: "cursor-1",
    person_name: "Mario Rossi",
    profile_id: "p1",
    role_label: "Calciatore",
    total_count: 27,
  };

  it("fetchJoinLinkPeoplePage: totalCount dal payload della riga, non dalla lunghezza", async () => {
    rpc.mockReturnValue(ok([ROW, ROW]));

    const page = await fetchJoinLinkPeoplePage({
      linkId: "link-1",
    });

    expect(page.rows).toHaveLength(2);
    expect(page.totalCount).toBe(27);
  });

  it("fetchJoinLinkPeoplePage: zero righe → totalCount 0", async () => {
    rpc.mockReturnValue(ok([]));

    const page = await fetchJoinLinkPeoplePage({
      linkId: "link-1",
    });

    expect(page.rows).toHaveLength(0);
    expect(page.totalCount).toBe(0);
  });

  it("fetchJoinLinkPeoplePage: scarta riga senza assignment_id", async () => {
    rpc.mockReturnValue(ok([ROW, { ...ROW, assignment_id: null }]));

    const page = await fetchJoinLinkPeoplePage({
      linkId: "link-1",
    });

    expect(page.rows).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §40 Codici di errore
// ──────────────────────────────────────────────────────────────────────────

describe("traduzione errori — §40", () => {
  it("toJoinLinksError: ordine per lunghezza (longest code first)", () => {
    const long = toJoinLinksError({
      message: "JOIN_LINK_CUSTOM_ROLE_TOO_LONG",
    });
    expect(long.code).toBe("JOIN_LINK_CUSTOM_ROLE_TOO_LONG");

    const short = toJoinLinksError({
      message: "JOIN_LINK_CUSTOM_ROLE_REQUIRED",
    });
    expect(short.code).toBe("JOIN_LINK_CUSTOM_ROLE_REQUIRED");
  });

  it("toJoinLinksError: codice sconosciuto → 'UNKNOWN'", () => {
    const err = toJoinLinksError({ message: "boom" });
    expect(err.code).toBe("UNKNOWN");
  });

  it("toJoinLinksError: carries details into .detail", () => {
    const err = toJoinLinksError({
      message: "JOIN_LINK_LIMIT_BELOW_USAGE",
      details: "31",
    });
    expect(err.detail).toBe("31");
  });

  it("toJoinLinksError: DashboardTimeoutError is re-thrown, never converted", async () => {
    const { DashboardTimeoutError } = await import(
      "../state/error-classification"
    );
    const timeoutErr = new DashboardTimeoutError("fetch_join_links");

    expect(() => {
      throw toJoinLinksError(timeoutErr);
    }).toThrow(DashboardTimeoutError);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §39 Riscatto del link (payload ristretto)
// ──────────────────────────────────────────────────────────────────────────

describe("riscatto del link — §39", () => {
  it("redeemJoinLink: manda solo p_token, p_profile_type, p_role_id, p_custom_role, p_idempotency_key", async () => {
    rpc.mockReturnValue(
      ok({
        already_applied: false,
        assignment_id: "a-1",
        outcome: "completed",
        role_label: "Calciatore",
      }),
    );

    await redeemJoinLink({
      customRole: null,
      operationKey: "key-1",
      profileType: "player",
      roleId: "role-1",
      token: "token-abc",
    });

    const params = rpc.mock.calls[0][1];
    expect(Object.keys(params).sort()).toEqual([
      "p_custom_role",
      "p_idempotency_key",
      "p_profile_type",
      "p_role_id",
      "p_token",
    ]);
    expect(params).not.toHaveProperty("p_club_id");
    expect(params).not.toHaveProperty("p_team_id");
    expect(params).not.toHaveProperty("p_profile_id");
    expect(params).not.toHaveProperty("p_quota");
  });

  it("redeemJoinLink: outcome 'already_connected'", async () => {
    rpc.mockReturnValue(
      ok({
        already_applied: false,
        assignment_id: "a-1",
        outcome: "already_connected",
        role_label: "Calciatore",
      }),
    );

    const result = await redeemJoinLink({
      customRole: null,
      operationKey: "key-1",
      profileType: "player",
      roleId: "role-1",
      token: "token-abc",
    });

    expect(result.outcome).toBe("already_connected");
  });

  it("redeemJoinLink: outcome 'completed'", async () => {
    rpc.mockReturnValue(
      ok({
        already_applied: false,
        assignment_id: "a-1",
        outcome: "completed",
        role_label: "Calciatore",
      }),
    );

    const result = await redeemJoinLink({
      customRole: null,
      operationKey: "key-1",
      profileType: "player",
      roleId: "role-1",
      token: "token-abc",
    });

    expect(result.outcome).toBe("completed");
  });

  it("redeemJoinLink: outcome sconosciuto cade a 'completed'", async () => {
    rpc.mockReturnValue(
      ok({
        already_applied: false,
        assignment_id: "a-1",
        outcome: "unknown_outcome",
        role_label: "Calciatore",
      }),
    );

    const result = await redeemJoinLink({
      customRole: null,
      operationKey: "key-1",
      profileType: "player",
      roleId: "role-1",
      token: "token-abc",
    });

    expect(result.outcome).toBe("completed");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Landing pubblica (§19)
// ──────────────────────────────────────────────────────────────────────────

describe("contesto pubblico — §19", () => {
  it("fetchJoinLinkPublicContext: nessuna riga → payload 'unavailable' senza errore", async () => {
    rpc.mockReturnValue(ok([]));

    const result = await fetchJoinLinkPublicContext("token-abc");

    expect(result.state).toBe("unavailable");
    expect(result.clubName).toBe("");
    expect(result.teamName).toBe("");
    expect(result.allowedProfileTypes).toEqual([]);
  });

  it("fetchJoinLinkPublicContext: riga con state 'valid'", async () => {
    rpc.mockReturnValue(
      ok([
        {
          allowed_profile_types: ["player", "coach"],
          club_is_verified: true,
          club_logo_url: null,
          club_name: "AC Como",
          state: "valid",
          team_name: "Prima squadra",
        },
      ]),
    );

    const result = await fetchJoinLinkPublicContext("token-abc");

    expect(result.state).toBe("valid");
    expect(result.clubName).toBe("AC Como");
    expect(result.allowedProfileTypes).toEqual(["player", "coach"]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Mutazioni gestionali (§27, §41)
// ──────────────────────────────────────────────────────────────────────────

describe("mutazioni gestionali — §27, §41", () => {
  it("updateJoinLinkLimit: manda p_idempotency_key", async () => {
    rpc.mockReturnValue(
      ok({
        already_applied: false,
        link_id: "link-1",
        revision: 2,
        token: null,
      }),
    );

    await updateJoinLinkLimit({
      linkId: "link-1",
      maxRedemptions: 50,
      operationKey: "op-key-1",
      revision: 1,
    });

    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_idempotency_key: "op-key-1",
    });
  });

  it("updateJoinLinkLimit: risultato carry alreadyApplied", async () => {
    rpc.mockReturnValue(
      ok({
        already_applied: true,
        link_id: "link-1",
        revision: 2,
      }),
    );

    const result = await updateJoinLinkLimit({
      linkId: "link-1",
      maxRedemptions: 50,
      operationKey: "op-key-1",
      revision: 1,
    });

    expect(result.alreadyApplied).toBe(true);
  });

  it("revokeJoinLink: manda p_idempotency_key", async () => {
    rpc.mockReturnValue(
      ok({
        already_applied: false,
        link_id: "link-1",
        revision: 2,
      }),
    );

    await revokeJoinLink({
      linkId: "link-1",
      operationKey: "op-key-1",
      revision: 1,
    });

    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_idempotency_key: "op-key-1",
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Catalogo dei ruoli (§13, §14)
// ──────────────────────────────────────────────────────────────────────────

describe("catalogo ruoli — §13", () => {
  it("fetchAssignmentRoles: customRoleMax dal catalogo, non da costante client", async () => {
    rpc.mockReturnValue(
      ok([
        {
          custom_role_max: 80,
          is_custom: false,
          label: "Calciatore",
          profile_type: "player",
          role_id: "player",
        },
        {
          custom_role_max: 80,
          is_custom: true,
          label: "Allenatore speciale",
          profile_type: "coach",
          role_id: "custom-1",
        },
      ]),
    );

    const catalog = await fetchAssignmentRoles();

    expect(catalog.customRoleMax).toBe(80);
    expect(catalog.roles).toHaveLength(2);
  });

  it("fetchAssignmentRoles: scarta riga senza role_id", async () => {
    rpc.mockReturnValue(
      ok([
        {
          custom_role_max: 80,
          is_custom: false,
          label: "Calciatore",
          profile_type: "player",
          role_id: "player",
        },
        {
          custom_role_max: 80,
          is_custom: false,
          label: null,
          profile_type: "coach",
          role_id: null,
        },
      ]),
    );

    const catalog = await fetchAssignmentRoles();

    expect(catalog.roles).toHaveLength(1);
  });
});
