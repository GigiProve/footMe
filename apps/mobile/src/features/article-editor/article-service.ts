/**
 * Accesso ai dati dell'Articolo (HOM-06.2 §7B, §7F–§7M, §16–§20, §64–§70, §216).
 *
 *  • contesto: `fetch_article_composer_context` — solo identity con
 *    can_publish_article, modalità utilizzabili, limiti centrali (§34, §7R);
 *  • fonte esterna e rich link: la Edge Function `link-preview` condivisa con
 *    HOM-06.1 (§66) con `purpose` dedicato; il client non invia mai metadata,
 *    solo lo `snapshot_id` che il server rilegge (§7H, §68);
 *  • dettaglio pubblico: `fetch_article_detail` — mai diritti né audit (§216);
 *  • salvataggio/invio: le RPC condivise di `publishing-service` con il payload
 *    costruito qui (`buildArticlePayload`).
 */

import { supabase } from "../../lib/supabase";
import { mapComposerIdentity } from "../post-composer/composer-service";
import type { ComposerIdentity, ComposerTaggedIdentity } from "../post-composer/composer-types";
import { fromWirePublication, mapSchedulePolicy } from "../publishing/publishing-service";
import type { ArticleCreationMode, ContentLifecycleState, Publication, SchedulePolicy } from "../publishing/publishing-types";
import { documentForWire, documentToLines, plainTextToDocument } from "./article-document";
import type { ArticleDraftState, ExternalSourceState } from "./article-presentation";
import { EMPTY_PROVENANCE } from "./article-presentation";
import {
  DEFAULT_ARTICLE_LIMITS,
  type ArticleCover,
  type ArticleDetail,
  type ArticleDocument,
  type ArticleLimits,
  type ArticleProvenance,
  type EditorLine,
  type RichLinkPreview,
  type WireArticleComposerContext,
  type WireArticleDetail,
  type WireArticleEditorPayload,
  type WireArticleLimits,
} from "./article-types";
import type { FeedContentType } from "../feed/feed-types";

function unwrapRow<T>(data: unknown): T | null {
  const row = Array.isArray(data) ? data[0] : data;
  return typeof row === "object" && row !== null ? (row as T) : null;
}

/* ------------------------------------------------------------------ */
/* Contesto                                                            */
/* ------------------------------------------------------------------ */

export type ArticleIdentity = ComposerIdentity & {
  canSchedule: boolean;
  modes: ArticleCreationMode[];
};

export type ArticleComposerContext = {
  identities: ArticleIdentity[];
  limits: ArticleLimits;
  schedule: SchedulePolicy;
  rightsDeclarationVersion: string;
};

export function mapArticleLimits(wire: WireArticleLimits | null | undefined): ArticleLimits {
  if (!wire) return DEFAULT_ARTICLE_LIMITS;
  return {
    excerptLength: wire.excerpt_length ?? DEFAULT_ARTICLE_LIMITS.excerptLength,
    maxBlockText: wire.max_block_text ?? DEFAULT_ARTICLE_LIMITS.maxBlockText,
    maxBlocks: wire.max_blocks ?? DEFAULT_ARTICLE_LIMITS.maxBlocks,
    maxBodyLength: wire.max_body_length ?? DEFAULT_ARTICLE_LIMITS.maxBodyLength,
    maxClipboardChars: wire.max_clipboard_chars ?? DEFAULT_ARTICLE_LIMITS.maxClipboardChars,
    maxTags: wire.max_tags ?? DEFAULT_ARTICLE_LIMITS.maxTags,
    maxTitleLength: wire.max_title_length ?? DEFAULT_ARTICLE_LIMITS.maxTitleLength,
    parseTimeoutMs: wire.parse_timeout_ms ?? DEFAULT_ARTICLE_LIMITS.parseTimeoutMs,
  };
}

export function mapArticleContext(wire: WireArticleComposerContext): ArticleComposerContext {
  return {
    identities: (wire.identities ?? []).map((identity) => ({
      ...mapComposerIdentity(identity),
      canSchedule: identity.can_schedule_content === true,
      modes: identity.article_modes ?? [],
    })),
    limits: mapArticleLimits(wire.limits),
    rightsDeclarationVersion: wire.rights_declaration_version ?? "v1",
    schedule: mapSchedulePolicy(wire.schedule),
  };
}

/** §16–§20, §7B: identity e modalità autorizzate, limiti centrali. */
export async function fetchArticleComposerContext(): Promise<ArticleComposerContext> {
  const { data, error } = await supabase.rpc("fetch_article_composer_context");
  if (error) throw error;
  const wire = unwrapRow<WireArticleComposerContext>(data);
  if (!wire) throw new Error("fetch_article_composer_context: risposta vuota");
  return mapArticleContext(wire);
}

/* ------------------------------------------------------------------ */
/* Fonte esterna e rich link (Edge Function condivisa)                 */
/* ------------------------------------------------------------------ */

type WireLinkResult =
  | {
      status: "ok";
      snapshot_id: string;
      original_url: string;
      final_url: string;
      normalized_url?: string | null;
      canonical_url?: string | null;
      title: string | null;
      description: string | null;
      image_url: string | null;
      favicon_url: string | null;
      domain: string;
      site_name: string | null;
      author?: string | null;
      published_time?: string | null;
    }
  | { status: "unavailable" | "blocked" | "invalid"; original_url: string; domain: string | null };

async function invokeLinkPreview(url: string, purpose: "article_source" | "rich_link"): Promise<WireLinkResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("link-preview", { body: { purpose, url } });
    if (error) return null;
    const result = unwrapRow<WireLinkResult>(data);
    return result?.status ? result : null;
  } catch {
    return null;
  }
}

/**
 * §7F–§7L: valida la destinazione e ne fotografa i metadata. Un fallimento
 * dei soli metadata produce comunque `ready` con titolo null (titolo manuale);
 * `failed` solo se la destinazione non è valida, non è sicura o non risponde.
 * Non lancia mai: l'URL inserito non si perde (§7F).
 */
export async function fetchArticleSource(url: string): Promise<ExternalSourceState> {
  const result = await invokeLinkPreview(url, "article_source");
  if (!result) {
    return { domain: null, reason: "unavailable", status: "failed", url };
  }
  if (result.status !== "ok") {
    return { domain: result.domain, reason: result.status, status: "failed", url };
  }
  return {
    canonicalUrl: result.canonical_url ?? null,
    domain: result.domain,
    finalUrl: result.final_url,
    normalizedUrl: result.normalized_url ?? null,
    siteName: result.site_name,
    snapshot: {
      author: result.author ?? null,
      description: result.description,
      favicon_url: result.favicon_url,
      image_url: result.image_url,
      published_time: result.published_time ?? null,
      site_name: result.site_name,
      title: result.title,
    },
    snapshotId: result.snapshot_id,
    status: "ready",
    url,
  };
}

/** §63–§70: preview di un rich link nel corpo. Un fallimento non blocca il publish (§70). */
export async function fetchRichLinkPreview(url: string): Promise<{ snapshotId: string | null; preview: RichLinkPreview | null }> {
  const result = await invokeLinkPreview(url, "rich_link");
  if (!result || result.status !== "ok") {
    return { preview: null, snapshotId: null };
  }
  return {
    preview: {
      description: result.description,
      domain: result.domain,
      favicon_url: result.favicon_url,
      final_url: result.final_url,
      image_url: result.image_url,
      site_name: result.site_name,
      title: result.title,
    },
    snapshotId: result.snapshot_id,
  };
}

/* ------------------------------------------------------------------ */
/* Dettaglio pubblico                                                  */
/* ------------------------------------------------------------------ */

export function mapArticleDetail(wire: WireArticleDetail): ArticleDetail {
  return {
    attribution: wire.attribution
      ? {
          originalAuthor: wire.attribution.original_author,
          originalUrl: wire.attribution.original_url,
          publishedElsewhere: wire.attribution.published_elsewhere === true,
          sourceName: wire.attribution.source_name,
        }
      : null,
    cover: wire.cover
      ? { altText: wire.cover.alt_text, height: wire.cover.height, url: wire.cover.url, width: wire.cover.width }
      : null,
    creationMode: wire.creation_mode,
    document: wire.document,
    source: wire.source
      ? {
          description: wire.source.description,
          domain: wire.source.domain,
          faviconUrl: wire.source.favicon_url,
          imageUrl: wire.source.image_url,
          openUrl: wire.source.open_url,
          siteName: wire.source.site_name,
          title: wire.source.title,
        }
      : null,
  };
}

/** §7K, §7U, §216: documento, cover e attribuzione di un articolo pubblicato. */
export async function fetchArticleDetail(contentType: FeedContentType, contentId: string): Promise<ArticleDetail | null> {
  const { data, error } = await supabase.rpc("fetch_article_detail", {
    p_content_id: contentId,
    p_content_type: contentType,
  });
  if (error) throw error;
  const wire = unwrapRow<WireArticleDetail>(data);
  return wire?.creation_mode ? mapArticleDetail(wire) : null;
}

/* ------------------------------------------------------------------ */
/* Editor: payload ⇄ stato                                             */
/* ------------------------------------------------------------------ */

export type LoadedArticle = {
  contentType: FeedContentType;
  contentId: string;
  status: ContentLifecycleState;
  version: number;
  identity: ComposerIdentity;
  publication: Publication;
  canEdit: boolean;
  canSchedule: boolean;
  canDelete: boolean;
  state: Omit<ArticleDraftState, "tagCount">;
  lines: EditorLine[];
  tagged: ComposerTaggedIdentity[];
  failureCode: string | null;
};

function coverFromWire(cover: WireArticleEditorPayload["article"]["cover"]): ArticleCover | null {
  if (!cover?.url) return null;
  return {
    altText: cover.alt_text,
    height: cover.height,
    localUri: null,
    storagePath: cover.storage_path,
    uploadStatus: "uploaded",
    url: cover.url,
    width: cover.width,
  };
}

function provenanceFromWire(wire: WireArticleEditorPayload["article"]["provenance"]): ArticleProvenance {
  if (!wire) return EMPTY_PROVENANCE;
  return {
    noOriginalLink: wire.no_original_link === true,
    originalAuthor: wire.original_author ?? "",
    originalUrl: wire.original_url ?? "",
    publishedElsewhere: wire.published_elsewhere,
    sourceName: wire.source_name ?? "",
  };
}

function sourceFromWire(wire: WireArticleEditorPayload["article"]["source"]): ExternalSourceState {
  if (!wire?.url) return { status: "empty" };
  if (!wire.snapshot_id) {
    return { domain: wire.domain, reason: "unavailable", status: "failed", url: wire.url };
  }
  return {
    canonicalUrl: wire.canonical_url,
    domain: wire.domain ?? "",
    finalUrl: wire.final_url ?? wire.url,
    normalizedUrl: wire.normalized_url,
    siteName: wire.site_name,
    snapshot: wire.snapshot ?? {
      author: null,
      description: null,
      favicon_url: null,
      image_url: null,
      published_time: null,
      site_name: wire.site_name,
      title: null,
    },
    snapshotId: wire.snapshot_id,
    status: "ready",
    url: wire.url,
  };
}

/** §147–§148, §7V: una bozza ripristina esattamente modalità e dati. */
export function mapArticleEditorPayload(wire: WireArticleEditorPayload): LoadedArticle {
  const article = wire.article;
  const document: ArticleDocument = article.document ?? { blocks: [], v: 1 };
  const source = sourceFromWire(article.source);
  const titleFromMeta = source.status === "ready" ? source.snapshot.title?.trim() ?? "" : "";
  return {
    canDelete: wire.capabilities?.can_delete === true,
    canEdit: wire.capabilities?.can_edit === true,
    canSchedule: wire.capabilities?.can_schedule === true,
    contentId: wire.content_id,
    contentType: wire.content_type,
    failureCode: wire.failure_code,
    identity: mapComposerIdentity(wire.identity),
    lines: documentToLines(document),
    publication: fromWirePublication(wire.publication),
    state: {
      cover: coverFromWire(article.cover),
      document,
      manualTitle: article.creation_mode === "external_link" && (article.source?.manual_title || titleFromMeta.length === 0) ? article.title : "",
      mode: article.creation_mode,
      provenance: provenanceFromWire(article.provenance),
      rightsConfirmed: article.rights_confirmed === true,
      source,
      title: article.creation_mode === "external_link" ? "" : article.title,
    },
    status: wire.status,
    tagged: (article.tagged ?? []).map((tag) => ({
      avatarUrl: tag.avatar_url,
      displayName: tag.display_name,
      identityId: tag.target_id,
      identityType: tag.target_type,
      isVerified: tag.is_verified,
      subtitle: tag.subtitle,
    })),
    version: wire.version,
  };
}

/** Vecchi articoli Media senza documento: il body in paragrafi (contratto §A6.6). */
export function legacyDocument(body: string | null | undefined): ArticleDocument {
  return plainTextToDocument(body ?? "");
}

/**
 * Il payload articolo di `save_content_draft` / `submit_content` (contratto
 * §A6.4). Il client non invia mai metadata della fonte né preview dei rich
 * link: solo URL e snapshot_id, che il server rilegge (§7H, §68).
 */
export function buildArticlePayload(
  state: Omit<ArticleDraftState, "tagCount">,
  tagged: readonly ComposerTaggedIdentity[],
  options: { confirmSourceChange?: boolean } = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    creation_mode: state.mode,
    rights_confirmed: state.mode === "imported_text" ? state.rightsConfirmed : false,
    tagged: tagged.map((tag) => ({ target_id: tag.identityId, target_type: tag.identityType })),
  };

  if (state.mode === "external_link") {
    const source = state.source;
    payload.title = source.status === "ready" && source.snapshot.title?.trim() ? source.snapshot.title.trim() : state.manualTitle.trim();
    payload.cover = null;
    payload.document = null;
    payload.provenance = null;
    payload.source =
      source.status === "ready"
        ? { manual_title: !source.snapshot.title?.trim(), snapshot_id: source.snapshotId, url: source.url }
        : source.status === "failed" || source.status === "loading"
          ? { manual_title: true, snapshot_id: null, url: source.url }
          : null;
  } else {
    payload.title = state.title.trim();
    payload.document = documentForWire(state.document);
    payload.source = null;
    payload.cover =
      state.cover && state.cover.storagePath
        ? {
            alt_text: state.cover.altText,
            height: state.cover.height,
            storage_path: state.cover.storagePath,
            width: state.cover.width,
          }
        : null;
    payload.provenance =
      state.mode === "imported_text"
        ? {
            no_original_link: state.provenance.publishedElsewhere ? state.provenance.noOriginalLink : false,
            original_author: state.provenance.publishedElsewhere ? state.provenance.originalAuthor.trim() || null : null,
            original_url:
              state.provenance.publishedElsewhere && !state.provenance.noOriginalLink
                ? state.provenance.originalUrl.trim() || null
                : null,
            published_elsewhere: state.provenance.publishedElsewhere,
            source_name: state.provenance.publishedElsewhere ? state.provenance.sourceName.trim() || null : null,
          }
        : null;
  }

  if (options.confirmSourceChange) {
    payload.confirm_source_change = true;
  }
  return payload;
}
