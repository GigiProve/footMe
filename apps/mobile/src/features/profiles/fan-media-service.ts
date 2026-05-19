import { supabase } from "../../lib/supabase";

export const FAN_MEDIA_TAG_OPTIONS = [
  { label: "Partita", value: "Partita" },
  { label: "Tifo", value: "Tifo" },
  { label: "Mercato", value: "Mercato" },
  { label: "Giovani", value: "Giovani" },
  { label: "Serie D", value: "Serie D" },
  { label: "Eccellenza", value: "Eccellenza" },
  { label: "Opinione", value: "Opinione" },
  { label: "Domanda", value: "Domanda" },
  { label: "Highlights", value: "Highlights" },
] as const;

export type FanMediaTag = (typeof FAN_MEDIA_TAG_OPTIONS)[number]["value"];
export type FanMediaVisualType = "image" | "video";

export type FanMediaComment = {
  author_avatar_url: string | null;
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  profile_id: string;
};

export type FanMediaPost = {
  comment_count: number;
  comments: FanMediaComment[];
  created_at: string;
  description: string;
  id: string;
  is_liked: boolean;
  is_saved: boolean;
  like_count: number;
  profile_id: string;
  published_at: string | null;
  saved_count: number;
  status: "draft" | "published" | "archived";
  tag: FanMediaTag | null;
  thumbnail_url: string | null;
  updated_at: string;
  visual_type: FanMediaVisualType;
  visual_url: string;
};

export type CreateFanMediaPostInput = {
  description: string;
  profileId: string;
  tag?: FanMediaTag | null;
  thumbnailUrl?: string | null;
  visualType: FanMediaVisualType;
  visualUrl: string;
};

type FanMediaPostRow = {
  created_at: string;
  description: string;
  id: string;
  profile_id: string;
  published_at: string | null;
  status: string;
  tag: string | null;
  thumbnail_url: string | null;
  updated_at: string;
  visual_type: string;
  visual_url: string;
};

type ProfileRow = {
  avatar_url: string | null;
  full_name: string | null;
  id: string;
};

const POST_SELECT =
  "id, profile_id, description, tag, visual_url, visual_type, thumbnail_url, status, published_at, created_at, updated_at";

export async function fetchFanMediaFeed(
  profileId: string,
  viewerProfileId?: string | null,
): Promise<FanMediaPost[]> {
  const { data, error } = await supabase
    .from("fan_media_posts")
    .select(POST_SELECT)
    .eq("profile_id", profileId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return enrichFanMediaPosts((data ?? []) as FanMediaPostRow[], viewerProfileId, true);
}

export async function fetchFanMediaPostDetail(
  postId: string,
  viewerProfileId?: string | null,
): Promise<FanMediaPost | null> {
  const { data, error } = await supabase
    .from("fan_media_posts")
    .select(POST_SELECT)
    .eq("id", postId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [post] = await enrichFanMediaPosts(
    [data as FanMediaPostRow],
    viewerProfileId,
    true,
  );

  return post ?? null;
}

export async function createFanMediaPost(
  input: CreateFanMediaPostInput,
): Promise<FanMediaPost> {
  const payload = buildCreatePayload(input);
  const { data, error } = await supabase
    .from("fan_media_posts")
    .insert(payload)
    .select(POST_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Contenuto non creato.");
  }

  const [post] = await enrichFanMediaPosts(
    [data as FanMediaPostRow],
    input.profileId,
    true,
  );

  if (!post) {
    throw new Error("Contenuto non creato.");
  }

  return post;
}

export async function toggleFanMediaLike(
  profileId: string,
  postId: string,
  shouldLike: boolean,
) {
  if (shouldLike) {
    const { error } = await supabase.from("fan_media_likes").upsert(
      {
        post_id: postId,
        profile_id: profileId,
      },
      { onConflict: "post_id,profile_id" },
    );

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("fan_media_likes")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function toggleSavedFanMedia(
  profileId: string,
  postId: string,
  shouldSave: boolean,
) {
  if (shouldSave) {
    const { error } = await supabase.from("saved_fan_media").upsert(
      {
        post_id: postId,
        profile_id: profileId,
      },
      { onConflict: "post_id,profile_id" },
    );

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("saved_fan_media")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function addFanMediaComment(input: {
  body: string;
  postId: string;
  profileId: string;
}): Promise<FanMediaComment> {
  const trimmedBody = input.body.trim();

  if (!trimmedBody) {
    throw new Error("Scrivi un commento prima di pubblicare.");
  }

  const { data, error } = await supabase
    .from("fan_media_comments")
    .insert({
      body: trimmedBody,
      post_id: input.postId,
      profile_id: input.profileId,
    })
    .select("id, post_id, profile_id, body, created_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Commento non creato.");
  }

  const profiles = await loadProfilesById([input.profileId]);
  const author = profiles.get(input.profileId);

  return {
    author_avatar_url: author?.avatar_url ?? null,
    author_name: author?.full_name?.trim() || "Utente FootMe",
    body: String((data as { body: string }).body),
    created_at: String((data as { created_at: string }).created_at),
    id: String((data as { id: string }).id),
    profile_id: input.profileId,
  };
}

export async function deleteFanMediaPost(postId: string) {
  const { error } = await supabase
    .from("fan_media_posts")
    .delete()
    .eq("id", postId);

  if (error) {
    throw error;
  }
}

export async function fetchProfileFollowState(
  followerProfileId: string,
  followedProfileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profile_follows")
    .select("follower_profile_id")
    .eq("follower_profile_id", followerProfileId)
    .eq("followed_profile_id", followedProfileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function followProfile(
  followerProfileId: string,
  followedProfileId: string,
) {
  if (followerProfileId === followedProfileId) {
    throw new Error("Non puoi seguire il tuo profilo.");
  }

  const { error } = await supabase.from("profile_follows").upsert(
    {
      followed_profile_id: followedProfileId,
      follower_profile_id: followerProfileId,
    },
    { ignoreDuplicates: true, onConflict: "follower_profile_id,followed_profile_id" },
  );

  if (error) {
    throw error;
  }
}

export async function unfollowProfile(
  followerProfileId: string,
  followedProfileId: string,
) {
  const { error } = await supabase
    .from("profile_follows")
    .delete()
    .eq("follower_profile_id", followerProfileId)
    .eq("followed_profile_id", followedProfileId);

  if (error) {
    throw error;
  }
}

function buildCreatePayload(input: CreateFanMediaPostInput) {
  const description = normalizeDescription(input.description);
  const visualUrl = normalizeText(input.visualUrl);
  const tag = normalizeFanMediaTag(input.tag);

  if (!description) {
    throw new Error("Scrivi un testo breve prima di pubblicare.");
  }

  if (!visualUrl) {
    throw new Error("Seleziona una foto o un video prima di pubblicare.");
  }

  return {
    description,
    profile_id: input.profileId,
    status: "published",
    tag,
    thumbnail_url: normalizeText(input.thumbnailUrl),
    visual_type: normalizeVisualType(input.visualType),
    visual_url: visualUrl,
  };
}

async function enrichFanMediaPosts(
  rows: FanMediaPostRow[],
  viewerProfileId?: string | null,
  includeComments = false,
): Promise<FanMediaPost[]> {
  if (rows.length === 0) {
    return [];
  }

  const postIds = rows.map((row) => row.id);
  const [
    likeCounts,
    commentCounts,
    savedCounts,
    likedIds,
    savedIds,
    commentsByPost,
  ] = await Promise.all([
    loadPostCountMap("fan_media_likes", postIds),
    loadPostCountMap("fan_media_comments", postIds),
    loadPostCountMap("saved_fan_media", postIds),
    viewerProfileId
      ? loadViewerPostIds("fan_media_likes", viewerProfileId, postIds)
      : Promise.resolve(new Set<string>()),
    viewerProfileId
      ? loadViewerPostIds("saved_fan_media", viewerProfileId, postIds)
      : Promise.resolve(new Set<string>()),
    includeComments
      ? loadCommentsByPost(postIds)
      : Promise.resolve(new Map<string, FanMediaComment[]>()),
  ]);

  return rows.map((row) => ({
    comment_count: commentCounts.get(row.id) ?? 0,
    comments: commentsByPost.get(row.id) ?? [],
    created_at: row.created_at,
    description: row.description,
    id: row.id,
    is_liked: likedIds.has(row.id),
    is_saved: savedIds.has(row.id),
    like_count: likeCounts.get(row.id) ?? 0,
    profile_id: row.profile_id,
    published_at: row.published_at ?? null,
    saved_count: savedCounts.get(row.id) ?? 0,
    status: normalizeStatus(row.status),
    tag: normalizeFanMediaTag(row.tag),
    thumbnail_url: row.thumbnail_url ?? null,
    updated_at: row.updated_at,
    visual_type: normalizeVisualType(row.visual_type),
    visual_url: row.visual_url,
  }));
}

async function loadPostCountMap(table: string, postIds: string[]) {
  const counts = new Map<string, number>();

  if (postIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabase
    .from(table)
    .select("post_id")
    .in("post_id", postIds);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as { post_id: string }[]) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
  }

  return counts;
}

async function loadViewerPostIds(
  table: string,
  profileId: string,
  postIds: string[],
) {
  const ids = new Set<string>();

  if (postIds.length === 0) {
    return ids;
  }

  const { data, error } = await supabase
    .from(table)
    .select("post_id")
    .eq("profile_id", profileId)
    .in("post_id", postIds);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as { post_id: string }[]) {
    ids.add(row.post_id);
  }

  return ids;
}

async function loadCommentsByPost(postIds: string[]) {
  const commentsByPost = new Map<string, FanMediaComment[]>();

  if (postIds.length === 0) {
    return commentsByPost;
  }

  const { data, error } = await supabase
    .from("fan_media_comments")
    .select("id, post_id, profile_id, body, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as {
    body: string;
    created_at: string;
    id: string;
    post_id: string;
    profile_id: string;
  }[];
  const profiles = await loadProfilesById(rows.map((row) => row.profile_id));

  for (const row of rows) {
    const profile = profiles.get(row.profile_id);
    const list = commentsByPost.get(row.post_id) ?? [];

    list.push({
      author_avatar_url: profile?.avatar_url ?? null,
      author_name: profile?.full_name?.trim() || "Utente FootMe",
      body: row.body,
      created_at: row.created_at,
      id: row.id,
      profile_id: row.profile_id,
    });
    commentsByPost.set(row.post_id, list);
  }

  return commentsByPost;
}

async function loadProfilesById(profileIds: string[]) {
  const profiles = new Map<string, ProfileRow>();
  const ids = uniqueIds(profileIds);

  if (ids.length === 0) {
    return profiles;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);

  if (error) {
    throw error;
  }

  for (const profile of (data ?? []) as ProfileRow[]) {
    profiles.set(profile.id, profile);
  }

  return profiles;
}

function normalizeDescription(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.length > 280 ? trimmed.slice(0, 280) : trimmed;
}

function normalizeFanMediaTag(value: unknown): FanMediaTag | null {
  return FAN_MEDIA_TAG_OPTIONS.some((option) => option.value === value)
    ? (value as FanMediaTag)
    : null;
}

function normalizeStatus(value: string): FanMediaPost["status"] {
  return value === "draft" || value === "archived" ? value : "published";
}

function normalizeVisualType(value: unknown): FanMediaVisualType {
  return value === "video" ? "video" : "image";
}

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueIds(ids: string[]) {
  return Array.from(
    new Set(
      ids
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}
