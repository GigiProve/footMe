import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addClubMediaComment,
  createClubMediaPost,
  fetchClubMediaFeed,
  toggleClubMediaLike,
  toggleSavedClubMedia,
} from "./club-media-service";

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
  attachment_label: null,
  body: "Corpo contenuto",
  club_id: "club-1",
  created_at: "2026-05-14T08:00:00Z",
  created_by_profile_id: "owner-1",
  event_date: null,
  excerpt: "Anteprima",
  external_url: null,
  interviewee_name: null,
  player_birth_year: null,
  player_name: null,
  player_previous_club: null,
  player_role: null,
  published_at: "2026-05-14T08:00:00Z",
  status: "published",
  thumbnail_url: null,
  updated_at: "2026-05-14T08:00:00Z",
  video_duration_seconds: null,
  visual_type: null,
  visual_url: null,
};

describe("club-media-service", () => {
  beforeEach(() => {
    mocks.reset();
    mocks.fromMock.mockClear();
  });

  it("fetches feed items with social state, counts and tagged profiles", async () => {
    mocks.queueResponses(
      {
        data: [
          {
            ...basePost,
            id: "post-new",
            kind: "market",
            player_birth_year: 2006,
            player_name: "Marco Rossi",
            player_role: "Attaccante",
            title: "Marco Rossi e' un nuovo giocatore",
          },
          {
            ...basePost,
            id: "post-old",
            kind: "highlights",
            title: "AC Como 2-1 Lecco",
            visual_type: "video",
            visual_url: "https://cdn.test/highlight.mp4",
          },
        ],
        error: null,
      },
      { data: [{ post_id: "post-new" }, { post_id: "post-new" }], error: null },
      { data: [{ post_id: "post-new" }], error: null },
      { data: [{ post_id: "post-new" }], error: null },
      { data: [{ post_id: "post-old" }], error: null },
      {
        data: [{ post_id: "post-new", profile_id: "player-1" }],
        error: null,
      },
      {
        data: [
          {
            avatar_url: "https://cdn.test/avatar.jpg",
            full_name: "Marco Rossi",
            id: "player-1",
            role: "player",
          },
        ],
        error: null,
      },
    );

    const feed = await fetchClubMediaFeed("club-1", "viewer-1");

    expect(feed.map((post) => post.id)).toEqual(["post-new", "post-old"]);
    expect(feed[0]).toMatchObject({
      comment_count: 1,
      is_liked: true,
      is_saved: false,
      kind: "market",
      like_count: 2,
      saved_count: 0,
    });
    expect(feed[0].tagged_profiles).toEqual([
      {
        avatar_url: "https://cdn.test/avatar.jpg",
        display_name: "Marco Rossi",
        profile_id: "player-1",
        role: "player",
      },
    ]);
    expect(feed[1]).toMatchObject({ is_saved: true, saved_count: 1 });
    expect(mocks.operations[0].orders[0]).toEqual({
      column: "published_at",
      options: { ascending: false, nullsFirst: false },
    });
  });

  it("validates required create fields by content type", async () => {
    await expect(
      createClubMediaPost({
        clubId: "club-1",
        createdByProfileId: "owner-1",
        kind: "market",
        playerBirthYear: "2006",
        playerName: "Marco Rossi",
        playerRole: "Attaccante",
        title: "Nuovo acquisto",
        visualType: "image",
        visualUrl: "https://cdn.test/signing.jpg",
      }),
    ).rejects.toThrow("testo ufficiale");

    expect(mocks.operations).toHaveLength(0);
  });

  it("creates a post and stores tagged profiles", async () => {
    mocks.queueResponses(
      {
        data: {
          ...basePost,
          id: "post-1",
          kind: "market",
          player_birth_year: 2006,
          player_name: "Marco Rossi",
          player_role: "Attaccante",
          title: "Nuovo acquisto",
          visual_type: "image",
          visual_url: "https://cdn.test/signing.jpg",
        },
        error: null,
      },
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [{ post_id: "post-1", profile_id: "player-1" }],
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          {
            avatar_url: null,
            full_name: "Marco Rossi",
            id: "player-1",
            role: "player",
          },
        ],
        error: null,
      },
    );

    const post = await createClubMediaPost({
      body: "Benvenuto Marco.",
      clubId: "club-1",
      createdByProfileId: "owner-1",
      kind: "market",
      playerBirthYear: "2006",
      playerName: "Marco Rossi",
      playerRole: "Attaccante",
      taggedProfileIds: ["player-1"],
      title: "Nuovo acquisto",
      visualType: "image",
      visualUrl: "https://cdn.test/signing.jpg",
    });

    expect(post.id).toBe("post-1");
    expect(mocks.operations[0]).toMatchObject({
      action: "select",
      table: "club_media_posts",
    });
    expect(mocks.operations[0].payload).toMatchObject({
      body: "Benvenuto Marco.",
      club_id: "club-1",
      created_by_profile_id: "owner-1",
      kind: "market",
      player_birth_year: 2006,
      status: "published",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "insert",
      payload: [{ post_id: "post-1", profile_id: "player-1" }],
      table: "club_media_tagged_profiles",
    });
  });

  it("toggles likes and saved posts with profile scoped writes", async () => {
    mocks.queueResponses(
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );

    await toggleClubMediaLike("viewer-1", "post-1", true);
    await toggleClubMediaLike("viewer-1", "post-1", false);
    await toggleSavedClubMedia("viewer-1", "post-1", true);
    await toggleSavedClubMedia("viewer-1", "post-1", false);

    expect(mocks.operations[0]).toMatchObject({
      action: "upsert",
      payload: { post_id: "post-1", profile_id: "viewer-1" },
      table: "club_media_likes",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "delete",
      table: "club_media_likes",
    });
    expect(mocks.operations[2]).toMatchObject({
      action: "upsert",
      table: "saved_club_media",
    });
    expect(mocks.operations[3]).toMatchObject({
      action: "delete",
      table: "saved_club_media",
    });
  });

  it("adds a comment for the current profile", async () => {
    mocks.queueResponses(
      {
        data: {
          body: "Forza Como!",
          created_at: "2026-05-14T09:00:00Z",
          id: "comment-1",
          post_id: "post-1",
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
            role: "fan",
          },
        ],
        error: null,
      },
    );

    const comment = await addClubMediaComment({
      body: "  Forza Como!  ",
      postId: "post-1",
      profileId: "viewer-1",
    });

    expect(comment).toMatchObject({
      author_name: "Luigi",
      body: "Forza Como!",
      id: "comment-1",
    });
    expect(mocks.operations[0]).toMatchObject({
      action: "select",
      payload: {
        body: "Forza Como!",
        post_id: "post-1",
        profile_id: "viewer-1",
      },
      table: "club_media_comments",
    });
  });
});
