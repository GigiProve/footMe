import { supabase } from "../../lib/supabase";

/**
 * Content surfaces where a profile can be tagged. Each maps to an existing
 * per-content tag table with a `status` column.
 */
export type TaggedContentType = "club_media" | "fan_tribuna" | "media_profile";

export type TagStatus =
  | "active"
  | "hidden"
  | "reported"
  | "in_review"
  | "removed";

export const TAG_STATUS_LABELS: Record<TagStatus, string> = {
  active: "Attivo",
  hidden: "Nascosto dal profilo",
  in_review: "In revisione",
  removed: "Rimosso",
  reported: "Segnalato",
};

export type ReportReason =
  | "info_non_corrette"
  | "uso_improprio"
  | "contenuto_offensivo"
  | "spam"
  | "altro";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  altro: "Altro",
  contenuto_offensivo: "Contenuto offensivo",
  info_non_corrette: "Informazioni non corrette",
  spam: "Spam o non pertinente",
  uso_improprio: "Uso improprio del profilo",
};

export type TargetType = "profile" | "club" | "team";

const PROFILE_ROLE_LABELS: Record<string, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
};

/**
 * Localized role label for a tag suggestion. Only profiles carry a role; clubs
 * and teams return null so their meta line shows just the subtitle.
 */
export function formatTargetRoleLabel(
  roleLabel: string | null | undefined,
  targetType: TargetType,
): string | null {
  if (targetType !== "profile" || !roleLabel) {
    return null;
  }

  return PROFILE_ROLE_LABELS[roleLabel] ?? "Profilo";
}

export type TaggedContentItem = {
  content_type: TaggedContentType;
  kind: string;
  post_id: string;
  published_at: string | null;
  publisher_id: string;
  publisher_name: string;
  thumbnail_url: string | null;
  title: string;
};

export type TagSearchResult = {
  avatar_url: string | null;
  display_name: string;
  role_label: string;
  subtitle: string;
  target_id: string;
  target_type: TargetType;
};

/**
 * The tagged party sets the moderation status of their own tag row. RLS only
 * permits updating rows where the caller is the tagged party (or club owner for
 * club/team targets on club_media).
 *
 * For club_media, matching now uses target_type + coalesce(target_id, profile_id)
 * because the table was migrated to a surrogate PK with non-account target support.
 */
async function setTagStatus(
  contentType: TaggedContentType,
  postId: string,
  taggedId: string,
  status: TagStatus,
  targetType: TargetType = "profile",
) {
  if (contentType === "club_media") {
    // club_media_tagged_profiles has target_type/target_id after the migration.
    // The RLS policy gates this update to: profile_id=auth.uid() for profile targets,
    // or owns_club(post.club_id) for club/team targets.
    const { error } = await supabase
      .from("club_media_tagged_profiles")
      .update({ status })
      .eq("post_id", postId)
      .eq("target_type", targetType)
      .eq("target_id", taggedId);

    if (error) {
      throw error;
    }

    return;
  }

  if (contentType === "fan_tribuna") {
    const { error } = await supabase
      .from("fan_tribuna_tagged_players")
      .update({ status })
      .eq("post_id", postId)
      .eq("player_profile_id", taggedId);

    if (error) {
      throw error;
    }

    return;
  }

  // media_profile: uses (target_type, target_id)
  const { error } = await supabase
    .from("media_profile_post_tagged_targets")
    .update({ status })
    .eq("post_id", postId)
    .eq("target_type", targetType)
    .eq("target_id", taggedId);

  if (error) {
    throw error;
  }
}

/**
 * Notify profiles that they were tagged in a piece of content. Best-effort:
 * the tagger is never the recipient, and failures do not block content creation.
 */
export async function notifyTaggedProfiles(input: {
  /** Lowercase content noun used in the notification body, e.g. "un articolo". */
  contentLabel?: string;
  contentType: TaggedContentType;
  postId: string;
  publisherId?: string;
  publisherName?: string;
  taggedProfileIds: string[];
  taggerProfileId: string;
}) {
  const recipients = Array.from(new Set(input.taggedProfileIds)).filter(
    (id) => id && id !== input.taggerProfileId,
  );

  if (recipients.length === 0) {
    return;
  }

  const label = input.contentLabel ?? "un contenuto";
  const body = input.publisherName
    ? `${input.publisherName} ti ha taggato in ${label}`
    : `Sei stato taggato in ${label}`;

  await supabase.from("notifications").insert(
    recipients.map((profileId) => ({
      body,
      data: {
        content_type: input.contentType,
        post_id: input.postId,
        publisher_id: input.publisherId ?? null,
        target_type: "profile",
      },
      recipient_profile_id: profileId,
      title: "Nuovo tag",
      type: "content_tag",
    })),
  );
}

/** Hide a tag from the tagged party's own profile view. */
export function hideTag(
  contentType: TaggedContentType,
  postId: string,
  taggedId: string,
  targetType: TargetType = "profile",
) {
  return setTagStatus(contentType, postId, taggedId, "hidden", targetType);
}

/** Remove a tag entirely (disappears from all surfaces except the publisher's own view). */
export function removeTag(
  contentType: TaggedContentType,
  postId: string,
  taggedId: string,
  targetType: TargetType = "profile",
) {
  return setTagStatus(contentType, postId, taggedId, "removed", targetType);
}

/**
 * Report a tag via the report_content_tag RPC which:
 *   1. Inserts a row in content_tag_reports.
 *   2. Sets the tag status to 'reported'.
 */
export async function reportTag(
  contentType: TaggedContentType,
  postId: string,
  taggedId: string,
  reason: ReportReason,
  note?: string | null,
  targetType: TargetType = "profile",
) {
  const { error } = await supabase.rpc("report_content_tag", {
    p_content_type: contentType,
    p_note: note ?? null,
    p_post_id: postId,
    p_reason: reason,
    p_tagged_id: taggedId,
    p_target_type: targetType,
  });

  if (error) {
    throw error;
  }
}

/**
 * Fetch content where the given profile is tagged (active only).
 * Uses the fetch_tagged_content_for_owner RPC; omit profileId to default to auth.uid().
 */
export async function fetchTaggedContentForProfile(
  profileId?: string,
): Promise<TaggedContentItem[]> {
  const params = profileId ? { p_profile_id: profileId } : {};
  const { data, error } = await supabase.rpc(
    "fetch_tagged_content_for_owner",
    params,
  );

  if (error) {
    throw error;
  }

  return (data ?? []) as TaggedContentItem[];
}

/**
 * Search taggable targets across profiles, clubs, and internal teams.
 * Returns an empty array for queries shorter than 2 characters (client-side guard
 * mirrors the RPC server-side guard to avoid a round-trip).
 */
export async function searchTagTargets(
  query: string,
  limit = 20,
): Promise<TagSearchResult[]> {
  if (query.trim().length < 2) {
    return [];
  }

  const { data, error } = await supabase.rpc("search_tag_targets", {
    p_limit: limit,
    p_query: query,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as TagSearchResult[];
}
