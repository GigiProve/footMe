import { notifyTaggedProfiles } from "../content/content-tag-service";
import type { TaggableTarget } from "../content/tag-types";
import { targetKey } from "../content/tag-types";
import { supabase } from "../../lib/supabase";

export const FAN_TRIBUNA_FORMATIONS = [
  "4-3-3",
  "4-4-2",
  "3-5-2",
  "4-2-3-1",
] as const;

export type FanTribunaKind =
  | "poll"
  | "proposal"
  | "formation"
  | "opinion"
  | "photo";

export type FanTribunaMediaType = "image" | "video";

export type FanTribunaFormation = (typeof FAN_TRIBUNA_FORMATIONS)[number];

export type FanTribunaComment = {
  author_avatar_url: string | null;
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  profile_id: string;
};

export type FanTribunaPollOption = {
  id: string;
  is_voted: boolean;
  label: string;
  percentage: number;
  sort_order: number;
  target_id: string | null;
  target_type: string | null;
  vote_count: number;
};

export type FanTribunaTaggedPlayer = {
  avatar_url: string | null;
  display_name: string;
  player_profile_id: string;
  sort_order: number;
};

export type FanTribunaLineupPlayer = FanTribunaTaggedPlayer & {
  slot_key: string;
  x_percent: number;
  y_percent: number;
};

export type FanTribunaPost = {
  body: string | null;
  comment_count: number;
  comments: FanTribunaComment[];
  created_at: string;
  formation: FanTribunaFormation | null;
  id: string;
  is_saved: boolean;
  is_supported: boolean;
  kind: FanTribunaKind;
  lineup_players: FanTribunaLineupPlayer[];
  media_type: FanTribunaMediaType | null;
  media_url: string | null;
  poll_options: FanTribunaPollOption[];
  profile_id: string;
  published_at: string | null;
  reference_category: string | null;
  reference_club_id: string | null;
  reference_team_name: string | null;
  saved_count: number;
  status: "draft" | "published" | "archived";
  support_count: number;
  /**
   * All tagged targets regardless of type. For profile-only consumers use
   * tagged_players (derived subset) for backward compatibility.
   */
  tagged_targets: TaggableTarget[];
  /** Backward-compat: profile targets only (target_type === 'profile'). */
  tagged_players: FanTribunaTaggedPlayer[];
  thumbnail_url: string | null;
  title: string;
  total_vote_count: number;
  updated_at: string;
};

export type CreateFanTribunaPollInput = {
  options: { label: string; target?: TaggableTarget | null }[];
  profileId: string;
  publisherName?: string | null;
  question: string;
};

export type CreateFanTribunaProposalInput = {
  body: string;
  profileId: string;
  referenceCategory?: string | null;
  referenceClubId?: string | null;
  referenceTeamName?: string | null;
  publisherName?: string | null;
  /**
   * Preferred: multi-type targets. Backward-compat: taggedPlayers still works
   * and is treated as profile targets.
   */
  targets?: TaggableTarget[];
  /** @deprecated Use targets instead. */
  taggedPlayers?: FanTribunaTaggedPlayer[];
  title: string;
};

export type CreateFanTribunaFormationInput = {
  body?: string | null;
  formation: FanTribunaFormation;
  lineupPlayers?: FanTribunaLineupPlayer[];
  profileId: string;
  referenceCategory?: string | null;
  referenceClubId?: string | null;
  referenceTeamName: string;
  title?: string | null;
};

export type CreateFanTribunaOpinionInput = {
  body: string;
  profileId: string;
  publisherName?: string | null;
  targets?: TaggableTarget[];
  title?: string | null;
};

export type CreateFanTribunaPhotoInput = {
  caption?: string | null;
  mediaType: FanTribunaMediaType;
  mediaUrl: string;
  profileId: string;
  publisherName?: string | null;
  targets?: TaggableTarget[];
  thumbnailUrl?: string | null;
};

type FanTribunaPostRow = {
  body: string | null;
  created_at: string;
  formation: string | null;
  id: string;
  kind: string;
  media_type: string | null;
  media_url: string | null;
  profile_id: string;
  published_at: string | null;
  reference_category: string | null;
  reference_club_id: string | null;
  reference_team_name: string | null;
  status: string;
  thumbnail_url: string | null;
  title: string;
  updated_at: string;
};

type FanTribunaPollOptionRow = {
  id: string;
  label: string;
  post_id: string;
  sort_order: number;
  target_id: string | null;
  target_type: string | null;
};

type ProfileRow = {
  avatar_url: string | null;
  full_name: string | null;
  id: string;
};

type ClubRow = {
  id: string;
  logo_url: string | null;
  name: string;
};

type ClubTeamRow = {
  club_id: string;
  id: string;
  logo_url: string | null;
  name: string;
};

const POST_SELECT =
  "id, profile_id, kind, title, body, reference_team_name, reference_club_id, reference_category, formation, status, published_at, created_at, updated_at, media_url, media_type, thumbnail_url";

const MAX_TAGS = 5;

/** Default page size for the fan tribuna feed (ordered by published_at desc). */
export const FAN_TRIBUNA_PAGE_SIZE = 30;

/** Paging options for the fan tribuna feed loader. */
export type FanTribunaFeedPageOptions = {
  limit?: number;
  offset?: number;
};

// ─────────────────────────────────────────────────────────────
// Public API — create functions
// ─────────────────────────────────────────────────────────────

/**
 * Fetch one page of a fan's published tribuna posts, newest first.
 * Bounded by `limit` (default {@link FAN_TRIBUNA_PAGE_SIZE}); callers detect
 * "has more" when the returned length equals the requested limit.
 */
export async function fetchFanTribunaFeed(
  profileId: string,
  viewerProfileId?: string | null,
  options: FanTribunaFeedPageOptions = {},
): Promise<FanTribunaPost[]> {
  const limit = options.limit ?? FAN_TRIBUNA_PAGE_SIZE;
  const offset = options.offset ?? 0;

  const { data, error } = await supabase
    .from("fan_tribuna_posts")
    .select(POST_SELECT)
    .eq("profile_id", profileId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return enrichFanTribunaPosts((data ?? []) as FanTribunaPostRow[], viewerProfileId);
}

export type FanTribunaPostDetail = FanTribunaPost & {
  publisher_name: string;
};

/**
 * Fetch a single published fan tribuna post by id (any author) for the content
 * detail screen, enriched and with the publisher display name resolved.
 */
export async function fetchFanTribunaPostDetail(
  postId: string,
  viewerProfileId?: string | null,
): Promise<FanTribunaPostDetail | null> {
  const { data, error } = await supabase
    .from("fan_tribuna_posts")
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

  const [post] = await enrichFanTribunaPosts(
    [data as FanTribunaPostRow],
    viewerProfileId,
  );

  if (!post) {
    return null;
  }

  const publishers = await loadProfilesById([post.profile_id]);
  const publisher = publishers.get(post.profile_id);

  return {
    ...post,
    publisher_name: publisher?.full_name?.trim() || "Appassionato",
  };
}

export async function createFanTribunaPoll(
  input: CreateFanTribunaPollInput,
): Promise<FanTribunaPost> {
  const question = requireText(input.question, "Inserisci la domanda del sondaggio.");
  const options = normalizePollOptions(input.options.map((o) => o.label));

  // Build the tag list from option targets (dedup by targetKey, cap at MAX_TAGS).
  const rawTargets: TaggableTarget[] = input.options
    .map((o) => o.target)
    .filter((t): t is TaggableTarget => t != null && Boolean(t.target_id.trim()));

  const targets = dedupTargets(rawTargets);

  if (targets.length > MAX_TAGS) {
    throw new Error(`Puoi taggare al massimo ${MAX_TAGS} profili per contenuto.`);
  }

  const post = await insertTribunaPost({
    body: null,
    formation: null,
    kind: "poll",
    media_type: null,
    media_url: null,
    profile_id: input.profileId,
    reference_category: null,
    reference_club_id: null,
    reference_team_name: null,
    status: "published",
    thumbnail_url: null,
    title: question,
  });

  const normalizedOptions = options.map((label, index) => {
    const source = input.options[index];
    const t = source?.target;
    return {
      label,
      post_id: post.id,
      sort_order: index,
      target_id: t?.target_id ?? null,
      target_type: t?.target_type ?? null,
    };
  });

  const { error } = await supabase.from("fan_tribuna_poll_options").insert(normalizedOptions);

  if (error) {
    throw error;
  }

  await insertTaggedTargets(post.id, targets);

  await notifyFanTribunaTagged({
    kind: "poll",
    postId: post.id,
    publisherName: input.publisherName ?? null,
    taggerProfileId: input.profileId,
    targets,
  });

  return loadCreatedPost(post, input.profileId);
}

export async function createFanTribunaProposal(
  input: CreateFanTribunaProposalInput,
): Promise<FanTribunaPost> {
  const title = requireText(input.title, "Inserisci il titolo della proposta.");
  const body = requireText(input.body, "Aggiungi una breve motivazione.");

  // Prefer input.targets; fall back to legacy taggedPlayers as profile targets.
  const rawTargets: TaggableTarget[] =
    input.targets ??
    (input.taggedPlayers ?? []).map((p) => ({
      avatar_url: p.avatar_url,
      display_name: p.display_name,
      target_id: p.player_profile_id,
      target_type: "profile" as const,
    }));

  const targets = dedupTargets(rawTargets);

  if (targets.length > MAX_TAGS) {
    throw new Error(`Puoi taggare al massimo ${MAX_TAGS} profili per contenuto.`);
  }

  const post = await insertTribunaPost({
    body,
    formation: null,
    kind: "proposal",
    media_type: null,
    media_url: null,
    profile_id: input.profileId,
    reference_category: normalizeText(input.referenceCategory),
    reference_club_id: normalizeText(input.referenceClubId),
    reference_team_name: normalizeText(input.referenceTeamName),
    status: "published",
    thumbnail_url: null,
    title,
  });

  await insertTaggedTargets(post.id, targets);

  await notifyFanTribunaTagged({
    kind: "proposal",
    postId: post.id,
    publisherName: input.publisherName ?? null,
    taggerProfileId: input.profileId,
    targets,
  });

  return loadCreatedPost(post, input.profileId);
}

export async function createFanTribunaFormation(
  input: CreateFanTribunaFormationInput,
): Promise<FanTribunaPost> {
  const referenceTeamName = requireText(
    input.referenceTeamName,
    "Scegli la squadra della formazione.",
  );
  const formation = normalizeFormation(input.formation);
  const title =
    normalizeText(input.title) ?? `La mia formazione ${formation} per ${referenceTeamName}`;
  const post = await insertTribunaPost({
    body: normalizeText(input.body),
    formation,
    kind: "formation",
    media_type: null,
    media_url: null,
    profile_id: input.profileId,
    reference_category: normalizeText(input.referenceCategory),
    reference_club_id: normalizeText(input.referenceClubId),
    reference_team_name: referenceTeamName,
    status: "published",
    thumbnail_url: null,
    title,
  });

  await insertLineupPlayers(post.id, input.lineupPlayers ?? []);

  return loadCreatedPost(post, input.profileId);
}

export async function createFanTribunaOpinion(
  input: CreateFanTribunaOpinionInput,
): Promise<FanTribunaPost> {
  const body = requireText(input.body, "Scrivi il testo dell'opinione.");
  const targets = dedupTargets(input.targets ?? []);

  if (targets.length > MAX_TAGS) {
    throw new Error(`Puoi taggare al massimo ${MAX_TAGS} profili per contenuto.`);
  }

  const post = await insertTribunaPost({
    body,
    formation: null,
    kind: "opinion",
    media_type: null,
    media_url: null,
    profile_id: input.profileId,
    reference_category: null,
    reference_club_id: null,
    reference_team_name: null,
    status: "published",
    thumbnail_url: null,
    title: normalizeText(input.title) ?? body.slice(0, 120),
  });

  await insertTaggedTargets(post.id, targets);

  await notifyFanTribunaTagged({
    kind: "opinion",
    postId: post.id,
    publisherName: input.publisherName ?? null,
    taggerProfileId: input.profileId,
    targets,
  });

  return loadCreatedPost(post, input.profileId);
}

export async function createFanTribunaPhoto(
  input: CreateFanTribunaPhotoInput,
): Promise<FanTribunaPost> {
  if (!input.mediaUrl.trim()) {
    throw new Error("URL del media mancante.");
  }

  const targets = dedupTargets(input.targets ?? []);

  if (targets.length > MAX_TAGS) {
    throw new Error(`Puoi taggare al massimo ${MAX_TAGS} profili per contenuto.`);
  }

  const caption = normalizeText(input.caption);
  // For images, thumbnail defaults to media_url when not supplied.
  const thumbnailUrl =
    normalizeText(input.thumbnailUrl) ??
    (input.mediaType === "image" ? input.mediaUrl.trim() : null);

  const post = await insertTribunaPost({
    body: caption,
    formation: null,
    kind: "photo",
    media_type: input.mediaType,
    media_url: input.mediaUrl.trim(),
    profile_id: input.profileId,
    reference_category: null,
    reference_club_id: null,
    reference_team_name: null,
    status: "published",
    thumbnail_url: thumbnailUrl,
    title: caption ?? "Foto",
  });

  await insertTaggedTargets(post.id, targets);

  await notifyFanTribunaTagged({
    kind: "photo",
    postId: post.id,
    publisherName: input.publisherName ?? null,
    taggerProfileId: input.profileId,
    targets,
  });

  return loadCreatedPost(post, input.profileId);
}

export async function voteFanTribunaPoll(input: {
  optionId: string;
  postId: string;
  profileId: string;
}) {
  const { error } = await supabase.from("fan_tribuna_poll_votes").upsert(
    {
      option_id: input.optionId,
      post_id: input.postId,
      profile_id: input.profileId,
    },
    { onConflict: "post_id,profile_id" },
  );

  if (error) {
    throw error;
  }
}

export async function toggleFanTribunaSupport(
  profileId: string,
  postId: string,
  shouldSupport: boolean,
) {
  if (shouldSupport) {
    const { error } = await supabase.from("fan_tribuna_support_votes").upsert(
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
    .from("fan_tribuna_support_votes")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function toggleSavedFanTribuna(
  profileId: string,
  postId: string,
  shouldSave: boolean,
) {
  if (shouldSave) {
    const { error } = await supabase.from("saved_fan_tribuna").upsert(
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
    .from("saved_fan_tribuna")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function addFanTribunaComment(input: {
  body: string;
  postId: string;
  profileId: string;
}): Promise<FanTribunaComment> {
  const body = requireText(input.body, "Scrivi un commento prima di pubblicare.");

  const { data, error } = await supabase
    .from("fan_tribuna_comments")
    .insert({
      body,
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

// ─────────────────────────────────────────────────────────────
// Internal helpers — post insert + enrichment
// ─────────────────────────────────────────────────────────────

async function insertTribunaPost(payload: {
  body: string | null;
  formation: FanTribunaFormation | null;
  kind: FanTribunaKind;
  media_type: FanTribunaMediaType | null;
  media_url: string | null;
  profile_id: string;
  reference_category: string | null;
  reference_club_id: string | null;
  reference_team_name: string | null;
  status: "published";
  thumbnail_url: string | null;
  title: string;
}) {
  const { data, error } = await supabase
    .from("fan_tribuna_posts")
    .insert(payload)
    .select(POST_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Contenuto non creato.");
  }

  return data as FanTribunaPostRow;
}

async function loadCreatedPost(
  row: FanTribunaPostRow,
  viewerProfileId: string,
): Promise<FanTribunaPost> {
  const [post] = await enrichFanTribunaPosts([row], viewerProfileId);

  if (!post) {
    throw new Error("Contenuto non creato.");
  }

  return post;
}

/**
 * Insert polymorphic tag rows. For profile targets, player_profile_id is set
 * to target_id so the autofill trigger and legacy RLS both work.
 */
async function insertTaggedTargets(postId: string, targets: TaggableTarget[]) {
  if (targets.length === 0) {
    return;
  }

  const payload = targets.map((target, index) => ({
    avatar_url: target.avatar_url ?? null,
    display_name: target.display_name ?? null,
    player_profile_id: target.target_type === "profile" ? target.target_id : null,
    post_id: postId,
    sort_order: index,
    target_id: target.target_id,
    target_type: target.target_type,
  }));

  const { error } = await supabase.from("fan_tribuna_tagged_players").insert(payload);

  if (error) {
    throw error;
  }
}

async function insertLineupPlayers(
  postId: string,
  lineupPlayers: FanTribunaLineupPlayer[],
) {
  const payload = lineupPlayers
    .filter((player) => player.player_profile_id && player.display_name.trim())
    .map((player, index) => ({
      avatar_url: normalizeText(player.avatar_url),
      display_name: player.display_name.trim(),
      player_profile_id: player.player_profile_id,
      post_id: postId,
      slot_key: player.slot_key,
      sort_order: index,
      x_percent: clampPercent(player.x_percent),
      y_percent: clampPercent(player.y_percent),
    }));

  if (payload.length === 0) {
    return;
  }

  const { error } = await supabase.from("fan_tribuna_lineup_players").insert(payload);

  if (error) {
    throw error;
  }
}

async function enrichFanTribunaPosts(
  rows: FanTribunaPostRow[],
  viewerProfileId?: string | null,
): Promise<FanTribunaPost[]> {
  if (rows.length === 0) {
    return [];
  }

  const postIds = rows.map((row) => row.id);
  const [
    supportCounts,
    savedCounts,
    commentCounts,
    supportedIds,
    savedIds,
    optionsByPost,
    pollVoteState,
    commentsByPost,
    taggedTargetsByPost,
    lineupPlayersByPost,
  ] = await Promise.all([
    loadTribunaCountMap("fan_tribuna_support_votes", postIds),
    loadTribunaCountMap("saved_fan_tribuna", postIds),
    loadTribunaCountMap("fan_tribuna_comments", postIds),
    viewerProfileId
      ? loadViewerTribunaPostIds("fan_tribuna_support_votes", viewerProfileId, postIds)
      : Promise.resolve(new Set<string>()),
    viewerProfileId
      ? loadViewerTribunaPostIds("saved_fan_tribuna", viewerProfileId, postIds)
      : Promise.resolve(new Set<string>()),
    loadPollOptionsByPost(postIds),
    loadPollVoteState(postIds, viewerProfileId),
    loadCommentsByPost(postIds),
    loadTaggedTargetsByPost(postIds),
    loadLineupPlayersByPost(postIds),
  ]);

  return rows.map((row) => {
    const pollOptions = (optionsByPost.get(row.id) ?? []).map((option) => {
      const voteCount = pollVoteState.optionCounts.get(option.id) ?? 0;
      const totalVoteCount = pollVoteState.totalCounts.get(row.id) ?? 0;

      return {
        id: option.id,
        is_voted: pollVoteState.viewerOptionByPost.get(row.id) === option.id,
        label: option.label,
        percentage:
          totalVoteCount > 0 ? Math.round((voteCount / totalVoteCount) * 100) : 0,
        sort_order: option.sort_order,
        target_id: option.target_id,
        target_type: option.target_type,
        vote_count: voteCount,
      };
    });

    const taggedTargets = taggedTargetsByPost.get(row.id) ?? [];
    const taggedPlayers = taggedTargets
      .filter((t) => t.target_type === "profile")
      .map((t) => ({
        avatar_url: t.avatar_url,
        display_name: t.display_name,
        player_profile_id: t.target_id,
        sort_order: 0,
      }));

    return {
      body: row.body ?? null,
      comment_count: commentCounts.get(row.id) ?? 0,
      comments: commentsByPost.get(row.id) ?? [],
      created_at: row.created_at,
      formation: normalizeFormationOrNull(row.formation),
      id: row.id,
      is_saved: savedIds.has(row.id),
      is_supported: supportedIds.has(row.id),
      kind: normalizeKind(row.kind),
      lineup_players: lineupPlayersByPost.get(row.id) ?? [],
      media_type: normalizeMediaType(row.media_type),
      media_url: row.media_url ?? null,
      poll_options: pollOptions,
      profile_id: row.profile_id,
      published_at: row.published_at ?? null,
      reference_category: row.reference_category ?? null,
      reference_club_id: row.reference_club_id ?? null,
      reference_team_name: row.reference_team_name ?? null,
      saved_count: savedCounts.get(row.id) ?? 0,
      status: normalizeStatus(row.status),
      support_count: supportCounts.get(row.id) ?? 0,
      tagged_players: taggedPlayers,
      tagged_targets: taggedTargets,
      thumbnail_url: row.thumbnail_url ?? null,
      title: row.title,
      total_vote_count: pollVoteState.totalCounts.get(row.id) ?? 0,
      updated_at: row.updated_at,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Notification helper
// ─────────────────────────────────────────────────────────────

/**
 * Send best-effort notifications to all tagged targets.
 * Profile targets: via notifyTaggedProfiles.
 * Club/team targets: resolve owner then insert notification rows directly.
 * Never throws — failures must not block content creation.
 */
async function notifyFanTribunaTagged(input: {
  kind: FanTribunaKind;
  postId: string;
  publisherName: string | null;
  taggerProfileId: string;
  targets: TaggableTarget[];
}): Promise<void> {
  if (input.targets.length === 0) {
    return;
  }

  const contentLabel = kindToContentLabel(input.kind);

  try {
    const profileTargetIds = input.targets
      .filter((t) => t.target_type === "profile")
      .map((t) => t.target_id);

    if (profileTargetIds.length > 0) {
      await notifyTaggedProfiles({
        contentLabel,
        contentType: "fan_tribuna",
        postId: input.postId,
        publisherId: input.taggerProfileId,
        publisherName: input.publisherName ?? undefined,
        taggedProfileIds: profileTargetIds,
        taggerProfileId: input.taggerProfileId,
      });
    }

    const clubTargets = input.targets.filter((t) => t.target_type === "club");
    const teamTargets = input.targets.filter((t) => t.target_type === "team");

    const recipients: {
      body: string;
      entityName: string;
      recipientProfileId: string;
      targetType: "club" | "team";
    }[] = [];

    if (clubTargets.length > 0) {
      const { data } = await supabase
        .from("clubs")
        .select("id, name, owner_profile_id")
        .in(
          "id",
          clubTargets.map((t) => t.target_id),
        );

      for (const row of (data ?? []) as {
        id: string;
        name: string;
        owner_profile_id: string;
      }[]) {
        recipients.push({
          body: `${input.publisherName ?? "Un fan"} ha taggato ${row.name} in un contenuto.`,
          entityName: row.name,
          recipientProfileId: row.owner_profile_id,
          targetType: "club",
        });
      }
    }

    if (teamTargets.length > 0) {
      const { data: teamData } = await supabase
        .from("club_teams")
        .select("id, name, club_id")
        .in(
          "id",
          teamTargets.map((t) => t.target_id),
        );

      if ((teamData ?? []).length > 0) {
        const teamClubIds = (teamData ?? []).map((r: { club_id: string }) => r.club_id);
        const { data: ownerData } = await supabase
          .from("clubs")
          .select("id, owner_profile_id")
          .in("id", teamClubIds);

        const ownerByClubId = new Map<string, string>();
        for (const row of (ownerData ?? []) as {
          id: string;
          owner_profile_id: string;
        }[]) {
          ownerByClubId.set(row.id, row.owner_profile_id);
        }

        for (const row of (teamData ?? []) as {
          club_id: string;
          id: string;
          name: string;
        }[]) {
          const ownerProfileId = ownerByClubId.get(row.club_id);
          if (ownerProfileId) {
            recipients.push({
              body: `${input.publisherName ?? "Un fan"} ha taggato ${row.name} in un contenuto.`,
              entityName: row.name,
              recipientProfileId: ownerProfileId,
              targetType: "team",
            });
          }
        }
      }
    }

    // Never notify the tagger about their own content (e.g. tagging a club they own).
    const externalRecipients = recipients.filter(
      (recipient) => recipient.recipientProfileId !== input.taggerProfileId,
    );

    if (externalRecipients.length > 0) {
      await supabase.from("notifications").insert(
        externalRecipients.map(({ body, recipientProfileId, targetType }) => ({
          body,
          data: {
            content_type: "fan_tribuna",
            post_id: input.postId,
            publisher_id: input.taggerProfileId,
            target_type: targetType,
          },
          recipient_profile_id: recipientProfileId,
          title: "Nuovo tag",
          type: "content_tag",
        })),
      );
    }
  } catch {
    // Best-effort: swallow errors so they never block content creation.
  }
}

function kindToContentLabel(kind: FanTribunaKind): string {
  switch (kind) {
    case "opinion":
      return "un'opinione";
    case "poll":
      return "un sondaggio";
    case "formation":
      return "una formazione";
    case "photo":
      return "una foto";
    case "proposal":
    default:
      return "un contenuto";
  }
}

// ─────────────────────────────────────────────────────────────
// Loaders
// ─────────────────────────────────────────────────────────────

async function loadTribunaCountMap(table: string, postIds: string[]) {
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

async function loadViewerTribunaPostIds(
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

async function loadPollOptionsByPost(postIds: string[]) {
  const optionsByPost = new Map<string, FanTribunaPollOptionRow[]>();

  if (postIds.length === 0) {
    return optionsByPost;
  }

  const { data, error } = await supabase
    .from("fan_tribuna_poll_options")
    .select("id, post_id, label, sort_order, target_type, target_id")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as FanTribunaPollOptionRow[]) {
    const list = optionsByPost.get(row.post_id) ?? [];
    list.push(row);
    optionsByPost.set(row.post_id, list);
  }

  return optionsByPost;
}

async function loadPollVoteState(
  postIds: string[],
  viewerProfileId?: string | null,
) {
  const optionCounts = new Map<string, number>();
  const totalCounts = new Map<string, number>();
  const viewerOptionByPost = new Map<string, string>();

  if (postIds.length === 0) {
    return { optionCounts, totalCounts, viewerOptionByPost };
  }

  const { data, error } = await supabase
    .from("fan_tribuna_poll_votes")
    .select("post_id, option_id, profile_id")
    .in("post_id", postIds);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as {
    option_id: string;
    post_id: string;
    profile_id: string;
  }[]) {
    optionCounts.set(row.option_id, (optionCounts.get(row.option_id) ?? 0) + 1);
    totalCounts.set(row.post_id, (totalCounts.get(row.post_id) ?? 0) + 1);

    if (viewerProfileId && row.profile_id === viewerProfileId) {
      viewerOptionByPost.set(row.post_id, row.option_id);
    }
  }

  return { optionCounts, totalCounts, viewerOptionByPost };
}

async function loadCommentsByPost(postIds: string[]) {
  const commentsByPost = new Map<string, FanTribunaComment[]>();

  if (postIds.length === 0) {
    return commentsByPost;
  }

  const { data, error } = await supabase
    .from("fan_tribuna_comments")
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

/**
 * Load all tagged targets for a set of posts.
 * For club/team targets, live name is fetched from clubs/club_teams;
 * display_name stored in the row is used as a fallback.
 * Only returns status='active' rows.
 *
 * No explicit LIMIT: this is a per-post lookup keyed on `postIds`, which is
 * already bounded by the paginated feed page, and each post carries at most
 * MAX_TAGS (5) tags — so the result is inherently bounded. A LIMIT here would
 * risk truncating a post's tag set rather than paginating.
 */
async function loadTaggedTargetsByPost(postIds: string[]) {
  const targetsByPost = new Map<string, TaggableTarget[]>();

  if (postIds.length === 0) {
    return targetsByPost;
  }

  const { data, error } = await supabase
    .from("fan_tribuna_tagged_players")
    .select(
      "post_id, target_type, target_id, player_profile_id, display_name, avatar_url, sort_order",
    )
    .in("post_id", postIds)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  type TagRow = {
    avatar_url: string | null;
    display_name: string | null;
    player_profile_id: string | null;
    post_id: string;
    sort_order: number;
    target_id: string;
    target_type: string;
  };

  const rows = (data ?? []) as TagRow[];

  // Batch-load live names for club/team targets.
  const clubIds = uniqueIds(
    rows.filter((r) => r.target_type === "club").map((r) => r.target_id),
  );
  const teamIds = uniqueIds(
    rows.filter((r) => r.target_type === "team").map((r) => r.target_id),
  );

  const [clubRows, teamRows] = await Promise.all([
    clubIds.length > 0
      ? supabase
          .from("clubs")
          .select("id, name, logo_url")
          .in("id", clubIds)
          .then(({ data: d }) => (d ?? []) as ClubRow[])
      : Promise.resolve([] as ClubRow[]),
    teamIds.length > 0
      ? supabase
          .from("club_teams")
          .select("id, name, club_id, logo_url")
          .in("id", teamIds)
          .then(({ data: d }) => (d ?? []) as ClubTeamRow[])
      : Promise.resolve([] as ClubTeamRow[]),
  ]);

  const clubMap = new Map<string, ClubRow>(clubRows.map((c) => [c.id, c]));
  const teamMap = new Map<string, ClubTeamRow>(teamRows.map((t) => [t.id, t]));

  for (const row of rows) {
    let displayName = row.display_name ?? "";
    let avatarUrl = row.avatar_url ?? null;

    if (row.target_type === "club") {
      const club = clubMap.get(row.target_id);
      if (club) {
        displayName = club.name;
        avatarUrl = club.logo_url ?? null;
      }
    } else if (row.target_type === "team") {
      const team = teamMap.get(row.target_id);
      if (team) {
        displayName = team.name;
        avatarUrl = team.logo_url ?? null;
      }
    }

    const list = targetsByPost.get(row.post_id) ?? [];
    list.push({
      avatar_url: avatarUrl,
      display_name: displayName,
      target_id: row.target_id,
      target_type: row.target_type as "profile" | "club" | "team",
    });
    targetsByPost.set(row.post_id, list);
  }

  return targetsByPost;
}

async function loadLineupPlayersByPost(postIds: string[]) {
  const playersByPost = new Map<string, FanTribunaLineupPlayer[]>();

  if (postIds.length === 0) {
    return playersByPost;
  }

  const { data, error } = await supabase
    .from("fan_tribuna_lineup_players")
    .select(
      "post_id, slot_key, player_profile_id, display_name, avatar_url, x_percent, y_percent, sort_order",
    )
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as (FanTribunaLineupPlayer & { post_id: string })[]) {
    const list = playersByPost.get(row.post_id) ?? [];
    list.push({
      avatar_url: row.avatar_url ?? null,
      display_name: row.display_name,
      player_profile_id: row.player_profile_id,
      slot_key: row.slot_key,
      sort_order: row.sort_order,
      x_percent: Number(row.x_percent),
      y_percent: Number(row.y_percent),
    });
    playersByPost.set(row.post_id, list);
  }

  return playersByPost;
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

// ─────────────────────────────────────────────────────────────
// Normalizers and utilities
// ─────────────────────────────────────────────────────────────

function normalizePollOptions(options: string[]) {
  const normalized = options
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (normalized.length < 2) {
    throw new Error("Aggiungi almeno due opzioni al sondaggio.");
  }

  return normalized;
}

function normalizeFormation(value: string): FanTribunaFormation {
  if (FAN_TRIBUNA_FORMATIONS.some((formation) => formation === value)) {
    return value as FanTribunaFormation;
  }

  throw new Error("Scegli un modulo valido.");
}

function normalizeFormationOrNull(value: string | null): FanTribunaFormation | null {
  return value && FAN_TRIBUNA_FORMATIONS.some((formation) => formation === value)
    ? (value as FanTribunaFormation)
    : null;
}

function normalizeKind(value: string): FanTribunaKind {
  if (
    value === "proposal" ||
    value === "formation" ||
    value === "opinion" ||
    value === "photo"
  ) {
    return value;
  }

  return "poll";
}

function normalizeMediaType(value: string | null): FanTribunaMediaType | null {
  if (value === "image" || value === "video") {
    return value;
  }

  return null;
}

function normalizeStatus(value: string): FanTribunaPost["status"] {
  return value === "draft" || value === "archived" ? value : "published";
}

function normalizeText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireText(value: string | null | undefined, message: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(0, Math.min(100, value));
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

/** Deduplicate targets by targetKey, preserving insertion order. */
function dedupTargets(targets: TaggableTarget[]): TaggableTarget[] {
  const seen = new Set<string>();
  const result: TaggableTarget[] = [];

  for (const t of targets) {
    if (!t.target_id.trim()) {
      continue;
    }

    const key = targetKey(t);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(t);
  }

  return result;
}
