import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addFanTribunaComment,
  createFanTribunaFormation,
  createFanTribunaPoll,
  createFanTribunaProposal,
  fetchFanTribunaFeed,
  toggleFanTribunaSupport,
  toggleSavedFanTribuna,
  voteFanTribunaPoll,
} from "./fan-tribuna-service";

const mocks = vi.hoisted(() => {
  type Filter = {
    column: string;
    value: unknown;
  };

  type Operation = {
    action: string | null;
    filters: Filter[];
    inFilters: Filter[];
    orders: { column: string; options: unknown }[];
    options: unknown;
    payload: unknown;
    selectArgs: unknown[];
    table: string;
  };

  const operations: Operation[] = [];
  const responses: unknown[] = [];

  function nextResponse() {
    return responses.shift() ?? { data: null, error: null };
  }

  function createBuilder(table: string) {
    const operation: Operation = {
      action: null,
      filters: [],
      inFilters: [],
      orders: [],
      options: null,
      payload: null,
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
      insert: vi.fn((payload: unknown) => {
        operation.action = "insert";
        operation.payload = payload;
        return builder;
      }),
      maybeSingle: vi.fn(async () => nextResponse()),
      order: vi.fn((column: string, options: unknown) => {
        operation.orders.push({ column, options });
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
      ) => Promise.resolve(nextResponse()).then(resolve, reject),
      upsert: vi.fn((payload: unknown, options: unknown) => {
        operation.action = "upsert";
        operation.payload = payload;
        operation.options = options;
        return builder;
      }),
    };

    return builder;
  }

  return {
    fromMock: vi.fn((table: string) => createBuilder(table)),
    operations,
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

const basePost = {
  body: null,
  created_at: "2026-05-15T08:00:00Z",
  formation: null,
  id: "poll-1",
  kind: "poll",
  profile_id: "fan-1",
  published_at: "2026-05-15T08:00:00Z",
  reference_category: null,
  reference_club_id: null,
  reference_team_name: null,
  status: "published",
  title: "Confermeresti l'allenatore?",
  updated_at: "2026-05-15T08:00:00Z",
};

describe("fan-tribuna-service", () => {
  beforeEach(() => {
    mocks.reset();
    mocks.fromMock.mockClear();
  });

  it("loads poll, proposal and formation cards with viewer state and enrichment", async () => {
    mocks.queueResponses(
      {
        data: [
          basePost,
          {
            ...basePost,
            body: "Porterei due 2007 stabilmente in gruppo.",
            id: "proposal-1",
            kind: "proposal",
            reference_category: "Under 19",
            reference_team_name: "AC Como",
            title: "Due Under 19 in prima squadra",
          },
          {
            ...basePost,
            body: "Pressing alto e ampiezza.",
            formation: "4-3-3",
            id: "formation-1",
            kind: "formation",
            reference_team_name: "AC Como",
            title: "Il mio 4-3-3",
          },
        ],
        error: null,
      },
      { data: [{ post_id: "proposal-1" }, { post_id: "formation-1" }], error: null },
      { data: [{ post_id: "proposal-1" }], error: null },
      { data: [{ post_id: "poll-1" }, { post_id: "proposal-1" }], error: null },
      { data: [{ post_id: "proposal-1" }], error: null },
      { data: [{ post_id: "proposal-1" }], error: null },
      {
        data: [
          { id: "option-yes", label: "Si", post_id: "poll-1", sort_order: 0 },
          { id: "option-no", label: "No", post_id: "poll-1", sort_order: 1 },
        ],
        error: null,
      },
      {
        data: [
          { option_id: "option-yes", post_id: "poll-1", profile_id: "viewer-1" },
          { option_id: "option-yes", post_id: "poll-1", profile_id: "viewer-2" },
          { option_id: "option-no", post_id: "poll-1", profile_id: "viewer-3" },
        ],
        error: null,
      },
      {
        data: [
          {
            body: "Bella idea.",
            created_at: "2026-05-15T09:00:00Z",
            id: "comment-1",
            post_id: "proposal-1",
            profile_id: "viewer-1",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            avatar_url: "https://cdn.test/player.jpg",
            display_name: "Marco Verdi",
            player_profile_id: "player-1",
            post_id: "proposal-1",
            sort_order: 0,
          },
        ],
        error: null,
      },
      {
        data: [
          {
            avatar_url: "https://cdn.test/keeper.jpg",
            display_name: "Luca Neri",
            player_profile_id: "player-2",
            post_id: "formation-1",
            slot_key: "goalkeeper",
            sort_order: 0,
            x_percent: 50,
            y_percent: 88,
          },
        ],
        error: null,
      },
      {
        data: [
          {
            avatar_url: "https://cdn.test/viewer.jpg",
            full_name: "Sara",
            id: "viewer-1",
          },
        ],
        error: null,
      },
    );

    const feed = await fetchFanTribunaFeed("fan-1", "viewer-1");

    expect(feed).toHaveLength(3);
    expect(feed[0].poll_options).toMatchObject([
      { id: "option-yes", is_voted: true, percentage: 67, vote_count: 2 },
      { id: "option-no", is_voted: false, percentage: 33, vote_count: 1 },
    ]);
    expect(feed[0].total_vote_count).toBe(3);
    expect(feed[1]).toMatchObject({
      comment_count: 1,
      is_saved: true,
      is_supported: true,
      support_count: 1,
      tagged_players: [
        {
          display_name: "Marco Verdi",
          player_profile_id: "player-1",
        },
      ],
    });
    expect(feed[1].comments[0]).toMatchObject({
      author_name: "Sara",
      body: "Bella idea.",
    });
    expect(feed[2]).toMatchObject({
      formation: "4-3-3",
      lineup_players: [
        {
          display_name: "Luca Neri",
          slot_key: "goalkeeper",
        },
      ],
    });
  });

  it("creates polls with two to six options and rejects incomplete drafts", async () => {
    await expect(
      createFanTribunaPoll({
        options: ["Si"],
        profileId: "fan-1",
        question: "Confermeresti l'allenatore?",
      }),
    ).rejects.toThrow("almeno due opzioni");

    mocks.queueResponses(
      { data: basePost, error: null },
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          { id: "option-yes", label: "Si", post_id: "poll-1", sort_order: 0 },
          { id: "option-no", label: "No", post_id: "poll-1", sort_order: 1 },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    );

    const post = await createFanTribunaPoll({
      options: [" Si ", " No "],
      profileId: "fan-1",
      question: " Confermeresti l'allenatore? ",
    });

    expect(post.kind).toBe("poll");
    expect(mocks.operations[0]).toMatchObject({
      action: "select",
      payload: {
        body: null,
        formation: null,
        kind: "poll",
        profile_id: "fan-1",
        status: "published",
        title: "Confermeresti l'allenatore?",
      },
      table: "fan_tribuna_posts",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "insert",
      payload: [
        { label: "Si", post_id: "poll-1", sort_order: 0 },
        { label: "No", post_id: "poll-1", sort_order: 1 },
      ],
      table: "fan_tribuna_poll_options",
    });
  });

  it("creates proposal and formation posts with clickable player references", async () => {
    mocks.queueResponses(
      {
        data: {
          ...basePost,
          body: "Serve fisicita' negli ultimi metri.",
          id: "proposal-1",
          kind: "proposal",
          reference_category: "Under 19",
          reference_team_name: "AC Como",
          title: "Serve un attaccante fisico",
        },
        error: null,
      },
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          {
            avatar_url: null,
            display_name: "Marco Verdi",
            player_profile_id: "player-1",
            post_id: "proposal-1",
            sort_order: 0,
          },
        ],
        error: null,
      },
      { data: [], error: null },
    );

    const proposal = await createFanTribunaProposal({
      body: " Serve fisicita' negli ultimi metri. ",
      profileId: "fan-1",
      referenceCategory: "Under 19",
      referenceTeamName: "AC Como",
      taggedPlayers: [
        {
          avatar_url: null,
          display_name: "Marco Verdi",
          player_profile_id: "player-1",
          sort_order: 0,
        },
      ],
      title: " Serve un attaccante fisico ",
    });

    expect(proposal.kind).toBe("proposal");
    expect(proposal.tagged_players[0].player_profile_id).toBe("player-1");
    expect(mocks.operations[1]).toMatchObject({
      action: "insert",
      table: "fan_tribuna_tagged_players",
    });

    mocks.reset();
    mocks.queueResponses(
      {
        data: {
          ...basePost,
          body: "Ampiezza e pressing.",
          formation: "4-3-3",
          id: "formation-1",
          kind: "formation",
          reference_team_name: "AC Como",
          title: "La mia formazione 4-3-3",
        },
        error: null,
      },
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          {
            avatar_url: null,
            display_name: "Luca Neri",
            player_profile_id: "player-2",
            post_id: "formation-1",
            slot_key: "goalkeeper",
            sort_order: 0,
            x_percent: 50,
            y_percent: 88,
          },
        ],
        error: null,
      },
    );

    const formation = await createFanTribunaFormation({
      body: "Ampiezza e pressing.",
      formation: "4-3-3",
      lineupPlayers: [
        {
          avatar_url: null,
          display_name: "Luca Neri",
          player_profile_id: "player-2",
          slot_key: "goalkeeper",
          sort_order: 0,
          x_percent: 50,
          y_percent: 88,
        },
      ],
      profileId: "fan-1",
      referenceTeamName: "AC Como",
      title: "La mia formazione 4-3-3",
    });

    expect(formation.lineup_players).toHaveLength(1);
    expect(mocks.operations[1]).toMatchObject({
      action: "insert",
      table: "fan_tribuna_lineup_players",
    });
  });

  it("votes, saves, supports and comments with viewer-scoped writes", async () => {
    mocks.queueResponses(
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      {
        data: {
          body: "Sono d'accordo.",
          created_at: "2026-05-15T10:00:00Z",
          id: "comment-1",
          post_id: "proposal-1",
          profile_id: "viewer-1",
        },
        error: null,
      },
      {
        data: [
          {
            avatar_url: null,
            full_name: "Luigi",
            id: "viewer-1",
          },
        ],
        error: null,
      },
    );

    await voteFanTribunaPoll({
      optionId: "option-yes",
      postId: "poll-1",
      profileId: "viewer-1",
    });
    await toggleFanTribunaSupport("viewer-1", "proposal-1", true);
    await toggleSavedFanTribuna("viewer-1", "proposal-1", true);
    await toggleSavedFanTribuna("viewer-1", "proposal-1", false);
    const comment = await addFanTribunaComment({
      body: "  Sono d'accordo. ",
      postId: "proposal-1",
      profileId: "viewer-1",
    });

    expect(mocks.operations[0]).toMatchObject({
      action: "upsert",
      payload: {
        option_id: "option-yes",
        post_id: "poll-1",
        profile_id: "viewer-1",
      },
      table: "fan_tribuna_poll_votes",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "upsert",
      table: "fan_tribuna_support_votes",
    });
    expect(mocks.operations[2]).toMatchObject({
      action: "upsert",
      table: "saved_fan_tribuna",
    });
    expect(mocks.operations[3]).toMatchObject({
      action: "delete",
      table: "saved_fan_tribuna",
    });
    expect(comment).toMatchObject({
      author_name: "Luigi",
      body: "Sono d'accordo.",
    });
  });
});
