import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addFanMediaComment,
  createFanMediaPost,
  fetchFanMediaFeed,
  fetchProfileFollowState,
  followProfile,
  toggleFanMediaLike,
  toggleSavedFanMedia,
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
  });

  it("loads a fan feed with social counts, viewer state and comments", async () => {
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
      { data: [{ post_id: "post-1" }], error: null },
      { data: [{ post_id: "post-2" }], error: null },
      { data: [{ post_id: "post-1" }], error: null },
      { data: [{ post_id: "post-2" }], error: null },
      {
        data: [
          {
            body: "Che atmosfera.",
            created_at: "2026-05-14T09:00:00Z",
            id: "comment-1",
            post_id: "post-1",
            profile_id: "viewer-1",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            avatar_url: "https://cdn.test/viewer.jpg",
            full_name: "Luigi",
            id: "viewer-1",
          },
        ],
        error: null,
      },
    );

    const feed = await fetchFanMediaFeed("fan-1", "viewer-1");

    expect(feed.map((post) => post.id)).toEqual(["post-1", "post-2"]);
    expect(feed[0]).toMatchObject({
      comment_count: 1,
      comments: [
        {
          author_avatar_url: "https://cdn.test/viewer.jpg",
          author_name: "Luigi",
          body: "Che atmosfera.",
        },
      ],
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

  it("toggles likes and saves with profile scoped writes", async () => {
    mocks.queueResponses(
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    );

    await toggleFanMediaLike("viewer-1", "post-1", true);
    await toggleFanMediaLike("viewer-1", "post-1", false);
    await toggleSavedFanMedia("viewer-1", "post-1", true);
    await toggleSavedFanMedia("viewer-1", "post-1", false);

    expect(mocks.operations[0]).toMatchObject({
      action: "upsert",
      payload: { post_id: "post-1", profile_id: "viewer-1" },
      table: "fan_media_likes",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "delete",
      table: "fan_media_likes",
    });
    expect(mocks.operations[2]).toMatchObject({
      action: "upsert",
      table: "saved_fan_media",
    });
    expect(mocks.operations[3]).toMatchObject({
      action: "delete",
      table: "saved_fan_media",
    });
  });

  it("adds comments and resolves author metadata", async () => {
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
          },
        ],
        error: null,
      },
    );

    const comment = await addFanMediaComment({
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
      table: "fan_media_comments",
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
