/**
 * Contratto di bozze, programmazione e lifecycle condivisi da Post e Articolo
 * (HOM-06.2 §82–§83, §116–§132, §137–§202, §256).
 *
 * Principio (Obiettivo): POST e ARTICLE sono due formati distinti che
 * condividono identity, permission, Draft, scheduling, navigation e lifecycle.
 * Questo modulo è quel pezzo condiviso: il composer Post (HOM-06.1) e l'editor
 * Articolo lo usano entrambi, nessuno dei due ha uno scheduler o una lista
 * bozze propria (§83, §169, §7V, §7W).
 *
 * Decisione Luigi 2026-11-13: bozze e programmati sono STATI della stessa riga
 * del contenuto (profile_posts / club_media_posts / media_profile_posts), non
 * una tabella parallela: l'id resta lo stesso dalla bozza al pubblicato (§188).
 *
 * I tipi `Wire*` sono la forma jsonb delle RPC di
 * `20261121090000_home_editorial_drafts_scheduling.sql` (snake_case).
 */

import type { FeedContentType, FeedIdentityType } from "../feed/feed-types";
import type { WireComposerIdentity } from "../post-composer/composer-types";

/* ------------------------------------------------------------------ */
/* Riferimenti e stati                                                 */
/* ------------------------------------------------------------------ */

/** Un contenuto è sempre (content_type, content_id): lo stesso id da bozza a pubblicato (§188, §221). */
export type ContentRef = { contentType: FeedContentType; contentId: string };

export type WireContentRef = { content_type: FeedContentType; content_id: string };

export type ContentFormat = "post" | "article";

/** §181: lifecycle del contenuto, separato da quello dei media (§180, §183). */
export type ContentLifecycleState =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "deleted";

/** §7C: un solo ARTICLE, tre modalità di creazione (origine, non formato). */
export type ArticleCreationMode = "native" | "external_link" | "imported_text";

export const ARTICLE_CREATION_MODES: readonly ArticleCreationMode[] = [
  "native",
  "external_link",
  "imported_text",
];

/* ------------------------------------------------------------------ */
/* Pubblicazione                                                       */
/* ------------------------------------------------------------------ */

/**
 * §81–§92, §99–§102: «Ora» oppure un istante futuro. L'istante è UTC
 * (`scheduledAt`, ISO-8601) e il fuso è quello in cui l'utente l'ha scelto:
 * cambiare il fuso del dispositivo non sposta l'istante reale (§102).
 */
export type Publication =
  | { mode: "now" }
  | { mode: "scheduled"; scheduledAt: string; timezone: string };

export type WirePublication =
  | { mode: "now" }
  | { mode: "scheduled"; scheduled_at: string; timezone: string }
  /** Modifica di un programmato o di un Articolo pubblicato senza toccare stato e data (§167, §227). */
  | { mode: "keep" };

/** §96: lead time e orizzonte dal server, mai hardcodati (§34, §96). */
export type SchedulePolicy = { minLeadMinutes: number; maxHorizonDays: number };

export type WireSchedulePolicy = { min_lead_minutes: number; max_horizon_days: number };

/* ------------------------------------------------------------------ */
/* Launcher «+»                                                        */
/* ------------------------------------------------------------------ */

/** Risposta di `fetch_content_launcher()` (§4–§10). */
export type WireContentLauncher = {
  can_publish_post: boolean;
  can_publish_article: boolean;
  can_view_drafts: boolean;
  drafts_count: number;
  scheduled_count: number;
  failed_count: number;
};

export type ContentLauncherState = {
  canPublishPost: boolean;
  canPublishArticle: boolean;
  canViewDrafts: boolean;
  draftsCount: number;
  scheduledCount: number;
  failedCount: number;
};

/* ------------------------------------------------------------------ */
/* Lista Bozze e programmati                                           */
/* ------------------------------------------------------------------ */

export type DraftsTab = "drafts" | "scheduled";

/** Perché una bozza non è programmabile ora (§150–§152). */
export type UnschedulableReason =
  | "missing_title"
  | "empty"
  | "media_not_ready"
  | "rights"
  | "source"
  | "capability";

export type WireDraftListItem = {
  content_type: FeedContentType;
  content_id: string;
  format: ContentFormat;
  creation_mode: ArticleCreationMode | null;
  status: ContentLifecycleState;
  title: string | null;
  preview_text: string | null;
  thumbnail_url: string | null;
  identity: WireComposerIdentity;
  updated_at: string;
  scheduled_at: string | null;
  schedule_timezone: string | null;
  failure_code: string | null;
  version: number;
  can_edit: boolean;
  can_schedule: boolean;
  can_delete: boolean;
  schedulable: boolean;
  unschedulable_reason: UnschedulableReason | null;
};

export type WireDraftListPage = { items: WireDraftListItem[]; next_cursor: unknown | null };

export type DraftListItem = {
  ref: ContentRef;
  format: ContentFormat;
  creationMode: ArticleCreationMode | null;
  status: ContentLifecycleState;
  title: string | null;
  previewText: string | null;
  thumbnailUrl: string | null;
  identity: {
    type: FeedIdentityType;
    id: string;
    name: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  updatedAt: string;
  scheduledAt: string | null;
  scheduleTimezone: string | null;
  failureCode: string | null;
  version: number;
  canEdit: boolean;
  canSchedule: boolean;
  canDelete: boolean;
  schedulable: boolean;
  unschedulableReason: UnschedulableReason | null;
};

export type DraftListPage = { items: DraftListItem[]; nextCursor: unknown | null };

/* ------------------------------------------------------------------ */
/* Comandi                                                             */
/* ------------------------------------------------------------------ */

/** Risposta di `save_content_draft` (§117–§122). */
export type WireSaveDraftResult = {
  content_type: FeedContentType;
  content_id: string;
  status: ContentLifecycleState;
  version: number;
  updated_at: string;
  rights_confirmed: boolean | null;
};

/** Risposta di `submit_content` (§203–§211). */
export type WireSubmitResult = {
  content_type: FeedContentType;
  content_id: string;
  status: "published" | "scheduled";
  scheduled_at: string | null;
  version: number;
  replayed: boolean;
};

/** Risposta dei comandi di gestione (`schedule_content`, `publish_content_now`, …). */
export type WireLifecycleResult = {
  status: ContentLifecycleState;
  scheduled_at?: string | null;
  version?: number;
};

/* ------------------------------------------------------------------ */
/* Errori                                                              */
/* ------------------------------------------------------------------ */

/** Codici nel `message` delle RPC di HOM-06.2 (contratto §A8). */
export const PUBLISHING_ERROR_CODES = [
  "content_permission_denied",
  "content_not_found",
  "content_version_conflict",
  "content_operation_conflict",
  "content_invalid_state",
  "content_empty",
  "content_identity_change_requires_draft",
  "schedule_in_past",
  "schedule_too_soon",
  "schedule_too_far",
  "schedule_media_not_ready",
  "schedule_not_allowed",
  "publication_invalid",
  "article_missing_title",
  "article_title_too_long",
  "article_invalid_document",
  "article_body_too_long",
  "article_invalid_source",
  "article_source_required",
  "article_rights_required",
  "article_duplicate",
  "article_mode_not_allowed",
  "article_cover_not_allowed",
  // Parti Post riusate da HOM-06.1.
  "post_permission_denied",
  "post_invalid_content",
  "post_media_limit",
  "post_invalid_media",
  "post_invalid_mention",
  "post_invalid_tag",
  "post_invalid_link",
] as const;

export type PublishingErrorCode = (typeof PUBLISHING_ERROR_CODES)[number];

export type PublishingErrorKind = PublishingErrorCode | "network" | "unknown";

/** Errore classificato + dettaglio del server (es. il ref del duplicato §7M, la versione corrente §128). */
export type PublishingError = {
  kind: PublishingErrorKind;
  detail: string | null;
  /** Solo per `article_duplicate`: l'articolo già collegato (§7M «Visualizza articolo»). */
  duplicateRef: ContentRef | null;
};

/* ------------------------------------------------------------------ */
/* Autosave                                                            */
/* ------------------------------------------------------------------ */

/** §119–§121, §126–§128: stato discreto dell'autosave, mai un toast (§120). */
export type AutosaveStatus =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; at: string }
  /** Salvato solo sul dispositivo: rete assente (§126); al ritorno si sincronizza (§127). */
  | { status: "offline" }
  | { status: "conflict" }
  | { status: "error"; code: PublishingErrorKind };
