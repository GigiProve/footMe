/**
 * Accesso ai dati dei Commenti (HOM-08 §47–§53, §130–§136, §141–§145, §153–§155,
 * §160–§170, §192, §199) → RPC `fetch_comment_context`, `list_content_comments`,
 * `list_comment_replies`, `create_comment`, `update_comment`, `delete_comment`,
 * `fetch_comment_updates`.
 *
 * La tabella `content_comments` è chiusa ai client: tutto passa dalle RPC, che
 * rivalidano identità, capability e leggibilità del contenuto a OGNI chiamata
 * (§42, §199). Ranking, visibilità (bloccati, sospesi, eliminati) e conteggio sono
 * del server (§89, §122): qui solo il ponte snake_case → camelCase, la paginazione
 * a cursore (§130–§131, §135) e la classificazione degli errori (A5).
 *
 * Un elemento sconosciuto o malformato si scarta senza far cadere la pagina: un
 * client più vecchio del backend non rompe la conversazione.
 */

import { supabase } from "../../lib/supabase";
import {
  isInteractionIdentityType,
  parseLikedAs,
} from "../interactions/interaction-identity";
import type { InteractionIdentityType } from "../interactions/interaction-types";
import type {
  Comment,
  CommentAuthor,
  CommentCapabilities,
  CommentContext,
  CommentCursor,
  CommentErrorKind,
  CommentIdentity,
  CommentLimits,
  CommentLink,
  CommentMentionRef,
  CommentPage,
  CommentReplyTarget,
  CommentSort,
  CommentStatus,
  CommentUpdates,
  CreateCommentResult,
  DeleteCommentResult,
} from "./comment-types";

/** §130, §135: 20 root per pagina, risposte a blocchi di 10. Il server limita a 50. */
export const COMMENTS_PAGE_SIZE = 20;
export const COMMENT_REPLIES_PAGE_SIZE = 10;

const DEFAULT_LIMITS: CommentLimits = { maxBodyLength: 1000, maxLinks: 10, maxMentions: 20 };

/* ------------------------------------------------------------------ */
/* Mapper                                                              */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** I `bigint` possono arrivare come stringa da PostgREST. */
function count(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0
    ? Math.floor(parsed)
    : fallback;
}

function isStatus(value: unknown): value is CommentStatus {
  return value === "active" || value === "deleted" || value === "unavailable";
}

function mapAuthor(value: unknown): CommentAuthor | null {
  if (!isRecord(value) || !isInteractionIdentityType(value.identity_type)) {
    return null;
  }
  if (typeof value.identity_id !== "string") {
    return null;
  }

  return {
    avatarUrl: text(value.avatar_url),
    clubCategory: text(value.club_category),
    clubName: text(value.club_name),
    identityId: value.identity_id,
    identityType: value.identity_type,
    isVerified: value.is_verified === true,
    mediaKind: text(value.media_kind),
    name: text(value.name) ?? "",
    primaryPosition: text(value.primary_position),
    role: text(value.role),
    teamLabel: text(value.team_label),
  };
}

function mapReplyTarget(value: unknown): CommentReplyTarget | null {
  if (!isRecord(value) || !isInteractionIdentityType(value.identity_type)) {
    return null;
  }
  if (typeof value.identity_id !== "string") {
    return null;
  }

  return {
    identityId: value.identity_id,
    identityType: value.identity_type,
    name: text(value.name) ?? "",
  };
}

/** Una mention con intervallo o identità non validi si scarta: il testo resta intero. */
export function mapMentions(value: unknown): CommentMentionRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): CommentMentionRef[] => {
    if (!isRecord(entry)) {
      return [];
    }
    const { identity_id, identity_type, display_name, start, end } = entry;
    if (
      typeof identity_id !== "string" ||
      (identity_type !== "profile" && identity_type !== "club") ||
      typeof display_name !== "string" ||
      typeof start !== "number" ||
      typeof end !== "number"
    ) {
      return [];
    }

    return [{ displayName: display_name, end, identityId: identity_id, identityType: identity_type, start }];
  });
}

/** Solo i link salvati dal server sono cliccabili (§112, §115). */
export function mapLinks(value: unknown): CommentLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): CommentLink[] => {
    if (!isRecord(entry)) {
      return [];
    }
    const { url, start, end } = entry;
    if (typeof url !== "string" || typeof start !== "number" || typeof end !== "number") {
      return [];
    }

    return [{ end, start, url }];
  });
}

function mapCapabilities(value: unknown): CommentCapabilities {
  const raw = isRecord(value) ? value : {};

  return {
    canDelete: raw.can_delete === true,
    canEdit: raw.can_edit === true,
    canLike: raw.can_like === true,
    canOpenAuthor: raw.can_open_author === true,
    // HOM-11 §70: assente (server pre-HOM-11) = nessuna voce Segnala.
    canReport: raw.can_report === true,
    canReply: raw.can_reply === true,
  };
}

/**
 * Un commento dal JSON delle RPC (forma unica, contratto A5). `null` se mancano
 * id, contenuto o data: non esiste una riga senza identità.
 */
export function mapComment(value: unknown): Comment | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, content_type, content_id, created_at } = value;
  if (
    typeof id !== "string" ||
    typeof content_type !== "string" ||
    typeof content_id !== "string" ||
    typeof created_at !== "string" ||
    !isStatus(value.status)
  ) {
    return null;
  }

  const status = value.status;
  const isActive = status === "active";
  const rootId = typeof value.root_comment_id === "string" ? value.root_comment_id : id;
  const replyToId = typeof value.reply_to_comment_id === "string" ? value.reply_to_comment_id : null;

  return {
    // deleted/unavailable: nessun autore, testo, like, capability (§166–§167).
    author: isActive ? mapAuthor(value.author) : null,
    body: isActive && typeof value.body === "string" ? value.body : "",
    capabilities: isActive
      ? mapCapabilities(value.capabilities)
      : { canDelete: false, canEdit: false, canLike: false, canOpenAuthor: false, canReply: false },
    contentId: content_id,
    contentType: content_type,
    createdAt: created_at,
    editedAt: typeof value.edited_at === "string" ? value.edited_at : null,
    id,
    isContentAuthor: isActive && value.is_content_author === true,
    likedAs: isActive ? parseLikedAs(value.liked_as) : [],
    likesCount: isActive ? count(value.likes_count) : 0,
    links: isActive ? mapLinks(value.links) : [],
    mentions: isActive ? mapMentions(value.mentions) : [],
    operationKey: text(value.operation_key),
    repliesCount: count(value.replies_count),
    replyTo: replyToId ? mapReplyTarget(value.reply_to) : null,
    replyToCommentId: replyToId,
    rootCommentId: rootId,
    status,
    updatedAt: typeof value.updated_at === "string" ? value.updated_at : created_at,
    // HOM-11 §54, §126, §134: assenti (server pre-HOM-11) = non seguito, non segnalato.
    viewerFollowsAuthor: isActive && value.viewer_follows_author === true,
    viewerHasReported: isActive && value.viewer_has_reported === true,
    version: count(value.version, 1),
  };
}

function mapIdentity(value: unknown, index: number): CommentIdentity[] {
  if (!isRecord(value) || !isInteractionIdentityType(value.identity_type)) {
    return [];
  }
  if (typeof value.identity_id !== "string") {
    return [];
  }

  return [
    {
      avatarUrl: text(value.avatar_url),
      canComment: value.can_comment === true,
      clubCategory: text(value.club_category),
      clubName: text(value.club_name),
      id: value.identity_id,
      isVerified: value.is_verified === true,
      mediaKind: text(value.media_kind),
      name: text(value.name) ?? "",
      primaryPosition: text(value.primary_position),
      teamLabel: text(value.team_label),
      rank: typeof value.rank === "number" ? value.rank : index,
      role: text(value.role),
      type: value.identity_type,
    },
  ];
}

function mapLimits(value: unknown): CommentLimits {
  const raw = isRecord(value) ? value : {};

  return {
    maxBodyLength: count(raw.max_body_length, DEFAULT_LIMITS.maxBodyLength) || DEFAULT_LIMITS.maxBodyLength,
    maxLinks: count(raw.max_links, DEFAULT_LIMITS.maxLinks) || DEFAULT_LIMITS.maxLinks,
    maxMentions: count(raw.max_mentions, DEFAULT_LIMITS.maxMentions) || DEFAULT_LIMITS.maxMentions,
  };
}

export function mapContext(value: unknown): CommentContext {
  const raw = isRecord(value) ? value : {};
  const author = isRecord(raw.content_author) ? raw.content_author : null;
  const identities = Array.isArray(raw.identities) ? raw.identities : [];

  return {
    asOf: typeof raw.as_of === "string" ? raw.as_of : null,
    commentsCount: count(raw.comments_count),
    // Un server che non manda il campo = commenti attivi (riga assente = abilitati, A2).
    commentsEnabled: raw.comments_enabled !== false,
    commentsVisible: raw.comments_visible !== false,
    contentAuthor:
      author &&
      isInteractionIdentityType(author.identity_type) &&
      typeof author.identity_id === "string"
        ? { identityId: author.identity_id, identityType: author.identity_type }
        : null,
    identities: identities.flatMap(mapIdentity),
    limits: mapLimits(raw.limits),
  };
}

function unwrapObject(data: unknown): Raw | null {
  const row = Array.isArray(data) ? data[0] : data;
  return isRecord(row) ? row : null;
}

/** Il cursore sta sull'ultima riga; `null` a lista finita (contratto A5: `next_cursor`). */
function mapPage(data: unknown): CommentPage {
  const rows = (Array.isArray(data) ? data : []).filter(isRecord);
  const last = rows[rows.length - 1];
  const nextCursor = last && isRecord(last.next_cursor) ? (last.next_cursor as CommentCursor) : null;
  // `as_of` è lo stesso su ogni riga: basta la prima che lo porta.
  const asOf = rows.find((row) => typeof row.as_of === "string")?.as_of;

  return {
    asOf: typeof asOf === "string" ? asOf : null,
    comments: rows.flatMap((row) => {
      const comment = mapComment(row.comment);
      return comment ? [comment] : [];
    }),
    nextCursor,
  };
}

/* ------------------------------------------------------------------ */
/* Wire verso le RPC                                                   */
/* ------------------------------------------------------------------ */

/** Stessa forma dei Post (`WireMention`, offset UTF-16, `end` escluso): il server verifica `body.slice`. */
export function toWireMentions(mentions: readonly CommentMentionRef[]) {
  return mentions.map((mention) => ({
    display_name: mention.displayName,
    end: mention.end,
    identity_id: mention.identityId,
    identity_type: mention.identityType,
    start: mention.start,
  }));
}

export function toWireLinks(links: readonly CommentLink[]) {
  return links.map((link) => ({ end: link.end, start: link.start, url: link.url }));
}

/* ------------------------------------------------------------------ */
/* Errori                                                              */
/* ------------------------------------------------------------------ */

function messageOf(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const { message, details } = error as { message?: unknown; details?: unknown };
    return [message, details].filter((part) => typeof part === "string").join(" ");
  }
  return "";
}

/**
 * Dal codice nel `message` della RPC (contratto A5) a ciò che l'interfaccia
 * distingue. Tutto il resto — rete, timeout, errore ignoto — è `network`: ammette
 * «Riprova» e non cancella mai niente.
 */
export function classifyCommentError(error: unknown): CommentErrorKind {
  const message = messageOf(error);

  if (message.includes("comment_identity_forbidden") || message.includes("like_identity_forbidden")) {
    return "identity_forbidden";
  }
  if (message.includes("comment_target_unavailable")) {
    return "target_unavailable";
  }
  if (message.includes("comment_unavailable")) {
    return "comment_unavailable";
  }
  if (message.includes("content_unavailable")) {
    return "content_unavailable";
  }
  if (message.includes("comments_disabled")) {
    return "comments_disabled";
  }
  if (message.includes("comment_too_long")) {
    return "too_long";
  }
  if (message.includes("comment_invalid_body")) {
    return "invalid_body";
  }
  if (message.includes("comment_invalid_mention")) {
    return "invalid_mention";
  }
  if (message.includes("comment_operation_conflict")) {
    return "operation_conflict";
  }
  if (message.includes("comment_version_conflict")) {
    return "version_conflict";
  }
  if (message.includes("comment_forbidden")) {
    return "forbidden";
  }

  return "network";
}

/** §155: il conflitto di versione porta la versione corrente nel DETAIL dell'errore. */
export function currentVersionFromConflict(error: unknown): number | null {
  const details =
    typeof error === "object" && error !== null ? (error as { details?: unknown }).details : null;
  const source = typeof details === "string" ? details : messageOf(error);
  const found = /\b(\d+)\b/.exec(source.replace("comment_version_conflict", ""));

  return found ? Number(found[1]) : null;
}

/* ------------------------------------------------------------------ */
/* RPC                                                                 */
/* ------------------------------------------------------------------ */

/** §34, §178–§180, §A5.1: stato del contesto + identità che possono commentare. */
export async function fetchCommentContext(contentType: string, contentId: string): Promise<CommentContext> {
  const { data, error } = await supabase.rpc("fetch_comment_context", {
    p_content_id: contentId,
    p_content_type: contentType,
  });

  if (error) {
    throw error;
  }

  const row = unwrapObject(data);
  if (!row) {
    throw new Error("fetch_comment_context: risposta vuota");
  }

  return mapContext(row);
}

/** §125, §130: pagina di commenti principali nell'ordine scelto; cursore keyset stabile (§222). */
export async function listContentComments({
  contentType,
  contentId,
  sort,
  cursor,
  limit = COMMENTS_PAGE_SIZE,
}: {
  contentType: string;
  contentId: string;
  sort: CommentSort;
  cursor: CommentCursor | null;
  limit?: number;
}): Promise<CommentPage> {
  const { data, error } = await supabase.rpc("list_content_comments", {
    p_content_id: contentId,
    p_content_type: contentType,
    p_cursor: cursor,
    p_limit: limit,
    p_sort: sort,
  });

  if (error) {
    throw error;
  }

  return mapPage(data);
}

/** §126, §133–§135: risposte più vecchie → più recenti, a blocchi. */
export async function listCommentReplies({
  rootCommentId,
  cursor,
  limit = COMMENT_REPLIES_PAGE_SIZE,
}: {
  rootCommentId: string;
  cursor: CommentCursor | null;
  limit?: number;
}): Promise<CommentPage> {
  const { data, error } = await supabase.rpc("list_comment_replies", {
    p_cursor: cursor,
    p_limit: limit,
    p_root_comment_id: rootCommentId,
  });

  if (error) {
    throw error;
  }

  return mapPage(data);
}

export type CreateCommentArgs = {
  contentType: string;
  contentId: string;
  replyToCommentId: string | null;
  body: string;
  mentions: readonly CommentMentionRef[];
  links: readonly CommentLink[];
  identity: { type: InteractionIdentityType; id: string };
  operationKey: string;
};

/** §86, §92–§95: la stessa `operationKey` rilancia lo stesso commento, mai un secondo. */
export async function createComment(args: CreateCommentArgs): Promise<CreateCommentResult> {
  const { data, error } = await supabase.rpc("create_comment", {
    p_body: args.body,
    p_content_id: args.contentId,
    p_content_type: args.contentType,
    p_identity_id: args.identity.id,
    p_identity_type: args.identity.type,
    p_links: toWireLinks(args.links),
    p_mentions: toWireMentions(args.mentions),
    p_operation_key: args.operationKey,
    p_reply_to_comment_id: args.replyToCommentId,
  });

  if (error) {
    throw error;
  }

  const row = unwrapObject(data);
  const comment = row ? mapComment(row.comment) : null;
  if (!row || !comment) {
    throw new Error("create_comment: risposta senza commento");
  }

  return {
    comment,
    commentsCount: count(row.comments_count),
    rootRepliesCount: count(row.root_replies_count),
  };
}

/** §153–§156: modifica con controllo di versione, mai sovrascrittura silenziosa (§155). */
export async function updateComment(args: {
  commentId: string;
  expectedVersion: number;
  body: string;
  mentions: readonly CommentMentionRef[];
  links: readonly CommentLink[];
}): Promise<Comment> {
  const { data, error } = await supabase.rpc("update_comment", {
    p_body: args.body,
    p_comment_id: args.commentId,
    p_expected_version: args.expectedVersion,
    p_links: toWireLinks(args.links),
    p_mentions: toWireMentions(args.mentions),
  });

  if (error) {
    throw error;
  }

  const row = unwrapObject(data);
  const comment = row ? mapComment(row.comment) : null;
  if (!comment) {
    throw new Error("update_comment: risposta senza commento");
  }

  return comment;
}

/** §160–§170: `removed` (nessuna risposta attiva) o `tombstoned` (resta il segnaposto). */
export async function deleteComment(commentId: string): Promise<DeleteCommentResult> {
  const { data, error } = await supabase.rpc("delete_comment", { p_comment_id: commentId });

  if (error) {
    throw error;
  }

  const row = unwrapObject(data);
  if (!row || (row.outcome !== "removed" && row.outcome !== "tombstoned")) {
    throw new Error("delete_comment: risposta senza esito");
  }

  return {
    commentId: typeof row.comment_id === "string" ? row.comment_id : commentId,
    commentsCount: count(row.comments_count),
    outcome: row.outcome,
    rootCommentId: typeof row.root_comment_id === "string" ? row.root_comment_id : commentId,
    rootRepliesCount: count(row.root_replies_count),
  };
}

/** §141–§145: commenti di altre identità creati dopo `since`; mai la lista, solo un conteggio. */
export async function fetchCommentUpdates(
  contentType: string,
  contentId: string,
  since: string,
): Promise<CommentUpdates> {
  const { data, error } = await supabase.rpc("fetch_comment_updates", {
    p_content_id: contentId,
    p_content_type: contentType,
    p_since: since,
  });

  if (error) {
    throw error;
  }

  const row = unwrapObject(data);

  return { commentsCount: count(row?.comments_count), newCount: count(row?.new_count) };
}
