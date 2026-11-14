/**
 * Contratto del composer Post (HOM-06.1).
 *
 * Un solo formato Post (Regola finale): testo, link, IMAGE e VIDEO sono
 * contenuti dello stesso oggetto. Il Post si salva nella tabella già usata
 * dall'identità che pubblica (decisione Luigi 2026-11-13, «estendo le
 * esistenti»): PERSON → profile_posts, SOCIETY → club_media_posts kind 'post',
 * MEDIA → media_profile_posts kind 'post'. Nessun modello parallelo (§1).
 *
 * I tipi `Wire*` sono la forma jsonb scambiata con le RPC
 * `fetch_post_composer_context`, `publish_post`, `fetch_post_for_edit`,
 * `update_post` e con la Edge Function `link-preview`: snake_case, come il
 * server li manda. I tipi senza prefisso sono il dominio del client.
 */

import type { FeedContentType, FeedIdentityType } from "../feed/feed-types";
import type {
  ContentLifecycleState,
  ContentRef,
  Publication,
  PublishingErrorKind,
  WireSchedulePolicy,
} from "../publishing/publishing-types";

/* ------------------------------------------------------------------ */
/* Identità e politiche                                                */
/* ------------------------------------------------------------------ */

/** §15: PERSON / SOCIETY / MEDIA — stessi valori di `FeedIdentityType`. */
export type ComposerIdentityType = FeedIdentityType;

/** §18–19: solo identità con can_publish_post = true arrivano al client. */
export type WireComposerIdentity = {
  identity_type: ComposerIdentityType;
  identity_id: string;
  name: string;
  avatar_url: string | null;
  is_verified: boolean;
  /** «Profilo personale» / «Società» / «Media» (§19). */
  context_label: string;
  /** HOM-06.2 §84–§85: la riga Pubblicazione esiste solo se true. Assente su un server non aggiornato → false. */
  can_schedule_content?: boolean;
};

/** §61: limiti da una sola source of truth (server, app_policy_settings). */
export type WireComposerLimits = {
  max_media: number;
  max_body_length: number;
  max_video_seconds: number;
  max_tags: number;
  max_mentions: number;
};

/** Risposta di `fetch_post_composer_context()`. */
export type WireComposerContext = {
  identities: WireComposerIdentity[];
  limits: WireComposerLimits;
  /** HOM-06.2 §96: lead time e orizzonte dal server, mai hardcodati. */
  schedule?: WireSchedulePolicy;
};

export type ComposerIdentity = {
  type: ComposerIdentityType;
  id: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  contextLabel: string;
  /** HOM-06.2 §84–§85: con false niente riga Pubblicazione e CTA «Pubblica» standard. */
  canSchedule: boolean;
};

export type ComposerLimits = {
  maxMedia: number;
  maxBodyLength: number;
  maxVideoSeconds: number;
  maxTags: number;
  maxMentions: number;
};

/* ------------------------------------------------------------------ */
/* Origine e modalità                                                  */
/* ------------------------------------------------------------------ */

/**
 * §5: ogni apertura trasmette un origin; il ritorno lo usa (§122–126).
 * HOM-06.2: `DRAFTS` (riapertura dalla lista Bozze e programmati, §147) e
 * `NOTIFICATION` (tap sulla notifica di un contenuto programmato, §200).
 */
export const COMPOSER_ORIGINS = [
  "HOME_PER_TE",
  "HOME_SEGUITI",
  "PERSONAL_PROFILE",
  "SOCIETY_PROFILE",
  "MEDIA_PROFILE",
  "CONTENT_DETAIL",
  "DRAFTS",
  "NOTIFICATION",
] as const;

export type ComposerOrigin = (typeof COMPOSER_ORIGINS)[number];

export type ComposerMode =
  | { kind: "create" }
  | {
      kind: "edit";
      contentType: FeedContentType;
      contentId: string;
      /** `updated_at` letto all'apertura (§160): il server rifiuta se cambiato. */
      expectedVersion: string | null;
    };

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export type ComposerMediaType = "image" | "video";

export type ComposerUploadStatus = "pending" | "uploading" | "uploaded" | "failed";

/** §43: item della collection `media[]` in composizione. */
export type ComposerMediaItem = {
  localId: string;
  /** Solo per i media già pubblicati (Modifica, read-only §151). */
  remoteMediaPosition: number | null;
  type: ComposerMediaType;
  /** URI locale del picker; null per i media già pubblicati. */
  localUri: string | null;
  /** Path nello storage `profile-media` (`<uid>/posts/<file>`) dopo l'upload. */
  storagePath: string | null;
  /** URL pubblico (media già pubblicati o caricati). */
  remoteUrl: string | null;
  thumbnailUri: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  uploadStatus: ComposerUploadStatus;
  /** 0..1, null quando il progresso non è misurabile. */
  uploadProgress: number | null;
  errorCode: string | null;
  altText: string | null;
  /**
   * HOM-06.2 §107–§109: stato di elaborazione server di un media di una bozza
   * riaperta (`ready`, `processing`, …). Assente per i media appena caricati e
   * per i Post pubblicati: lì decide il server alla conferma della data.
   */
  processingState?: string | null;
  /**
   * HOM-06.2: path della miniatura di un media di una bozza riaperta. Si rimanda
   * invariato nel payload di salvataggio/invio, altrimenti la miniatura del video
   * andrebbe persa. Assente per i media appena caricati.
   */
  thumbnailPath?: string | null;
};

/** Elemento di `p_media` per `publish_post`: l'ordine dell'array è la posizione (§44). */
export type WirePublishMedia = {
  storage_path: string;
  media_type: ComposerMediaType;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  thumbnail_path: string | null;
  alt_text: string | null;
};

/* ------------------------------------------------------------------ */
/* Mention, tag, link                                                  */
/* ------------------------------------------------------------------ */

/**
 * §112: stessa forma di `FeedMention` (offset UTF-16, `end` escluso). Il
 * server verifica che `body.slice(start, end) === '@' + display_name`.
 */
export type WireMention = {
  identity_id: string;
  identity_type: "profile" | "club";
  display_name: string;
  start: number;
  end: number;
};

export type ComposerMention = {
  identityId: string;
  identityType: "profile" | "club";
  displayName: string;
  start: number;
  end: number;
};

/** §99–104: persone e Società taggate (associazione, non testo §115). */
export type WireTaggedIdentity = {
  target_type: "profile" | "club";
  target_id: string;
};

export type ComposerTaggedIdentity = {
  identityType: "profile" | "club";
  identityId: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  /** Ruolo/contesto (persona) o categoria (Società): §102–103. */
  subtitle: string | null;
};

/**
 * Risposta della Edge Function `link-preview` (§75, §80). `snapshot_id`
 * referenzia la riga persistita lato server: `publish_post` non accetta mai
 * metadata arbitrari dal client (§207).
 */
export type WireLinkPreviewResult =
  | {
      status: "ok";
      snapshot_id: string;
      original_url: string;
      final_url: string;
      title: string | null;
      description: string | null;
      image_url: string | null;
      favicon_url: string | null;
      domain: string;
      site_name: string | null;
    }
  | { status: "unavailable" | "blocked" | "invalid"; original_url: string; domain: string | null };

/** `p_link` di `publish_post` / `update_post`. */
export type WirePublishLink = {
  url: string;
  /** null se la preview è fallita o rimossa: il link resta testo cliccabile. */
  snapshot_id: string | null;
  /**
   * Letto solo da `update_post`. `true` quando, in Modifica, l'utente ha rimosso
   * (X) l'anteprima di un URL invariato: senza snapshot e senza questo flag il
   * server conserva l'anteprima esistente. Altrimenti si omette.
   */
  dismiss_preview?: boolean;
};

export type ComposerLinkPreviewState =
  | { status: "idle" }
  | { status: "loading"; url: string }
  | {
      status: "ready";
      url: string;
      /** `null` solo per l'anteprima già salvata di un Post in Modifica, quando il server non rimanda lo snapshot. */
      snapshotId: string | null;
      finalUrl: string;
      title: string | null;
      description: string | null;
      imageUrl: string | null;
      domain: string;
    }
  | { status: "failed"; url: string; domain: string | null; retryable: boolean };

/* ------------------------------------------------------------------ */
/* Pubblicazione e modifica                                            */
/* ------------------------------------------------------------------ */

/** Argomenti di `publish_post` (§117). */
export type WirePublishPostArgs = {
  p_operation_key: string;
  p_identity_type: ComposerIdentityType;
  p_identity_id: string;
  p_body: string;
  p_mentions: WireMention[];
  p_tagged: WireTaggedIdentity[];
  p_media: WirePublishMedia[];
  p_link: WirePublishLink | null;
  p_origin: ComposerOrigin;
};

/** `replayed = true` se l'operation key era già stata usata (§118, §176). */
export type WirePublishPostResult = {
  content_type: FeedContentType;
  content_id: string;
  replayed: boolean;
};

/** Risposta di `fetch_post_for_edit(p_content_type, p_post_id)` (§146). */
export type WirePostForEdit = {
  content_type: FeedContentType;
  content_id: string;
  version: string;
  author: WireComposerIdentity;
  body: string;
  mentions: WireMention[];
  tagged: (WireTaggedIdentity & {
      display_name: string;
      avatar_url: string | null;
      is_verified: boolean;
      subtitle: string | null;
    })[];
  link: {
    url: string;
    snapshot_id: string | null;
    /** `true` se il Post ha un'anteprima visuale salvata (§93, §156–157). */
    has_preview: boolean;
    title: string | null;
    description: string | null;
    image_url: string | null;
    domain: string;
  } | null;
  media: {
    position: number;
    media_type: ComposerMediaType;
    url: string;
    thumbnail_url: string | null;
    width: number | null;
    height: number | null;
    duration_seconds: number | null;
  }[];
  can_edit: boolean;
};

/** Argomenti di `update_post` (§155–161): media e autore non cambiano. */
export type WireUpdatePostArgs = {
  p_content_type: FeedContentType;
  p_post_id: string;
  p_expected_version: string;
  p_body: string;
  p_mentions: WireMention[];
  p_tagged: WireTaggedIdentity[];
  p_link: WirePublishLink | null;
};

export type WireUpdatePostResult = {
  content_type: FeedContentType;
  content_id: string;
  version: string;
};

/**
 * Codici errore che le RPC sollevano nel `message` (stile `content_*` di
 * HOM-04). Il client li mappa sulle copy della spec.
 */
export const COMPOSER_ERROR_CODES = [
  "post_permission_denied", // §169 / §30 — 42501
  "post_edit_denied", // §173 — 42501
  "post_version_conflict", // §161 — 40001
  // Stessa operation key con payload diverso, o post replayed non più pubblicato — 40001.
  // Il client ruota la chiave (§118) e lascia riprovare.
  "post_operation_conflict",
  "post_not_found", // P0002
  "post_invalid_content", // §12–13 — 22023
  "post_media_limit", // §61–62 — 22023
  "post_invalid_media", // §207 — 22023
  "post_invalid_mention", // §209 — 22023
  "post_invalid_tag", // §207, §210 — 22023
  "post_invalid_link", // §207, §211 — 22023
] as const;

export type ComposerErrorCode = (typeof COMPOSER_ERROR_CODES)[number];

/* ------------------------------------------------------------------ */
/* Dominio client aggiunto da HOM-06.1 (livello logico)                */
/* ------------------------------------------------------------------ */

/** Esito classificato di un errore di rete/RPC: codice server, rete o ignoto. */
export type ComposerErrorKind = ComposerErrorCode | "network" | "unknown";

/**
 * HOM-06.2: `submit_content` solleva i codici `content_*`, `schedule_*` di
 * `publishing-types`, in più dei `post_*` di HOM-06.1. `errorCopy` li traduce
 * tutti (i `post_*` sono gli stessi nei due elenchi).
 */
export type ComposerSubmitErrorKind = ComposerErrorKind | PublishingErrorKind;

/** §119–120, §174: stato dell'invio. `failed` lascia il composer intatto. */
export type ComposerPublishStatus =
  | { status: "idle" }
  | { status: "publishing" }
  | { status: "failed"; code: ComposerSubmitErrorKind };

/**
 * HOM-06.2 §116–§132: ciò che lega il composer a una bozza sul server.
 * `ref` e `version` sono quelli all'APERTURA (o ripristinati dal recovery): il
 * valore corrente lo possiede `useAutosave`. `status` è lo stato server
 * all'apertura, `null` per un contenuto nuovo.
 */
export type ComposerDraftInfo = {
  /** Chiave di idempotenza del salvataggio bozza della sessione, DISTINTA da `operationKey` dell'invio (§117, §121). */
  operationKey: string;
  ref: ContentRef | null;
  version: number | null;
  status: ContentLifecycleState | null;
  /** Publication all'apertura di un programmato: «Salva» invia `keep` finché non cambia (§166–§167). */
  initialPublication: Publication | null;
  /** Chiave del contenuto all'apertura di un programmato, per sapere se è cambiato qualcosa (§158 per analogia). */
  baselineKey: string | null;
};

/** Chi/cosa viene proposto da `@` (§110–111): il minimo comune a mention e tag. */
export type ComposerMentionCandidate = Pick<
  ComposerTaggedIdentity,
  "identityId" | "identityType" | "displayName"
>;

/** Intervallo di testo (`end` escluso) che la mention sostituirà. */
export type ComposerTextRange = { start: number; end: number };

/** §110: la query dell'autocomplete e il tratto di testo da sostituire. */
export type ComposerMentionQuery = { query: string; range: ComposerTextRange };

/** §73, §88: un URL trovato nel testo, con la forma normalizzata per i confronti. */
export type ComposerUrlMatch = {
  raw: string;
  normalized: string;
  start: number;
  end: number;
};

/** `fetch_post_for_edit` nel dominio del client (§146). */
export type ComposerPostForEdit = {
  contentType: FeedContentType;
  contentId: string;
  version: string;
  author: ComposerIdentity;
  body: string;
  mentions: ComposerMention[];
  tagged: ComposerTaggedIdentity[];
  /** Preview già persistita; `null` se il Post non ha link o non ha snapshot. */
  link: Extract<ComposerLinkPreviewState, { status: "ready" }> | null;
  /** Media pubblicati, già `uploadStatus: "uploaded"` e solo lettura (§151). */
  media: ComposerMediaItem[];
  canEdit: boolean;
};

/**
 * Stato tecnico recuperabile (§134–142). NON è una bozza consultabile: nessuna
 * lista, nessun titolo, nessun elenco (§136).
 */
export type ComposerRecoverySnapshot = {
  version: 1;
  savedAt: string;
  origin: ComposerOrigin;
  operationKey: string;
  identityType: ComposerIdentityType | null;
  identityId: string | null;
  body: string;
  mentions: ComposerMention[];
  tagged: ComposerTaggedIdentity[];
  media: ComposerMediaItem[];
  dismissedUrls: string[];
  /**
   * HOM-06.2 §121, §125–§127. Opzionali: uno snapshot di HOM-06.1 non li ha e
   * resta valido. Con la bozza server (ref + versione) un crash riprende la
   * STESSA bozza invece di crearne una seconda.
   */
  draftOperationKey?: string;
  draftRef?: ContentRef | null;
  draftVersion?: number | null;
  publication?: Publication;
};

/* ------------------------------------------------------------------ */
/* Riapertura di una bozza / programmato / fallito (HOM-06.2 §147)      */
/* ------------------------------------------------------------------ */

/** Ramo `post` di `fetch_content_for_editor` (contratto §A6.6). */
export type WireDraftPostEditor = {
  content_type: FeedContentType;
  content_id: string;
  format: "post" | "article";
  status: ContentLifecycleState;
  version: number;
  updated_at: string;
  identity: WireComposerIdentity;
  publication: { mode?: string | null; scheduled_at?: string | null; timezone?: string | null } | null;
  capabilities: { can_edit: boolean; can_schedule: boolean; can_delete: boolean };
  failure_code: string | null;
  post: {
    body: string;
    mentions: WireMention[];
    tagged: (WireTaggedIdentity & {
      display_name: string;
      avatar_url: string | null;
      is_verified: boolean;
      subtitle: string | null;
    })[];
    media: {
      position: number;
      storage_path: string;
      media_type: ComposerMediaType;
      url: string | null;
      thumbnail_url: string | null;
      thumbnail_path?: string | null;
      width: number | null;
      height: number | null;
      duration_seconds: number | null;
      alt_text: string | null;
      processing_state: string | null;
    }[];
    link: {
      url: string;
      snapshot_id: string | null;
      preview: {
        final_url?: string | null;
        title?: string | null;
        description?: string | null;
        image_url?: string | null;
        domain?: string | null;
      } | null;
    } | null;
  } | null;
};

/** `fetch_content_for_editor` (ramo Post) nel dominio del client. */
export type ComposerDraftForEditor = {
  ref: ContentRef;
  status: ContentLifecycleState;
  version: number;
  updatedAt: string;
  identity: ComposerIdentity;
  publication: Publication;
  canEdit: boolean;
  failureCode: string | null;
  body: string;
  mentions: ComposerMention[];
  tagged: ComposerTaggedIdentity[];
  /** Editabili (§112–§114), con `storagePath` per ri-salvare la bozza. */
  media: ComposerMediaItem[];
  link: Extract<ComposerLinkPreviewState, { status: "ready" }> | null;
  /** Il Post aveva un URL ma nessuna anteprima salvata: non si rigenera da sola (§93). */
  hadLinkWithoutPreview: boolean;
};
