/**
 * Derivazioni pure della Condivisione (HOM-09): preview, copy, etichette,
 * righe destinatario, payload per lo share sheet di sistema.
 *
 * Tutto ciò che si calcola dai dati sta qui e non nei componenti, così le
 * regole si testano senza renderizzare (CLAUDE.md: `-presentation.ts`).
 *
 * Decisioni centrali:
 *  • la preview è un riconoscimento, non una riproduzione (§13): autore,
 *    verifica, excerpt breve, thumbnail se c'è. Mai un placeholder per i campi
 *    assenti (§16, §18); per il Video una thumbnail mancante lascia il tile con
 *    il Play, perché senza il Play il formato non si legge (§19).
 *  • le righe destinatario hanno una sola riga di metadata (§59, §62–§64) e il
 *    ruolo passa da `formatRole`: «Procuratore», mai «Agente» (§61).
 *  • lo stato non selezionabile dice «Non disponibile per i messaggi» (§57):
 *    mai un nome di capability o un codice (§58, §217).
 *  • il payload esterno è un breve testo più l'URL canonico (§165–§170): mai il
 *    body intero, mai un file media, mai un identificativo grezzo (§171).
 */

import { formatCount } from "../../lib/format-count";
import { CONTENT_UNAVAILABLE_BODY, CONTENT_UNAVAILABLE_TITLE } from "../feed/content-availability-presentation";
import {
  authorMetaParts,
  formatPostVideoDuration,
  mediaImageUri,
  orderMedia,
  postBodyText,
  spokenVideoDuration,
} from "../feed/feed-post-presentation";
import { articleCoverUri, EDITORIAL_KIND_LABELS } from "../feed/feed-video-presentation";
import type {
  FeedAuthorMeta,
  FeedContentItem,
  FeedIdentityType,
} from "../feed/feed-types";
import type { InboxConversation } from "../messaging/messaging-service";
import { formatRole } from "../profiles/profile-display-helpers";
import {
  isShareContentType,
  type ContentReferenceView,
  type ShareItemKind,
  type SharePreview,
  type ShareRecipient,
  type ShareRecipientKind,
  type ShareTarget,
} from "./share-types";

// ────────────────────────────────────────────────────────────────
// Copy (§75, §76, §86, §130–§139, §155, §213)
// ────────────────────────────────────────────────────────────────

export const SHARE_COPY = {
  accessibilityShare: "Condividi contenuto",
  back: "Torna indietro",
  close: "Chiudi",
  copyLink: "Copia link",
  copyLinkDone: "Link copiato",
  copyLinkFailed: "Non è stato possibile copiare il link.",
  externalShare: "Condividi tramite…",
  externalShareFailed: "Non è stato possibile aprire la condivisione.",
  helperMultiSend: "Il contenuto verrà inviato separatamente a ogni conversazione.",
  messageLabel: "Aggiungi un messaggio…",
  messageOptionalHint: "Facoltativo",
  more: "Altro",
  moreAccessibility: "Altri destinatari",
  noResultsBody: "Prova con un altro nome.",
  noResultsTitle: "Nessun risultato",
  recipientsTitle: "Invia a",
  retry: "Riprova",
  searchError: "Non è stato possibile completare la ricerca.",
  searchPlaceholder: "Cerca persone, società o conversazioni",
  selectionLimit: "Puoi selezionare fino a 20 conversazioni.",
  sendFailed: "Invio non riuscito",
  sendOnProlink: "Invia su PROLINK",
  sentOne: "Inviato",
  sharedContentPreview: "Contenuto condiviso",
  stepTitle: "Condividi",
  unavailableBody: CONTENT_UNAVAILABLE_BODY,
  unavailableRecipient: "Non disponibile per i messaggi",
  unavailableTitle: CONTENT_UNAVAILABLE_TITLE,
} as const;

/** §87–§90: il normale limite dei messaggi, con contatore «0/500». */
export const SHARE_TEXT_MAX = 500;

/** Lo stesso massimo di destinazioni che accetta `send_content_share`. */
export const SHARE_MAX_DESTINATIONS = 20;

/** §31: pochi elementi leggibili, mai decine di avatar compressi. */
export const SHARE_RECENTS_MAX = 8;

/** §74, §222: la ricerca parte dal secondo carattere, come il resto di Cerca. */
export const SHARE_SEARCH_MIN_LENGTH = 2;

export function clampShareText(text: string): string {
  return text.length > SHARE_TEXT_MAX ? text.slice(0, SHARE_TEXT_MAX) : text;
}

export function shareTextCounter(text: string): string {
  return `${text.length}/${SHARE_TEXT_MAX}`;
}

// ────────────────────────────────────────────────────────────────
// Testo breve
// ────────────────────────────────────────────────────────────────

/** Excerpt della preview: una riga di testo, mai il body intero (§13, §169). */
export const SHARE_EXCERPT_MAX = 120;

/** Spazi collassati e taglio sui punti di codice, così non si spezza una emoji. */
export function shortText(value: string | null | undefined, max: number): string | null {
  const collapsed = value?.replace(/\s+/g, " ").trim();

  if (!collapsed) {
    return null;
  }

  const chars = Array.from(collapsed);

  return chars.length > max ? `${chars.slice(0, max).join("").trimEnd()}…` : collapsed;
}

// ────────────────────────────────────────────────────────────────
// Preview del contenuto (§13–§21)
// ────────────────────────────────────────────────────────────────

const KIND_LABELS: Record<ShareItemKind, string> = {
  article: EDITORIAL_KIND_LABELS.article,
  post: "Post",
  video: EDITORIAL_KIND_LABELS.video,
};

/** §15, §17, §19: la label discreta «Post» / «Articolo» / «Video». */
export function shareKindLabel(kind: ShareItemKind): string {
  return KIND_LABELS[kind];
}

function authorMetaLine(identityType: FeedIdentityType | null, meta: FeedAuthorMeta | null) {
  if (!identityType || !meta) {
    return null;
  }

  return authorMetaParts(identityType, meta).join(" · ") || null;
}

/**
 * Preview da un elemento del Feed o del dettaglio già in memoria (§21, §219):
 * nessun fetch, solo ciò che il content model possiede.
 */
export function buildSharePreviewFromFeedItem(item: FeedContentItem): SharePreview {
  const author = item.author;
  const common = {
    authorMeta: authorMetaLine(item.payload.authorIdentityType, item.payload.authorMeta),
    authorName: author?.name ?? null,
    isVerified: author?.isVerified ?? false,
  };

  if (item.type === "post") {
    const first = orderMedia(item.payload.media)[0] ?? null;

    return {
      ...common,
      durationSeconds: first?.type === "video" ? first.durationSeconds : null,
      excerpt: shortText(postBodyText(item.payload), SHARE_EXCERPT_MAX),
      // §16: un Post di solo testo non ha thumbnail né segnaposto.
      kind: "post",
      showsPlay: first?.type === "video",
      thumbnailUrl: first ? mediaImageUri(first, false) : null,
      title: null,
    };
  }

  if (item.type === "article") {
    return {
      ...common,
      durationSeconds: null,
      // §18: il titolo è la parte prioritaria; nessun excerpt a fargli concorrenza.
      excerpt: null,
      kind: "article",
      showsPlay: false,
      thumbnailUrl: articleCoverUri(item.payload),
      title: shortText(item.title, SHARE_EXCERPT_MAX),
    };
  }

  const video = orderMedia(item.payload.media).find((media) => media.type === "video") ?? null;

  return {
    ...common,
    durationSeconds: video?.durationSeconds ?? item.payload.durationSeconds,
    excerpt: null,
    kind: "video",
    showsPlay: true,
    thumbnailUrl: video?.thumbnailUrl ?? item.payload.thumbnailUrl,
    title: shortText(item.title ?? item.payload.summary, SHARE_EXCERPT_MAX),
  };
}

/** La reference canonica (§2) più la preview, da un elemento del Feed o del dettaglio Post. */
export function buildShareTarget(item: FeedContentItem): ShareTarget {
  return {
    contentId: item.payload.postId,
    contentType: item.payload.contentType,
    preview: buildSharePreviewFromFeedItem(item),
  };
}

/**
 * Preview dal dettaglio storico `/content/[type]/[id]`, che non ha un
 * `FeedItem`: il chiamante passa ciò che la sua vista già conosce. La verifica
 * dell'autore lì non è nota e non si inventa (§249: solo il check standard).
 */
export function buildSharePreviewFromDetail(input: {
  authorName: string | null;
  /** Seconda riga dell'autore, solo se la vista la ha già (nessun fetch per ottenerla). */
  authorMeta?: string | null;
  durationSeconds: number | null;
  excerpt: string | null;
  isArticle: boolean;
  /** Verifica dell'autore, solo se la vista la ha già. */
  isVerified?: boolean;
  thumbnailUrl: string | null;
  title: string | null;
  hasVideo: boolean;
}): SharePreview {
  const kind: ShareItemKind = input.isArticle ? "article" : input.hasVideo ? "video" : "post";

  return {
    authorMeta: input.authorMeta ?? null,
    authorName: input.authorName,
    durationSeconds: input.hasVideo ? input.durationSeconds : null,
    excerpt: kind === "post" ? shortText(input.excerpt, SHARE_EXCERPT_MAX) : null,
    isVerified: input.isVerified ?? false,
    kind,
    showsPlay: input.hasVideo,
    thumbnailUrl: input.thumbnailUrl,
    title: kind === "post" ? null : shortText(input.title, SHARE_EXCERPT_MAX),
  };
}

/** §19: «0:48» sulla thumbnail del Video. */
export function sharePreviewDuration(preview: SharePreview): string | null {
  return preview.showsPlay ? formatPostVideoDuration(preview.durationSeconds) : null;
}

/** Etichetta unica per lo screen reader: «Post di Matteo Rossi: Grande vittoria…». */
export function sharePreviewAccessibilityLabel(preview: SharePreview): string {
  const duration = preview.showsPlay ? spokenVideoDuration(preview.durationSeconds) : null;
  const head = [
    shareKindLabel(preview.kind),
    preview.authorName ? `di ${preview.authorName}` : null,
    preview.isVerified ? "profilo verificato" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [head, preview.title ?? preview.excerpt, duration].filter(Boolean).join(". ");
}

// ────────────────────────────────────────────────────────────────
// Card in chat (§104–§118, §122)
// ────────────────────────────────────────────────────────────────

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function identityTypeOf(value: unknown): FeedIdentityType | null {
  return value === "person" || value === "society" || value === "media" ? value : null;
}

function metaOf(value: unknown): FeedAuthorMeta | null {
  const raw = record(value);

  if (!raw) {
    return null;
  }

  return {
    clubCategory: text(raw.club_category),
    clubName: text(raw.club_name),
    mediaKind: text(raw.media_kind),
    primaryPosition: text(raw.primary_position),
    role: text(raw.role),
    teamLabel: text(raw.team_label),
  };
}

function kindOf(value: unknown): ShareItemKind {
  return value === "article" || value === "video" ? value : "post";
}

/**
 * Preview dallo snapshot del server (§100). Lo snapshot è solo il primo
 * rendering (§102): non si cerca di completarlo né di correggerlo, e se non è
 * un oggetto la card non ha nulla da mostrare.
 */
export function snapshotToPreview(snapshot: unknown): SharePreview | null {
  const raw = record(snapshot);

  if (!raw) {
    return null;
  }

  const kind = kindOf(raw.item_kind);
  const duration = typeof raw.duration_seconds === "number" ? raw.duration_seconds : null;

  return {
    authorMeta: authorMetaLine(identityTypeOf(raw.author_identity_type), metaOf(raw.author_meta)),
    authorName: text(raw.author_name),
    durationSeconds: duration,
    excerpt: kind === "post" ? shortText(text(raw.excerpt), SHARE_EXCERPT_MAX) : null,
    isVerified: raw.author_is_verified === true,
    kind,
    // Un Post con video ha `item_kind: "post"` ma `media_type: "video"` e una
    // durata: lo stesso Play del Feed (solo l'editoriale è `item_kind: "video"`).
    showsPlay: kind === "video" || raw.media_type === "video" || (kind === "post" && duration != null),
    thumbnailUrl: text(raw.thumbnail_url),
    title: kind === "post" ? null : shortText(text(raw.title) ?? text(raw.excerpt), SHARE_EXCERPT_MAX),
  };
}

type ContentReferenceColumns = {
  content_available?: boolean | null;
  content_ref_id?: string | null;
  content_ref_type?: string | null;
  content_snapshot?: Record<string, unknown> | null;
};

/**
 * §114–§118: contenuto eliminato, moderato, non più visibile, autore o pagina
 * non disponibili, permesso perso — tutto lo stesso stato, senza motivo.
 * Disponibile solo se il server lo conferma per QUESTO viewer (§122), ha mandato
 * lo snapshot e la reference è apribile: un tipo sconosciuto non diventa una href.
 */
export function readContentReference(message: ContentReferenceColumns): ContentReferenceView {
  const preview = snapshotToPreview(message.content_snapshot);

  if (
    message.content_available === false ||
    !preview ||
    !isShareContentType(message.content_ref_type) ||
    !message.content_ref_id
  ) {
    return { available: false };
  }

  return {
    available: true,
    contentId: message.content_ref_id,
    contentType: message.content_ref_type,
    preview,
  };
}

// ────────────────────────────────────────────────────────────────
// Recenti (§24–§33)
// ────────────────────────────────────────────────────────────────

/**
 * §25, §29–§30: solo DIRECT e GROUP che accettano messaggi normali. Fuori i
 * gruppi non attivi (archiviati o chiusi) e le chat che ho bloccato (D3): una
 * card destinata a fallire non si propone (§121). Chi ha bloccato ME resta
 * (non si rivela il blocco, MES-02): fallirà come non ritentabile.
 */
export function selectRecentRecipients(
  conversations: readonly InboxConversation[],
  max: number = SHARE_RECENTS_MAX,
): ShareRecipient[] {
  const recipients: ShareRecipient[] = [];

  for (const conversation of conversations) {
    if (recipients.length >= max) {
      break;
    }

    const isGroup = conversation.conversation_type === "group";

    if (
      (!isGroup && conversation.conversation_type !== "direct") ||
      conversation.archived ||
      conversation.blocked_by_me ||
      (isGroup && conversation.group_status != null && conversation.group_status !== "active")
    ) {
      continue;
    }

    recipients.push({
      available: true,
      avatarUrl: conversation.avatar_url,
      clubId: null,
      contextLabel: null,
      conversationId: conversation.conversation_id,
      displayName: conversation.display_title,
      groupAvatarPath: isGroup ? conversation.group_avatar_path : null,
      isVerified: false,
      key: `conv:${conversation.conversation_id}`,
      kind: isGroup ? "group" : "direct",
      participantCount: isGroup ? conversation.participant_count : null,
      profileId: conversation.other_profile_id,
      role: null,
    });
  }

  return recipients;
}

// ────────────────────────────────────────────────────────────────
// Righe destinatario (§59–§65, §228–§230)
// ────────────────────────────────────────────────────────────────

export function participantsLabel(count: number | null): string | null {
  if (count == null || count <= 0) {
    return null;
  }

  return `${formatCount(count)} ${count === 1 ? "partecipante" : "partecipanti"}`;
}

/** Una sola riga di metadata: «Allenatore · AC Como», «8 partecipanti», «Società · Serie D». */
export function recipientMetaLine(recipient: ShareRecipient): string | null {
  if (!recipient.available) {
    return SHARE_COPY.unavailableRecipient;
  }

  switch (recipient.kind) {
    case "group":
      return participantsLabel(recipient.participantCount);
    case "club":
      return recipient.contextLabel ?? "Società";
    case "media":
      return recipient.contextLabel ?? "Media";
    case "direct":
    case "person":
      return (
        [recipient.role ? formatRole(recipient.role) : null, recipient.contextLabel]
          .filter(Boolean)
          .join(" · ") || null
      );
  }
}

const KIND_SPOKEN: Record<ShareRecipientKind, string | null> = {
  club: "società",
  direct: null,
  group: "gruppo",
  media: "media",
  person: null,
};

/**
 * §228–§230: nome, tipo, stato. «Marco Bianchi, selezionato»,
 * «Staff Prima Squadra, gruppo, 8 partecipanti». Il tipo si dice dove non è
 * ovvio (gruppo, società, media): per le persone è il caso di default.
 */
export function recipientAccessibilityLabel(
  recipient: ShareRecipient,
  /** `null` dove non c'è una selezione (i Recenti): lo stato non si dice. */
  selected: boolean | null,
): string {
  return [
    recipient.displayName,
    recipient.isVerified ? "profilo verificato" : null,
    KIND_SPOKEN[recipient.kind],
    recipient.kind === "group" ? participantsLabel(recipient.participantCount) : null,
    recipient.available ? null : SHARE_COPY.unavailableRecipient,
    selected === null ? null : selected ? "selezionato" : "non selezionato",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Chiavi già presenti: i risultati paginati non si duplicano mai (§74). */
export function mergeRecipientPages(
  pages: readonly { items: readonly ShareRecipient[] }[],
): ShareRecipient[] {
  const seen = new Set<string>();
  const merged: ShareRecipient[] = [];

  for (const page of pages) {
    for (const item of page.items) {
      if (!seen.has(item.key)) {
        seen.add(item.key);
        merged.push(item);
      }
    }
  }

  return merged;
}

/** §66, §67: aggiunge o toglie dalla selezione, fino al massimo del server. */
export function toggleRecipient(
  selected: readonly ShareRecipient[],
  recipient: ShareRecipient,
): ShareRecipient[] {
  if (selected.some((item) => item.key === recipient.key)) {
    return selected.filter((item) => item.key !== recipient.key);
  }

  if (!recipient.available || selected.length >= SHARE_MAX_DESTINATIONS) {
    return [...selected];
  }

  return [...selected, recipient];
}

// ────────────────────────────────────────────────────────────────
// CTA e feedback (§69, §84–§86, §93–§94, §130–§131, §139, §233)
// ────────────────────────────────────────────────────────────────

/** §69: «Avanti» disabilitato a zero, poi «Avanti (N)». */
export function nextLabel(count: number): string {
  return count > 0 ? `Avanti (${count})` : "Avanti";
}

/** §93–§94: «Invia» per un destinatario, «Invia a N» per più. */
export function sendLabel(count: number): string {
  return count > 1 ? `Invia a ${count}` : "Invia";
}

/** §233: «Invia a 3 conversazioni». */
export function sendAccessibilityLabel(count: number): string {
  return count > 1 ? `Invia a ${count} conversazioni` : "Invia";
}

/**
 * §84–§85: il nome se uno solo, altrimenti la sintesi. `count` sono le consegne
 * deduplicate (persona P + Società di P = 1) e di default le righe; con una sola
 * consegna si mostra la prima riga, che è quella che parte.
 */
export function recipientsSummary(
  recipients: readonly ShareRecipient[],
  count: number = recipients.length,
): string {
  if (count === 1 && recipients.length > 0) {
    return recipients[0].displayName;
  }

  return `${count} conversazioni selezionate`;
}

/** §130–§131. */
export function successMessage(count: number): string {
  return count > 1 ? `Inviato a ${count} conversazioni` : SHARE_COPY.sentOne;
}

/** §139: «Inviato a 2 di 3 conversazioni». */
export function partialTitle(okCount: number, total: number): string {
  return `Inviato a ${okCount} di ${total} conversazioni`;
}

/** §139: «1 invio non riuscito», «2 invii non riusciti». */
export function failedCountLabel(count: number): string {
  return count === 1 ? "1 invio non riuscito" : `${count} invii non riusciti`;
}

/** §139: «Riprova 1 invio». */
export function retryLabel(count: number): string {
  return count === 1 ? "Riprova 1 invio" : `Riprova ${count} invii`;
}

// ────────────────────────────────────────────────────────────────
// Inbox
// ────────────────────────────────────────────────────────────────

/**
 * Anteprima dell'ultimo messaggio quando è una condivisione: il testo se c'è,
 * altrimenti «Contenuto condiviso». Mai l'URL né l'id (§288).
 */
export function sharedMessagePreview(body: string | null | undefined): string {
  return body?.trim() || SHARE_COPY.sharedContentPreview;
}

// ────────────────────────────────────────────────────────────────
// Payload per lo share sheet di sistema (§165–§172)
// ────────────────────────────────────────────────────────────────

/**
 * Il messaggio breve e l'URL canonico, in un'unica stringa: su iOS un campo
 * `url` accanto a un `message` che già lo contiene produce due item.
 *
 *  • Post (§166): «Matteo Rossi su PROLINK», excerpt, URL;
 *  • Articolo (§167): «Titolo — Autore», URL;
 *  • Video (§168): titolo, autore, URL.
 */
export function buildExternalShareMessage(preview: SharePreview, url: string): string {
  const author = preview.authorName;
  const lines: (string | null)[] = [];

  switch (preview.kind) {
    case "post":
      lines.push(author ? `${author} su PROLINK` : "Su PROLINK", shortText(preview.excerpt, 100));
      break;
    case "article":
      lines.push(
        [shortText(preview.title, 120), author].filter(Boolean).join(" — ") || "Su PROLINK",
      );
      break;
    case "video":
      lines.push(shortText(preview.title, 120), author);
      break;
  }

  return [...lines.filter(Boolean), url].join("\n");
}

/** Titolo del dialog Android: il formato, non un identificativo. */
export function externalShareTitle(preview: SharePreview): string {
  return preview.authorName ? `${preview.authorName} su PROLINK` : "PROLINK";
}
