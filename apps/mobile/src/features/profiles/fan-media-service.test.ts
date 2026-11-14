import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFanMediaPost,
  fetchFanMediaFeed,
  fetchProfileFollowState,
  followProfile,
  unfollowProfile,
} from "./fan-media-service";

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
    range?: { from: number; to: number };
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
      // REV-PROF-19: la bacheca è paginata, non arriva tutta in una risposta.
      range: vi.fn((from: number, to: number) => {
        operation.range = { from, to };
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

// HOM-07: i Mi piace passano da `set_content_like` per identità, non dalle tabelle.
const interactionMocks = vi.hoisted(() => ({
  loadInteractionIdentity: vi.fn(),
  setContentLike: vi.fn(),
}));

vi.mock("../interactions/interaction-service", () => interactionMocks);

// HOM-08: il conteggio commenti arriva da `fetch_comment_counts`, non dalle tabelle.
const countMocks = vi.hoisted(() => ({ fetchCommentCounts: vi.fn() }));

vi.mock("../feed/comment-counts-service", () => ({
  fetchCommentCounts: countMocks.fetchCommentCounts,
}));

const basePost = {
  created_at: "2026-05-14T08:00:00Z",
  description: "Una domenica piena di calcio.",
  id: "post-1",
  profile_id: "fan-1",
  published_at: "2026-05-14T08:00:00Z",
  status: "published",
  tag: "Partita",
  thumbnail_url: null,
  updated_at: "2026-05-14T08:00:00Z",
  visual_type: "image",
  visual_url: "https://cdn.test/spalti.jpg",
};

describe("fan-media-service", () => {
  beforeEach(() => {
    mocks.reset();
    mocks.fromMock.mockClear();
    countMocks.fetchCommentCounts.mockReset();
    countMocks.fetchCommentCounts.mockResolvedValue(new Map());
  });

  it("loads a fan feed with social counts and viewer state", async () => {
    countMocks.fetchCommentCounts.mockResolvedValue(new Map([["post-1", 1]]));
    mocks.queueResponses(
      {
        data: [
          basePost,
          {
            ...basePost,
            id: "post-2",
            tag: null,
            visual_type: "video",
            visual_url: "https://cdn.test/highlight.mp4",
          },
        ],
        error: null,
      },
      { data: [{ post_id: "post-1" }, { post_id: "post-1" }], error: null },
      { data: [{ post_id: "post-2" }], error: null },
      { data: [{ post_id: "post-1" }], error: null },
      { data: [{ post_id: "post-2" }], error: null },
    );

    const feed = await fetchFanMediaFeed("fan-1", "viewer-1");

    expect(feed.map((post) => post.id)).toEqual(["post-1", "post-2"]);
    // HOM-08: nessun commento letto da questo servizio (dominio unico).
    expect(feed[0]).not.toHaveProperty("comments");
    expect(mocks.operations.map((operation) => operation.table)).not.toContain(
      "fan_media_comments",
    );
    expect(countMocks.fetchCommentCounts).toHaveBeenCalledWith("fan_media", ["post-1", "post-2"]);
    expect(feed[1].comment_count).toBe(0);
    expect(feed[0]).toMatchObject({
      comment_count: 1,
      is_liked: true,
      is_saved: false,
      like_count: 2,
      saved_count: 0,
      tag: "Partita",
    });
    expect(feed[1]).toMatchObject({
      is_liked: false,
      is_saved: true,
      saved_count: 1,
      tag: null,
      visual_type: "video",
    });
    expect(mocks.operations[0]).toMatchObject({
      action: "select",
      table: "fan_media_posts",
    });
    expect(mocks.operations[0].orders[0]).toEqual({
      column: "published_at",
      options: { ascending: false, nullsFirst: false },
    });
  });

  it("rejects pure text posts and posts without short text", async () => {
    await expect(
      createFanMediaPost({
        description: "Solo testo",
        profileId: "fan-1",
        visualType: "image",
        visualUrl: "",
      }),
    ).rejects.toThrow("foto o un video");

    await expect(
      createFanMediaPost({
        description: "   ",
        profileId: "fan-1",
        visualType: "image",
        visualUrl: "https://cdn.test/foto.jpg",
      }),
    ).rejects.toThrow("testo breve");

    expect(mocks.operations).toHaveLength(0);
  });

  it("creates a published image or video post with optional tag", async () => {
    mocks.queueResponses(
      {
        data: {
          ...basePost,
          description: "Grande prova dei ragazzi.",
          id: "post-new",
          tag: "Giovani",
          thumbnail_url: "https://cdn.test/thumb.jpg",
          visual_type: "video",
          visual_url: "https://cdn.test/highlight.mp4",
        },
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    );

    const post = await createFanMediaPost({
      description: "  Grande prova dei ragazzi.  ",
      profileId: "fan-1",
      tag: "Giovani",
      thumbnailUrl: "https://cdn.test/thumb.jpg",
      visualType: "video",
      visualUrl: "https://cdn.test/highlight.mp4",
    });

    expect(post.id).toBe("post-new");
    expect(post.tag).toBe("Giovani");
    expect(mocks.operations[0]).toMatchObject({
      action: "select",
      payload: {
        description: "Grande prova dei ragazzi.",
        profile_id: "fan-1",
        status: "published",
        tag: "Giovani",
        thumbnail_url: "https://cdn.test/thumb.jpg",
        visual_type: "video",
        visual_url: "https://cdn.test/highlight.mp4",
      },
      table: "fan_media_posts",
    });
  });

  it("reads and updates asymmetric profile follows", async () => {
    mocks.queueResponses(
      { data: { follower_profile_id: "viewer-1" }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );

    await expect(fetchProfileFollowState("viewer-1", "fan-1")).resolves.toBe(true);
    await followProfile("viewer-1", "fan-1");
    await unfollowProfile("viewer-1", "fan-1");

    expect(mocks.operations[0]).toMatchObject({
      action: "select",
      table: "profile_follows",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "upsert",
      payload: {
        followed_profile_id: "fan-1",
        follower_profile_id: "viewer-1",
      },
      table: "profile_follows",
    });
    expect(mocks.operations[2]).toMatchObject({
      action: "delete",
      filters: [
        { column: "follower_profile_id", value: "viewer-1" },
        { column: "followed_profile_id", value: "fan-1" },
      ],
      table: "profile_follows",
    });
  });
});
