/**
 * Derivazioni pure dei Commenti (HOM-08 §24–§25, §30–§34, §52, §55–§66, §81–§85,
 * §112–§115, §132–§134, §146–§147, §157, §171–§174, §228–§229, §232).
 *
 * Tutto ciò che si può calcolare senza renderizzare vive qui, così è testabile
 * senza schermo: riga meta («Allenatore · AC Como · 2 h», «Società · Serie D · 1 h»,
 * «Media · 30 min»), segmenti del testo (testo | mention | link), pubblicabilità,
 * contatore, elemento ottimistico, azioni del menu •••, label per lo screen reader.
 *
 * Riusa, senza duplicarli, i presentatori già in uso: `authorMetaParts` (ruolo e
 * Società; «Procuratore» e mai «Agente», §59), `segmentBody` (mention valide),
 * `formatCompactRelativeTime`, `extractUrls` / `isLinkTargetEligible` (HOM-06.1).
 */

import { formatCompactRelativeTime, formatSpokenRelativeTime } from "../../lib/relative-time";
import { authorMetaParts, segmentBody } from "../feed/feed-post-presentation";
import type { FeedAuthorMeta } from "../feed/feed-types";
import { unfollowLabel } from "../following/follow-source";
import {
  REPORTED_ACTION_A11Y_LABEL,
  REPORTED_ACTION_LABEL,
  REPORT_ACTION_LABEL,
  reportTargetKey,
} from "../moderation/moderation-presentation";
import {
  defaultIdentity,
  extractUrls,
  hasMeaningfulText,
  isLinkTargetEligible,
} from "../post-composer/composer-presentation";
import type { ComposerIdentity } from "../post-composer/composer-types";
import {
  COMMENT_ACTION_DELETE,
  COMMENT_ACTION_EDIT,
  COMMENT_AUTHOR_LABEL,
  COMMENT_CONTEXT_MEDIA,
  COMMENT_CONTEXT_PERSON,
  COMMENT_CONTEXT_SOCIETY,
  COMMENT_DELETED,
  COMMENT_EDITED_LABEL,
  COMMENT_UNAVAILABLE,
  COMMENT_PERMISSION_LOST,
  COMMENT_TARGET_UNAVAILABLE,
  COMMENTS_DISABLED,
  COMMENT_CONTENT_UNAVAILABLE,
  COMMENT_TOO_LONG,
  COMMENT_INVALID_BODY,
  COMMENT_INVALID_MENTION,
  COMMENT_PUBLISH_ERROR,
  COMMENT_EDIT_CONFLICT,
  COMMENT_EDIT_ERROR,
  COMMENT_EDIT_FORBIDDEN,
  COMMENT_LIKE_ZERO,
  COMMENT_REPLIES_MORE,
  COMMENT_REPLY,
  COMMENT_REPLYING_TO,
  COMMENTS_SORT_RECENT,
  COMMENTS_SORT_RELEVANT,
  commentRepliesLabel,
} from "./comment-labels";
import { tempCommentId } from "./comment-operation-key";
import type { CommentFailureReason } from "./comment-analytics";
import type {
  Comment,
  CommentAuthor,
  CommentEntity,
  CommentErrorKind,
  CommentIdentity,
  CommentIdentityType,
  CommentLimits,
  CommentLink,
  CommentMentionRef,
  CommentRef,
  CommentSendRecord,
  CommentSort,
} from "./comment-types";

/* ------------------------------------------------------------------ */
/* Riga meta (§55–§61)                                                 */
/* ------------------------------------------------------------------ */

function metaOf(author: CommentAuthor): FeedAuthorMeta {
  return {
    clubCategory: author.clubCategory,
    clubName: author.clubName,
    mediaKind: author.mediaKind,
    primaryPosition: author.primaryPosition,
    role: author.role,
    teamLabel: author.teamLabel,
  };
}

/**
 * Le parti della riga SENZA tempo. Persona: ruolo + Società («Allenatore · AC
 * Como»), mai follower, città, carriera (§61). Società: «Società · Serie D».
 * Media: «Media». Mai «Profilo ufficiale» (§63).
 */
export function commentMetaParts(author: CommentAuthor): string[] {
  switch (author.identityType) {
    case "society":
      return [COMMENT_CONTEXT_SOCIETY, ...authorMetaParts("society", metaOf(author))];
    case "media":
      return [COMMENT_CONTEXT_MEDIA];
    default:
      return authorMetaParts("person", metaOf(author));
  }
}

/** «Allenatore · AC Como · 2 h» / «… · 2 h · Modificato» (§157). */
export function commentMetaLine(
  comment: Pick<Comment, "author" | "createdAt" | "editedAt">,
  now?: Date,
): string {
  // Spazio unificatore: con testo grande la riga va a capo, ma mai fra «2» e «h».
  const time = formatCompactRelativeTime(comment.createdAt, now).replace(/ /g, " ");
  const parts = [...(comment.author ? commentMetaParts(comment.author) : []), time];

  if (comment.editedAt) {
    parts.push(COMMENT_EDITED_LABEL);
  }

  return parts.filter(Boolean).join(" · ");
}

/* ------------------------------------------------------------------ */
/* Testo: mention e link (§108–§115, §232)                              */
/* ------------------------------------------------------------------ */

export type CommentBodySegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; mention: CommentMentionRef }
  | { kind: "link"; text: string; url: string };

const URL_DISPLAY_MAX = 36;

/**
 * §114: troncamento VISIVO di un URL lungo, con ellissi al centro; il target
 * resta l'URL intero (§115). Un URL corto non cambia.
 */
export function truncateUrlMiddle(url: string, max: number = URL_DISPLAY_MAX): string {
  const display = url.replace(/^https?:\/\//i, "");

  if (display.length <= max) {
    return display;
  }

  const keep = max - 1;
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;

  return `${display.slice(0, head)}…${display.slice(display.length - tail)}`;
}

function usableLinks(body: string, links: readonly CommentLink[]): CommentLink[] {
  return links
    .filter(
      (link) =>
        Number.isInteger(link.start) &&
        Number.isInteger(link.end) &&
        link.start >= 0 &&
        link.end > link.start &&
        link.end <= body.length &&
        link.url.length > 0,
    )
    .sort((a, b) => a.start - b.start);
}

/**
 * Segmenti del corpo: testo, mention (da `segmentBody`, range validati) e link.
 * Sono cliccabili SOLO i `links` salvati dal server (§112, §115): un URL scritto
 * ma non restituito resta testo. Un link che si sovrappone a una mention o a un
 * altro link è ignorato; il testo resta intero e leggibile.
 */
export function segmentCommentBody(
  body: string,
  mentions: readonly CommentMentionRef[],
  links: readonly CommentLink[],
): CommentBodySegment[] {
  const base = segmentBody(body, mentions);
  const candidates = usableLinks(body, links);
  const out: CommentBodySegment[] = [];
  let offset = 0;

  for (const segment of base) {
    const segmentStart = offset;
    const segmentEnd = offset + segment.text.length;
    offset = segmentEnd;

    if (segment.kind === "mention") {
      out.push(segment);
      continue;
    }

    let cursor = segmentStart;
    for (const link of candidates) {
      if (link.start < cursor || link.end > segmentEnd) {
        continue;
      }
      if (link.start > cursor) {
        out.push({ kind: "text", text: body.slice(cursor, link.start) });
      }
      out.push({ kind: "link", text: truncateUrlMiddle(body.slice(link.start, link.end)), url: link.url });
      cursor = link.end;
    }
    if (cursor < segmentEnd) {
      out.push({ kind: "text", text: body.slice(cursor, segmentEnd) });
    }
  }

  return out;
}

/**
 * I link da mandare al server (§112, §115): gli URL https idonei del testo, nel
 * limite. Il server li rivalida e scarta i non idonei senza errore (A3). Nessuna
 * anteprima (§113): `links` è solo un elenco di intervalli.
 */
export function extractCommentLinks(body: string, maxLinks: number): CommentLink[] {
  return extractUrls(body)
    .filter((match) => isLinkTargetEligible(match.normalized))
    .slice(0, maxLinks)
    .map((match) => ({ end: match.end, start: match.start, url: match.raw }));
}

/** Le mention ancora valide per il testo attuale, nel limite, in forma di invio. */
export function commentMentionsForSubmit(
  body: string,
  mentions: readonly CommentMentionRef[],
  maxMentions: number,
): CommentMentionRef[] {
  return mentions
    .filter((mention) => mention.end <= body.length && body.slice(mention.start, mention.end) === `@${mention.displayName}`)
    .slice(0, maxMentions);
}

/** Una mention inserita da una persona/Società autore: `profile` per persone e Media, `club` per Società. */
export function mentionFromAuthor(
  author: Pick<CommentAuthor, "identityType" | "identityId" | "name">,
  start = 0,
): CommentMentionRef {
  return {
    displayName: author.name,
    end: start + 1 + author.name.length,
    identityId: author.identityId,
    identityType: author.identityType === "society" ? "club" : "profile",
    start,
  };
}

/**
 * §84–§85: «Rispondi a X» può inserire «@X » come mention strutturata. Solo a testo
 * vuoto — non si scrive sopra a ciò che l'utente ha già digitato — e mai verso sé
 * stessi. `null` = nessuna mention automatica.
 */
export function replyMentionPrefix(
  target: Pick<CommentAuthor, "identityType" | "identityId" | "name">,
  options: { currentBody: string; self: { type: CommentIdentityType; id: string } | null; maxBodyLength: number },
): { body: string; mentions: CommentMentionRef[] } | null {
  if (options.currentBody.length > 0 || target.name.length === 0) {
    return null;
  }
  if (options.self && options.self.type === target.identityType && options.self.id === target.identityId) {
    return null;
  }

  const body = `@${target.name} `;

  return body.length > options.maxBodyLength ? null : { body, mentions: [mentionFromAuthor(target)] };
}

/** «Più rilevanti» / «Più recenti» (§117–§118): le uniche due opzioni, mai altri filtri (§119). */
export function sortLabel(sort: CommentSort): string {
  return sort === "recent" ? COMMENTS_SORT_RECENT : COMMENTS_SORT_RELEVANT;
}

/** §233: lo screen reader annuncia l'opzione scelta. */
export function sortSelectionAnnouncement(sort: CommentSort): string {
  return `Ordinamento: ${sortLabel(sort)}`;
}

/* ------------------------------------------------------------------ */
/* Pubblicabilità e contatore (§24–§25, §46)                           */
/* ------------------------------------------------------------------ */

/** §24: vuoto o fatto di sole mention/spazi → Pubblica disabled. */
export function isCommentMeaningful(body: string, mentions: readonly CommentMentionRef[]): boolean {
  // `CommentMentionRef` (= `FeedMention`) e `ComposerMention` hanno la stessa forma.
  return hasMeaningfulText({ body, mentions: [...mentions] });
}

/** «3/1000» (mockup 3). */
export function commentCounter(length: number, max: number): string {
  return `${length}/${max}`;
}

export function isOverLimit(length: number, max: number): boolean {
  return length > max;
}

export type PublishBlock =
  | "no_identity"
  | "identity_lost"
  | "empty"
  | "too_long"
  | "disabled"
  | "unavailable"
  | "busy";

/**
 * Perché Pubblica è disabilitato, o `null`. Mai cancella niente (§44, §46): il
 * testo resta e dice solo «non ora».
 */
export function publishBlockReason(input: {
  body: string;
  mentions: readonly CommentMentionRef[];
  limits: CommentLimits;
  hasIdentity: boolean;
  identityLost: boolean;
  commentsEnabled: boolean;
  contentAvailable: boolean;
  isSending: boolean;
}): PublishBlock | null {
  if (!input.contentAvailable) {
    return "unavailable";
  }
  if (!input.commentsEnabled) {
    return "disabled";
  }
  if (input.isSending) {
    return "busy";
  }
  if (!input.hasIdentity) {
    return "no_identity";
  }
  if (input.identityLost) {
    return "identity_lost";
  }
  if (isOverLimit(input.body.length, input.limits.maxBodyLength)) {
    return "too_long";
  }
  if (!isCommentMeaningful(input.body, input.mentions)) {
    return "empty";
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Identità (§30–§46)                                                  */
/* ------------------------------------------------------------------ */

/** «Profilo personale» / «Società · Serie D» / «Media» (§32, mockup 4). */
export function commentIdentityContextLabel(identity: Pick<CommentIdentity, "type" | "clubCategory">): string {
  switch (identity.type) {
    case "society":
      return identity.clubCategory
        ? `${COMMENT_CONTEXT_SOCIETY} · ${identity.clubCategory}`
        : COMMENT_CONTEXT_SOCIETY;
    case "media":
      return COMMENT_CONTEXT_MEDIA;
    default:
      return COMMENT_CONTEXT_PERSON;
  }
}

/** La stessa card del composer Post, per riusare `PublishAsSheet` (§32). */
export function toComposerIdentity(identity: CommentIdentity): ComposerIdentity {
  return {
    avatarUrl: identity.avatarUrl,
    canSchedule: false,
    contextLabel: commentIdentityContextLabel(identity),
    id: identity.id,
    isVerified: identity.isVerified,
    name: identity.name,
    type: identity.type,
  };
}

/** §34: solo le identità con `can_comment` nel contesto corrente. */
export function commentableIdentities(identities: readonly CommentIdentity[]): CommentIdentity[] {
  return identities.filter((identity) => identity.canComment);
}

function sameIdentity(
  a: Pick<CommentIdentity, "type" | "id"> | null,
  b: Pick<CommentIdentity, "type" | "id"> | null,
): boolean {
  return a !== null && b !== null && a.type === b.type && a.id === b.id;
}

/**
 * §35–§39: l'identità di partenza è la PERSONA (poi il Media, poi la prima), con
 * la regola `defaultIdentity` del composer Post — nessuna scelta a ogni commento.
 */
export function defaultCommentIdentity(available: readonly CommentIdentity[]): CommentIdentity | null {
  const chosen = defaultIdentity("CONTENT_DETAIL", available.map(toComposerIdentity), null);

  return chosen ? (available.find((identity) => sameIdentity(identity, chosen)) ?? null) : null;
}

export type ResolvedCommentIdentity = {
  identity: CommentIdentity | null;
  /** §43: l'identità scelta non può più commentare; il testo resta, Pubblica no. */
  lost: boolean;
};

/**
 * L'identità mostrata nel composer. Quella scelta vale finché esiste; se non è più
 * fra le autorizzate resta mostrata ma `lost` (§43–§45): niente cambio silenzioso.
 */
export function resolveCommentIdentity(
  available: readonly CommentIdentity[],
  chosen: CommentIdentity | null,
): ResolvedCommentIdentity {
  if (chosen) {
    const current = available.find((identity) => sameIdentity(identity, chosen));
    return current ? { identity: current, lost: false } : { identity: chosen, lost: true };
  }

  return { identity: defaultCommentIdentity(available), lost: false };
}

/** §30–§31: nessun selettore con una sola identità; con identità persa si può passare a un'altra. */
export function hasCommentIdentityChoice(
  available: readonly CommentIdentity[],
  resolved: ResolvedCommentIdentity,
): boolean {
  return available.length > 1 || (resolved.lost && available.length > 0);
}

/* ------------------------------------------------------------------ */
/* Errori → copy e analytics (§43, §98, §158–§159, §193)               */
/* ------------------------------------------------------------------ */

/** La copy di un invio fallito (§43, §189, §193); un guasto di rete cade sul messaggio generico. */
export function publishErrorCopy(kind: CommentErrorKind): string {
  switch (kind) {
    case "identity_forbidden":
      return COMMENT_PERMISSION_LOST;
    case "target_unavailable":
    case "comment_unavailable":
      return COMMENT_TARGET_UNAVAILABLE;
    case "content_unavailable":
      return COMMENT_CONTENT_UNAVAILABLE;
    case "comments_disabled":
      return COMMENTS_DISABLED;
    case "too_long":
      return COMMENT_TOO_LONG;
    case "invalid_body":
      return COMMENT_INVALID_BODY;
    case "invalid_mention":
      return COMMENT_INVALID_MENTION;
    default:
      return COMMENT_PUBLISH_ERROR;
  }
}

export function editErrorCopy(kind: CommentErrorKind): string {
  switch (kind) {
    case "version_conflict":
      return COMMENT_EDIT_CONFLICT;
    case "forbidden":
    case "identity_forbidden":
      return COMMENT_EDIT_FORBIDDEN;
    case "comment_unavailable":
    case "target_unavailable":
      return COMMENT_TARGET_UNAVAILABLE;
    case "content_unavailable":
      return COMMENT_CONTENT_UNAVAILABLE;
    case "comments_disabled":
      return COMMENTS_DISABLED;
    case "too_long":
      return COMMENT_TOO_LONG;
    case "invalid_body":
      return COMMENT_INVALID_BODY;
    case "invalid_mention":
      return COMMENT_INVALID_MENTION;
    default:
      return COMMENT_EDIT_ERROR;
  }
}

export function failureReasonOf(kind: CommentErrorKind): CommentFailureReason {
  switch (kind) {
    case "content_unavailable":
    case "comment_unavailable":
      return "unavailable";
    case "target_unavailable":
      return "target_unavailable";
    case "identity_forbidden":
    case "forbidden":
      return "permission";
    case "comments_disabled":
      return "disabled";
    case "too_long":
    case "invalid_body":
    case "invalid_mention":
    case "operation_conflict":
    case "version_conflict":
      return "invalid";
    default:
      return "network";
  }
}

/* ------------------------------------------------------------------ */
/* Elemento ottimistico (§92–§95)                                      */
/* ------------------------------------------------------------------ */

export function authorFromIdentity(identity: CommentIdentity): CommentAuthor {
  return {
    avatarUrl: identity.avatarUrl,
    clubCategory: identity.clubCategory,
    clubName: identity.clubName,
    identityId: identity.id,
    identityType: identity.type,
    isVerified: identity.isVerified,
    mediaKind: identity.mediaKind,
    name: identity.name,
    primaryPosition: identity.primaryPosition,
    role: identity.role,
    teamLabel: identity.teamLabel,
  };
}

/**
 * Un invio fallito torna al composer (§44, §101, §191): l'identità con cui era
 * partito si ricostruisce dalla card dell'elemento ottimistico. Se non è più fra le
 * autorizzate, `resolveCommentIdentity` la segna `lost` e il testo resta.
 */
export function identityFromAuthor(author: CommentAuthor): CommentIdentity {
  return {
    avatarUrl: author.avatarUrl,
    canComment: true,
    clubCategory: author.clubCategory,
    clubName: author.clubName,
    id: author.identityId,
    isVerified: author.isVerified,
    mediaKind: author.mediaKind,
    name: author.name,
    primaryPosition: author.primaryPosition,
    rank: 0,
    role: author.role,
    teamLabel: author.teamLabel,
    type: author.identityType,
  };
}

export type OptimisticInput = {
  operationKey: string;
  contentType: string;
  contentId: string;
  identity: CommentIdentity;
  body: string;
  mentions: CommentMentionRef[];
  links: CommentLink[];
  /** Il commento a cui si risponde; `null` = commento principale. */
  replyTo: {
    id: string;
    rootCommentId: string;
    author: Pick<CommentAuthor, "identityType" | "identityId" | "name"> | null;
  } | null;
  contentAuthor: { identityType: CommentIdentityType; identityId: string } | null;
  now?: Date;
};

/**
 * §92–§93: l'elemento che compare SUBITO, con id temporaneo derivato dalla chiave e
 * data «adesso». Nessuna capability finché il server non lo riconcilia (§94).
 */
export function buildOptimisticComment(input: OptimisticInput): CommentEntity {
  const id = tempCommentId(input.operationKey);
  const createdAt = (input.now ?? new Date()).toISOString();
  const target = input.replyTo;
  const send: CommentSendRecord = {
    body: input.body,
    failure: null,
    identity: { id: input.identity.id, type: input.identity.type },
    links: input.links,
    mentions: input.mentions,
    operationKey: input.operationKey,
    replyToCommentId: target?.id ?? null,
    rootCommentId: target?.rootCommentId ?? null,
    state: "sending",
  };

  return {
    author: authorFromIdentity(input.identity),
    body: input.body,
    capabilities: { canDelete: false, canEdit: false, canLike: false, canOpenAuthor: false, canReply: false },
    contentId: input.contentId,
    contentType: input.contentType,
    createdAt,
    editedAt: null,
    id,
    isContentAuthor:
      input.contentAuthor !== null &&
      input.contentAuthor.identityType === input.identity.type &&
      input.contentAuthor.identityId === input.identity.id,
    likedAs: [],
    likesCount: 0,
    links: input.links,
    mentions: input.mentions,
    operationKey: input.operationKey,
    repliesCount: 0,
    replyTo:
      target?.author
        ? {
            identityId: target.author.identityId,
            identityType: target.author.identityType,
            name: target.author.name,
          }
        : null,
    replyToCommentId: target?.id ?? null,
    rootCommentId: target?.rootCommentId ?? id,
    send,
    status: "active",
    updatedAt: createdAt,
    version: 1,
  };
}

/* ------------------------------------------------------------------ */
/* Thread (§132–§138)                                                  */
/* ------------------------------------------------------------------ */

export type RepliesToggleModel =
  | { kind: "none" }
  | { kind: "expand"; label: string }
  | { kind: "more"; label: string };

/**
 * §132–§134: «Visualizza N risposte» a thread chiuso; a thread aperto con altre
 * risposte da caricare, «Visualizza altre risposte». Nessun auto-load (§136).
 */
export function repliesToggleModel(input: {
  repliesCount: number;
  expanded: boolean;
  hasMore: boolean;
}): RepliesToggleModel {
  if (input.repliesCount <= 0) {
    return { kind: "none" };
  }
  if (!input.expanded) {
    return { kind: "expand", label: commentRepliesLabel(input.repliesCount) };
  }

  return input.hasMore ? { kind: "more", label: COMMENT_REPLIES_MORE } : { kind: "none" };
}

/**
 * Le righe dei commenti principali: prima i MIEI appena pubblicati (il più recente
 * per primo, qualunque ordinamento), poi quelli del server nell'ordine ricevuto.
 * Nessun id doppio fra pagine, fra proprio e server (§222–§223); i rimossi non si
 * mostrano.
 */
export function mergeRootRefs(input: {
  own: readonly CommentRef[];
  pageIds: readonly string[];
  isRemoved: (id: string) => boolean;
}): CommentRef[] {
  return mergeRefs(input.own, input.pageIds, input.isRemoved);
}

/** Le risposte di un thread: prima quelle del server (vecchia → recente), poi le mie in coda (§126). */
export function mergeReplyRefs(input: {
  own: readonly CommentRef[];
  pageIds: readonly string[];
  isRemoved: (id: string) => boolean;
}): CommentRef[] {
  // Una mia risposta già riconciliata che il server restituisce nella sua posizione
  // cronologica tiene la chiave React di quando era ottimistica: nessun rimontaggio.
  const ownKeys = new Map(input.own.map((ref) => [ref.id, ref.key]));
  const server = mergeRefs([], input.pageIds, input.isRemoved).map((ref) => ({
    id: ref.id,
    key: ownKeys.get(ref.id) ?? ref.key,
  }));
  const taken = new Set(server.map((ref) => ref.id));

  return [...server, ...input.own.filter((ref) => !taken.has(ref.id) && !input.isRemoved(ref.id))];
}

function mergeRefs(
  own: readonly CommentRef[],
  pageIds: readonly string[],
  isRemoved: (id: string) => boolean,
): CommentRef[] {
  const seen = new Set<string>();
  const out: CommentRef[] = [];

  for (const ref of own) {
    if (!seen.has(ref.id) && !isRemoved(ref.id)) {
      seen.add(ref.id);
      out.push(ref);
    }
  }
  for (const id of pageIds) {
    if (!seen.has(id) && !isRemoved(id)) {
      seen.add(id);
      out.push({ id, key: id });
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Menu ••• (§146–§147, §171–§174)                                      */
/* ------------------------------------------------------------------ */

export type CommentActionId = "edit" | "delete" | "unfollow" | "report" | "reported";

export type CommentActionItem = {
  id: CommentActionId;
  label: string;
  icon:
    | "create-outline"
    | "trash-outline"
    | "person-remove-outline"
    | "flag-outline"
    | "checkmark-circle-outline";
  destructive: boolean;
  dividerBefore: boolean;
  /** HOM-11 D6, §130: «Segnalazione inviata ✓» non è azionabile. */
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Le azioni del menu di UN commento dalle capability del server (§197–§198).
 *
 * Il proprio commento (o gestito): Modifica / Elimina, invariato (HOM-08 §146, HOM-11 §73) —
 * mai Segnala né Non seguire sul proprio. Il commento altrui (HOM-11 §69–§72, §132):
 *  • «Non seguire <autore>» solo se il viewer segue davvero l'identità autrice (§54),
 *    mai «Segui» al suo posto (§56);
 *  • «Segnala» — o «Segnalazione inviata ✓» non azionabile se già segnalato (§130) —
 *    se `canReport`, dopo un divisore, in rosso con la bandierina (§201);
 *  • mai «Non mi interessa» (§71), mai Salva (§72), né Copia link o Fissa (HOM-08 §147).
 * Senza azioni `[]` → nessun •••. `commentActionContext` porta il contesto al flow.
 */
export function buildCommentActions(
  comment: Pick<Comment, "status" | "capabilities"> &
    Partial<Pick<Comment, "author" | "viewerFollowsAuthor" | "viewerHasReported">>,
  options: {
    isSending?: boolean;
    /** «Non seguire» appena fatto: vale prima che il refetch porti il dato del server (§62). */
    unfollowedInSession?: boolean;
    /** «Segnala» appena inviato (§126): vale prima del refetch. */
    reportedInSession?: boolean;
  } = {},
): CommentActionItem[] {
  if (comment.status !== "active" || options.isSending) {
    return [];
  }

  const actions: CommentActionItem[] = [];
  if (comment.capabilities.canEdit) {
    actions.push({
      destructive: false,
      dividerBefore: false,
      icon: "create-outline",
      id: "edit",
      label: COMMENT_ACTION_EDIT,
    });
  }
  if (comment.capabilities.canDelete) {
    actions.push({
      destructive: true,
      dividerBefore: actions.length > 0,
      icon: "trash-outline",
      id: "delete",
      label: COMMENT_ACTION_DELETE,
    });
  }

  // §73: il proprio commento resta quello di HOM-08, senza voci HOM-11.
  if (comment.capabilities.canEdit || comment.capabilities.canDelete) {
    return actions;
  }

  if (comment.viewerFollowsAuthor === true && !options.unfollowedInSession && comment.author) {
    actions.push({
      destructive: false,
      dividerBefore: false,
      icon: "person-remove-outline",
      id: "unfollow",
      label: unfollowLabel(comment.author.name),
    });
  }

  if (comment.viewerHasReported === true || options.reportedInSession) {
    actions.push({
      accessibilityLabel: REPORTED_ACTION_A11Y_LABEL,
      destructive: false,
      disabled: true,
      dividerBefore: actions.length > 0,
      icon: "checkmark-circle-outline",
      id: "reported",
      label: REPORTED_ACTION_LABEL,
    });
  } else if (comment.capabilities.canReport === true) {
    actions.push({
      accessibilityHint: "Apre la segnalazione",
      destructive: true,
      dividerBefore: actions.length > 0,
      icon: "flag-outline",
      id: "report",
      label: REPORT_ACTION_LABEL,
    });
  }

  return actions;
}

/**
 * HOM-11 §134–§140: il commento va ripiegato in «Commento segnalato» se il viewer lo ha
 * segnalato (payload o sessione). Solo i commenti attivi: un segnaposto è già ripiegato.
 * Le risposte non seguono il padre (§136–§139): ognuna decide per sé.
 */
export function isCommentCollapsed(
  comment: Pick<Comment, "status" | "viewerHasReported">,
  reportedInSession: boolean,
): boolean {
  return comment.status === "active" && (comment.viewerHasReported === true || reportedInSession);
}

/** La chiave del commento nello store dei segnalati: un commento si identifica per id (§104). */
export function commentReportKey(commentId: string): string {
  return reportTargetKey({ contentType: "comment", targetId: commentId, targetType: "COMMENT" });
}

/** §174: ciò che il sistema di azioni contestuali (HOM-11) riceve per un commento. */
export type CommentActionContext = {
  targetType: "COMMENT";
  commentId: string;
  contentType: string;
  contentId: string;
  authorIdentityId: string | null;
  authorIdentityType: CommentIdentityType | null;
  viewerId: string;
};

export function commentActionContext(
  comment: Pick<Comment, "id" | "contentType" | "contentId" | "author">,
  viewerId: string,
): CommentActionContext {
  return {
    authorIdentityId: comment.author?.identityId ?? null,
    authorIdentityType: comment.author?.identityType ?? null,
    commentId: comment.id,
    contentId: comment.contentId,
    contentType: comment.contentType,
    targetType: "COMMENT",
    viewerId,
  };
}

/* ------------------------------------------------------------------ */
/* Accessibilità (§228–§233)                                           */
/* ------------------------------------------------------------------ */

export function placeholderLabel(status: Comment["status"]): string {
  return status === "deleted" ? COMMENT_DELETED : COMMENT_UNAVAILABLE;
}

type AccessibleComment = Pick<
  Comment,
  "author" | "body" | "createdAt" | "editedAt" | "isContentAuthor" | "replyTo" | "replyToCommentId"
>;

/**
 * §228–§229: chi parla, in quale contesto, quando; una risposta si annuncia «risposta
 * a …» senza basarsi sull'indentazione. Nessun «ufficiale» (§63). È l'etichetta
 * dell'intestazione: testo e azioni della riga restano elementi propri (le mention
 * devono restare raggiungibili come link, §232).
 */
export function commentAuthorAccessibilityLabel(comment: AccessibleComment, now?: Date): string {
  const author = comment.author;
  const spoken = formatSpokenRelativeTime(comment.createdAt, now);

  return [
    author?.name,
    author?.isVerified ? "profilo verificato" : null,
    comment.isContentAuthor ? COMMENT_AUTHOR_LABEL.toLowerCase() : null,
    author ? commentMetaParts(author).join(" ") : null,
    comment.replyToCommentId
      ? comment.replyTo?.name
        ? `risposta a ${comment.replyTo.name}`
        : "risposta"
      : null,
    spoken ? `pubblicato ${spoken}` : null,
    comment.editedAt ? COMMENT_EDITED_LABEL.toLowerCase() : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

/** La frase intera — autore, contesto, tempo, testo e stato del Mi piace (§228). */
export function commentAccessibilityLabel(
  comment: AccessibleComment,
  options: { isLiked: boolean; likesCount: number; now?: Date },
): string {
  const likes =
    options.likesCount > 0
      ? `${options.likesCount} Mi piace${options.isLiked ? ", messo da te" : ""}`
      : COMMENT_LIKE_ZERO;

  return [
    commentAuthorAccessibilityLabel(comment, options.now),
    comment.body.length > 0 ? comment.body : null,
    likes,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

/** «Rispondi a Marco Bianchi»: l'azione dice a chi (§228). */
export function replyAccessibilityLabel(author: Pick<CommentAuthor, "name"> | null): string {
  return author?.name ? `${COMMENT_REPLYING_TO} ${author.name}` : COMMENT_REPLY;
}

/** La destinazione del profilo dell'autore o dell'identità menzionata (nessun tap su profili inesistenti, §196). */
export function authorHref(author: Pick<CommentAuthor, "identityType" | "identityId">): string {
  return author.identityType === "society" ? `/club/${author.identityId}` : `/profile/${author.identityId}`;
}
