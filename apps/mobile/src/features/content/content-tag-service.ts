import { supabase } from "../../lib/supabase";

/**
 * Content surfaces where a profile can be tagged. Each maps to an existing
 * per-content tag table with a `status` column (active | hidden | reported).
 */
export type TaggedContentType = "club_media" | "fan_tribuna" | "media_profile";

export type TagStatus = "active" | "hidden" | "reported";

type TagTableConfig = {
  /** The column holding the tagged profile id. */
  profileColumn: string;
  table: string;
};

const TAG_TABLES: Record<TaggedContentType, TagTableConfig> = {
  club_media: {
    profileColumn: "profile_id",
    table: "club_media_tagged_profiles",
  },
  fan_tribuna: {
    profileColumn: "player_profile_id",
    table: "fan_tribuna_tagged_players",
  },
  media_profile: {
    // media_profile_post_tagged_targets uses (target_type='profile', target_id)
    profileColumn: "target_id",
    table: "media_profile_post_tagged_targets",
  },
};

/**
 * The tagged profile sets the moderation status of their own tag row. RLS only
 * permits updating rows where the caller is the tagged party.
 */
async function setTagStatus(
  contentType: TaggedContentType,
  postId: string,
  taggedProfileId: string,
  status: TagStatus,
) {
  const config = TAG_TABLES[contentType];

  let query = supabase
    .from(config.table)
    .update({ status })
    .eq("post_id", postId)
    .eq(config.profileColumn, taggedProfileId);

  if (contentType === "media_profile") {
    query = query.eq("target_type", "profile");
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
}

/**
 * Notify profiles that they were tagged in a piece of content. Best-effort:
 * the tagger is never the recipient, and failures do not block content creation.
 */
export async function notifyTaggedProfiles(input: {
  contentType: TaggedContentType;
  postId: string;
  taggedProfileIds: string[];
  taggerProfileId: string;
}) {
  const recipients = Array.from(new Set(input.taggedProfileIds)).filter(
    (id) => id && id !== input.taggerProfileId,
  );

  if (recipients.length === 0) {
    return;
  }

  await supabase.from("notifications").insert(
    recipients.map((profileId) => ({
      body: "Sei stato taggato in un contenuto",
      data: {
        content_type: input.contentType,
        post_id: input.postId,
      },
      recipient_profile_id: profileId,
      title: "Nuovo tag",
      type: "content_tag",
    })),
  );
}

/** Hide a tag from the tagged profile's own profile view. */
export function hideTag(
  contentType: TaggedContentType,
  postId: string,
  taggedProfileId: string,
) {
  return setTagStatus(contentType, postId, taggedProfileId, "hidden");
}

/** Report a tag as inappropriate (flags for later moderation). */
export function reportTag(
  contentType: TaggedContentType,
  postId: string,
  taggedProfileId: string,
) {
  return setTagStatus(contentType, postId, taggedProfileId, "reported");
}
