/**
 * La sezione Commenti montata sui componenti reali: stati dentro la sezione senza
 * nascondere il contenuto, empty compatto, disattivati, ordinamento, «Nuovi commenti»
 * e thread collassati (HOM-08 §16–§17, §132–§136, §141–§145, §177–§190, §306–§308).
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { countTestId, press, pressTestId, render, textOf } from "../../feed/components/feed-test-helpers";
import { likeStore } from "../../interactions/like-store";
import { commentStore } from "../comment-store";
import type { Comment } from "../comment-types";
import type { CommentsController } from "../use-comments-controller";
import { CommentsSection } from "./CommentsSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("../../feed/components/modules/FeedBanners", async () => {
  const react = await import("react");
  return {
    NewContentPill: (props: { label?: string }) =>
      react.createElement("NewContentPill", { ...props, accessibilityLabel: props.label }),
  };
});

const actions = {
  expandThread: vi.fn(),
  onThreadMoreLoaded: vi.fn(),
  openAuthor: vi.fn(),
  openLikes: vi.fn(),
  openLink: vi.fn(),
  openMention: vi.fn(),
  openMenu: vi.fn(),
  reopenFailed: vi.fn(),
  reply: vi.fn(),
  retrySend: vi.fn(),
  toggleLike: vi.fn(),
};

const fns = {
  loadMore: vi.fn(),
  retry: vi.fn(),
  setSortOpen: vi.fn(),
  showNew: vi.fn(),
};

type Overrides = {
  blocked?: CommentsController["blocked"];
  disabledNotice?: boolean;
  sort?: CommentsController["sort"];
  mode?: CommentsController["composer"]["mode"];
  newVisible?: boolean;
  roots?: Partial<CommentsController["roots"]>;
};

function controllerWith(overrides: Overrides = {}): CommentsController {
  return {
    actions,
    blocked: overrides.blocked ?? null,
    composer: { mode: overrides.mode ?? "ready" },
    disabledNotice: overrides.disabledNotice ?? false,
    newComments: { isVisible: overrides.newVisible ?? false, show: fns.showNew },
    onSectionLayout: vi.fn(),
    overlays: { setSortOpen: fns.setSortOpen },
    roots: {
      hasMore: false,
      isFetchingMore: false,
      loadMore: fns.loadMore,
      loadMoreFailed: false,
      refs: [],
      retry: fns.retry,
      status: "ready",
      ...overrides.roots,
    },
    sort: overrides.sort ?? "relevant",
    viewerId: "viewer-1",
  } as unknown as CommentsController;
}

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    author: {
      avatarUrl: null,
      clubCategory: null,
      clubName: "AC Como",
      identityId: "p-2",
      identityType: "person",
      isVerified: true,
      mediaKind: null,
      name: "Marco Bianchi",
      primaryPosition: null,
      role: "coach",
      teamLabel: null,
    },
    body: "Ottimo progetto.",
    capabilities: { canDelete: false, canEdit: false, canLike: true, canOpenAuthor: true, canReply: true },
    contentId: "post-1",
    contentType: "profile_post",
    createdAt: new Date().toISOString(),
    editedAt: null,
    id: "c-1",
    isContentAuthor: false,
    likedAs: [],
    likesCount: 0,
    links: [],
    mentions: [],
    operationKey: null,
    repliesCount: 0,
    replyTo: null,
    replyToCommentId: null,
    rootCommentId: "c-1",
    status: "active",
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}

function mount(controller: CommentsController) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <CommentsSection controller={controller} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  [...Object.values(actions), ...Object.values(fns)].forEach((mock) => mock.mockReset());
  commentStore.clear();
  likeStore.clear();
});

describe("CommentsSection — header e ordinamento (§16, §117–§120)", () => {
  it("«Commenti» a sinistra e «Più rilevanti ▾» a destra; il tap apre il foglio", () => {
    const tree = mount(controllerWith());

    expect(textOf(tree)).toContain("Commenti");
    expect(textOf(tree)).toContain("Più rilevanti");

    press(tree, "Ordina i commenti, Più rilevanti");
    expect(fns.setSortOpen).toHaveBeenCalledWith(true);
  });

  it("l'ordinamento scelto è quello mostrato", () => {
    const tree = mount(controllerWith({ sort: "recent" }));

    expect(textOf(tree)).toContain("Più recenti");
  });
});

describe("CommentsSection — stati dentro la sezione (§184–§187, §307–§308)", () => {
  it("mentre carica: solo righe skeleton, nessun empty né errore", () => {
    const tree = mount(controllerWith({ roots: { status: "loading" } }));

    expect(countTestId(tree, "comments-skeleton")).toBe(1);
    expect(countTestId(tree, "comments-empty")).toBe(0);
    expect(countTestId(tree, "comments-error")).toBe(0);
  });

  it("errore: «Non è stato possibile caricare i commenti.» con Riprova", () => {
    const tree = mount(controllerWith({ roots: { status: "error" } }));

    expect(textOf(tree)).toContain("Non è stato possibile caricare i commenti.");
    pressTestId(tree, "comments-error-retry");
    expect(fns.retry).toHaveBeenCalledTimes(1);
  });

  it("empty compatto e senza illustrazione: «Nessun commento» + «Inizia tu la conversazione.» (§182–§183)", () => {
    const tree = mount(controllerWith());

    expect(countTestId(tree, "comments-empty")).toBe(1);
    expect(textOf(tree)).toContain("Nessun commento");
    expect(textOf(tree)).toContain("Inizia tu la conversazione.");
  });

  it("senza composer (commenti disattivati) l'empty non invita a scrivere", () => {
    const tree = mount(controllerWith({ mode: "hidden" }));

    expect(textOf(tree)).toContain("Nessun commento");
    expect(textOf(tree)).not.toContain("Inizia tu la conversazione.");
  });
});

describe("CommentsSection — disattivati e contenuto non disponibile (§177–§180, §190)", () => {
  it("disattivati e nascosti: solo l'avviso, nessun ordinamento né lista", () => {
    const tree = mount(controllerWith({ blocked: "disabled_hidden" }));

    expect(textOf(tree)).toContain("I commenti sono disattivati per questo contenuto.");
    expect(countTestId(tree, "comments-sort")).toBe(0);
    expect(countTestId(tree, "comments-skeleton")).toBe(0);
    expect(countTestId(tree, "comments-empty")).toBe(0);
  });

  it("disattivati ma leggibili: avviso sopra la lista", () => {
    const tree = mount(controllerWith({ disabledNotice: true }));

    expect(countTestId(tree, "comments-disabled")).toBe(1);
    expect(countTestId(tree, "comments-sort")).toBe(1);
  });

  it("contenuto non disponibile: «Contenuto non disponibile», nient'altro", () => {
    const tree = mount(controllerWith({ blocked: "content_unavailable" }));

    expect(textOf(tree)).toContain("Contenuto non disponibile");
    expect(countTestId(tree, "comments-sort")).toBe(0);
  });
});

describe("CommentsSection — «Nuovi commenti» (§141–§145)", () => {
  it("la pill compare solo se ci sono nuovi commenti e al tap rilegge in modo controllato", () => {
    const hidden = mount(controllerWith({ newVisible: false }));
    expect(JSON.stringify(hidden.toJSON())).not.toContain("Nuovi commenti");

    const shown = mount(controllerWith({ newVisible: true }));
    press(shown, "Nuovi commenti");
    expect(fns.showNew).toHaveBeenCalledTimes(1);
  });
});

describe("CommentsSection — thread (§50–§51, §132–§136)", () => {
  it("un commento con 8 risposte è collassato: «Visualizza 8 risposte», e il tap espande", () => {
    const root = comment({ repliesCount: 8 });
    commentStore.seed([root], 1);
    const tree = mount(controllerWith({ roots: { refs: [{ id: "c-1", key: "c-1" }] } }));

    expect(countTestId(tree, "comment-row-c-1")).toBe(1);
    expect(textOf(tree)).toContain("Visualizza 8 risposte");

    pressTestId(tree, "comment-replies-expand-c-1");

    expect(actions.expandThread).toHaveBeenCalledWith(expect.objectContaining({ id: "c-1", repliesCount: 8 }));
  });

  it("nessuna richiesta di risposte finché il thread è chiuso (§136)", () => {
    commentStore.seed([comment({ repliesCount: 8 })], 1);
    const tree = mount(controllerWith({ roots: { refs: [{ id: "c-1", key: "c-1" }] } }));

    expect(countTestId(tree, "comment-thread-replies-c-1")).toBe(1);
    // nessuna riga di risposta montata, nessuno skeleton di risposte
    expect(countTestId(tree, "comments-skeleton")).toBe(0);
  });

  it("un root eliminato con risposte: «Commento eliminato» non interattivo, le risposte restano raggiungibili (§164–§168)", () => {
    commentStore.seed([comment({ repliesCount: 2 })], 1);
    commentStore.tombstone("c-1", 5);
    const tree = mount(controllerWith({ roots: { refs: [{ id: "c-1", key: "c-1" }] } }));

    expect(countTestId(tree, "comment-placeholder")).toBe(1);
    expect(countTestId(tree, "comment-like-c-1")).toBe(0);
    expect(countTestId(tree, "comment-reply-c-1")).toBe(0);
    expect(textOf(tree)).toContain("Visualizza 2 risposte");
  });

  it("un root «non disponibile» (autore bloccato) è un segnaposto", () => {
    commentStore.seed([comment({ id: "c-9", rootCommentId: "c-9", status: "unavailable", repliesCount: 1 })], 1);
    const tree = mount(controllerWith({ roots: { refs: [{ id: "c-9", key: "c-9" }] } }));

    expect(textOf(tree)).toContain("Commento non disponibile");
  });
});

describe("CommentsSection — paginazione (§130–§131)", () => {
  it("con altre pagine: «Visualizza altri commenti» carica la successiva", () => {
    commentStore.seed([comment()], 1);
    const tree = mount(controllerWith({ roots: { hasMore: true, refs: [{ id: "c-1", key: "c-1" }] } }));

    pressTestId(tree, "comments-load-more");

    expect(fns.loadMore).toHaveBeenCalledTimes(1);
  });

  it("un errore di paginazione non toglie la lista", () => {
    commentStore.seed([comment()], 1);
    const tree = mount(controllerWith({ roots: { loadMoreFailed: true, refs: [{ id: "c-1", key: "c-1" }] } }));

    expect(countTestId(tree, "comment-row-c-1")).toBe(1);
    expect(textOf(tree)).toContain("Non è stato possibile caricare i commenti.");
    expect(countTestId(tree, "comments-load-more")).toBe(0);
  });
});
