/**
 * Tipi del sistema di Condivisione contenuti (HOM-09).
 *
 * Due livelli, come nel Feed: le forme grezze delle RPC (`Raw*`, snake_case,
 * 1:1 con il contratto della migrazione `20261124090000_home_content_share`) e
 * i tipi camelCase su cui lavorano i componenti. `share-service.ts` è l'unico
 * ponte tra i due.
 *
 * §2: la reference canonica è `content_id` + `content_type`; il resto
 * (`SharePreview`) serve solo a far riconoscere il contenuto (§13) e non è
 * mai fonte di verità (§101): all'apertura la card rivalida (§122).
 * §95–§98: un solo message object, testo opzionale + reference.
 */

import type { ContentOrigin } from "../feed/content-routes";
import type { FeedContentType } from "../feed/feed-types";

// ────────────────────────────────────────────────────────────────
// Contenuto condiviso
// ────────────────────────────────────────────────────────────────

/** §14, §17, §19: i tre formati con una preview. Un solo dominio Share per tutti (§1). */
export type ShareItemKind = "post" | "article" | "video";

/**
 * I quattro tipi di `FeedContentType` che il server accetta in
 * `send_content_share` (22023 per gli altri) e che la route
 * `/content/[type]/[id]` apre. `fan_tribuna` e `media_tribuna` sono fuori: non
 * hanno Condividi e una card di quel tipo non può esistere. Serve a nascondere
 * la cella Condividi, a validare ciò che arriva dal server prima di costruirci
 * una href o un URL (§148: mai un identificatore che non sia un tipo di
 * contenuto condivisibile PROLINK) e a leggere le card in chat.
 */
export const SHARE_CONTENT_TYPES: readonly FeedContentType[] = [
  "profile_post",
  "club_media",
  "media_profile",
  "fan_media",
];

export function isShareContentType(value: unknown): value is FeedContentType {
  return SHARE_CONTENT_TYPES.includes(value as FeedContentType);
}

/**
 * Preview compatta (§13): quanto basta a riconoscere il contenuto. Nessun
 * placeholder artificiale per i campi assenti (§16, §18): `null` vuol dire che
 * il componente non disegna quel blocco.
 */
export type SharePreview = {
  kind: ShareItemKind;
  authorName: string | null;
  isVerified: boolean;
  /** Seconda riga dell'autore, già formattata («Attaccante · AC Como»). */
  authorMeta: string | null;
  /** Titolo editoriale (Articolo, Video). Per il Post è `null`. */
  title: string | null;
  /** Estratto breve del testo del Post (§14), mai il body intero (§13, §169). */
  excerpt: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  /** §19: Play sulla thumbnail (Video, o Post con video in prima posizione). */
  showsPlay: boolean;
};

/** La reference da condividere più ciò che serve per disegnarla. */
export type ShareTarget = {
  contentType: FeedContentType;
  contentId: string;
  preview: SharePreview;
};

/** §174–§175: l'origine è solo per analytics; il ritorno è sempre la schermata precedente. */
export type ShareOrigin = ContentOrigin | null;

// ────────────────────────────────────────────────────────────────
// Destinatari
// ────────────────────────────────────────────────────────────────

/** §48: DIRECT esistenti, persone senza DIRECT, Società/Media, GROUP. */
export type ShareRecipientKind = "direct" | "group" | "person" | "club" | "media";

export type ShareRecipient = {
  /** Chiave stabile: `conv:<id>` | `profile:<id>` | `club:<id>`. */
  key: string;
  kind: ShareRecipientKind;
  conversationId: string | null;
  profileId: string | null;
  clubId: string | null;
  displayName: string;
  avatarUrl: string | null;
  groupAvatarPath: string | null;
  isVerified: boolean;
  /** Enum grezzo del ruolo: il client formatta con `formatRole` (§61). */
  role: string | null;
  contextLabel: string | null;
  participantCount: number | null;
  /** §56–§57: false = «Non disponibile per i messaggi», non selezionabile. */
  available: boolean;
};

export type ShareRecipientsPage = {
  items: ShareRecipient[];
  nextCursor: string | null;
};

/** Forma grezza di `search_share_recipients` (contratto, sezione Database §4). */
export type RawShareRecipient = {
  recipient_key?: string | null;
  kind?: string | null;
  conversation_id?: string | null;
  profile_id?: string | null;
  club_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  group_avatar_path?: string | null;
  is_verified?: boolean | null;
  role?: string | null;
  context_label?: string | null;
  participant_count?: number | null;
  available?: boolean | null;
};

// ────────────────────────────────────────────────────────────────
// Invio
// ────────────────────────────────────────────────────────────────

/** Una destinazione di `send_content_share` (§53, §128). */
export type ShareDestinationPayload = {
  delivery_key: string;
  /** Il server non accetta più `club`: la Società viaggia come profilo del titolare (D1). */
  kind: "conversation" | "profile";
  conversation_id?: string;
  profile_id?: string;
};

/** §140: identificatore, esito, ritentabile. Nessun codice tecnico verso la UI (§217). */
export type ShareDeliveryOutcome = {
  deliveryKey: string;
  ok: boolean;
  retryable: boolean;
  conversationId: string | null;
  messageId: string | null;
};

export type ShareSendStatus = "ok" | "partial" | "failed" | "content_unavailable";

export type ShareSendResult = {
  status: ShareSendStatus;
  outcomes: ShareDeliveryOutcome[];
};

export type SendContentShareInput = {
  batchId: string;
  contentType: FeedContentType;
  contentId: string;
  text: string;
  destinations: ShareDestinationPayload[];
};

/** `record_content_share_event`: i soli due tipi che non passano da un batch (D4). */
export type ShareEventKind = "copy_link" | "external_sheet_open";

// ────────────────────────────────────────────────────────────────
// Card in chat
// ────────────────────────────────────────────────────────────────

/** Esito della lettura di un messaggio `content_reference` per il viewer. */
export type ContentReferenceView =
  | {
      available: true;
      contentType: FeedContentType;
      contentId: string;
      preview: SharePreview;
    }
  | { available: false };
