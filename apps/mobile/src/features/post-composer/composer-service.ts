/**
 * Accesso ai dati del composer Post (HOM-06.1 §18, §75–80, §99–104, §117–118,
 * §146, §155–161, §174–177).
 *
 * Una RPC per intenzione, nessuna tabella letta dal client: contesto
 * (`fetch_post_composer_context`), pubblicazione (`publish_post`), lettura per la
 * modifica (`fetch_post_for_edit`), salvataggio (`update_post`). La preview del
 * link passa dalla Edge Function `link-preview` (recupero server-side §76,
 * snapshot persistito §80). La ricerca dei tag riusa `search_tag_targets` di
 * `features/content/content-tag-service.ts`: nessun motore separato (§101).
 *
 * Gli errori delle RPC sono codici nel `message` (stile `content_*` di HOM-04);
 * `parseComposerError` li riconduce a `ComposerErrorKind` per la copy (§169–175).
 * Un timeout dopo l'invio NON si tratta come fallimento certo (§176): lo stesso
 * `p_operation_key` rilancia in sicurezza il publish, il server risponde
 * `replayed = true` invece di creare un secondo Post.
 */

import { supabase } from "../../lib/supabase";
import { formatTargetRoleLabel, searchTagTargets, type TagSearchResult } from "../content/content-tag-service";
import { normalizeUrl } from "./composer-presentation";
import {
  COMPOSER_ERROR_CODES,
  type ComposerErrorCode,
  type ComposerErrorKind,
  type ComposerIdentity,
  type ComposerLimits,
  type ComposerLinkPreviewState,
  type ComposerMediaItem,
  type ComposerPostForEdit,
  type ComposerTaggedIdentity,
  type WireComposerContext,
  type WireComposerIdentity,
  type WireComposerLimits,
  type WireLinkPreviewResult,
  type WirePostForEdit,
  type WirePublishPostArgs,
  type WirePublishPostResult,
  type WireUpdatePostArgs,
  type WireUpdatePostResult,
} from "./composer-types";
import type { FeedContentType } from "../feed/feed-types";

/* ------------------------------------------------------------------ */
/* Mappers puri (wire → dominio)                                       */
/* ------------------------------------------------------------------ */

function unwrapRow<T>(data: unknown): T | null {
  const row = Array.isArray(data) ? data[0] : data;
  return typeof row === "object" && row !== null ? (row as T) : null;
}

export function mapComposerIdentity(wire: WireComposerIdentity): ComposerIdentity {
  return {
    avatarUrl: wire.avatar_url,
    contextLabel: wire.context_label,
    id: wire.identity_id,
    isVerified: wire.is_verified,
    name: wire.name,
    type: wire.identity_type,
  };
}

export function mapComposerLimits(wire: WireComposerLimits): ComposerLimits {
  return {
    maxBodyLength: wire.max_body_length,
    maxMedia: wire.max_media,
    maxMentions: wire.max_mentions,
    maxTags: wire.max_tags,
    maxVideoSeconds: wire.max_video_seconds,
  };
}

export type ComposerContext = { identities: ComposerIdentity[]; limits: ComposerLimits };

export function mapComposerContext(wire: WireComposerContext): ComposerContext {
  return {
    identities: (wire.identities ?? []).map(mapComposerIdentity),
    limits: mapComposerLimits(wire.limits),
  };
}

export function mapPostForEdit(wire: WirePostForEdit): ComposerPostForEdit {
  const link: ComposerPostForEdit["link"] =
    // `has_preview` decide, non lo snapshot: un'anteprima salvata può arrivare senza
    // `snapshot_id`, e un link senza anteprima resta solo testo.
    wire.link && wire.link.has_preview
      ? {
          description: wire.link.description,
          domain: wire.link.domain,
          finalUrl: wire.link.url,
          imageUrl: wire.link.image_url,
          snapshotId: wire.link.snapshot_id,
          status: "ready",
          title: wire.link.title,
          // Normalizzato come l'URL del testo: lo confrontano `dropStaleLink` e `toWireLink`.
          url: normalizeUrl(wire.link.url) ?? wire.link.url,
        }
      : null;

  const media: ComposerMediaItem[] = [...wire.media]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      altText: null,
      durationSeconds: item.duration_seconds,
      errorCode: null,
      height: item.height,
      localId: `remote-${item.position}`,
      localUri: null,
      mimeType: null,
      remoteMediaPosition: item.position,
      remoteUrl: item.url,
      storagePath: null,
      thumbnailUri: item.thumbnail_url,
      type: item.media_type,
      uploadProgress: null,
      uploadStatus: "uploaded",
      width: item.width,
    }));

  return {
    author: mapComposerIdentity(wire.author),
    body: wire.body,
    canEdit: wire.can_edit,
    contentId: wire.content_id,
    contentType: wire.content_type,
    link,
    media,
    mentions: wire.mentions.map((mention) => ({
      displayName: mention.display_name,
      end: mention.end,
      identityId: mention.identity_id,
      identityType: mention.identity_type,
      start: mention.start,
    })),
    tagged: wire.tagged.map((tag) => ({
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

/** Dalla risposta della Edge Function allo stato della preview (§89–91). */
export function linkStateFromResult(url: string, result: WireLinkPreviewResult): ComposerLinkPreviewState {
  if (result.status === "ok") {
    return {
      description: result.description,
      domain: result.domain,
      finalUrl: result.final_url,
      imageUrl: result.image_url,
      snapshotId: result.snapshot_id,
      status: "ready",
      title: result.title,
      url,
    };
  }

  // `unavailable` è temporaneo (§91 «Riprova»); `blocked`/`invalid` non lo diventano.
  return {
    domain: result.domain,
    retryable: result.status === "unavailable",
    status: "failed",
    url,
  };
}

/** Un risultato della ricerca condivisa come identità taggabile; i team interni non sono taggabili qui (§99). */
export function mapTagCandidate(result: TagSearchResult): ComposerTaggedIdentity | null {
  if (result.target_type !== "profile" && result.target_type !== "club") {
    return null;
  }

  const role = formatTargetRoleLabel(result.role_label, result.target_type);
  const subtitle = [role, result.subtitle].filter((part): part is string => Boolean(part)).join(" · ");

  return {
    avatarUrl: result.avatar_url,
    displayName: result.display_name,
    identityId: result.target_id,
    identityType: result.target_type,
    // Il check viene dal server (§183); su un server che non lo manda ancora, nessun check inventato.
    isVerified: result.is_verified === true,
    subtitle: subtitle.length > 0 ? subtitle : null,
  };
}

/* ------------------------------------------------------------------ */
/* Errori                                                              */
/* ------------------------------------------------------------------ */

const NETWORK_PATTERN = /network|fetch|timeout|timed out|offline|internet|connection|ECONN|ENOTFOUND/i;

/**
 * §169–177: dal codice nel `message` della RPC; senza codice, `42501` vale come
 * permesso perso (del publish o dell'edit a seconda del contesto), un errore di
 * trasporto vale `network`, il resto `unknown`.
 */
export function parseComposerError(
  error: unknown,
  context: "publish" | "edit" = "publish",
): ComposerErrorKind {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : typeof error === "string"
          ? error
          : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  const named = COMPOSER_ERROR_CODES.find((candidate: ComposerErrorCode) => message.includes(candidate));
  if (named) {
    return named;
  }

  if (code === "42501") {
    return context === "edit" ? "post_edit_denied" : "post_permission_denied";
  }
  if (code === "40001") {
    return "post_version_conflict";
  }
  if (code === "P0002") {
    return "post_not_found";
  }

  return NETWORK_PATTERN.test(message) ? "network" : "unknown";
}

/* ------------------------------------------------------------------ */
/* RPC                                                                 */
/* ------------------------------------------------------------------ */

/** §18, §61: identity con can_publish_post e limiti dalla sola source of truth. */
export async function fetchComposerContext(): Promise<ComposerContext> {
  const { data, error } = await supabase.rpc("fetch_post_composer_context");

  if (error) {
    throw error;
  }

  const wire = unwrapRow<WireComposerContext>(data);

  if (!wire?.limits) {
    throw new Error("fetch_post_composer_context: risposta senza limiti");
  }

  return mapComposerContext(wire);
}

/** §117–118: stessa `p_operation_key` per ogni tentativo della sessione. */
export async function publishPost(args: WirePublishPostArgs): Promise<WirePublishPostResult> {
  const { data, error } = await supabase.rpc("publish_post", args);

  if (error) {
    throw error;
  }

  const result = unwrapRow<WirePublishPostResult>(data);

  if (!result?.content_id || !result.content_type) {
    throw new Error("publish_post: risposta senza contenuto");
  }

  return result;
}

/** §146: il server rivaluta `can_edit` e rifiuta ciò che non è un Post. */
export async function fetchPostForEdit(
  contentType: FeedContentType,
  postId: string,
): Promise<ComposerPostForEdit> {
  const { data, error } = await supabase.rpc("fetch_post_for_edit", {
    p_content_type: contentType,
    p_post_id: postId,
  });

  if (error) {
    throw error;
  }

  const wire = unwrapRow<WirePostForEdit>(data);

  if (!wire?.content_id) {
    throw new Error("fetch_post_for_edit: risposta senza contenuto");
  }

  return mapPostForEdit(wire);
}

/** §155–161: la versione attesa fa rifiutare l'overwrite silenzioso. */
export async function updatePost(args: WireUpdatePostArgs): Promise<WireUpdatePostResult> {
  const { data, error } = await supabase.rpc("update_post", args);

  if (error) {
    throw error;
  }

  const result = unwrapRow<WireUpdatePostResult>(data);

  if (!result?.content_id || !result.version) {
    throw new Error("update_post: risposta senza versione");
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Preview link e ricerca                                              */
/* ------------------------------------------------------------------ */

/**
 * §75–80: il recupero dei metadata è del server (SSRF, redirect, timeout §77–79).
 * Non lancia mai: un fallimento della preview non blocca la pubblicazione (§89),
 * diventa uno stato `failed` ritentabile (§91).
 */
export async function fetchLinkPreview(url: string): Promise<ComposerLinkPreviewState> {
  try {
    const { data, error } = await supabase.functions.invoke("link-preview", { body: { url } });

    if (error) {
      return { domain: null, retryable: true, status: "failed", url };
    }

    const result = unwrapRow<WireLinkPreviewResult>(data);

    return result?.status
      ? linkStateFromResult(url, result)
      : { domain: null, retryable: true, status: "failed", url };
  } catch {
    return { domain: null, retryable: true, status: "failed", url };
  }
}

/**
 * §99–104, §110: profili e Società dalla ricerca PROLINK condivisa
 * (`search_tag_targets`, soglia di 2 caratteri inclusa). Serve sia al selector
 * Tagga sia all'autocomplete `@`.
 */
export async function searchTagCandidates(query: string, limit = 20): Promise<ComposerTaggedIdentity[]> {
  const results = await searchTagTargets(query, limit);

  return results.flatMap((result) => {
    const candidate = mapTagCandidate(result);
    return candidate ? [candidate] : [];
  });
}
