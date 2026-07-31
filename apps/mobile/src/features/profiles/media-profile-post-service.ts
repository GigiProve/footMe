import { notifyTaggedProfiles, searchTagTargets } from "../content/content-tag-service";
import { supabase } from "../../lib/supabase";

/**
 * Notify everyone following a media profile that it published new content.
 * Best-effort: failures must not block content creation.
 */
async function notifyMediaFollowers(input: {
  excludeProfileIds: string[];
  mediaProfileId: string;
  postId: string;
  title: string;
}) {
  const { data, error } = await supabase
    .from("profile_follows")
    .select("follower_profile_id")
    .eq("followed_profile_id", input.mediaProfileId);

  if (error || !data || data.length === 0) {
    return;
  }

  // Skip the author and anyone already notified as a tagged profile.
  const excluded = new Set(input.excludeProfileIds);
  const recipients = data
    .map((row) => row.follower_profile_id as string)
    .filter((id) => id && !excluded.has(id));

  if (recipients.length === 0) {
    return;
  }

  await supabase.from("notifications").insert(
    recipients.map((profileId) => ({
      body: `Nuovo contenuto: "${input.title}"`,
      data: { media_profile_id: input.mediaProfileId, post_id: input.postId },
      recipient_profile_id: profileId,
      title: "Un media che segui ha pubblicato un nuovo contenuto",
      type: "followed_media_content",
    })),
  );
}

export type MediaProfilePostKind = "article" | "news";
export type MediaProfilePostCoverType = "image" | "video";
export type MediaProfilePostStatus = "draft" | "published" | "archived";
export type MediaProfilePostTargetType = "profile" | "club" | "team";
/** How the post was produced: written on-platform, imported from a link, or pasted. */
export type MediaProfilePostSourceType = "platform" | "link" | "pasted";
/** For link-imported posts: show only a preview + link, or the full body in-app. */
export type MediaProfilePostDisplayMode = "preview" | "full";

export type MediaProfilePostTaggedTarget = {
  avatar_url: string | null;
  display_name: string;
  role: string | null;
  subtitle: string | null;
  target_id: string;
  target_type: MediaProfilePostTargetType;
};

export type MediaProfilePostComment = {
  author_avatar_url: string | null;
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  profile_id: string;
};

export type MediaProfilePost = {
  author_id: string | null;
  author_name: string;
  body: string | null;
  category: string;
  comment_count: number;
  comments: MediaProfilePostComment[];
  cover_type: MediaProfilePostCoverType | null;
  cover_url: string | null;
  created_at: string;
  created_by_profile_id: string;
  display_mode: MediaProfilePostDisplayMode;
  excerpt: string | null;
  external_url: string | null;
  id: string;
  is_saved: boolean;
  kind: MediaProfilePostKind;
  media_profile_id: string;
  published_at: string | null;
  /** Display name of the publishing media outlet (entity_name, fallback full_name). */
  publisher_name: string;
  reading_time_minutes: number;
  source_name: string | null;
  source_type: MediaProfilePostSourceType;
  status: MediaProfilePostStatus;
  subtitle: string | null;
  tagged_targets: MediaProfilePostTaggedTarget[];
  title: string;
  updated_at: string;
};

export type CreateMediaProfilePostInput = {
  authorId?: string | null;
  authorName: string;
  body?: string | null;
  category: string;
  coverType?: MediaProfilePostCoverType | null;
  coverUrl?: string | null;
  createdByProfileId: string;
  displayMode?: MediaProfilePostDisplayMode | null;
  excerpt?: string | null;
  externalUrl?: string | null;
  kind: MediaProfilePostKind;
  mediaProfileId: string;
  /** Display name of the publishing media profile, used in the tag notification. */
  publisherName?: string | null;
  sourceName?: string | null;
  sourceType?: MediaProfilePostSourceType | null;
  subtitle?: string | null;
  taggedTargets?: MediaProfilePostTaggedTarget[];
  title: string;
};

type MediaProfilePostRow = {
  author_id: string | null;
  author_name: string;
  body: string | null;
  category: string;
  cover_type: string | null;
  cover_url: string | null;
  created_at: string;
  created_by_profile_id: string;
  display_mode: string | null;
  excerpt: string | null;
  external_url: string | null;
  id: string;
  kind: string;
  media_profile_id: string;
  published_at: string | null;
  source_name: string | null;
  source_type: string | null;
  status: string;
  subtitle: string | null;
  title: string;
  updated_at: string;
};

type ProfileTargetRow = {
  avatar_url: string | null;
  city?: string | null;
  full_name: string | null;
  id: string;
  region?: string | null;
  role: string | null;
};

type ClubTargetRow = {
  category: string | null;
  city: string | null;
  id: string;
  logo_url: string | null;
  name: string;
  region: string | null;
};

type TeamTargetRow = {
  category: string | null;
  city: string | null;
  id: string;
  logo_url: string | null;
  name: string;
};

const POST_SELECT =
  "id, media_profile_id, created_by_profile_id, kind, category, title, subtitle, excerpt, body, cover_url, cover_type, external_url, author_id, author_name, source_type, display_mode, source_name, status, published_at, created_at, updated_at";

export async function fetchMediaProfilePostFeed(
  mediaProfileId: string,
  viewerProfileId?: string | null,
): Promise<MediaProfilePost[]> {
  const { data, error } = await supabase
    .from("media_profile_posts")
    .select(POST_SELECT)
    .eq("media_profile_id", mediaProfileId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return enrichMediaProfilePosts(
    (data ?? []) as MediaProfilePostRow[],
    viewerProfileId,
  );
}

export async function fetchMediaProfilePostDetail(
  postId: string,
  viewerProfileId?: string | null,
): Promise<MediaProfilePost | null> {
  const { data, error } = await supabase
    .from("media_profile_posts")
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

  const [post] = await enrichMediaProfilePosts(
    [data as MediaProfilePostRow],
    viewerProfileId,
    true,
  );

  return post ?? null;
}

export async function createMediaProfilePost(
  input: CreateMediaProfilePostInput,
): Promise<MediaProfilePost> {
  const payload = buildCreatePayload(input);
  const { data, error } = await supabase
    .from("media_profile_posts")
    .insert(payload)
    .select(POST_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Articolo non creato.");
  }

  const postId = (data as MediaProfilePostRow).id;
  const taggedTargets = uniqueTargets(input.taggedTargets ?? []);
  const taggedProfileIds = taggedTargets
    .filter((target) => target.target_type === "profile")
    .map((target) => target.target_id);

  if (taggedTargets.length > 0) {
    const { error: tagError } = await supabase
      .from("media_profile_post_tagged_targets")
      .insert(
        taggedTargets.map((target) => ({
          post_id: postId,
          target_id: target.target_id,
          target_type: target.target_type,
        })),
      );

    if (tagError) {
      throw tagError;
    }

    // Notifications are best-effort: a delivery failure must not fail the post.
    try {
      await notifyTaggedProfiles({
        contentLabel: input.kind === "news" ? "una news" : "un articolo",
        contentType: "media_profile",
        postId,
        publisherId: input.mediaProfileId,
        publisherName: normalizeText(input.publisherName) ?? undefined,
        taggedProfileIds,
        taggerProfileId: input.createdByProfileId,
      });
    } catch {
      // Swallow: the post is already created.
    }
  }

  // Notify followers of the media profile that a new article was published.
  const row = data as MediaProfilePostRow;
  const isPublished =
    (row as { status?: string }).status === "published" ||
    row.published_at !== null;

  if (isPublished) {
    try {
      await notifyMediaFollowers({
        // Skip the author and the already-notified tagged profiles.
        excludeProfileIds: [input.createdByProfileId, ...taggedProfileIds],
        mediaProfileId: input.mediaProfileId,
        postId,
        title: input.title,
      });
    } catch {
      // Swallow: the post is already created.
    }
  }

  const [post] = await enrichMediaProfilePosts(
    [data as MediaProfilePostRow],
    input.createdByProfileId,
    true,
  );

  return post;
}

export async function addMediaProfilePostComment(input: {
  body: string;
  postId: string;
  profileId: string;
}): Promise<MediaProfilePostComment> {
  const trimmedBody = input.body.trim();

  if (!trimmedBody) {
    throw new Error("Scrivi un commento prima di pubblicare.");
  }

  const { data, error } = await supabase
    .from("media_profile_post_comments")
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
    author_name: author?.full_name?.trim() || "Utente ProLink",
    body: String((data as { body: string }).body),
    created_at: String((data as { created_at: string }).created_at),
    id: String((data as { id: string }).id),
    profile_id: input.profileId,
  };
}

export async function toggleSavedMediaProfilePost(
  profileId: string,
  postId: string,
  shouldSave: boolean,
) {
  if (shouldSave) {
    const { error } = await supabase.from("saved_media_profile_posts").upsert(
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
    .from("saved_media_profile_posts")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function searchMediaProfilePostTargets(
  query: string,
  limit = 8,
): Promise<MediaProfilePostTaggedTarget[]> {
  const results = await searchTagTargets(query, limit);

  return results.map((item) => ({
    avatar_url: item.avatar_url,
    display_name: item.display_name,
    role: item.role_label,
    subtitle: item.subtitle || null,
    target_id: item.target_id,
    target_type: item.target_type as MediaProfilePostTargetType,
  }));
}

async function enrichMediaProfilePosts(
  rows: MediaProfilePostRow[],
  viewerProfileId?: string | null,
  includeComments = false,
): Promise<MediaProfilePost[]> {
  if (rows.length === 0) {
    return [];
  }

  const postIds = rows.map((row) => row.id);
  const [commentCounts, savedIds, taggedTargets, commentsByPost, publisherNames] =
    await Promise.all([
      loadPostCountMap("media_profile_post_comments", postIds),
      viewerProfileId
        ? loadViewerSavedPostIds(viewerProfileId, postIds)
        : Promise.resolve(new Set<string>()),
      loadTaggedTargets(postIds),
      includeComments
        ? loadCommentsByPost(postIds)
        : Promise.resolve(new Map<string, MediaProfilePostComment[]>()),
      loadPublisherNames(rows.map((row) => row.media_profile_id)),
    ]);

  return rows.map((row) => {
    const body = row.body ?? null;

    return {
      author_id: row.author_id ?? null,
      author_name: row.author_name,
      body,
      category: row.category,
      comment_count: commentCounts.get(row.id) ?? 0,
      comments: commentsByPost.get(row.id) ?? [],
      cover_type: normalizeCoverType(row.cover_type),
      cover_url: row.cover_url ?? null,
      created_at: row.created_at,
      created_by_profile_id: row.created_by_profile_id,
      display_mode: normalizeDisplayMode(row.display_mode),
      excerpt: row.excerpt ?? buildExcerpt(body),
      external_url: row.external_url ?? null,
      id: row.id,
      is_saved: savedIds.has(row.id),
      kind: normalizeKind(row.kind),
      media_profile_id: row.media_profile_id,
      published_at: row.published_at ?? null,
      publisher_name:
        publisherNames.get(row.media_profile_id) ?? row.author_name,
      reading_time_minutes: calculateReadingTime(body),
      source_name: row.source_name ?? null,
      source_type: normalizeSourceType(row.source_type),
      status: normalizeStatus(row.status),
      subtitle: row.subtitle ?? null,
      tagged_targets: taggedTargets.get(row.id) ?? [],
      title: row.title,
      updated_at: row.updated_at,
    };
  });
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

async function loadViewerSavedPostIds(profileId: string, postIds: string[]) {
  const ids = new Set<string>();

  if (postIds.length === 0) {
    return ids;
  }

  const { data, error } = await supabase
    .from("saved_media_profile_posts")
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

async function loadTaggedTargets(postIds: string[]) {
  const targetsByPost = new Map<string, MediaProfilePostTaggedTarget[]>();

  if (postIds.length === 0) {
    return targetsByPost;
  }

  const { data, error } = await supabase
    .from("media_profile_post_tagged_targets")
    .select("post_id, target_id, target_type, status")
    .in("post_id", postIds)
    // A removed tag is unlinked from the article: it must not appear in the
    // detail header ("con …"). Hidden/reported/in_review tags stay on the post.
    .neq("status", "removed");

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as {
    post_id: string;
    target_id: string;
    target_type: string;
  }[];
  const profileIds = rows
    .filter((row) => row.target_type === "profile")
    .map((row) => row.target_id);
  const clubIds = rows
    .filter((row) => row.target_type === "club")
    .map((row) => row.target_id);
  const teamIds = rows
    .filter((row) => row.target_type === "team")
    .map((row) => row.target_id);
  const [profiles, clubs, teams] = await Promise.all([
    loadProfilesById(profileIds),
    loadClubsById(clubIds),
    loadTeamsById(teamIds),
  ]);

  for (const row of rows) {
    const list = targetsByPost.get(row.post_id) ?? [];

    if (row.target_type === "club") {
      const club = clubs.get(row.target_id);
      list.push({
        avatar_url: club?.logo_url ?? null,
        display_name: club?.name?.trim() || "Societa ProLink",
        role: "club",
        subtitle: club
          ? [club.category, club.city ?? club.region].filter(Boolean).join(" - ") || null
          : null,
        target_id: row.target_id,
        target_type: "club",
      });
    } else if (row.target_type === "team") {
      const team = teams.get(row.target_id);
      list.push({
        avatar_url: team?.logo_url ?? null,
        display_name: team?.name?.trim() || "Squadra ProLink",
        role: "team",
        subtitle: team
          ? [team.category, team.city].filter(Boolean).join(" - ") || null
          : null,
        target_id: row.target_id,
        target_type: "team",
      });
    } else {
      const profile = profiles.get(row.target_id);
      list.push({
        avatar_url: profile?.avatar_url ?? null,
        display_name: profile?.full_name?.trim() || "Profilo ProLink",
        role: profile?.role ?? null,
        subtitle: profile
          ? formatProfileSubtitle(profile.role, profile.city ?? null, profile.region ?? null)
          : null,
        target_id: row.target_id,
        target_type: "profile",
      });
    }

    targetsByPost.set(row.post_id, list);
  }

  return targetsByPost;
}

async function loadCommentsByPost(postIds: string[]) {
  const commentsByPost = new Map<string, MediaProfilePostComment[]>();

  if (postIds.length === 0) {
    return commentsByPost;
  }

  const { data, error } = await supabase
    .from("media_profile_post_comments")
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
      author_name: profile?.full_name?.trim() || "Utente ProLink",
      body: row.body,
      created_at: row.created_at,
      id: row.id,
      profile_id: row.profile_id,
    });
    commentsByPost.set(row.post_id, list);
  }

  return commentsByPost;
}

async function loadPublisherNames(mediaProfileIds: string[]) {
  const names = new Map<string, string>();
  const ids = uniqueIds(mediaProfileIds);

  if (ids.length === 0) {
    return names;
  }

  const { data, error } = await supabase
    .from("media_profiles")
    .select("profile_id, entity_name")
    .in("profile_id", ids);

  if (error) {
    return names;
  }

  for (const row of (data ?? []) as {
    entity_name: string | null;
    profile_id: string;
  }[]) {
    const name = row.entity_name?.trim();

    if (name) {
      names.set(row.profile_id, name);
    }
  }

  // Fall back to the owner profile's full name where entity_name is missing.
  const missing = ids.filter((id) => !names.has(id));

  if (missing.length > 0) {
    const profiles = await loadProfilesById(missing);

    for (const id of missing) {
      names.set(id, profiles.get(id)?.full_name?.trim() || "Media ProLink");
    }
  }

  return names;
}

async function loadProfilesById(profileIds: string[]) {
  const profiles = new Map<string, ProfileTargetRow>();
  const ids = uniqueIds(profileIds);

  if (ids.length === 0) {
    return profiles;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, city, region")
    .in("id", ids);

  if (error) {
    throw error;
  }

  for (const profile of (data ?? []) as ProfileTargetRow[]) {
    profiles.set(profile.id, profile);
  }

  return profiles;
}

async function loadClubsById(clubIds: string[]) {
  const clubs = new Map<string, ClubTargetRow>();
  const ids = uniqueIds(clubIds);

  if (ids.length === 0) {
    return clubs;
  }

  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, city, region, category, logo_url")
    .in("id", ids);

  if (error) {
    throw error;
  }

  for (const club of (data ?? []) as ClubTargetRow[]) {
    clubs.set(club.id, club);
  }

  return clubs;
}

async function loadTeamsById(teamIds: string[]) {
  const teams = new Map<string, TeamTargetRow>();
  const ids = uniqueIds(teamIds);

  if (ids.length === 0) {
    return teams;
  }

  const { data, error } = await supabase
    .from("club_teams")
    .select("id, name, category, city, logo_url")
    .in("id", ids);

  if (error) {
    throw error;
  }

  for (const team of (data ?? []) as TeamTargetRow[]) {
    teams.set(team.id, team);
  }

  return teams;
}

function buildCreatePayload(input: CreateMediaProfilePostInput) {
  const title = input.title.trim();
  const authorName = input.authorName.trim();
  const category = input.category.trim();
  const body = normalizeText(input.body);
  const subtitle = normalizeText(input.subtitle);
  const excerpt = normalizeText(input.excerpt) ?? buildExcerpt(body);
  const coverUrl = normalizeText(input.coverUrl);
  const coverType = input.coverType ?? inferCoverType(coverUrl);
  const externalUrl = normalizeExternalUrl(input.externalUrl);
  const sourceType = normalizeSourceType(input.sourceType);
  // Only link-imported posts may be preview-only; everything else shows in full.
  const displayMode =
    sourceType === "link" ? normalizeDisplayMode(input.displayMode) : "full";

  validateCreateInput({
    authorName,
    body,
    category,
    displayMode,
    excerpt,
    kind: input.kind,
    sourceType,
    title,
  });

  return {
    author_name: authorName,
    author_id: normalizeText(input.authorId),
    body,
    category,
    cover_type: coverType,
    cover_url: coverUrl,
    created_by_profile_id: input.createdByProfileId,
    display_mode: displayMode,
    excerpt,
    external_url: externalUrl,
    kind: input.kind,
    media_profile_id: input.mediaProfileId,
    source_name: normalizeText(input.sourceName),
    source_type: sourceType,
    status: "published",
    subtitle,
    title,
  };
}

function validateCreateInput(input: {
  authorName: string;
  body: string | null;
  category: string;
  displayMode: MediaProfilePostDisplayMode;
  excerpt: string | null;
  kind: MediaProfilePostKind;
  sourceType: MediaProfilePostSourceType;
  title: string;
}) {
  if (!input.title) {
    throw new Error("Inserisci un titolo per il contenuto.");
  }

  if (!input.category) {
    throw new Error("Seleziona una categoria.");
  }

  if (!input.authorName) {
    throw new Error("Inserisci l'autore del contenuto.");
  }

  // Link imported as preview-only: the body is intentionally not brought in-app,
  // so only a description/excerpt (shown next to the source link) is required.
  if (input.sourceType === "link" && input.displayMode === "preview") {
    if (!input.excerpt && !input.body) {
      throw new Error("Aggiungi una descrizione per l'anteprima del link.");
    }

    return;
  }

  if (input.kind === "article" && !input.body) {
    throw new Error("Inserisci il testo dell'articolo.");
  }

  if (input.kind === "news" && !input.body && !input.excerpt) {
    throw new Error("Scrivi il testo della news.");
  }
}

/** Count words in a body, ignoring markdown markers used by the editor toolbar. */
export function countWords(body: string | null | undefined): number {
  if (!body) {
    return 0;
  }

  return body
    .replace(/[*_>#-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Estimate reading time in minutes (~220 words/min), minimum 1. */
export function calculateReadingTime(body: string | null): number {
  const words = countWords(body);

  if (words === 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(words / 220));
}

function buildExcerpt(body: string | null) {
  if (!body) {
    return null;
  }

  return body.length > 150 ? `${body.slice(0, 147).trim()}...` : body;
}

function normalizeKind(value: string): MediaProfilePostKind {
  return value === "news" ? "news" : "article";
}

function normalizeStatus(value: string): MediaProfilePostStatus {
  return value === "draft" || value === "archived" ? value : "published";
}

function normalizeSourceType(
  value: string | null | undefined,
): MediaProfilePostSourceType {
  return value === "link" || value === "pasted" ? value : "platform";
}

function normalizeDisplayMode(
  value: string | null | undefined,
): MediaProfilePostDisplayMode {
  return value === "preview" ? "preview" : "full";
}

function normalizeCoverType(value: string | null): MediaProfilePostCoverType | null {
  return value === "image" || value === "video" ? value : null;
}

function inferCoverType(url: string | null): MediaProfilePostCoverType | null {
  if (!url) {
    return null;
  }

  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?.*)?$/i.test(url) ? "video" : "image";
}

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeExternalUrl(value: string | null | undefined) {
  const trimmed = normalizeText(value);

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^www\./i.test(trimmed) || trimmed.includes(".")) {
    return `https://${trimmed}`;
  }

  return trimmed;
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

function uniqueTargets(targets: MediaProfilePostTaggedTarget[]) {
  const seen = new Set<string>();
  const unique: MediaProfilePostTaggedTarget[] = [];

  targets.forEach((target) => {
    const key = `${target.target_type}:${target.target_id}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(target);
  });

  return unique;
}

function formatProfileSubtitle(
  role: string | null,
  city: string | null,
  region: string | null,
) {
  const roleLabel =
    role === "player"
      ? "Calciatore"
      : role === "coach"
        ? "Allenatore"
        : role === "staff"
          ? "Staff"
          : role === "director"
            ? "Dirigente"
            : "Profilo";
  const location = city || region;

  return location ? `${roleLabel} - ${location}` : roleLabel;
}
