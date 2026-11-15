/**
 * Servizio Commenti: mapper della forma unica (contratto A5), wire verso le RPC,
 * paginazione a cursore e classificazione degli errori (HOM-08 §47–§53, §130–§135,
 * §166–§167, §192–§193, §199).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  classifyCommentError,
  createComment,
  currentVersionFromConflict,
  deleteComment,
  fetchCommentContext,
  fetchCommentUpdates,
  listCommentReplies,
  listContentComments,
  mapComment,
  mapContext,
  mapLinks,
  mapMentions,
  toWireMentions,
  updateComment,
} from "./comment-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

beforeEach(() => mocks.rpc.mockReset());

const AUTHOR = {
  avatar_url: "https://x.test/a.png",
  club_category: null,
  club_name: "AC Como",
  identity_id: "p-1",
  identity_type: "person",
  is_verified: true,
  media_kind: null,
  name: "Marco Bianchi",
  primary_position: null,
  role: "coach",
  team_label: null,
};

function raw(overrides: Record<string, unknown> = {}) {
  return {
    author: AUTHOR,
    body: "Ottimo progetto.",
    capabilities: { can_delete: true, can_edit: true, can_like: true, can_open_author: true, can_reply: true },
    content_id: "post-1",
    content_type: "profile_post",
    created_at: "2026-11-14T10:00:00.000Z",
    edited_at: null,
    id: "c-1",
    is_content_author: false,
    liked_as: [{ id: "p-9", type: "person" }],
    likes_count: "12",
    links: [],
    mentions: [],
    operation_key: null,
    replies_count: 8,
    reply_to: null,
    reply_to_comment_id: null,
    root_comment_id: "c-1",
    status: "active",
    updated_at: "2026-11-14T10:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

describe("mapComment — forma unica del contratto A5", () => {
  it("passa da snake_case a camelCase; i bigint arrivano anche come stringa", () => {
    const comment = mapComment(raw());

    expect(comment).toMatchObject({
      author: { identityId: "p-1", identityType: "person", isVerified: true, name: "Marco Bianchi", role: "coach" },
      body: "Ottimo progetto.",
      id: "c-1",
      likesCount: 12,
      repliesCount: 8,
      rootCommentId: "c-1",
      status: "active",
      version: 1,
    });
    expect(comment?.likedAs).toEqual([{ id: "p-9", type: "person" }]);
    expect(comment?.capabilities).toEqual({
      canDelete: true,
      canEdit: true,
      canLike: true,
      canOpenAuthor: true,
      canReply: true,
      // HOM-11: assente nel payload = falso.
      canReport: false,
    });
  });

  it("HOM-11 §54, §70, §126: legge can_report, viewer_follows_author e viewer_has_reported; assenti = falso", () => {
    const flagged = mapComment(
      raw({
        capabilities: { can_like: true, can_report: true },
        viewer_follows_author: true,
        viewer_has_reported: true,
      }),
    );
    expect(flagged?.capabilities.canReport).toBe(true);
    expect(flagged).toMatchObject({ viewerFollowsAuthor: true, viewerHasReported: true });

    // Un server pre-HOM-11 non manda nulla: nessuna voce nuova, nessun commento ripiegato.
    expect(mapComment(raw())).toMatchObject({ viewerFollowsAuthor: false, viewerHasReported: false });
  });

  it("HOM-11: un segnaposto non porta Segui, Segnala né «segnalato»", () => {
    const placeholder = mapComment(
      raw({ status: "deleted", viewer_follows_author: true, viewer_has_reported: true }),
    );

    expect(placeholder).toMatchObject({ viewerFollowsAuthor: false, viewerHasReported: false });
  });

  it("§48: senza root_comment_id un commento è il proprio root", () => {
    expect(mapComment(raw({ root_comment_id: undefined }))?.rootCommentId).toBe("c-1");
  });

  it("§49, §53: la risposta conserva root, target preciso e destinatario", () => {
    const reply = mapComment(
      raw({
        id: "c-3",
        reply_to: { identity_id: "p-2", identity_type: "person", name: "Luca Ferri" },
        reply_to_comment_id: "c-2",
        root_comment_id: "c-1",
      }),
    );

    expect(reply).toMatchObject({
      replyTo: { identityId: "p-2", name: "Luca Ferri" },
      replyToCommentId: "c-2",
      rootCommentId: "c-1",
    });
  });

  it("§166–§167: eliminato e non disponibile non portano autore, testo, like né capability", () => {
    for (const status of ["deleted", "unavailable"] as const) {
      const placeholder = mapComment(raw({ status }));

      expect(placeholder).toMatchObject({
        author: null,
        body: "",
        likedAs: [],
        likesCount: 0,
        links: [],
        mentions: [],
        status,
      });
      expect(Object.values(placeholder?.capabilities ?? {}).every((value) => value === false)).toBe(true);
    }
  });

  it("scarta ciò che non è un commento: id, contenuto, data o stato mancanti", () => {
    expect(mapComment(null)).toBeNull();
    expect(mapComment(raw({ id: undefined }))).toBeNull();
    expect(mapComment(raw({ created_at: undefined }))).toBeNull();
    expect(mapComment(raw({ status: "banned" }))).toBeNull();
  });

  it("l'operation_key è esposta solo se il server la manda (commenti dell'utente)", () => {
    expect(mapComment(raw())?.operationKey).toBeNull();
    expect(mapComment(raw({ operation_key: "k-1" }))?.operationKey).toBe("k-1");
  });
});

describe("mention e link", () => {
  it("una mention malformata si scarta senza far cadere le altre", () => {
    const mentions = mapMentions([
      { display_name: "Marco Bianchi", end: 14, identity_id: "p-1", identity_type: "profile", start: 0 },
      { display_name: "X", end: 3, identity_id: "p-2", identity_type: "robot", start: 0 },
      { display_name: "Y", identity_id: "p-3", identity_type: "profile" },
      "boh",
    ]);

    expect(mentions).toEqual([
      { displayName: "Marco Bianchi", end: 14, identityId: "p-1", identityType: "profile", start: 0 },
    ]);
  });

  it("toWireMentions riporta la forma dei Post (§108)", () => {
    expect(
      toWireMentions([
        { displayName: "AC Como", end: 8, identityId: "c-1", identityType: "club", start: 0 },
      ]),
    ).toEqual([
      { display_name: "AC Como", end: 8, identity_id: "c-1", identity_type: "club", start: 0 },
    ]);
  });

  it("i link sono solo quelli del server", () => {
    expect(mapLinks([{ end: 22, start: 0, url: "https://prolink.app/x" }, { url: 3 }])).toEqual([
      { end: 22, start: 0, url: "https://prolink.app/x" },
    ]);
    expect(mapLinks(undefined)).toEqual([]);
  });
});

describe("mapContext", () => {
  it("legge conteggio, abilitazione, limiti e identità con can_comment", () => {
    const context = mapContext({
      comments_count: 18,
      comments_enabled: true,
      comments_visible: true,
      content_author: { identity_id: "c-1", identity_type: "society" },
      identities: [
        { can_comment: true, identity_id: "p-1", identity_type: "person", is_verified: false, name: "Matteo Rossi", rank: 0 },
        { can_comment: false, club_category: "Serie D", identity_id: "c-1", identity_type: "society", name: "AC Como", rank: 1 },
        { identity_id: "x", identity_type: "robot" },
      ],
      limits: { max_body_length: 500, max_links: 5, max_mentions: 10 },
    });

    expect(context.commentsCount).toBe(18);
    expect(context.contentAuthor).toEqual({ identityId: "c-1", identityType: "society" });
    expect(context.limits).toEqual({ maxBodyLength: 500, maxLinks: 5, maxMentions: 10 });
    // i campi della riga meta dell'identità (stesso calcolo dell'`author` delle card)
    expect(
      mapContext({
        identities: [
          {
            can_comment: true,
            club_name: "AC Como",
            identity_id: "p-1",
            identity_type: "person",
            media_kind: null,
            name: "Matteo Rossi",
            primary_position: "striker",
            role: "player",
            team_label: "Prima squadra",
          },
        ],
      }).identities[0],
    ).toMatchObject({ clubName: "AC Como", mediaKind: null, primaryPosition: "striker", teamLabel: "Prima squadra" });
    expect(context.identities.map((identity) => [identity.id, identity.canComment])).toEqual([
      ["p-1", true],
      ["c-1", false],
    ]);
  });

  it("un server che non manda i campi = commenti abilitati e limiti di default (A2, A3)", () => {
    const context = mapContext({});

    expect(context.commentsEnabled).toBe(true);
    expect(context.commentsVisible).toBe(true);
    expect(context.limits.maxBodyLength).toBe(1000);
    expect(context.identities).toEqual([]);
  });

  it("§177–§180: disattivati e nascosti sono letti come arrivano", () => {
    const context = mapContext({ comments_enabled: false, comments_visible: false });

    expect(context.commentsEnabled).toBe(false);
    expect(context.commentsVisible).toBe(false);
  });
});

describe("liste a cursore (§130–§135)", () => {
  it("il cursore è quello dell'ultima riga; null a lista finita", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        { comment: raw({ id: "c-1" }), next_cursor: null },
        { comment: raw({ id: "c-2" }), next_cursor: { created_at: "t", id: "c-2" } },
      ],
      error: null,
    });

    const page = await listContentComments({
      contentId: "post-1",
      contentType: "profile_post",
      cursor: null,
      sort: "recent",
    });

    expect(page.comments.map((comment) => comment.id)).toEqual(["c-1", "c-2"]);
    expect(page.nextCursor).toEqual({ created_at: "t", id: "c-2" });
    expect(mocks.rpc).toHaveBeenCalledWith("list_content_comments", {
      p_content_id: "post-1",
      p_content_type: "profile_post",
      p_cursor: null,
      p_limit: 20,
      p_sort: "recent",
    });

    mocks.rpc.mockResolvedValueOnce({ data: [{ comment: raw(), next_cursor: null }], error: null });
    const last = await listContentComments({
      contentId: "post-1",
      contentType: "profile_post",
      cursor: { id: "c-2" },
      sort: "relevant",
    });
    expect(last.nextCursor).toBeNull();
  });

  it("una riga malformata non fa cadere la pagina; pagina vuota senza cursore", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ comment: { id: "senza-resto" }, next_cursor: null }, { comment: raw({ id: "c-9" }), next_cursor: null }],
      error: null,
    });
    const page = await listCommentReplies({ cursor: null, rootCommentId: "c-1" });

    expect(page.comments.map((comment) => comment.id)).toEqual(["c-9"]);
    expect(mocks.rpc).toHaveBeenCalledWith("list_comment_replies", {
      p_cursor: null,
      p_limit: 10,
      p_root_comment_id: "c-1",
    });

    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await listCommentReplies({ cursor: null, rootCommentId: "c-1" })).toEqual({
      asOf: null,
      comments: [],
      nextCursor: null,
    });
  });

  it("il watermark è l'as_of del SERVER portato dalle righe, mai un orologio locale (§141–§145)", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        { as_of: "2026-11-14T10:00:00.123456+00:00", comment: raw({ id: "c-1" }), next_cursor: null },
        { as_of: "2026-11-14T10:00:00.123456+00:00", comment: raw({ id: "c-2" }), next_cursor: null },
      ],
      error: null,
    });

    const page = await listContentComments({
      contentId: "post-1",
      contentType: "profile_post",
      cursor: null,
      sort: "recent",
    });

    expect(page.asOf).toBe("2026-11-14T10:00:00.123456+00:00");
  });

  it("il contesto porta l'as_of di ripiego per una prima pagina vuota", () => {
    expect(mapContext({ as_of: "2026-11-14T10:00:00+00:00" }).asOf).toBe("2026-11-14T10:00:00+00:00");
    expect(mapContext({}).asOf).toBeNull();
  });

  it("un errore della RPC si propaga", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("content_unavailable") });

    await expect(
      listContentComments({ contentId: "p", contentType: "profile_post", cursor: null, sort: "relevant" }),
    ).rejects.toThrow("content_unavailable");
  });
});

describe("RPC di scrittura", () => {
  it("create_comment manda identità, chiave di idempotenza e wire strutturato", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { comment: raw({ id: "c-5", operation_key: "k-1" }), comments_count: 19, root_replies_count: 0 },
      error: null,
    });

    const result = await createComment({
      body: "@Marco Bianchi bravo",
      contentId: "post-1",
      contentType: "profile_post",
      identity: { id: "p-1", type: "person" },
      links: [],
      mentions: [{ displayName: "Marco Bianchi", end: 14, identityId: "p-2", identityType: "profile", start: 0 }],
      operationKey: "k-1",
      replyToCommentId: "c-1",
    });

    expect(result).toMatchObject({ commentsCount: 19, rootRepliesCount: 0 });
    expect(result.comment.id).toBe("c-5");
    expect(mocks.rpc).toHaveBeenCalledWith("create_comment", {
      p_body: "@Marco Bianchi bravo",
      p_content_id: "post-1",
      p_content_type: "profile_post",
      p_identity_id: "p-1",
      p_identity_type: "person",
      p_links: [],
      p_mentions: [
        { display_name: "Marco Bianchi", end: 14, identity_id: "p-2", identity_type: "profile", start: 0 },
      ],
      p_operation_key: "k-1",
      p_reply_to_comment_id: "c-1",
    });
  });

  it("create_comment senza commento nella risposta è un errore, non un commento inventato", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { comments_count: 1 }, error: null });

    await expect(
      createComment({
        body: "x",
        contentId: "p",
        contentType: "profile_post",
        identity: { id: "p-1", type: "person" },
        links: [],
        mentions: [],
        operationKey: "k",
        replyToCommentId: null,
      }),
    ).rejects.toThrow();
  });

  it("update_comment manda la versione attesa (CAS, §154–§155)", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { comment: raw({ version: 2 }) }, error: null });

    const comment = await updateComment({
      body: "nuovo",
      commentId: "c-1",
      expectedVersion: 1,
      links: [],
      mentions: [],
    });

    expect(comment.version).toBe(2);
    expect(mocks.rpc).toHaveBeenCalledWith("update_comment", {
      p_body: "nuovo",
      p_comment_id: "c-1",
      p_expected_version: 1,
      p_links: [],
      p_mentions: [],
    });
  });

  it("delete_comment: removed o tombstoned con i conteggi aggiornati (§163–§170)", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { comment_id: "c-1", comments_count: 9, outcome: "tombstoned", root_comment_id: "c-1", root_replies_count: 3 },
      error: null,
    });

    expect(await deleteComment("c-1")).toEqual({
      commentId: "c-1",
      commentsCount: 9,
      outcome: "tombstoned",
      rootCommentId: "c-1",
      rootRepliesCount: 3,
    });

    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "boh" }, error: null });
    await expect(deleteComment("c-1")).rejects.toThrow();
  });

  it("fetch_comment_updates e fetch_comment_context", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ comments_count: 20, new_count: 2 }], error: null });
    expect(await fetchCommentUpdates("profile_post", "post-1", "2026-11-14T10:00:00Z")).toEqual({
      commentsCount: 20,
      newCount: 2,
    });

    mocks.rpc.mockResolvedValueOnce({ data: { comments_count: 3 }, error: null });
    expect((await fetchCommentContext("profile_post", "post-1")).commentsCount).toBe(3);
    expect(mocks.rpc).toHaveBeenLastCalledWith("fetch_comment_context", {
      p_content_id: "post-1",
      p_content_type: "profile_post",
    });
  });
});

describe("classifyCommentError (contratto A5)", () => {
  it.each([
    ["comment_identity_forbidden", "identity_forbidden"],
    ["comment_target_unavailable", "target_unavailable"],
    ["comment_unavailable", "comment_unavailable"],
    ["content_unavailable", "content_unavailable"],
    ["comments_disabled", "comments_disabled"],
    ["comment_invalid_body", "invalid_body"],
    ["comment_too_long", "too_long"],
    ["comment_invalid_mention", "invalid_mention"],
    ["comment_operation_conflict", "operation_conflict"],
    ["comment_version_conflict", "version_conflict"],
    ["comment_forbidden", "forbidden"],
  ] as const)("%s → %s", (code, kind) => {
    expect(classifyCommentError({ message: code })).toBe(kind);
    expect(classifyCommentError(new Error(`rpc: ${code}`))).toBe(kind);
  });

  it("il commento-bersaglio non disponibile non si confonde col commento non disponibile", () => {
    expect(classifyCommentError({ message: "comment_target_unavailable" })).not.toBe("comment_unavailable");
  });

  it("rete, timeout, null, errore ignoto: network (si può riprovare)", () => {
    expect(classifyCommentError(new Error("Network request failed"))).toBe("network");
    expect(classifyCommentError(null)).toBe("network");
    expect(classifyCommentError({ message: "boom" })).toBe("network");
  });

  it("§155: la versione corrente si legge dal DETAIL del conflitto", () => {
    expect(
      currentVersionFromConflict({ details: "current_version=5", message: "comment_version_conflict" }),
    ).toBe(5);
    expect(currentVersionFromConflict({ message: "comment_version_conflict" })).toBeNull();
  });
});
