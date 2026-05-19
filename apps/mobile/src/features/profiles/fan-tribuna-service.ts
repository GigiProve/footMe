import { supabase } from "../../lib/supabase";

export const FAN_TRIBUNA_FORMATIONS = [
  "4-3-3",
  "4-4-2",
  "3-5-2",
  "4-2-3-1",
] as const;

export type FanTribunaKind = "poll" | "proposal" | "formation";
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
  poll_options: FanTribunaPollOption[];
  profile_id: string;
  published_at: string | null;
  reference_category: string | null;
  reference_club_id: string | null;
  reference_team_name: string | null;
  saved_count: number;
  status: "draft" | "published" | "archived";
  support_count: number;
  tagged_players: FanTribunaTaggedPlayer[];
  title: string;
  total_vote_count: number;
  updated_at: string;
};

export type CreateFanTribunaPollInput = {
  options: string[];
  profileId: string;
  question: string;
};

export type CreateFanTribunaProposalInput = {
  body: string;
  profileId: string;
  referenceCategory?: string | null;
  referenceClubId?: string | null;
  referenceTeamName?: string | null;
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

type FanTribunaPostRow = {
  body: string | null;
  created_at: string;
  formation: string | null;
  id: string;
  kind: string;
  profile_id: string;
  published_at: string | null;
  reference_category: string | null;
  reference_club_id: string | null;
  reference_team_name: string | null;
  status: string;
  title: string;
  updated_at: string;
};

type FanTribunaPollOptionRow = {
  id: string;
  label: string;
  post_id: string;
  sort_order: number;
};

type ProfileRow = {
  avatar_url: string | null;
  full_name: string | null;
  id: string;
};

const POST_SELECT =
  "id, profile_id, kind, title, body, reference_team_name, reference_club_id, reference_category, formation, status, published_at, created_at, updated_at";

export async function fetchFanTribunaFeed(
  profileId: string,
  viewerProfileId?: string | null,
): Promise<FanTribunaPost[]> {
  const { data, error } = await supabase
    .from("fan_tribuna_posts")
    .select(POST_SELECT)
    .eq("profile_id", profileId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return enrichFanTribunaPosts((data ?? []) as FanTribunaPostRow[], viewerProfileId);
}

export async function createFanTribunaPoll(
  input: CreateFanTribunaPollInput,
): Promise<FanTribunaPost> {
  const question = requireText(input.question, "Inserisci la domanda del sondaggio.");
  const options = normalizePollOptions(input.options);

  const post = await insertTribunaPost({
    body: null,
    formation: null,
    kind: "poll",
    profile_id: input.profileId,
    reference_category: null,
    reference_club_id: null,
    reference_team_name: null,
    status: "published",
    title: question,
  });

  const { error } = await supabase.from("fan_tribuna_poll_options").insert(
    options.map((label, index) => ({
      label,
      post_id: post.id,
      sort_order: index,
    })),
  );

  if (error) {
    throw error;
  }

  return loadCreatedPost(post, input.profileId);
}

export async function createFanTribunaProposal(
  input: CreateFanTribunaProposalInput,
): Promise<FanTribunaPost> {
  const title = requireText(input.title, "Inserisci il titolo della proposta.");
  const body = requireText(input.body, "Aggiungi una breve motivazione.");
  const post = await insertTribunaPost({
    body,
    formation: null,
    kind: "proposal",
    profile_id: input.profileId,
    reference_category: normalizeText(input.referenceCategory),
    reference_club_id: normalizeText(input.referenceClubId),
    reference_team_name: normalizeText(input.referenceTeamName),
    status: "published",
    title,
  });

  await insertTaggedPlayers(post.id, input.taggedPlayers ?? []);

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
    profile_id: input.profileId,
    reference_category: normalizeText(input.referenceCategory),
    reference_club_id: normalizeText(input.referenceClubId),
    reference_team_name: referenceTeamName,
    status: "published",
    title,
  });

  await insertLineupPlayers(post.id, input.lineupPlayers ?? []);

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

async function insertTribunaPost(payload: {
  body: string | null;
  formation: FanTribunaFormation | null;
  kind: FanTribunaKind;
  profile_id: string;
  reference_category: string | null;
  reference_club_id: string | null;
  reference_team_name: string | null;
  status: "published";
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

async function insertTaggedPlayers(
  postId: string,
  taggedPlayers: FanTribunaTaggedPlayer[],
) {
  const payload = taggedPlayers
    .filter((player) => player.player_profile_id && player.display_name.trim())
    .map((player, index) => ({
      avatar_url: normalizeText(player.avatar_url),
      display_name: player.display_name.trim(),
      player_profile_id: player.player_profile_id,
      post_id: postId,
      sort_order: index,
    }));

  if (payload.length === 0) {
    return;
  }

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
    taggedPlayersByPost,
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
    loadTaggedPlayersByPost(postIds),
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
        vote_count: voteCount,
      };
    });

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
      poll_options: pollOptions,
      profile_id: row.profile_id,
      published_at: row.published_at ?? null,
      reference_category: row.reference_category ?? null,
      reference_club_id: row.reference_club_id ?? null,
      reference_team_name: row.reference_team_name ?? null,
      saved_count: savedCounts.get(row.id) ?? 0,
      status: normalizeStatus(row.status),
      support_count: supportCounts.get(row.id) ?? 0,
      tagged_players: taggedPlayersByPost.get(row.id) ?? [],
      title: row.title,
      total_vote_count: pollVoteState.totalCounts.get(row.id) ?? 0,
      updated_at: row.updated_at,
    };
  });
}

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
    .select("id, post_id, label, sort_order")
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

async function loadTaggedPlayersByPost(postIds: string[]) {
  const playersByPost = new Map<string, FanTribunaTaggedPlayer[]>();

  if (postIds.length === 0) {
    return playersByPost;
  }

  const { data, error } = await supabase
    .from("fan_tribuna_tagged_players")
    .select("post_id, player_profile_id, display_name, avatar_url, sort_order")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as (FanTribunaTaggedPlayer & { post_id: string })[]) {
    const list = playersByPost.get(row.post_id) ?? [];
    list.push({
      avatar_url: row.avatar_url ?? null,
      display_name: row.display_name,
      player_profile_id: row.player_profile_id,
      sort_order: row.sort_order,
    });
    playersByPost.set(row.post_id, list);
  }

  return playersByPost;
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
  if (value === "proposal" || value === "formation") {
    return value;
  }

  return "poll";
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
