/**
 * Il controller dei Commenti: apertura sui commenti o sul composer, eventi `comments_open*`
 * una volta sola, tap sulla cella Commenta del dettaglio e watermark del server
 * (HOM-08 §5–§6, §13, §141–§145, §177–§179, §258).
 *
 * Gli hook di rete (contesto, liste, «Nuovi commenti») sono simulati: qui si prova la
 * logica del controller; pubblicazione, modifica ed eliminazione hanno i propri test.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { likeItemKey } from "../interactions/like-store";
import { commentCountStore } from "./comment-count-store";
import { commentStore } from "./comment-store";
import type { CommentContext, CommentIdentity } from "./comment-types";
import { useCommentsController, type CommentsController, type CommentsFocus } from "./use-comments-controller";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  context: { current: null as unknown },
  push: vi.fn(),
  rootsAsOf: { current: null as string | null },
  updatesArgs: vi.fn(),
}));

vi.mock("expo-router", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("../../ui", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../auth/use-session", () => ({ useSession: () => ({ profile: { id: "viewer-1" } }) }));
vi.mock("../feed/feed-service", () => ({ resolveIdentityHref: vi.fn(() => "/profile/x") }));
vi.mock("../feed/use-feed-post-like", () => ({ useContentLikeToggle: () => vi.fn() }));
vi.mock("../likes/use-open-likes", () => ({ useOpenLikes: () => vi.fn() }));
vi.mock("../article-editor/article-links", () => ({ openExternalUrl: vi.fn() }));
vi.mock("./use-comment-context", () => ({ useCommentContext: () => mocks.context.current }));
vi.mock("./use-root-comments", () => ({
  useRootComments: () => ({
    errorKind: null,
    firstAsOf: mocks.rootsAsOf.current,
    hasMore: false,
    isFetchingMore: false,
    loadMore: vi.fn(),
    loadMoreFailed: false,
    pageIds: [],
    refreshFirstPage: vi.fn(async () => undefined),
    retry: vi.fn(),
    status: "ready",
  }),
}));
vi.mock("./use-comment-updates", () => ({
  useCommentUpdates: (args: unknown) => {
    mocks.updatesArgs(args);
    return { count: 0, dismiss: vi.fn(), isVisible: false };
  },
}));

const KEY = likeItemKey("profile_post", "post-1");

const PERSON: CommentIdentity = {
  avatarUrl: null,
  canComment: true,
  clubCategory: null,
  clubName: null,
  mediaKind: null,
  primaryPosition: null,
  teamLabel: null,
  id: "p-1",
  isVerified: false,
  name: "Matteo Rossi",
  rank: 0,
  role: null,
  type: "person",
};

function context(overrides: Partial<CommentContext> = {}) {
  const data: CommentContext = {
    asOf: "2026-11-14T10:00:00+00:00",
    commentsCount: 18,
    commentsEnabled: true,
    commentsVisible: true,
    contentAuthor: null,
    identities: [PERSON],
    limits: { maxBodyLength: 1000, maxLinks: 10, maxMentions: 20 },
    ...overrides,
  };

  return { data, refresh: vi.fn(), status: "ready" as const };
}

let events: AnalyticsEvent[] = [];
let controller!: CommentsController;
let scrollTo: ReturnType<typeof vi.fn>;

function mount(focus: CommentsFocus) {
  const client = new QueryClient();
  scrollTo = vi.fn();
  const scrollRef = { current: { scrollTo } } as unknown as React.RefObject<never>;

  function Harness() {
    controller = useCommentsController({
      contentId: "post-1",
      contentType: "profile_post",
      focus,
      origin: "HOME_PER_TE",
      scrollRef,
    });
    return null;
  }

  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  return tree;
}

function layout(y: number) {
  act(() => {
    controller.onSectionLayout({ nativeEvent: { layout: { y } } } as never);
  });
}

function names() {
  return events.map((event) => event.name);
}

beforeEach(() => {
  events = [];
  setAnalyticsSink((event) => events.push(event));
  commentStore.clear();
  commentCountStore.clear();
  commentCountStore.seed(KEY, 18, 1);
  mocks.context.current = context();
  mocks.rootsAsOf.current = "2026-11-14T10:05:00+00:00";
  mocks.updatesArgs.mockReset();
});

afterEach(() => setAnalyticsSink(null));

describe("apertura sui commenti — §5", () => {
  it("focus=comments: scroll alla sezione, tastiera chiusa, `comments_open` con il conteggio", () => {
    mount("comments");
    layout(300);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ animated: true, y: 292 });
    expect(controller.composer.store.getState().active).toBe(false);
    expect(events.filter((event) => event.name === "comments_open")).toEqual([
      expect.objectContaining({
        name: "comments_open",
        props: expect.objectContaining({ commentsCount: 18, contentId: "post-1", origin: "HOME_PER_TE" }),
      }),
    ]);
    expect(names()).not.toContain("comments_open_with_composer");
  });

  it("senza focus: nessun evento di apertura e nessuno scroll", () => {
    mount(null);
    layout(300);

    expect(scrollTo).not.toHaveBeenCalled();
    expect(names()).not.toContain("comments_open");
    expect(names()).not.toContain("comments_open_with_composer");
  });

  it("gli eventi di apertura partono UNA volta, anche con più render", () => {
    mount("comments");
    layout(300);
    layout(320);
    layout(340);

    expect(names().filter((name) => name === "comments_open")).toHaveLength(1);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

describe("apertura col composer — §6", () => {
  it("focus=composer: composer attivo con focus, scroll e `comments_open_with_composer`", () => {
    mount("composer");
    layout(300);

    expect(controller.composer.store.getState()).toMatchObject({ active: true, focusToken: 1 });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(names()).toContain("comments_open_with_composer");
    expect(names()).toContain("comment_composer_open");
    expect(names()).not.toContain("comments_open");
  });

  it("con i commenti disattivati il composer non si attiva, ma si arriva alla sezione (§179)", () => {
    mocks.context.current = context({ commentsEnabled: false });
    mount("composer");
    layout(300);

    expect(controller.composer.mode).toBe("hidden");
    expect(controller.composer.store.getState().active).toBe(false);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

describe("tap sulla cella Commenta del dettaglio — §13", () => {
  it("con commenti: scorre alla sezione, nessuna tastiera", () => {
    mount(null);
    layout(500);

    act(() => controller.onActionRowComment());

    expect(scrollTo).toHaveBeenCalledWith({ animated: true, y: 492 });
    expect(controller.composer.store.getState().active).toBe(false);
  });

  it("a zero: attiva il composer con focus e scorre (decide dal conteggio vivo, non dal payload)", () => {
    commentCountStore.apply(KEY, 0, 10);
    mount(null);
    layout(500);

    act(() => controller.onActionRowComment());

    expect(controller.composer.store.getState()).toMatchObject({ active: true, focusToken: 1 });
    expect(scrollTo).toHaveBeenCalledWith({ animated: true, y: 492 });
  });

  it("a zero ma con i commenti disattivati: solo lo scroll", () => {
    commentCountStore.apply(KEY, 0, 10);
    mocks.context.current = context({ commentsEnabled: false });
    mount(null);
    layout(500);

    act(() => controller.onActionRowComment());

    expect(controller.composer.store.getState().active).toBe(false);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});

describe("watermark di «Nuovi commenti» — §141–§145", () => {
  it("è l'as_of del SERVER della prima pagina", () => {
    mount(null);

    expect(mocks.updatesArgs).toHaveBeenLastCalledWith(
      expect.objectContaining({ watermark: "2026-11-14T10:05:00+00:00" }),
    );
  });

  it("con la prima pagina vuota vale quello del contesto, mai l'orologio del dispositivo", () => {
    mocks.rootsAsOf.current = null;
    mount(null);

    expect(mocks.updatesArgs).toHaveBeenLastCalledWith(
      expect.objectContaining({ watermark: "2026-11-14T10:00:00+00:00" }),
    );
  });
});

describe("stato di disponibilità — §177–§190", () => {
  it("commenti disattivati ma ancora leggibili: lista e avviso, niente composer", () => {
    mocks.context.current = context({ commentsEnabled: false });
    mount(null);

    expect(controller.blocked).toBeNull();
    expect(controller.disabledNotice).toBe(true);
    expect(controller.composer.mode).toBe("hidden");
  });

  it("commenti disattivati e nascosti: la sezione dice solo l'avviso", () => {
    mocks.context.current = context({ commentsEnabled: false, commentsVisible: false });
    mount(null);

    expect(controller.blocked).toBe("disabled_hidden");
  });

  it("contenuto non disponibile: nessun composer", () => {
    mocks.context.current = { kind: "content_unavailable", retry: vi.fn(), status: "error" };
    mount(null);

    expect(controller.blocked).toBe("content_unavailable");
    expect(controller.composer.mode).toBe("hidden");
  });

  it("l'ordinamento parte da «Più rilevanti» e la scelta resta nello store del contenuto (§128–§129)", () => {
    mount(null);
    expect(controller.sort).toBe("relevant");

    act(() => controller.setSort("recent"));

    expect(controller.sort).toBe("recent");
    expect(commentStore.getSort(KEY)).toBe("recent");
    expect(names()).toContain("comments_sort_changed");
  });
});
