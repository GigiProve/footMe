/**
 * Tipi del dominio Commenti e Risposte (HOM-08 §1–§3, §47–§53, §197).
 *
 * Un solo dominio per tutti i tipi di contenuto (§3): `content_comments`, legato
 * a `content_type` + `content_id`. Il commento appartiene a un'IDENTITÀ — persona,
 * Società o Media — mai all'utente (§29, §41); `acted_by` non arriva mai al client.
 *
 * Qui i tipi del client (camelCase). La forma snake_case delle RPC e il mapper
 * stanno in `comment-service.ts`.
 */

import type { FeedMention } from "../feed/feed-types";
import type {
  InteractionIdentityType,
  LikeIdentityRef,
} from "../interactions/interaction-types";

export type CommentIdentityType = InteractionIdentityType;

/** §90: `deleted` è il segnaposto «Commento eliminato», `unavailable` un root non visibile con risposte visibili. */
export type CommentStatus = "active" | "deleted" | "unavailable";

/** §117–§119: solo due ordinamenti. Il ranking lo calcola il server (§122). */
export type CommentSort = "relevant" | "recent";

/** Come `FeedAuthorMeta` + identità: la riga meta riusa i presentatori del Feed (§56–§60). */
export type CommentAuthor = {
  identityType: CommentIdentityType;
  identityId: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  role: string | null;
  clubName: string | null;
  teamLabel: string | null;
  clubCategory: string | null;
  mediaKind: string | null;
  primaryPosition: string | null;
};

/** Destinatario di una risposta (§49, §53): snapshot di identità e nome. */
export type CommentReplyTarget = {
  identityType: CommentIdentityType;
  identityId: string;
  name: string;
};

/** §112–§115: il link salvato dal server, offset UTF-16 (`end` escluso). Solo questi sono cliccabili. */
export type CommentLink = { url: string; start: number; end: number };

export type CommentMentionRef = FeedMention;

/** §197: il client mostra ciò che il server dice, non deduce permessi dal ruolo (§198). */
export type CommentCapabilities = {
  canEdit: boolean;
  canDelete: boolean;
  canReply: boolean;
  canLike: boolean;
  canOpenAuthor: boolean;
};

export type Comment = {
  id: string;
  contentType: string;
  contentId: string;
  /** = `id` per un root (§48). */
  rootCommentId: string;
  /** `null` per un root (§49, §53). */
  replyToCommentId: string | null;
  replyTo: CommentReplyTarget | null;
  status: CommentStatus;
  /** `null` per deleted/unavailable (§166). */
  author: CommentAuthor | null;
  /** §64: l'identità del commento coincide con l'autore del contenuto. */
  isContentAuthor: boolean;
  body: string;
  mentions: CommentMentionRef[];
  links: CommentLink[];
  likesCount: number;
  /** Identità del viewer che hanno messo Mi piace, per `likeStore` (HOM-07). */
  likedAs: LikeIdentityRef[];
  /** Risposte attive visibili (solo root). */
  repliesCount: number;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  version: number;
  capabilities: CommentCapabilities;
  /** Solo sui commenti dell'utente: riconciliazione dell'inserimento ottimistico (§94, §223). */
  operationKey: string | null;
};

export type CommentCursor = Record<string, unknown>;

export type CommentPage = {
  comments: Comment[];
  nextCursor: CommentCursor | null;
  /**
   * L'istante SERVER (`as_of`, uguale su ogni riga) a cui la pagina è letta: è il
   * watermark di «Nuovi commenti», mai l'orologio del dispositivo. `null` su una
   * pagina vuota (nessuna riga che lo porti): vale quello del contesto.
   */
  asOf: string | null;
};

/** Limiti da una sola source of truth: il server (§A3). */
export type CommentLimits = {
  maxBodyLength: number;
  maxMentions: number;
  maxLinks: number;
};

/** Identità con cui l'utente può commentare nel contesto (§34): le identità di interazione + `can_comment`. */
export type CommentIdentity = {
  type: CommentIdentityType;
  id: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  clubCategory: string | null;
  role: string | null;
  /** Gli stessi campi dell'`author` delle card: la riga meta ottimistica non «salta» alla riconciliazione. */
  clubName: string | null;
  teamLabel: string | null;
  mediaKind: string | null;
  primaryPosition: string | null;
  rank: number;
  canComment: boolean;
};

/** `existing_visibility` del §180: commenti ancora leggibili o nascosti con commenti disattivati. */
export type CommentContext = {
  /** Istante server del contesto: watermark di ripiego quando la prima pagina è vuota. */
  asOf: string | null;
  commentsCount: number;
  commentsEnabled: boolean;
  /** `false` = commenti nascosti (disattivati con visibilità 'hidden', §180). */
  commentsVisible: boolean;
  contentAuthor: { identityType: CommentIdentityType; identityId: string } | null;
  limits: CommentLimits;
  identities: CommentIdentity[];
};

export type CreateCommentResult = {
  comment: Comment;
  commentsCount: number;
  rootRepliesCount: number;
};

export type DeleteCommentResult = {
  outcome: "removed" | "tombstoned";
  commentId: string;
  rootCommentId: string;
  commentsCount: number;
  rootRepliesCount: number;
};

export type CommentUpdates = { newCount: number; commentsCount: number };

/**
 * Codici errore delle RPC (contratto A5), già ridotti a ciò che l'interfaccia
 * distingue. `network` copre ogni errore di trasporto e ogni errore ignoto: tutti
 * ammettono «Riprova».
 */
export type CommentErrorKind =
  | "content_unavailable"
  | "comment_unavailable"
  | "target_unavailable"
  | "identity_forbidden"
  | "comments_disabled"
  | "invalid_body"
  | "too_long"
  | "invalid_mention"
  | "operation_conflict"
  | "forbidden"
  | "version_conflict"
  | "network";

/** Stato di invio di un elemento ottimistico (§92–§101). */
export type CommentSendState = "sending" | "failed";

/** Ciò che serve per rispedire un commento fallito con la STESSA chiave (§99, §101). */
export type CommentSendRecord = {
  state: CommentSendState;
  operationKey: string;
  /** `null` = commento principale. */
  replyToCommentId: string | null;
  rootCommentId: string | null;
  identity: { type: CommentIdentityType; id: string };
  body: string;
  mentions: CommentMentionRef[];
  links: CommentLink[];
  failure: CommentErrorKind | null;
};

/** Un commento nello store: il dominio più, per gli elementi ottimistici, lo stato di invio. */
export type CommentEntity = Comment & {
  send: CommentSendRecord | null;
};

/** Come una lista identifica una riga: `key` resta stabile alla riconciliazione, `id` no (§94). */
export type CommentRef = { key: string; id: string };
