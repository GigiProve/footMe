/**
 * La riga di commento montata sui componenti reali (HOM-08 §54–§73, §98, §146–§147,
 * §167): senza card, «Autore» discreto, menu solo se esistono azioni, Mi piace e
 * Rispondi dalle capability, segnaposto non interattivo, invio fallito con «Riprova».
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { countTestId, hostByTestId, press, pressTestId, render } from "../../feed/components/feed-test-helpers";
import { resetUnfollowedSourcesStore, unfollowedSourcesStore } from "../../following/unfollowed-sources-store";
import { likeStore } from "../../interactions/like-store";
import { reportedStore, resetReportedStore } from "../../moderation/reported-store";
import type { CommentEntity } from "../comment-types";
import type { CommentsController } from "../use-comments-controller";
import { CommentPlaceholderRow } from "./CommentPlaceholderRow";
import { CommentRow } from "./CommentRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const controller = { actions } as unknown as CommentsController;

function comment(overrides: Partial<CommentEntity> = {}): CommentEntity {
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
    likesCount: 12,
    links: [],
    mentions: [],
    operationKey: null,
    repliesCount: 0,
    replyTo: null,
    replyToCommentId: null,
    rootCommentId: "c-1",
    send: null,
    status: "active",
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  Object.values(actions).forEach((mock) => mock.mockReset());
  likeStore.clear();
  // HOM-11: gli insiemi di sessione sono di modulo, ogni test parte da zero.
  resetReportedStore();
  resetUnfollowedSourcesStore();
});

describe("CommentRow", () => {
  it("un commento altrui: Mi piace e Rispondi, nessun menu •••", () => {
    const tree = render(<CommentRow comment={comment()} controller={controller} isReply={false} />);

    expect(countTestId(tree, "comment-like-c-1")).toBe(1);
    expect(countTestId(tree, "comment-reply-c-1")).toBe(1);
    expect(countTestId(tree, "comment-menu-c-1")).toBe(0);
  });

  it("il proprio commento: menu ••• «Azioni commento» che passa l'entità (§146, §231)", () => {
    const own = comment({
      capabilities: { canDelete: true, canEdit: true, canLike: true, canOpenAuthor: true, canReply: true },
    });
    const tree = render(<CommentRow comment={own} controller={controller} isReply={false} />);

    press(tree, "Azioni commento");

    expect(actions.openMenu).toHaveBeenCalledWith(own);
  });

  it("Rispondi chiama l'azione del controller con l'entità (§81)", () => {
    const entity = comment();
    const tree = render(<CommentRow comment={entity} controller={controller} isReply={false} />);

    press(tree, "Rispondi a Marco Bianchi");

    expect(actions.reply).toHaveBeenCalledWith(entity);
  });

  it("senza capability niente Rispondi né Mi piace azionabile: il numero resta statico (§177–§180)", () => {
    const frozen = comment({
      capabilities: { canDelete: false, canEdit: false, canLike: false, canOpenAuthor: true, canReply: false },
    });
    const tree = render(<CommentRow comment={frozen} controller={controller} isReply={false} />);

    expect(countTestId(tree, "comment-reply-c-1")).toBe(0);
    expect(countTestId(tree, "comment-like-c-1")).toBe(0);
    expect(countTestId(tree, "comment-likes-static-c-1")).toBe(1);
  });

  it("l'autore del contenuto ha «· Autore» inline, senza fondo né bordo (§64–§66)", () => {
    const tree = render(<CommentRow comment={comment({ isContentAuthor: true })} controller={controller} isReply={false} />);

    expect(JSON.stringify(tree.toJSON())).toContain("· Autore");
  });

  it("un tap sul nome o sull'avatar apre il profilo dell'autore (§110, §196)", () => {
    const entity = comment();
    const tree = render(<CommentRow comment={entity} controller={controller} isReply={false} />);

    pressTestId(tree, "comment-avatar-c-1");
    expect(actions.openAuthor).toHaveBeenLastCalledWith(entity.author, "c-1", "avatar");

    pressTestId(tree, "comment-author-c-1");
    expect(actions.openAuthor).toHaveBeenLastCalledWith(entity.author, "c-1", "name");
  });

  it("avatar e nome non sono due punti per lo screen reader verso lo stesso bersaglio (§196, §236)", () => {
    const tree = render(<CommentRow comment={comment()} controller={controller} isReply={false} />);
    const avatar = hostByTestId(tree, "comment-avatar-c-1")[0];
    const name = hostByTestId(tree, "comment-author-c-1")[0];

    expect(avatar.props.accessible).toBe(false);
    expect(name.props.accessibilityLabel).toContain("Marco Bianchi");
    // 32pt di avatar + hitSlop per lato = almeno 44pt di area di tocco.
    const slop = avatar.props.hitSlop as { top: number; bottom: number };
    expect(32 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  });

  it("un tap sul numero dei Mi piace apre la lista HOM-07 (§74)", () => {
    const entity = comment();
    const tree = render(<CommentRow comment={entity} controller={controller} isReply={false} />);
    const count = hostByTestId(tree, "comment-likes-count-c-1").find((node) => typeof node.props.onPress === "function");

    expect(count).toBeDefined();
    count?.props.onPress();

    expect(actions.openLikes).toHaveBeenCalledWith(entity);
  });

  it("elemento in invio: nessun Mi piace, Rispondi né menu", () => {
    const sending = comment({
      id: "tmp:k-1",
      send: {
        body: "Ottimo progetto.",
        failure: null,
        identity: { id: "p-1", type: "person" },
        links: [],
        mentions: [],
        operationKey: "k-1",
        replyToCommentId: null,
        rootCommentId: null,
        state: "sending",
      },
    });
    const tree = render(<CommentRow comment={sending} controller={controller} isReply={false} />);

    expect(countTestId(tree, "comment-like-tmp:k-1")).toBe(0);
    expect(countTestId(tree, "comment-reply-tmp:k-1")).toBe(0);
    expect(countTestId(tree, "comment-menu-tmp:k-1")).toBe(0);
    expect(countTestId(tree, "comment-retry-tmp:k-1")).toBe(0);
  });

  it("invio fallito: «Invio non riuscito · Riprova» e il testo riapre il composer (§98, §101)", () => {
    const failed = comment({
      id: "tmp:k-1",
      send: {
        body: "Ottimo progetto.",
        failure: "network",
        identity: { id: "p-1", type: "person" },
        links: [],
        mentions: [],
        operationKey: "k-1",
        replyToCommentId: null,
        rootCommentId: null,
        state: "failed",
      },
    });
    const tree = render(<CommentRow comment={failed} controller={controller} isReply={false} />);

    expect(JSON.stringify(tree.toJSON())).toContain("Invio non riuscito · Riprova");

    press(tree, "Invio non riuscito. Riprova");
    expect(actions.retrySend).toHaveBeenCalledWith("tmp:k-1");
  });

  it("una risposta è indentata una volta sola, mai un terzo livello (§50–§51)", () => {
    const reply = comment({ id: "c-3", replyToCommentId: "c-2", rootCommentId: "c-1" });
    const tree = render(<CommentRow comment={reply} controller={controller} isReply />);
    const row = hostByTestId(tree, "comment-row-c-3")[0];
    const style = JSON.stringify(row.props.style);

    expect(style).toContain("paddingLeft");
    expect(style).not.toContain("marginLeft");
  });
});

/**
 * HOM-11 §69–§72, §134–§140, §278–§280: il ••• sul commento altrui quando c'è almeno
 * un'azione, e il commento segnalato ripiegato senza azioni.
 */
describe("CommentRow — HOM-11", () => {
  it("commento altrui con can_report: compare il ••• (Segnala, §70, §132)", () => {
    const reportable = comment({
      capabilities: { canDelete: false, canEdit: false, canLike: true, canOpenAuthor: true, canReply: true, canReport: true },
    });
    const tree = render(<CommentRow comment={reportable} controller={controller} isReply={false} />);

    expect(countTestId(tree, "comment-menu-c-1")).toBe(1);
    press(tree, "Azioni commento");
    expect(actions.openMenu).toHaveBeenCalledWith(reportable);
  });

  it("commento altrui con autore seguito: compare il ••• anche senza can_report (Non seguire, §70)", () => {
    const followed = comment({ viewerFollowsAuthor: true });
    const tree = render(<CommentRow comment={followed} controller={controller} isReply={false} />);

    expect(countTestId(tree, "comment-menu-c-1")).toBe(1);
  });

  it("l'unica azione era Non seguire e la fonte è appena stata lasciata: nessun ••• vuoto (§62)", () => {
    unfollowedSourcesStore.add("profile:p-2");
    const followed = comment({ viewerFollowsAuthor: true });
    const tree = render(<CommentRow comment={followed} controller={controller} isReply={false} />);

    expect(countTestId(tree, "comment-menu-c-1")).toBe(0);
  });

  it("segnalato (payload): riga «Commento segnalato» senza Mi piace, Rispondi né menu (§134–§135, §140)", () => {
    const reported = comment({ viewerHasReported: true });
    const tree = render(<CommentRow comment={reported} controller={controller} isReply={false} />);

    expect(countTestId(tree, "comment-reported-c-1")).toBe(1);
    expect(JSON.stringify(tree.toJSON())).toContain("Commento segnalato");
    expect(countTestId(tree, "comment-like-c-1")).toBe(0);
    expect(countTestId(tree, "comment-reply-c-1")).toBe(0);
    expect(countTestId(tree, "comment-menu-c-1")).toBe(0);
    expect(countTestId(tree, "comment-author-c-1")).toBe(0);
    // Il testo del commento segnalato non si mostra più al reporter.
    expect(JSON.stringify(tree.toJSON())).not.toContain("Ottimo progetto.");
  });

  it("segnalato in sessione (prima del refetch): si ripiega subito", () => {
    reportedStore.add("COMMENT:c-1");
    const tree = render(<CommentRow comment={comment()} controller={controller} isReply={false} />);

    expect(countTestId(tree, "comment-reported-c-1")).toBe(1);
  });

  it("una risposta segnalata si ripiega da sola: le altre restano (§138–§139)", () => {
    reportedStore.add("COMMENT:c-2");
    const reported = render(
      <CommentRow comment={comment({ id: "c-2", replyToCommentId: "c-1" })} controller={controller} isReply />,
    );
    const sibling = render(
      <CommentRow comment={comment({ id: "c-3", replyToCommentId: "c-1" })} controller={controller} isReply />,
    );

    expect(countTestId(reported, "comment-reported-c-2")).toBe(1);
    expect(countTestId(sibling, "comment-reported-c-3")).toBe(0);
    expect(countTestId(sibling, "comment-like-c-3")).toBe(1);
  });

  it("il commento ripiegato è un solo elemento leggibile: la bandierina non è l'unico segnale (§201)", () => {
    const tree = render(<CommentRow comment={comment({ viewerHasReported: true })} controller={controller} isReply={false} />);
    const bar = hostByTestId(tree, "comment-reported-c-1")[0];

    expect(bar.props.accessible).toBe(true);
    expect(bar.props.accessibilityLabel).toBe("Commento segnalato");
  });
});

describe("CommentPlaceholderRow — §164–§168, §195–§196", () => {
  it("«Commento eliminato»: nessun controllo, nessun tap", () => {
    const tree = render(<CommentPlaceholderRow status="deleted" />);

    expect(JSON.stringify(tree.toJSON())).toContain("Commento eliminato");
    expect(tree.root.findAll((node) => typeof node.type === "string" && typeof node.props?.onPress === "function"))
      .toHaveLength(0);
  });

  it("«Commento non disponibile» per un root non visibile con risposte visibili", () => {
    const tree = render(<CommentPlaceholderRow status="unavailable" />);

    expect(JSON.stringify(tree.toJSON())).toContain("Commento non disponibile");
  });
});
