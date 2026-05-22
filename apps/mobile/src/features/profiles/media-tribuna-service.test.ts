import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addMediaTribunaComment,
  createMediaArticleDebate,
  createMediaCommunityQa,
  createMediaPlayerVote,
  createMediaTribunaPoll,
  fetchMediaTribunaFeed,
  submitMediaTribunaQuestion,
  toggleSavedMediaTribuna,
  voteMediaTribunaOption,
  voteMediaTribunaQuestion,
} from "./media-tribuna-service";

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
  created_at: "2026-05-19T08:00:00Z",
  created_by_profile_id: "media-1",
  id: "poll-1",
  kind: "editorial_poll",
  linked_article_id: null,
  media_profile_id: "media-1",
  published_at: "2026-05-19T08:00:00Z",
  status: "published",
  title: "Quale reparto deve rinforzare il Como?",
  updated_at: "2026-05-19T08:00:00Z",
};

describe("media-tribuna-service", () => {
  beforeEach(() => {
    mocks.reset();
    mocks.fromMock.mockClear();
  });

  it("loads editorial poll, article debate, player vote and Q&A with enrichment", async () => {
    mocks.queueResponses(
      {
        data: [
          basePost,
          {
            ...basePost,
            body: "Raccogliamo il parere della community dopo l'articolo.",
            id: "debate-1",
            kind: "article_debate",
            linked_article_id: "article-1",
            title: "Che tipo di profilo servirebbe davvero?",
          },
          {
            ...basePost,
            id: "player-vote-1",
            kind: "player_vote",
            title: "Migliore in campo - Como U19 vs Lecco U19",
          },
          {
            ...basePost,
            body: "Le domande piu votate saranno usate nella prossima intervista.",
            id: "qa-1",
            kind: "community_qa",
            title: "Fai una domanda al DS del Como",
          },
        ],
        error: null,
      },
      { data: [{ post_id: "poll-1" }, { post_id: "qa-1" }], error: null },
      { data: [{ post_id: "poll-1" }], error: null },
      {
        data: [
          { id: "option-defense", label: "Difesa", player_profile_id: null, post_id: "poll-1", sort_order: 0 },
          { id: "option-attack", label: "Attacco", player_profile_id: null, post_id: "poll-1", sort_order: 1 },
          { id: "option-player-1", label: "Marco Verdi", player_profile_id: "player-1", post_id: "player-vote-1", sort_order: 0 },
          { id: "option-player-2", label: "Luca Neri", player_profile_id: "player-2", post_id: "player-vote-1", sort_order: 1 },
        ],
        error: null,
      },
      {
        data: [
          { option_id: "option-attack", post_id: "poll-1", profile_id: "viewer-1" },
          { option_id: "option-attack", post_id: "poll-1", profile_id: "viewer-2" },
          { option_id: "option-defense", post_id: "poll-1", profile_id: "viewer-3" },
          { option_id: "option-player-1", post_id: "player-vote-1", profile_id: "viewer-1" },
        ],
        error: null,
      },
      {
        data: [
          {
            body: "Serve una punta fisica.",
            created_at: "2026-05-19T09:00:00Z",
            id: "comment-1",
            post_id: "poll-1",
            profile_id: "viewer-1",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            body: "Qual e' l'obiettivo della prossima stagione?",
            created_at: "2026-05-19T09:10:00Z",
            id: "question-1",
            post_id: "qa-1",
            profile_id: "viewer-2",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            category: "Mercato",
            cover_type: "image",
            cover_url: "https://cdn.test/article.jpg",
            excerpt: "Anteprima articolo",
            id: "article-1",
            subtitle: "Sottotitolo",
            title: "Como, occhi su un attaccante Under 19",
          },
        ],
        error: null,
      },
      {
        data: [
          { avatar_url: "https://cdn.test/player.jpg", full_name: "Marco Verdi", id: "player-1", role: "player" },
          { avatar_url: null, full_name: "Luca Neri", id: "player-2", role: "player" },
        ],
        error: null,
      },
      {
        data: [{ avatar_url: null, full_name: "Sara", id: "viewer-1", role: "player" }],
        error: null,
      },
      {
        data: [{ avatar_url: null, full_name: "Anna", id: "viewer-2", role: "player" }],
        error: null,
      },
      {
        data: [
          { profile_id: "viewer-1", question_id: "question-1" },
          { profile_id: "viewer-3", question_id: "question-1" },
        ],
        error: null,
      },
    );

    const feed = await fetchMediaTribunaFeed("media-1", "viewer-1");

    expect(feed).toHaveLength(4);
    expect(feed[0]).toMatchObject({
      comment_count: 1,
      is_saved: true,
      total_vote_count: 3,
    });
    expect(feed[0].options).toMatchObject([
      { id: "option-defense", percentage: 33, vote_count: 1 },
      { id: "option-attack", is_voted: true, percentage: 67, vote_count: 2 },
    ]);
    expect(feed[1].linked_article).toMatchObject({
      id: "article-1",
      title: "Como, occhi su un attaccante Under 19",
    });
    expect(feed[2].options[0]).toMatchObject({
      player_display_name: "Marco Verdi",
      player_profile_id: "player-1",
    });
    expect(feed[3].questions[0]).toMatchObject({
      author_name: "Anna",
      is_voted: true,
      vote_count: 2,
    });
  });

  it("creates all media Tribuna formats with policy-friendly payloads", async () => {
    await expect(
      createMediaTribunaPoll({
        createdByProfileId: "media-1",
        mediaProfileId: "media-1",
        options: ["Si"],
        question: "Confermeresti l'allenatore?",
      }),
    ).rejects.toThrow("almeno 2 opzioni");

    mocks.queueResponses(
      { data: basePost, error: null },
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          { id: "option-defense", label: "Difesa", player_profile_id: null, post_id: "poll-1", sort_order: 0 },
          { id: "option-attack", label: "Attacco", player_profile_id: null, post_id: "poll-1", sort_order: 1 },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    );

    const poll = await createMediaTribunaPoll({
      createdByProfileId: "media-1",
      mediaProfileId: "media-1",
      options: [" Difesa ", " Attacco "],
      question: " Quale reparto deve rinforzare il Como? ",
    });

    expect(poll.kind).toBe("editorial_poll");
    expect(mocks.operations[0]).toMatchObject({
      action: "select",
      payload: {
        body: null,
        created_by_profile_id: "media-1",
        kind: "editorial_poll",
        linked_article_id: null,
        media_profile_id: "media-1",
        status: "published",
        title: "Quale reparto deve rinforzare il Como?",
      },
      table: "media_tribuna_posts",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "insert",
      table: "media_tribuna_options",
    });

    mocks.reset();
    mocks.queueResponses(
      {
        data: {
          ...basePost,
          id: "debate-1",
          kind: "article_debate",
          linked_article_id: "article-1",
          title: "Che tipo di profilo servirebbe davvero?",
        },
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          {
            category: "Mercato",
            cover_type: null,
            cover_url: null,
            excerpt: null,
            id: "article-1",
            subtitle: null,
            title: "Como mercato U19",
          },
        ],
        error: null,
      },
    );

    await createMediaArticleDebate({
      articleId: "article-1",
      body: "Contesto",
      createdByProfileId: "media-1",
      mediaProfileId: "media-1",
      question: "Che tipo di profilo servirebbe davvero?",
    });
    expect(mocks.operations[0]).toMatchObject({
      payload: expect.objectContaining({
        kind: "article_debate",
        linked_article_id: "article-1",
      }),
      table: "media_tribuna_posts",
    });

    mocks.reset();
    mocks.queueResponses(
      {
        data: {
          ...basePost,
          id: "player-vote-1",
          kind: "player_vote",
          title: "Migliore in campo",
        },
        error: null,
      },
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          { id: "option-player-1", label: "Marco Verdi", player_profile_id: "player-1", post_id: "player-vote-1", sort_order: 0 },
          { id: "option-player-2", label: "Luca Neri", player_profile_id: "player-2", post_id: "player-vote-1", sort_order: 1 },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      {
        data: [
          { avatar_url: null, full_name: "Marco Verdi", id: "player-1", role: "player" },
          { avatar_url: null, full_name: "Luca Neri", id: "player-2", role: "player" },
        ],
        error: null,
      },
    );

    await createMediaPlayerVote({
      createdByProfileId: "media-1",
      mediaProfileId: "media-1",
      options: [
        { displayName: "Marco Verdi", playerProfileId: "player-1" },
        { displayName: "Luca Neri", playerProfileId: "player-2" },
      ],
      title: "Migliore in campo",
    });
    expect(mocks.operations[1].payload).toEqual([
      {
        label: "Marco Verdi",
        player_profile_id: "player-1",
        post_id: "player-vote-1",
        sort_order: 0,
      },
      {
        label: "Luca Neri",
        player_profile_id: "player-2",
        post_id: "player-vote-1",
        sort_order: 1,
      },
    ]);

    mocks.reset();
    mocks.queueResponses(
      {
        data: {
          ...basePost,
          id: "qa-1",
          kind: "community_qa",
          title: "Fai una domanda al DS del Como",
        },
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    );

    await createMediaCommunityQa({
      body: "Le domande piu votate saranno usate nella prossima intervista.",
      createdByProfileId: "media-1",
      mediaProfileId: "media-1",
      title: "Fai una domanda al DS del Como",
    });
    expect(mocks.operations[0]).toMatchObject({
      payload: expect.objectContaining({ kind: "community_qa" }),
      table: "media_tribuna_posts",
    });
  });

  it("votes, saves, comments and handles Q&A votes with viewer-scoped writes", async () => {
    mocks.queueResponses(
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      {
        data: {
          body: "Serve una punta fisica.",
          created_at: "2026-05-19T10:00:00Z",
          id: "comment-1",
          post_id: "poll-1",
          profile_id: "viewer-1",
        },
        error: null,
      },
      {
        data: [{ avatar_url: null, full_name: "Luigi", id: "viewer-1", role: "player" }],
        error: null,
      },
      {
        data: {
          body: "Qual e' l'obiettivo stagionale?",
          created_at: "2026-05-19T10:05:00Z",
          id: "question-1",
          post_id: "qa-1",
          profile_id: "viewer-1",
        },
        error: null,
      },
      {
        data: [{ avatar_url: null, full_name: "Luigi", id: "viewer-1", role: "player" }],
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null },
    );

    await voteMediaTribunaOption({
      optionId: "option-attack",
      postId: "poll-1",
      profileId: "viewer-1",
    });
    await toggleSavedMediaTribuna("viewer-1", "poll-1", true);
    await toggleSavedMediaTribuna("viewer-1", "poll-1", false);
    const comment = await addMediaTribunaComment({
      body: "  Serve una punta fisica. ",
      postId: "poll-1",
      profileId: "viewer-1",
    });
    const question = await submitMediaTribunaQuestion({
      body: " Qual e' l'obiettivo stagionale? ",
      postId: "qa-1",
      profileId: "viewer-1",
    });
    await voteMediaTribunaQuestion("question-1", "viewer-1", true);
    await voteMediaTribunaQuestion("question-1", "viewer-1", false);

    expect(mocks.operations[0]).toMatchObject({
      action: "upsert",
      payload: {
        option_id: "option-attack",
        post_id: "poll-1",
        profile_id: "viewer-1",
      },
      table: "media_tribuna_option_votes",
    });
    expect(mocks.operations[1]).toMatchObject({
      action: "upsert",
      table: "saved_media_tribuna",
    });
    expect(mocks.operations[2]).toMatchObject({
      action: "delete",
      table: "saved_media_tribuna",
    });
    expect(comment).toMatchObject({
      author_name: "Luigi",
      body: "Serve una punta fisica.",
    });
    expect(question).toMatchObject({
      author_name: "Luigi",
      body: "Qual e' l'obiettivo stagionale?",
    });
    expect(mocks.operations[7]).toMatchObject({
      action: "upsert",
      table: "media_tribuna_question_votes",
    });
    expect(mocks.operations[8]).toMatchObject({
      action: "delete",
      table: "media_tribuna_question_votes",
    });
  });
});
