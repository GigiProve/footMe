import { describe, expect, it } from "vitest";

import type {
  MediaTribunaOption,
  MediaTribunaPost,
  MediaTribunaQuestion,
} from "../media-tribuna-service";
import {
  MEDIA_TRIBUNA_KINDS,
  buildVotedMediaTribunaState,
  formatMediaTribunaCounts,
  formatMediaTribunaLabel,
  hasVotedMediaTribuna,
  isMediaTribunaVotable,
  sortMediaTribunaPosts,
  sortMediaTribunaQuestions,
} from "./media-tribuna-model";

function buildOption(
  overrides: Partial<MediaTribunaOption> = {},
): MediaTribunaOption {
  return {
    id: "option-1",
    is_voted: false,
    label: "ASD Predappio",
    percentage: 0,
    player_avatar_url: null,
    player_display_name: null,
    player_profile_id: null,
    sort_order: 0,
    vote_count: 0,
    ...overrides,
  };
}

function buildPost(overrides: Partial<MediaTribunaPost> = {}): MediaTribunaPost {
  return {
    body: null,
    comment_count: 0,
    comments: [],
    created_at: "2026-06-19T08:00:00Z",
    created_by_profile_id: "media-1",
    id: "tribuna-1",
    is_saved: false,
    kind: "editorial_poll",
    linked_article: null,
    linked_article_id: null,
    media_profile_id: "media-1",
    options: [],
    published_at: "2026-06-19T08:00:00Z",
    question_count: 0,
    questions: [],
    status: "published",
    title: "Chi vincerà il campionato?",
    total_vote_count: 0,
    updated_at: "2026-06-19T08:00:00Z",
    ...overrides,
  };
}

function buildQuestion(
  overrides: Partial<MediaTribunaQuestion> = {},
): MediaTribunaQuestion {
  return {
    author_avatar_url: null,
    author_name: "Utente",
    body: "Una domanda",
    created_at: "2026-06-19T08:00:00Z",
    id: "question-1",
    is_voted: false,
    profile_id: "profile-1",
    vote_count: 0,
    ...overrides,
  };
}

describe("content type della Tribuna", () => {
  it("resta ai quattro tipi già approvati", () => {
    expect(MEDIA_TRIBUNA_KINDS).toEqual([
      "editorial_poll",
      "article_debate",
      "player_vote",
      "community_qa",
    ]);
  });

  it("etichetta ogni tipo con il suo nome pubblico", () => {
    expect(formatMediaTribunaLabel("editorial_poll")).toBe("Sondaggio");
    expect(formatMediaTribunaLabel("article_debate")).toBe("Dibattito");
    expect(formatMediaTribunaLabel("player_vote")).toBe("Vota il migliore");
    expect(formatMediaTribunaLabel("community_qa")).toBe("Q&A");
  });

  it("sa quali tipi si votano scegliendo un'opzione", () => {
    expect(isMediaTribunaVotable("editorial_poll")).toBe(true);
    expect(isMediaTribunaVotable("player_vote")).toBe(true);
    expect(isMediaTribunaVotable("article_debate")).toBe(false);
    expect(isMediaTribunaVotable("community_qa")).toBe(false);
  });
});

describe("ordinamento", () => {
  it("mette in cima la pubblicazione più recente, non l'aggiornamento", () => {
    const sorted = sortMediaTribunaPosts([
      buildPost({
        id: "vecchio",
        published_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-07-01T08:00:00Z",
      }),
      buildPost({ id: "nuovo", published_at: "2026-06-20T08:00:00Z" }),
    ]);

    expect(sorted.map((post) => post.id)).toEqual(["nuovo", "vecchio"]);
  });

  it("ordina le domande per voti e, a pari voti, dalla più vecchia", () => {
    const sorted = sortMediaTribunaQuestions([
      buildQuestion({ id: "b", created_at: "2026-06-02T08:00:00Z", vote_count: 3 }),
      buildQuestion({ id: "a", created_at: "2026-06-01T08:00:00Z", vote_count: 3 }),
      buildQuestion({ id: "c", vote_count: 10 }),
    ]);

    expect(sorted.map((question) => question.id)).toEqual(["c", "a", "b"]);
  });
});

describe("voto di un sondaggio", () => {
  it("il primo voto aggiunge un votante e ricalcola le percentuali", () => {
    const post = buildPost({
      options: [
        buildOption({ id: "a", vote_count: 1 }),
        buildOption({ id: "b", vote_count: 1 }),
      ],
      total_vote_count: 2,
    });

    const next = buildVotedMediaTribunaState(post, "a");

    expect(next.total_vote_count).toBe(3);
    expect(next.options.find((option) => option.id === "a")).toMatchObject({
      is_voted: true,
      percentage: 67,
      vote_count: 2,
    });
    expect(next.options.find((option) => option.id === "b")).toMatchObject({
      is_voted: false,
      percentage: 33,
      vote_count: 1,
    });
  });

  it("cambiare preferenza sposta il voto senza aggiungere un votante", () => {
    const post = buildPost({
      options: [
        buildOption({ id: "a", is_voted: true, vote_count: 2 }),
        buildOption({ id: "b", vote_count: 2 }),
      ],
      total_vote_count: 4,
    });

    const next = buildVotedMediaTribunaState(post, "b");

    expect(next.total_vote_count).toBe(4);
    expect(next.options.find((option) => option.id === "a")).toMatchObject({
      is_voted: false,
      vote_count: 1,
    });
    expect(next.options.find((option) => option.id === "b")).toMatchObject({
      is_voted: true,
      vote_count: 3,
    });
  });

  it("nessun conteggio scende sotto zero", () => {
    const post = buildPost({
      options: [buildOption({ id: "a", is_voted: true, vote_count: 0 })],
      total_vote_count: 0,
    });

    const next = buildVotedMediaTribunaState(post, "b");

    expect(next.options[0]?.vote_count).toBe(0);
    expect(next.options[0]?.percentage).toBeGreaterThanOrEqual(0);
  });

  it("riconosce un voto già espresso", () => {
    expect(
      hasVotedMediaTribuna(
        buildPost({ options: [buildOption({ is_voted: true })] }),
      ),
    ).toBe(true);
    expect(
      hasVotedMediaTribuna(buildPost({ options: [buildOption()] })),
    ).toBe(false);
  });
});

describe("riga dei conteggi", () => {
  it("mostra voti e commenti con il plurale corretto", () => {
    expect(
      formatMediaTribunaCounts(
        buildPost({ comment_count: 52, total_vote_count: 368 }),
      ),
    ).toEqual(["368 voti", "52 commenti"]);
    expect(
      formatMediaTribunaCounts(
        buildPost({ comment_count: 1, total_vote_count: 1 }),
      ),
    ).toEqual(["1 voto", "1 commento"]);
  });

  it("non mostra una voce che vale zero", () => {
    expect(formatMediaTribunaCounts(buildPost())).toEqual([]);
  });

  it("per un dibattito non mostra i voti, che non esistono", () => {
    expect(
      formatMediaTribunaCounts(
        buildPost({
          comment_count: 47,
          kind: "article_debate",
          total_vote_count: 0,
        }),
      ),
    ).toEqual(["47 commenti"]);
  });

  it("per un Q&A mostra le domande", () => {
    expect(
      formatMediaTribunaCounts(
        buildPost({ comment_count: 3, kind: "community_qa", question_count: 8 }),
      ),
    ).toEqual(["8 domande", "3 commenti"]);
  });
});
