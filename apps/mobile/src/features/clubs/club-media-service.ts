import { supabase } from "../../lib/supabase";

export type ClubMediaKind =
  | "highlights"
  | "interview"
  | "market"
  | "statement"
  | "training"
  | "event";

export type ClubMediaVisualType = "image" | "video";

export type ClubMediaTaggedProfile = {
  avatar_url: string | null;
  display_name: string;
  profile_id: string;
  role: string | null;
};

export type ClubMediaComment = {
  author_avatar_url: string | null;
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  profile_id: string;
};

export type ClubMediaPost = {
  attachment_label: string | null;
  body: string | null;
  club_id: string;
  comment_count: number;
  comments: ClubMediaComment[];
  created_at: string;
  created_by_profile_id: string;
  event_date: string | null;
  excerpt: string | null;
  external_url: string | null;
  id: string;
  interviewee_name: string | null;
  is_liked: boolean;
  is_saved: boolean;
  kind: ClubMediaKind;
  like_count: number;
  player_birth_year: number | null;
  player_name: string | null;
  player_previous_club: string | null;
  player_role: string | null;
  published_at: string | null;
  saved_count: number;
  status: "draft" | "published" | "archived";
  tagged_profiles: ClubMediaTaggedProfile[];
  thumbnail_url: string | null;
  title: string;
  updated_at: string;
  video_duration_seconds: number | null;
  visual_type: ClubMediaVisualType | null;
  visual_url: string | null;
};

export type CreateClubMediaPostInput = {
  attachmentLabel?: string | null;
  body?: string | null;
  clubId: string;
  createdByProfileId: string;
  eventDate?: string | null;
  excerpt?: string | null;
  externalUrl?: string | null;
  intervieweeName?: string | null;
  kind: ClubMediaKind;
  playerBirthYear?: string | number | null;
  playerName?: string | null;
  playerPreviousClub?: string | null;
  playerRole?: string | null;
  taggedProfileIds?: string[];
  thumbnailUrl?: string | null;
  title: string;
  videoDurationSeconds?: string | number | null;
  visualType?: ClubMediaVisualType | null;
  visualUrl?: string | null;
};

type ClubMediaPostRow = {
  attachment_label: string | null;
  body: string | null;
  club_id: string;
  created_at: string;
  created_by_profile_id: string;
  event_date: string | null;
  excerpt: string | null;
  external_url: string | null;
  id: string;
  interviewee_name: string | null;
  kind: string;
  player_birth_year: number | null;
  player_name: string | null;
  player_previous_club: string | null;
  player_role: string | null;
  published_at: string | null;
  status: string;
  thumbnail_url: string | null;
  title: string;
  updated_at: string;
  video_duration_seconds: number | null;
  visual_type: string | null;
  visual_url: string | null;
};

type ProfileRow = {
  avatar_url: string | null;
  full_name: string | null;
  id: string;
  role: string | null;
};

const POST_SELECT =
  "id, club_id, created_by_profile_id, kind, title, excerpt, body, visual_url, visual_type, thumbnail_url, video_duration_seconds, player_name, player_role, player_birth_year, player_previous_club, interviewee_name, event_date, attachment_label, external_url, status, published_at, created_at, updated_at";

export async function fetchClubMediaFeed(
  clubId: string,
  viewerProfileId?: string | null,
): Promise<ClubMediaPost[]> {
  const { data, error } = await supabase
    .from("club_media_posts")
    .select(POST_SELECT)
    .eq("club_id", clubId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return enrichClubMediaPosts((data ?? []) as ClubMediaPostRow[], viewerProfileId);
}

export async function fetchClubMediaPostDetail(
  postId: string,
  viewerProfileId?: string | null,
): Promise<ClubMediaPost | null> {
  const { data, error } = await supabase
    .from("club_media_posts")
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

  const [post] = await enrichClubMediaPosts(
    [data as ClubMediaPostRow],
    viewerProfileId,
    true,
  );

  return post ?? null;
}

export async function createClubMediaPost(
  input: CreateClubMediaPostInput,
): Promise<ClubMediaPost> {
  const payload = buildCreatePayload(input);
  const { data, error } = await supabase
    .from("club_media_posts")
    .insert(payload)
    .select(POST_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Contenuto media non creato.");
  }

  const postId = (data as ClubMediaPostRow).id;
  const taggedProfileIds = uniqueIds(input.taggedProfileIds ?? []);

  if (taggedProfileIds.length > 0) {
    const { error: tagError } = await supabase
      .from("club_media_tagged_profiles")
      .insert(
        taggedProfileIds.map((profileId) => ({
          post_id: postId,
          profile_id: profileId,
        })),
      );

    if (tagError) {
      throw tagError;
    }
  }

  const [post] = await enrichClubMediaPosts(
    [data as ClubMediaPostRow],
    input.createdByProfileId,
    true,
  );

  return post;
}

export async function toggleClubMediaLike(
  profileId: string,
  postId: string,
  shouldLike: boolean,
) {
  if (shouldLike) {
    const { error } = await supabase.from("club_media_likes").upsert(
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
    .from("club_media_likes")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function toggleSavedClubMedia(
  profileId: string,
  postId: string,
  shouldSave: boolean,
) {
  if (shouldSave) {
    const { error } = await supabase.from("saved_club_media").upsert(
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
    .from("saved_club_media")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function addClubMediaComment(input: {
  body: string;
  postId: string;
  profileId: string;
}): Promise<ClubMediaComment> {
  const trimmedBody = input.body.trim();

  if (!trimmedBody) {
    throw new Error("Scrivi un commento prima di pubblicare.");
  }

  const { data, error } = await supabase
    .from("club_media_comments")
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

  const profile = await loadProfilesById([input.profileId]);
  const author = profile.get(input.profileId);

  return {
    author_avatar_url: author?.avatar_url ?? null,
    author_name: author?.full_name?.trim() || "Utente FootMe",
    body: String((data as { body: string }).body),
    created_at: String((data as { created_at: string }).created_at),
    id: String((data as { id: string }).id),
    profile_id: input.profileId,
  };
}

export async function deleteClubMediaPost(postId: string) {
  const { error } = await supabase
    .from("club_media_posts")
    .delete()
    .eq("id", postId);

  if (error) {
    throw error;
  }
}

async function enrichClubMediaPosts(
  rows: ClubMediaPostRow[],
  viewerProfileId?: string | null,
  includeComments = false,
): Promise<ClubMediaPost[]> {
  if (rows.length === 0) {
    return [];
  }

  const postIds = rows.map((row) => row.id);
  const [
    likeCounts,
    commentCounts,
    likedIds,
    savedIds,
    taggedProfiles,
    commentsByPost,
  ] = await Promise.all([
    loadPostCountMap("club_media_likes", postIds),
    loadPostCountMap("club_media_comments", postIds),
    viewerProfileId
      ? loadViewerPostIds("club_media_likes", viewerProfileId, postIds)
      : Promise.resolve(new Set<string>()),
    viewerProfileId
      ? loadViewerPostIds("saved_club_media", viewerProfileId, postIds)
      : Promise.resolve(new Set<string>()),
    loadTaggedProfiles(postIds),
    includeComments
      ? loadCommentsByPost(postIds)
      : Promise.resolve(new Map<string, ClubMediaComment[]>()),
  ]);

  return rows.map((row) => ({
    attachment_label: row.attachment_label ?? null,
    body: row.body ?? null,
    club_id: row.club_id,
    comment_count: commentCounts.get(row.id) ?? 0,
    comments: commentsByPost.get(row.id) ?? [],
    created_at: row.created_at,
    created_by_profile_id: row.created_by_profile_id,
    event_date: row.event_date ?? null,
    excerpt: row.excerpt ?? null,
    external_url: row.external_url ?? null,
    id: row.id,
    interviewee_name: row.interviewee_name ?? null,
    is_liked: likedIds.has(row.id),
    is_saved: savedIds.has(row.id),
    kind: normalizeKind(row.kind),
    like_count: likeCounts.get(row.id) ?? 0,
    player_birth_year: row.player_birth_year ?? null,
    player_name: row.player_name ?? null,
    player_previous_club: row.player_previous_club ?? null,
    player_role: row.player_role ?? null,
    published_at: row.published_at ?? null,
    saved_count: savedIds.has(row.id) ? 1 : 0,
    status: normalizeStatus(row.status),
    tagged_profiles: taggedProfiles.get(row.id) ?? [],
    thumbnail_url: row.thumbnail_url ?? null,
    title: row.title,
    updated_at: row.updated_at,
    video_duration_seconds: row.video_duration_seconds ?? null,
    visual_type: normalizeVisualType(row.visual_type),
    visual_url: row.visual_url ?? null,
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

async function loadTaggedProfiles(postIds: string[]) {
  const taggedByPost = new Map<string, ClubMediaTaggedProfile[]>();

  if (postIds.length === 0) {
    return taggedByPost;
  }

  const { data, error } = await supabase
    .from("club_media_tagged_profiles")
    .select("post_id, profile_id")
    .in("post_id", postIds);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as { post_id: string; profile_id: string }[];
  const profiles = await loadProfilesById(rows.map((row) => row.profile_id));

  for (const row of rows) {
    const profile = profiles.get(row.profile_id);
    const list = taggedByPost.get(row.post_id) ?? [];

    list.push({
      avatar_url: profile?.avatar_url ?? null,
      display_name: profile?.full_name?.trim() || "Profilo FootMe",
      profile_id: row.profile_id,
      role: profile?.role ?? null,
    });
    taggedByPost.set(row.post_id, list);
  }

  return taggedByPost;
}

async function loadCommentsByPost(postIds: string[]) {
  const commentsByPost = new Map<string, ClubMediaComment[]>();

  if (postIds.length === 0) {
    return commentsByPost;
  }

  const { data, error } = await supabase
    .from("club_media_comments")
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
    .select("id, full_name, avatar_url, role")
    .in("id", ids);

  if (error) {
    throw error;
  }

  for (const profile of (data ?? []) as ProfileRow[]) {
    profiles.set(profile.id, profile);
  }

  return profiles;
}

function buildCreatePayload(input: CreateClubMediaPostInput) {
  const title = input.title.trim();
  const body = normalizeText(input.body);
  const excerpt = normalizeText(input.excerpt) ?? buildExcerpt(body);
  const visualUrl = normalizeText(input.visualUrl);
  const visualType = input.visualType ?? inferVisualType(visualUrl);
  const taggedProfileIds = uniqueIds(input.taggedProfileIds ?? []);
  const videoDurationSeconds = normalizeOptionalInteger(input.videoDurationSeconds);
  const playerBirthYear = normalizeOptionalInteger(input.playerBirthYear);

  validateCreateInput({
    ...input,
    body,
    excerpt,
    playerBirthYear,
    taggedProfileIds,
    title,
    videoDurationSeconds,
    visualType,
    visualUrl,
  });

  return {
    attachment_label: normalizeText(input.attachmentLabel),
    body,
    club_id: input.clubId,
    created_by_profile_id: input.createdByProfileId,
    event_date: normalizeText(input.eventDate),
    excerpt,
    external_url: normalizeText(input.externalUrl),
    interviewee_name: normalizeText(input.intervieweeName),
    kind: input.kind,
    player_birth_year: playerBirthYear,
    player_name: normalizeText(input.playerName),
    player_previous_club: normalizeText(input.playerPreviousClub),
    player_role: normalizeText(input.playerRole),
    status: "published",
    thumbnail_url: normalizeText(input.thumbnailUrl),
    title,
    video_duration_seconds: videoDurationSeconds,
    visual_type: visualType,
    visual_url: visualUrl,
  };
}

function validateCreateInput(input: {
  body: string | null;
  excerpt: string | null;
  kind: ClubMediaKind;
  playerBirthYear: number | null;
  playerName?: string | null;
  playerRole?: string | null;
  taggedProfileIds: string[];
  title: string;
  videoDurationSeconds: number | null;
  visualType: ClubMediaVisualType | null;
  visualUrl: string | null;
}) {
  if (!input.title) {
    throw new Error("Inserisci un titolo per il contenuto.");
  }

  if (input.videoDurationSeconds != null && input.videoDurationSeconds < 0) {
    throw new Error("La durata video non può essere negativa.");
  }

  if (input.kind === "highlights") {
    if (!input.visualUrl || input.visualType !== "video") {
      throw new Error("Gli highlights richiedono un video.");
    }
    return;
  }

  if (input.kind === "interview") {
    if (!input.visualUrl) {
      throw new Error("L'intervista richiede una foto o un video.");
    }
    return;
  }

  if (input.kind === "market") {
    if (!input.visualUrl) {
      throw new Error("Il nuovo acquisto richiede un'immagine o un video.");
    }

    if (!normalizeText(input.playerName) || !normalizeText(input.playerRole)) {
      throw new Error("Inserisci nome e ruolo del giocatore.");
    }

    if (!input.playerBirthYear) {
      throw new Error("Inserisci la classe del giocatore.");
    }

    if (!input.body) {
      throw new Error("Inserisci il testo ufficiale dell'annuncio.");
    }

    if (input.taggedProfileIds.length === 0) {
      throw new Error("Tagga il profilo del giocatore.");
    }
    return;
  }

  if (input.kind === "statement") {
    if (!input.body) {
      throw new Error("Il comunicato richiede un testo.");
    }
    return;
  }

  if (input.kind === "training") {
    if (!input.visualUrl) {
      throw new Error("L'allenamento richiede una foto o un video.");
    }

    if (!input.excerpt && !input.body) {
      throw new Error("Aggiungi una breve descrizione dell'allenamento.");
    }
    return;
  }

  if (input.kind === "event" && !input.body && !input.excerpt) {
    throw new Error("Aggiungi i dettagli dell'evento.");
  }
}

function buildExcerpt(body: string | null) {
  if (!body) {
    return null;
  }

  return body.length > 140 ? `${body.slice(0, 137).trim()}...` : body;
}

function normalizeKind(value: string): ClubMediaKind {
  return value === "interview" ||
    value === "market" ||
    value === "statement" ||
    value === "training" ||
    value === "event"
    ? value
    : "highlights";
}

function normalizeStatus(value: string): ClubMediaPost["status"] {
  return value === "draft" || value === "archived" ? value : "published";
}

function normalizeVisualType(value: string | null): ClubMediaVisualType | null {
  return value === "image" || value === "video" ? value : null;
}

function inferVisualType(url: string | null): ClubMediaVisualType | null {
  if (!url) {
    return null;
  }

  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?.*)?$/i.test(url) ? "video" : "image";
}

function normalizeOptionalInteger(value: string | number | null | undefined) {
  if (value == null || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseInt(value.trim(), 10);

  return Number.isFinite(numericValue) ? numericValue : null;
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
