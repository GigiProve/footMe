import { supabase } from "../../lib/supabase";

export type MediaProfilePostKind = "article" | "news";
export type MediaProfilePostCoverType = "image" | "video";
export type MediaProfilePostStatus = "draft" | "published" | "archived";
export type MediaProfilePostTargetType = "profile" | "club";

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
  author_name: string;
  body: string | null;
  category: string;
  comment_count: number;
  comments: MediaProfilePostComment[];
  cover_type: MediaProfilePostCoverType | null;
  cover_url: string | null;
  created_at: string;
  created_by_profile_id: string;
  excerpt: string | null;
  external_url: string | null;
  id: string;
  is_saved: boolean;
  kind: MediaProfilePostKind;
  media_profile_id: string;
  published_at: string | null;
  reading_time_minutes: number;
  status: MediaProfilePostStatus;
  subtitle: string | null;
  tagged_targets: MediaProfilePostTaggedTarget[];
  title: string;
  updated_at: string;
};

export type CreateMediaProfilePostInput = {
  authorName: string;
  body?: string | null;
  category: string;
  coverType?: MediaProfilePostCoverType | null;
  coverUrl?: string | null;
  createdByProfileId: string;
  excerpt?: string | null;
  externalUrl?: string | null;
  kind: MediaProfilePostKind;
  mediaProfileId: string;
  subtitle?: string | null;
  taggedTargets?: MediaProfilePostTaggedTarget[];
  title: string;
};

type MediaProfilePostRow = {
  author_name: string;
  body: string | null;
  category: string;
  cover_type: string | null;
  cover_url: string | null;
  created_at: string;
  created_by_profile_id: string;
  excerpt: string | null;
  external_url: string | null;
  id: string;
  kind: string;
  media_profile_id: string;
  published_at: string | null;
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

const POST_SELECT =
  "id, media_profile_id, created_by_profile_id, kind, category, title, subtitle, excerpt, body, cover_url, cover_type, external_url, author_name, status, published_at, created_at, updated_at";

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
    author_name: author?.full_name?.trim() || "Utente FootMe",
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

export async function searchMediaProfilePostTargets(query: string, limit = 8) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [] as MediaProfilePostTaggedTarget[];
  }

  const [profilesResult, clubsResult] = await Promise.all([
    supabase
      .from("profiles_with_age")
      .select("id, full_name, avatar_url, role, city, region")
      .in("role", ["player", "coach", "staff"])
      .ilike("full_name", `%${trimmedQuery}%`)
      .limit(limit),
    supabase
      .from("clubs")
      .select("id, name, city, region, category, logo_url")
      .ilike("name", `%${trimmedQuery}%`)
      .limit(limit),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (clubsResult.error) {
    throw clubsResult.error;
  }

  const profileTargets = ((profilesResult.data ?? []) as ProfileTargetRow[]).map(
    (row) => ({
      avatar_url: row.avatar_url,
      display_name: row.full_name?.trim() || "Profilo FootMe",
      role: row.role,
      subtitle: formatProfileSubtitle(row.role, row.city ?? null, row.region ?? null),
      target_id: row.id,
      target_type: "profile" as const,
    }),
  );
  const clubTargets = ((clubsResult.data ?? []) as ClubTargetRow[]).map((row) => ({
    avatar_url: row.logo_url,
    display_name: row.name,
    role: "club",
    subtitle: [row.category, row.city ?? row.region].filter(Boolean).join(" - ") || null,
    target_id: row.id,
    target_type: "club" as const,
  }));

  return [...profileTargets, ...clubTargets].slice(0, limit);
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
  const [commentCounts, savedIds, taggedTargets, commentsByPost] =
    await Promise.all([
      loadPostCountMap("media_profile_post_comments", postIds),
      viewerProfileId
        ? loadViewerSavedPostIds(viewerProfileId, postIds)
        : Promise.resolve(new Set<string>()),
      loadTaggedTargets(postIds),
      includeComments
        ? loadCommentsByPost(postIds)
        : Promise.resolve(new Map<string, MediaProfilePostComment[]>()),
    ]);

  return rows.map((row) => {
    const body = row.body ?? null;

    return {
      author_name: row.author_name,
      body,
      category: row.category,
      comment_count: commentCounts.get(row.id) ?? 0,
      comments: commentsByPost.get(row.id) ?? [],
      cover_type: normalizeCoverType(row.cover_type),
      cover_url: row.cover_url ?? null,
      created_at: row.created_at,
      created_by_profile_id: row.created_by_profile_id,
      excerpt: row.excerpt ?? buildExcerpt(body),
      external_url: row.external_url ?? null,
      id: row.id,
      is_saved: savedIds.has(row.id),
      kind: normalizeKind(row.kind),
      media_profile_id: row.media_profile_id,
      published_at: row.published_at ?? null,
      reading_time_minutes: calculateReadingTime(body),
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
    .select("post_id, target_id, target_type")
    .in("post_id", postIds);

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
  const [profiles, clubs] = await Promise.all([
    loadProfilesById(profileIds),
    loadClubsById(clubIds),
  ]);

  for (const row of rows) {
    const list = targetsByPost.get(row.post_id) ?? [];

    if (row.target_type === "club") {
      const club = clubs.get(row.target_id);
      list.push({
        avatar_url: club?.logo_url ?? null,
        display_name: club?.name?.trim() || "Societa FootMe",
        role: "club",
        subtitle: club
          ? [club.category, club.city ?? club.region].filter(Boolean).join(" - ") || null
          : null,
        target_id: row.target_id,
        target_type: "club",
      });
    } else {
      const profile = profiles.get(row.target_id);
      list.push({
        avatar_url: profile?.avatar_url ?? null,
        display_name: profile?.full_name?.trim() || "Profilo FootMe",
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

  validateCreateInput({
    authorName,
    body,
    category,
    excerpt,
    kind: input.kind,
    title,
  });

  return {
    author_name: authorName,
    body,
    category,
    cover_type: coverType,
    cover_url: coverUrl,
    created_by_profile_id: input.createdByProfileId,
    excerpt,
    external_url: externalUrl,
    kind: input.kind,
    media_profile_id: input.mediaProfileId,
    status: "published",
    subtitle,
    title,
  };
}

function validateCreateInput(input: {
  authorName: string;
  body: string | null;
  category: string;
  excerpt: string | null;
  kind: MediaProfilePostKind;
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

  if (input.kind === "article" && !input.body) {
    throw new Error("Inserisci il testo dell'articolo.");
  }

  if (input.kind === "news" && !input.body && !input.excerpt) {
    throw new Error("Scrivi il testo della news.");
  }
}

function calculateReadingTime(body: string | null) {
  if (!body) {
    return 1;
  }

  const words = body.split(/\s+/).filter(Boolean).length;
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
          : "Profilo";
  const location = city || region;

  return location ? `${roleLabel} - ${location}` : roleLabel;
}
