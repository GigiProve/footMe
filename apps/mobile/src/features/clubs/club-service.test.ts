import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchClubAffiliations,
  fetchClubFollowState,
  fetchClubParentAffiliation,
  fetchClubPositionPreview,
  fetchClubPositions,
  fetchPublicClubHeaderStats,
  fetchPublicClubProfile,
  fetchPublicClubRoster,
  fetchPublicClubTeamProfile,
  followClub,
  saveClubAffiliations,
  searchClubsForAffiliation,
  updateClubSportProfile,
  unfollowClub,
} from "./club-service";

const mocks = vi.hoisted(() => {
  type Filter = {
    column: string;
    value: unknown;
  };

  type Operation = {
    action: string | null;
    filters: Filter[];
    ilikeFilters: Filter[];
    inFilters: Filter[];
    limitValue: number | null;
    neqFilters: Filter[];
    orders: { column: string; options: unknown }[];
    options: unknown;
    payload: unknown;
    rangeArgs: [number, number] | null;
    selectArgs: unknown[];
    table: string;
  };

  type MatchedResponse = {
    matcher: (operation: Operation) => boolean;
    response: unknown;
    type: "matched";
  };

  const operations: Operation[] = [];
  const responses: (MatchedResponse | unknown)[] = [];

  function isMatchedResponse(response: unknown): response is MatchedResponse {
    return (
      typeof response === "object" &&
      response !== null &&
      "type" in response &&
      (response as MatchedResponse).type === "matched"
    );
  }

  function nextResponse(operation: Operation) {
    const matchedIndex = responses.findIndex(
      (response) => isMatchedResponse(response) && response.matcher(operation),
    );

    if (matchedIndex >= 0) {
      const [matched] = responses.splice(matchedIndex, 1) as [MatchedResponse];
      return matched.response;
    }

    const genericIndex = responses.findIndex(
      (response) => !isMatchedResponse(response),
    );

    if (genericIndex >= 0) {
      const [response] = responses.splice(genericIndex, 1);
      return response;
    }

    return { data: null, error: null };
  }

  function createBuilder(table: string) {
    const operation: Operation = {
      action: null,
      filters: [],
      ilikeFilters: [],
      inFilters: [],
      limitValue: null,
      neqFilters: [],
      orders: [],
      options: null,
      payload: null,
      rangeArgs: null,
      selectArgs: [],
      table,
    };
    operations.push(operation);

    const builder = {
      delete: vi.fn(() => {
        operation.action = "delete";
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        operation.filters.push({ column, value });
        return builder;
      }),
      in: vi.fn((column: string, value: unknown) => {
        operation.inFilters.push({ column, value });
        return builder;
      }),
      ilike: vi.fn((column: string, value: unknown) => {
        operation.ilikeFilters.push({ column, value });
        return builder;
      }),
      insert: vi.fn((payload: unknown) => {
        operation.action = "insert";
        operation.payload = payload;
        return builder;
      }),
      limit: vi.fn((value: number) => {
        operation.limitValue = value;
        return builder;
      }),
      maybeSingle: vi.fn(async () => nextResponse(operation)),
      neq: vi.fn((column: string, value: unknown) => {
        operation.neqFilters.push({ column, value });
        return builder;
      }),
      order: vi.fn((column: string, options: unknown) => {
        operation.orders.push({ column, options });
        return builder;
      }),
      range: vi.fn((from: number, to: number) => {
        operation.rangeArgs = [from, to];
        return builder;
      }),
      select: vi.fn((...args: unknown[]) => {
        operation.action = "select";
        operation.selectArgs = args;
        return builder;
      }),
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(nextResponse(operation)).then(resolve, reject),
      upsert: vi.fn((payload: unknown, options: unknown) => {
        operation.action = "upsert";
        operation.payload = payload;
        operation.options = options;
        return builder;
      }),
      update: vi.fn((payload: unknown) => {
        operation.action = "update";
        operation.payload = payload;
        return builder;
      }),
    };

    return builder;
  }

  return {
    fromMock: vi.fn((table: string) => createBuilder(table)),
    operations,
    queueMatchedResponse: (
      matcher: (operation: Operation) => boolean,
      response: unknown,
    ) => {
      responses.push({ matcher, response, type: "matched" });
    },
    queueResponses: (...nextResponses: unknown[]) => {
      responses.push(...nextResponses);
    },
    reset: () => {
      operations.length = 0;
      responses.length = 0;
    },
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

describe("club-service", () => {
  beforeEach(() => {
    mocks.reset();
    mocks.fromMock.mockClear();
  });

  it("fetches the public club profile fields needed by the header", async () => {
    mocks.queueResponses(
      {
        data: {
          category: "Serie D",
          city: "Como",
          club_colors: null,
          club_email: "info@club.test",
          club_phone: null,
          country: "IT",
          description: null,
          field_address: null,
          founding_year: 1907,
          gallery_urls: ["https://cdn.test/1.jpg", 42],
          headquarters_address: null,
          id: "club-1",
          key_results: ["Serie C 2022/23", null],
          league: "LND",
          logo_url: null,
          name: "AC Como",
          owner_profile_id: "owner-1",
          region: "Lombardia",
          sports_focus: "Valorizzazione giovani",
          stadium: "Sinigaglia",
          top_level_reached: "Serie C",
          verification_status: "verified",
          website_url: null,
        },
        error: null,
      },
      {
        data: { full_name: "Owner Name" },
        error: null,
      },
    );

    const profile = await fetchPublicClubProfile("club-1");

    expect(profile).toEqual(
      expect.objectContaining({
        category: "Serie D",
        league: "LND",
        owner_full_name: "Owner Name",
        gallery_urls: ["https://cdn.test/1.jpg"],
        key_results: ["Serie C 2022/23"],
        sports_focus: "Valorizzazione giovani",
        stadium: "Sinigaglia",
        top_level_reached: "Serie C",
      }),
    );
    expect(mocks.operations[0].selectArgs[0]).toContain("category");
    expect(mocks.operations[0].selectArgs[0]).toContain("stadium");
    expect(mocks.operations[0].selectArgs[0]).toContain("sports_focus");
  });

  it("counts active teams, players, and staff for the public header", async () => {
    mocks.queueResponses(
      { count: 5, data: null, error: null },
      { count: 142, data: null, error: null },
      { count: 28, data: null, error: null },
    );

    const stats = await fetchPublicClubHeaderStats("club-1");

    expect(stats).toEqual({
      activeTeamsCount: 5,
      playersCount: 142,
      staffCount: 28,
    });
    expect(mocks.operations[0]).toEqual(
      expect.objectContaining({ action: "select", table: "club_teams" }),
    );
    expect(mocks.operations[1].filters).toEqual(
      expect.arrayContaining([
        { column: "club_id", value: "club-1" },
        { column: "status", value: "active" },
        { column: "member_role", value: "player" },
      ]),
    );
    expect(mocks.operations[2].inFilters).toEqual([
      { column: "member_role", value: ["staff", "coach", "director"] },
    ]);
  });

  it("returns the active position preview with the total count and team labels", async () => {
    mocks.queueResponses(
      {
        count: 6,
        data: [
          {
            category: "Under 19",
            created_at: "2026-05-01T08:00:00Z",
            description: "Profilo offensivo",
            id: "ad-1",
            published_at: "2026-05-02T08:00:00Z",
            region: "Lombardia",
            role_required: "forward",
            team_id: "team-1",
            title: "Attaccante",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            category: "Under 19",
            id: "team-1",
            name: "Juniores Nazionale",
          },
        ],
        error: null,
      },
    );

    const preview = await fetchClubPositionPreview("club-1");

    expect(preview.total).toBe(6);
    expect(preview.positions).toEqual([
      expect.objectContaining({
        id: "ad-1",
        role_required: "forward",
        team_category: "Under 19",
        team_name: "Juniores Nazionale",
      }),
    ]);
    expect(mocks.operations[0]).toEqual(
      expect.objectContaining({ action: "select", table: "recruiting_ads" }),
    );
    expect(mocks.operations[0].filters).toEqual(
      expect.arrayContaining([
        { column: "club_id", value: "club-1" },
        { column: "status", value: "published" },
      ]),
    );
    expect(mocks.operations[0].rangeArgs).toEqual([0, 2]);
    expect(mocks.operations[1].inFilters).toEqual([
      { column: "id", value: ["team-1"] },
    ]);
  });

  it("fetches all published club positions for the dedicated positions page", async () => {
    mocks.queueResponses(
      {
        data: [
          {
            category: "Prima squadra",
            created_at: "2026-05-01T08:00:00Z",
            description: "Profilo difensivo",
            id: "ad-1",
            published_at: "2026-05-02T08:00:00Z",
            region: "Lombardia",
            role_required: "defender",
            team_id: "team-1",
            title: "Difensore centrale",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            category: "Serie D",
            id: "team-1",
            name: "Prima squadra",
          },
        ],
        error: null,
      },
    );

    const positions = await fetchClubPositions("club-1");

    expect(positions).toEqual([
      expect.objectContaining({
        id: "ad-1",
        team_category: "Serie D",
        team_name: "Prima squadra",
      }),
    ]);
    expect(mocks.operations[0].orders).toEqual([
      {
        column: "published_at",
        options: { ascending: false, nullsFirst: false },
      },
      { column: "created_at", options: { ascending: false } },
    ]);
  });

  it("loads linked affiliate clubs with their relationship labels", async () => {
    mocks.queueResponses(
      {
        data: [
          {
            affiliate_club_id: "club-affiliate",
            relationship_label: "Academy ufficiale",
            sort_order: 0,
          },
        ],
        error: null,
      },
      {
        data: [
          {
            category: "Scuola calcio",
            city: "Cantù",
            id: "club-affiliate",
            logo_url: null,
            name: "Como Academy Cantù",
            region: "Lombardia",
          },
        ],
        error: null,
      },
    );

    const affiliations = await fetchClubAffiliations("club-1");

    expect(affiliations).toEqual([
      expect.objectContaining({
        id: "club-affiliate",
        name: "Como Academy Cantù",
        relationship_label: "Academy ufficiale",
      }),
    ]);
    expect(mocks.operations[0].orders).toEqual([
      { column: "sort_order", options: { ascending: true } },
    ]);
    expect(mocks.operations[1].inFilters).toEqual([
      { column: "id", value: ["club-affiliate"] },
    ]);
  });

  it("loads the parent club context for affiliate profiles", async () => {
    mocks.queueResponses(
      {
        data: [
          {
            club_id: "club-parent",
            relationship_label: "Centro tecnico affiliato",
            sort_order: 0,
          },
        ],
        error: null,
      },
      {
        data: [
          {
            category: "Serie D",
            city: "Como",
            id: "club-parent",
            logo_url: null,
            name: "AC Como",
            region: "Lombardia",
          },
        ],
        error: null,
      },
    );

    const parent = await fetchClubParentAffiliation("club-affiliate");

    expect(parent).toEqual({
      id: "club-parent",
      name: "AC Como",
      relationship_label: "Centro tecnico affiliato",
    });
    expect(mocks.operations[0].filters).toEqual([
      { column: "affiliate_club_id", value: "club-affiliate" },
    ]);
    expect(mocks.operations[0].limitValue).toBe(1);
  });

  it("loads the public club roster with linked profile data", async () => {
    mocks.queueResponses(
      {
        data: [
          {
            id: "member-1",
            manual_name: null,
            member_role: "player",
            profile_id: "profile-1",
            staff_title: null,
            team_id: "team-1",
          },
          {
            id: "member-2",
            manual_name: "Preparatore atletico",
            member_role: "staff",
            profile_id: null,
            staff_title: "Preparatore",
            team_id: "team-1",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            avatar_url: "https://cdn.test/avatar.jpg",
            full_name: "Luca Bianchi",
            id: "profile-1",
          },
        ],
        error: null,
      },
    );

    const roster = await fetchPublicClubRoster("club-1", "team-1");

    expect(roster).toEqual([
      expect.objectContaining({
        avatar_url: "https://cdn.test/avatar.jpg",
        full_name: "Luca Bianchi",
        id: "member-1",
        team_id: "team-1",
      }),
      expect.objectContaining({
        full_name: null,
        manual_name: "Preparatore atletico",
        staff_title: "Preparatore",
      }),
    ]);
    expect(mocks.operations[0].filters).toEqual(
      expect.arrayContaining([
        { column: "club_id", value: "club-1" },
        { column: "team_id", value: "team-1" },
      ]),
    );
    expect(mocks.operations[1].inFilters).toEqual([
      { column: "id", value: ["profile-1"] },
    ]);
  });

  it("builds the lightweight public team profile", async () => {
    mocks.queueMatchedResponse(
      (operation) =>
        operation.table === "club_teams" &&
        operation.filters.some(
          (filter) => filter.column === "id" && filter.value === "team-1",
        ),
      {
        data: {
          category: "Under 17",
          city: "Como",
          club_id: "club-1",
          id: "team-1",
          inherited: false,
          logo_url: null,
          name: "Under 17 Elite",
          parent_team_id: null,
          region: "Lombardia",
          sort_order: 2,
          team_type: "youth",
        },
        error: null,
      },
    );
    mocks.queueMatchedResponse(
      (operation) =>
        operation.table === "clubs" &&
        operation.filters.some(
          (filter) => filter.column === "id" && filter.value === "club-1",
        ),
      {
        data: {
          category: "Serie D",
          city: "Como",
          club_colors: null,
          club_email: null,
          club_phone: null,
          country: "IT",
          description: null,
          field_address: null,
          founding_year: null,
          gallery_urls: [],
          headquarters_address: null,
          id: "club-1",
          key_results: [],
          league: null,
          logo_url: null,
          name: "AC Como",
          owner_profile_id: "owner-1",
          region: "Lombardia",
          sports_focus: null,
          stadium: null,
          top_level_reached: null,
          verification_status: "verified",
          website_url: null,
        },
        error: null,
      },
    );
    mocks.queueMatchedResponse(
      (operation) =>
        operation.table === "profiles" &&
        operation.filters.some(
          (filter) => filter.column === "id" && filter.value === "owner-1",
        ),
      { data: { full_name: "Owner Name" }, error: null },
    );
    mocks.queueMatchedResponse(
      (operation) => operation.table === "club_team_profiles",
      {
        data: {
          competition_name: "Campionato Under 17 Elite",
          group_name: "Girone A",
          media_urls: ["https://cdn.test/team.jpg"],
          promoted_players_count: 3,
          recent_results: ["Titolo provinciale"],
          team_id: "team-1",
        },
        error: null,
      },
    );
    mocks.queueMatchedResponse(
      (operation) => operation.table === "club_members",
      {
        data: [
          {
            id: "member-1",
            manual_name: null,
            member_role: "player",
            profile_id: "profile-1",
            staff_title: null,
            team_id: "team-1",
          },
        ],
        error: null,
      },
    );
    mocks.queueMatchedResponse(
      (operation) =>
        operation.table === "profiles" && operation.inFilters.length > 0,
      {
        data: [
          {
            avatar_url: null,
            full_name: "Luca Bianchi",
            id: "profile-1",
          },
        ],
        error: null,
      },
    );
    mocks.queueMatchedResponse(
      (operation) => operation.table === "recruiting_ads",
      {
        count: 1,
        data: [
          {
            category: "Under 17",
            created_at: "2026-05-01T08:00:00Z",
            description: null,
            id: "ad-1",
            published_at: "2026-05-02T08:00:00Z",
            region: "Lombardia",
            role_required: "goalkeeper",
            team_id: "team-1",
            title: "Portiere",
          },
        ],
        error: null,
      },
    );
    mocks.queueMatchedResponse(
      (operation) =>
        operation.table === "club_teams" && operation.inFilters.length > 0,
      {
        data: [
          {
            category: "Under 17",
            id: "team-1",
            name: "Under 17 Elite",
          },
        ],
        error: null,
      },
    );

    const profile = await fetchPublicClubTeamProfile("team-1");

    expect(profile).toEqual(
      expect.objectContaining({
        positionsTotal: 1,
        team: expect.objectContaining({
          category: "Under 17",
          name: "Under 17 Elite",
        }),
      }),
    );
    expect(profile?.club).toEqual(
      expect.objectContaining({
        id: "club-1",
        name: "AC Como",
      }),
    );
    expect(profile?.profile).toEqual(
      expect.objectContaining({
        competition_name: "Campionato Under 17 Elite",
        promoted_players_count: 3,
      }),
    );
    expect(profile?.members[0]).toEqual(
      expect.objectContaining({ full_name: "Luca Bianchi" }),
    );
    expect(profile?.positionPreview[0]).toEqual(
      expect.objectContaining({
        role_required: "goalkeeper",
        team_name: "Under 17 Elite",
      }),
    );
  });

  it("updates club sport profile fields owned by the current profile", async () => {
    mocks.queueResponses({ error: null });

    await updateClubSportProfile({
      clubId: "club-1",
      keyResults: ["Serie C 2022/23"],
      ownerProfileId: "owner-1",
      sportsFocus: "Valorizzazione giovani",
      topLevelReached: "Serie C",
    });

    expect(mocks.operations[0]).toEqual(
      expect.objectContaining({
        action: "update",
        filters: [
          { column: "id", value: "club-1" },
          { column: "owner_profile_id", value: "owner-1" },
        ],
        payload: {
          key_results: ["Serie C 2022/23"],
          sports_focus: "Valorizzazione giovani",
          top_level_reached: "Serie C",
        },
        table: "clubs",
      }),
    );
  });

  it("replaces club affiliations with ordered relationship labels", async () => {
    mocks.queueResponses({ error: null }, { error: null });

    await saveClubAffiliations("club-1", [
      {
        affiliateClubId: "club-affiliate",
        relationshipLabel: "Academy ufficiale",
        sortOrder: 0,
      },
    ]);

    expect(mocks.operations[0]).toEqual(
      expect.objectContaining({
        action: "delete",
        filters: [{ column: "club_id", value: "club-1" }],
        table: "club_affiliations",
      }),
    );
    expect(mocks.operations[1]).toEqual(
      expect.objectContaining({
        action: "insert",
        payload: [
          {
            affiliate_club_id: "club-affiliate",
            club_id: "club-1",
            relationship_label: "Academy ufficiale",
            sort_order: 0,
          },
        ],
        table: "club_affiliations",
      }),
    );
  });

  it("searches existing clubs for affiliation management", async () => {
    await expect(searchClubsForAffiliation("a", "club-1")).resolves.toEqual([]);
    expect(mocks.operations).toHaveLength(0);

    mocks.queueResponses({
      data: [
        {
          category: "Scuola calcio",
          city: "Cantù",
          id: "club-affiliate",
          logo_url: null,
          name: "Como Academy Cantù",
          region: "Lombardia",
        },
      ],
      error: null,
    });

    const results = await searchClubsForAffiliation("Como", "club-1", 5);

    expect(results).toEqual([
      expect.objectContaining({
        id: "club-affiliate",
        name: "Como Academy Cantù",
        relationship_label: null,
      }),
    ]);
    expect(mocks.operations[0].ilikeFilters).toEqual([
      { column: "name", value: "%Como%" },
    ]);
    expect(mocks.operations[0].neqFilters).toEqual([
      { column: "id", value: "club-1" },
    ]);
    expect(mocks.operations[0].limitValue).toBe(5);
  });

  it("reads whether the current profile follows the club", async () => {
    mocks.queueResponses({
      data: { profile_id: "profile-1" },
      error: null,
    });

    await expect(fetchClubFollowState("profile-1", "club-1")).resolves.toBe(
      true,
    );
    expect(mocks.operations[0].filters).toEqual([
      { column: "profile_id", value: "profile-1" },
      { column: "club_id", value: "club-1" },
    ]);
  });

  it("upserts and deletes club follows", async () => {
    mocks.queueResponses({ error: null }, { error: null });

    await followClub("profile-1", "club-1");
    await unfollowClub("profile-1", "club-1");

    expect(mocks.operations[0]).toEqual(
      expect.objectContaining({
        action: "upsert",
        options: { ignoreDuplicates: true, onConflict: "profile_id,club_id" },
        payload: { club_id: "club-1", profile_id: "profile-1" },
        table: "club_follows",
      }),
    );
    expect(mocks.operations[1]).toEqual(
      expect.objectContaining({
        action: "delete",
        filters: [
          { column: "profile_id", value: "profile-1" },
          { column: "club_id", value: "club-1" },
        ],
        table: "club_follows",
      }),
    );
  });
});
