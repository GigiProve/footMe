import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addMediaProfilePostComment,
  createMediaProfilePost,
  fetchMediaProfilePostFeed,
  toggleSavedMediaProfilePost,
} from "./media-profile-post-service";

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
      ilike: vi.fn((column: string, value: unknown) => {
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
      limit: vi.fn(() => builder),
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
  author_id: "author-1",
  author_name: "Marco Bianchi",
  body: "Testo articolo",
  category: "Mercato",
  cover_type: "image",
  cover_url: "https://cdn.test/cover.jpg",
  created_at: "2026-05-19T08:00:00Z",
  created_by_profile_id: "media-1",
  excerpt: "Anteprima articolo",
  external_url: null,
  kind: "article",
  media_profile_id: "media-1",
  published_at: "2026-05-19T08:00:00Z",
  status: "published",
  subtitle: "Sottotitolo",
  title: "Como, occhi su un attaccante Under 19",
  updated_at: "2026-05-19T08:00:00Z",
};

describe("media-profile-post-service", () => {
  beforeEach(() => {
    mocks.reset();
    mocks.fromMock.mockClear();
  });

  it("fetches published feed items with comments, saved state and tagged targets", async () => {
    mocks.queueResponses(
      {
        data: [
          { ...basePost, id: "post-1" },
          {
            ...basePost,
            body: "News breve",
            category: "Giovanili",
            id: "post-2",
            kind: "news",
            title: "Como U19, convocato un nuovo attaccante",
          },
        ],
        error: null,
      },
      { data: [{ post_id: "post-1" }, { post_id: "post-1" }], error: null },
      { data: [{ post_id: "post-1" }], error: null },
      {
        data: [
          { post_id: "post-1", target_id: "player-1", target_type: "profile" },
          { post_id: "post-1", target_id: "club-1", target_type: "club" },
        ],
        error: null,
      },
      {
        data: [
          {
            avatar_url: "https://cdn.test/player.jpg",
            city: "Como",
            full_name: "Luca Rossi",
            id: "player-1",
            region: "Lombardia",
            role: "player",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            category: "Under 19",
            city: "Como",
            id: "club-1",
            logo_url: "https://cdn.test/club.jpg",
            name: "AC Como",
            region: "Lombardia",
          },
        ],
        error: null,
      },
    );

    const feed = await fetchMediaProfilePostFeed("media-1", "viewer-1");

    expect(feed.map((post) => post.id)).toEqual(["post-1", "post-2"]);
    expect(feed[0]).toMatchObject({
      comment_count: 2,
      is_saved: true,
      kind: "article",
      reading_time_minutes: 1,
    });
    expect(feed[0].tagged_targets).toEqual([
      {
        avatar_url: "https://cdn.test/player.jpg",
        display_name: "Luca Rossi",
        role: "player",
        subtitle: "Calciatore - Como",
        target_id: "player-1",
        target_type: "profile",
      },
      {
        avatar_url: "https://cdn.test/club.jpg",
        display_name: "AC Como",
        role: "club",
        subtitle: "Under 19 - Como",
        target_id: "club-1",
        target_type: "club",
      },
    ]);
    expect(mocks.operations[0].orders[0]).toEqual({
      column: "published_at",
      options: { ascending: false, nullsFirst: false },
    });
  });

  it("validates article body and accepts short news without a body", async () => {
    await expect(
      createMediaProfilePost({
        authorName: "Marco Bianchi",
        category: "Mercato",
        createdByProfileId: "media-1",
        kind: "article",
        mediaProfileId: "media-1",
        title: "Titolo articolo",
      }),
    ).rejects.toThrow("testo dell'articolo");

    expect(mocks.operations).toHaveLength(0);

    mocks.queueResponses(
      {
        data: {
          ...basePost,
          body: null,
          excerpt: "Aggiornamento veloce",
          id: "news-1",
          kind: "news",
          title: "News breve",
        },
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    );

    const news = await createMediaProfilePost({
      authorName: "Luca Verdi",
      category: "Giovanili",
      createdByProfileId: "media-1",
      excerpt: "Aggiornamento veloce",
      kind: "news",
      mediaProfileId: "media-1",
      title: "News breve",
    });

    expect(news.kind).toBe("news");
    expect(mocks.operations[0].payload).toMatchObject({
      author_id: null,
      author_name: "Luca Verdi",
      body: null,
      category: "Giovanili",
      external_url: null,
      kind: "news",
    });
  });

  it("creates an article and stores tagged targets", async () => {
    mocks.queueResponses(
      {
        data: { ...basePost, id: "post-1" },
        error: null,
      },
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [{ post_id: "post-1", target_id: "club-1", target_type: "club" }],
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          {
            category: "Serie A",
            city: "Como",
            id: "club-1",
            logo_url: null,
            name: "AC Como",
            region: "Lombardia",
          },
        ],
        error: null,
      },
      { data: [], error: null },
    );

    const post = await createMediaProfilePost({
      authorId: "author-1",
      authorName: "Marco Bianchi",
      body: "Testo completo dell'articolo.",
      category: "Mercato",
      coverType: "image",
      coverUrl: "https://cdn.test/cover.jpg",
      createdByProfileId: "media-1",
      externalUrl: "gazzetta.example/articolo",
      kind: "article",
      mediaProfileId: "media-1",
      taggedTargets: [
        {
          avatar_url: null,
          display_name: "AC Como",
          role: "club",
          subtitle: null,
          target_id: "club-1",
          target_type: "club",
        },
      ],
      title: "Como, occhi su un attaccante Under 19",
    });

    expect(post.id).toBe("post-1");
    expect(mocks.operations[0]).toMatchObject({
      action: "select",
      table: "media_profile_posts",
    });
    expect(mocks.operations[0].payload).toMatchObject({
      author_id: "author-1",
      author_name: "Marco Bianchi",
      body: "Testo completo dell'articolo.",
      external_url: "https://gazzetta.example/articolo",
      kind: "article",
      media_profile_id: "media-1",
      status: "published",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "insert",
      payload: [
        { post_id: "post-1", target_id: "club-1", target_type: "club" },
      ],
      table: "media_profile_post_tagged_targets",
    });
  });

  it("toggles saved media profile posts with profile scoped writes", async () => {
    mocks.queueResponses(
      { data: null, error: null },
      { data: null, error: null },
    );

    await toggleSavedMediaProfilePost("viewer-1", "post-1", true);
    await toggleSavedMediaProfilePost("viewer-1", "post-1", false);

    expect(mocks.operations[0]).toMatchObject({
      action: "upsert",
      payload: { post_id: "post-1", profile_id: "viewer-1" },
      table: "saved_media_profile_posts",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "delete",
      table: "saved_media_profile_posts",
    });
  });

  it("adds a comment for the current profile", async () => {
    mocks.queueResponses(
      {
        data: {
          body: "Bell'articolo!",
          created_at: "2026-05-19T09:00:00Z",
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

    const comment = await addMediaProfilePostComment({
      body: "  Bell'articolo!  ",
      postId: "post-1",
      profileId: "viewer-1",
    });

    expect(comment).toMatchObject({
      author_name: "Luigi",
      body: "Bell'articolo!",
      id: "comment-1",
    });
    expect(mocks.operations[0]).toMatchObject({
      action: "select",
      payload: {
        body: "Bell'articolo!",
        post_id: "post-1",
        profile_id: "viewer-1",
      },
      table: "media_profile_post_comments",
    });
  });
});
