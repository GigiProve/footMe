/**
 * Contratto dell'Articolo (HOM-06.2 §1–§3, §7A–§7Z, §28–§72, §216).
 *
 * Un solo formato ARTICLE (§2, §7C): Società e Media pubblicano lo stesso tipo,
 * con lo stesso editor e lo stesso renderer; cambiano identità, capability e
 * contenuto. Le tre modalità (`native`, `external_link`, `imported_text`)
 * descrivono l'origine, non sono tre content type né tre editor (Obiettivo).
 *
 * Persistenza (decisione Luigi 2026-11-13): Società → `club_media_posts`
 * `kind = 'article'`, Media → `media_profile_posts` `kind = 'article'`, più la
 * riga privata `content_articles` (documento, cover, fonte, provenance). Le
 * persone non pubblicano Articoli in V1.
 *
 * Il corpo NON è HTML (§48, §51): è il documento strutturato §49 qui sotto, che
 * il server valida e normalizza. I tipi `Wire*` sono la forma jsonb (snake_case).
 */

import type { FeedContentType } from "../feed/feed-types";
import type { WireComposerIdentity } from "../post-composer/composer-types";
import type { ArticleCreationMode, ContentLifecycleState, WireSchedulePolicy } from "../publishing/publishing-types";

/* ------------------------------------------------------------------ */
/* Documento strutturato (§49–§50, contratto §A4)                      */
/* ------------------------------------------------------------------ */

export type ArticleMark = "bold" | "italic";

export type ArticleTextInline = { type: "text"; text: string; marks?: ArticleMark[] };

export type ArticleLinkInline = { type: "inline_link"; url: string; content: ArticleTextInline[] };

export type ArticleInline = ArticleTextInline | ArticleLinkInline;

export type ArticleListItem = { id: string; content: ArticleInline[] };

export type RichLinkPreview = {
  final_url: string | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  favicon_url: string | null;
  domain: string | null;
  site_name: string | null;
};

export type ArticleBlock =
  | { id: string; type: "paragraph"; content: ArticleInline[] }
  | { id: string; type: "heading"; content: ArticleInline[] }
  | { id: string; type: "unordered_list"; items: ArticleListItem[] }
  | { id: string; type: "ordered_list"; items: ArticleListItem[] }
  | {
      id: string;
      type: "rich_link";
      url: string;
      snapshot_id: string | null;
      /** Ricostruita SEMPRE dal server dallo snapshot (§68); il client la usa solo per mostrarla. */
      preview?: RichLinkPreview | null;
    };

export type ArticleDocument = { v: 1; blocks: ArticleBlock[] };

/* ------------------------------------------------------------------ */
/* Modello di editing (righe piatte)                                   */
/* ------------------------------------------------------------------ */

/** Intervallo marcato del testo di una riga, `end` escluso, offset UTF-16 (JS). */
export type MarkSpan = { start: number; end: number; mark: ArticleMark };

/** §59–§62: il testo resta testo, l'URL completo è memorizzato a parte (§61). */
export type LinkSpan = { start: number; end: number; url: string };

export type TextLineKind = "paragraph" | "heading" | "bullet" | "numbered";

export type TextLine = {
  id: string;
  kind: TextLineKind;
  text: string;
  marks: MarkSpan[];
  links: LinkSpan[];
};

export type RichLinkLine = {
  id: string;
  kind: "rich_link";
  url: string;
  snapshotId: string | null;
  preview: RichLinkPreview | null;
  status: "loading" | "ready" | "failed";
};

export type EditorLine = TextLine | RichLinkLine;

/** Marks da applicare al prossimo testo digitato con il cursore fermo (toolbar B / I). */
export type PendingMarks = Partial<Record<ArticleMark, boolean>>;

/* ------------------------------------------------------------------ */
/* Limiti, contesto, identità                                          */
/* ------------------------------------------------------------------ */

/** §34, §7R: limiti definiti centralmente e uguali fra client e server. */
export type WireArticleLimits = {
  max_title_length: number;
  max_body_length: number;
  max_blocks: number;
  max_block_text: number;
  max_clipboard_chars: number;
  parse_timeout_ms: number;
  excerpt_length: number;
  max_tags: number;
};

export type ArticleLimits = {
  maxTitleLength: number;
  maxBodyLength: number;
  maxBlocks: number;
  maxBlockText: number;
  maxClipboardChars: number;
  parseTimeoutMs: number;
  excerptLength: number;
  maxTags: number;
};

export const DEFAULT_ARTICLE_LIMITS: ArticleLimits = {
  excerptLength: 240,
  maxBlockText: 8000,
  maxBlocks: 400,
  maxBodyLength: 60000,
  maxClipboardChars: 120000,
  maxTags: 20,
  maxTitleLength: 160,
  parseTimeoutMs: 1500,
};

/** §16–§20, §7B: solo identity con can_publish_article, con le modalità realmente utilizzabili. */
export type WireArticleIdentity = WireComposerIdentity & {
  can_schedule_content: boolean;
  article_modes: ArticleCreationMode[];
};

/** Risposta di `fetch_article_composer_context()`. */
export type WireArticleComposerContext = {
  identities: WireArticleIdentity[];
  limits: WireArticleLimits;
  schedule: WireSchedulePolicy;
  rights_declaration_version: string;
};

/* ------------------------------------------------------------------ */
/* Fonte, provenance, cover                                            */
/* ------------------------------------------------------------------ */

/** Snapshot persistito dei metadata della fonte (§7H–§7I). Mai rifatto a ogni apertura. */
export type ArticleSourceSnapshot = {
  title: string | null;
  description: string | null;
  image_url: string | null;
  favicon_url: string | null;
  site_name: string | null;
  author: string | null;
  published_time: string | null;
};

export type WireArticleSource = {
  url: string;
  normalized_url: string | null;
  final_url: string | null;
  canonical_url: string | null;
  domain: string | null;
  site_name: string | null;
  snapshot: ArticleSourceSnapshot | null;
  snapshot_id: string | null;
  manual_title: boolean;
};

/** §7P: origine del testo importato; fonte e autore originali sono attributi separati (§7D). */
export type ArticleProvenance = {
  publishedElsewhere: boolean | null;
  sourceName: string;
  originalAuthor: string;
  originalUrl: string;
  noOriginalLink: boolean;
};

export type WireArticleProvenance = {
  published_elsewhere: boolean | null;
  source_name: string | null;
  original_author: string | null;
  original_url: string | null;
  no_original_link: boolean;
};

/** §36–§40: cover canonica; il client conosce il path solo dopo l'upload. */
export type ArticleCover = {
  localUri: string | null;
  storagePath: string | null;
  url: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  uploadStatus: "pending" | "uploading" | "uploaded" | "failed";
};

export type WireArticleCover = {
  storage_path: string | null;
  url: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
};

/* ------------------------------------------------------------------ */
/* Payload di editor (fetch_content_for_editor → article)              */
/* ------------------------------------------------------------------ */

export type WireArticleTag = {
  target_type: "profile" | "club";
  target_id: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  subtitle: string | null;
};

export type WireArticleEditorPayload = {
  content_type: FeedContentType;
  content_id: string;
  format: "article";
  status: ContentLifecycleState;
  version: number;
  updated_at: string;
  identity: WireComposerIdentity;
  publication: { mode: "now" | "scheduled"; scheduled_at: string | null; timezone: string | null } | null;
  capabilities: { can_edit: boolean; can_schedule: boolean; can_delete: boolean };
  article: {
    creation_mode: ArticleCreationMode;
    title: string;
    cover: WireArticleCover | null;
    document: ArticleDocument | null;
    tagged: WireArticleTag[];
    source: WireArticleSource | null;
    provenance: WireArticleProvenance | null;
    rights_confirmed: boolean;
  };
  failure_code: string | null;
};

/* ------------------------------------------------------------------ */
/* Dettaglio pubblico (fetch_article_detail)                           */
/* ------------------------------------------------------------------ */

/** §216: il serializer pubblico espone solo il necessario al rendering, mai diritti né audit. */
export type WireArticleDetail = {
  creation_mode: ArticleCreationMode;
  document: ArticleDocument | null;
  cover: { url: string; width: number | null; height: number | null; alt_text: string | null } | null;
  source: {
    open_url: string;
    domain: string;
    site_name: string | null;
    title: string | null;
    description: string | null;
    image_url: string | null;
    favicon_url: string | null;
  } | null;
  attribution: {
    published_elsewhere: boolean;
    source_name: string | null;
    original_author: string | null;
    original_url: string | null;
  } | null;
};

export type ArticleDetail = {
  creationMode: ArticleCreationMode;
  document: ArticleDocument | null;
  cover: { url: string; width: number | null; height: number | null; altText: string | null } | null;
  source: {
    openUrl: string;
    domain: string;
    siteName: string | null;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    faviconUrl: string | null;
  } | null;
  attribution: {
    publishedElsewhere: boolean;
    sourceName: string | null;
    originalAuthor: string | null;
    originalUrl: string | null;
  } | null;
};
