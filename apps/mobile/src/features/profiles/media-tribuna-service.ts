import { supabase } from "../../lib/supabase";

export type MediaTribunaKind =
  | "editorial_poll"
  | "article_debate"
  | "player_vote"
  | "community_qa";

export type MediaTribunaStatus = "draft" | "published" | "archived";

export type LinkedMediaArticle = {
  category: string;
  cover_type: "image" | "video" | null;
  cover_url: string | null;
  excerpt: string | null;
  id: string;
  subtitle: string | null;
  title: string;
};

export type MediaTribunaOption = {
  id: string;
  is_voted: boolean;
  label: string;
  percentage: number;
  player_avatar_url: string | null;
  player_display_name: string | null;
  player_profile_id: string | null;
  sort_order: number;
  vote_count: number;
};

export type MediaTribunaComment = {
  author_avatar_url: string | null;
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  profile_id: string;
};

export type MediaTribunaQuestion = {
  author_avatar_url: string | null;
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  is_voted: boolean;
  profile_id: string;
  vote_count: number;
};

export type MediaTribunaPost = {
  body: string | null;
  comment_count: number;
  comments: MediaTribunaComment[];
  created_at: string;
  created_by_profile_id: string;
  id: string;
  is_saved: boolean;
  kind: MediaTribunaKind;
  linked_article: LinkedMediaArticle | null;
  linked_article_id: string | null;
  media_profile_id: string;
  options: MediaTribunaOption[];
  published_at: string | null;
  question_count: number;
  questions: MediaTribunaQuestion[];
  status: MediaTribunaStatus;
  title: string;
  total_vote_count: number;
  updated_at: string;
};

export type CreateMediaTribunaPollInput = {
  createdByProfileId: string;
  mediaProfileId: string;
  options: string[];
  question: string;
};

export type CreateMediaArticleDebateInput = {
  articleId: string;
  body?: string | null;
  createdByProfileId: string;
  mediaProfileId: string;
  question: string;
};

export type MediaTribunaPlayerOptionInput = {
  avatarUrl?: string | null;
  displayName: string;
  playerProfileId: string;
};

export type CreateMediaPlayerVoteInput = {
  body?: string | null;
  createdByProfileId: string;
  mediaProfileId: string;
  options: MediaTribunaPlayerOptionInput[];
  title: string;
};

export type CreateMediaCommunityQaInput = {
  body?: string | null;
  createdByProfileId: string;
  mediaProfileId: string;
  title: string;
};

type MediaTribunaPostRow = {
  body: string | null;
  created_at: string;
  created_by_profile_id: string;
  id: string;
  kind: string;
  linked_article_id: string | null;
  media_profile_id: string;
  published_at: string | null;
  status: string;
  title: string;
  updated_at: string;
};

type MediaTribunaOptionRow = {
  id: string;
  label: string;
  player_profile_id: string | null;
  post_id: string;
  sort_order: number;
};

type MediaTribunaQuestionRow = {
  body: string;
  created_at: string;
  id: string;
  post_id: string;
  profile_id: string;
};

type MediaTribunaCommentRow = {
  body: string;
  created_at: string;
  id: string;
  post_id: string;
  profile_id: string;
};

type ProfileRow = {
  avatar_url: string | null;
  full_name: string | null;
  id: string;
  role?: string | null;
};

type LinkedArticleRow = {
  category: string;
  cover_type: string | null;
  cover_url: string | null;
  excerpt: string | null;
  id: string;
  subtitle: string | null;
  title: string;
};

const POST_SELECT =
  "id, media_profile_id, created_by_profile_id, kind, title, body, linked_article_id, status, published_at, created_at, updated_at";

const LINKED_ARTICLE_SELECT =
  "id, category, title, subtitle, excerpt, cover_url, cover_type";

export async function fetchMediaTribunaFeed(
  mediaProfileId: string,
  viewerProfileId?: string | null,
): Promise<MediaTribunaPost[]> {
  const { data, error } = await supabase
    .from("media_tribuna_posts")
    .select(POST_SELECT)
    .eq("media_profile_id", mediaProfileId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return enrichMediaTribunaPosts(
    (data ?? []) as MediaTribunaPostRow[],
    viewerProfileId,
  );
}

export async function fetchMediaTribunaDetail(
  postId: string,
  viewerProfileId?: string | null,
): Promise<MediaTribunaPost | null> {
  const { data, error } = await supabase
    .from("media_tribuna_posts")
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

  const [post] = await enrichMediaTribunaPosts(
    [data as MediaTribunaPostRow],
    viewerProfileId,
  );

  return post ?? null;
}

export async function createMediaTribunaPoll(
  input: CreateMediaTribunaPollInput,
): Promise<MediaTribunaPost> {
  const question = requireText(input.question, "Inserisci la domanda del sondaggio.");
  const options = normalizeTextOptions(input.options, 2, 6);
  const post = await insertTribunaPost({
    body: null,
    created_by_profile_id: input.createdByProfileId,
    kind: "editorial_poll",
    linked_article_id: null,
    media_profile_id: input.mediaProfileId,
    status: "published",
    title: question,
  });

  await insertOptions(
    post.id,
    options.map((label, index) => ({
      label,
      player_profile_id: null,
      sort_order: index,
    })),
  );

  return loadCreatedPost(post, input.createdByProfileId);
}

export async function createMediaArticleDebate(
  input: CreateMediaArticleDebateInput,
): Promise<MediaTribunaPost> {
  const question = requireText(input.question, "Inserisci la domanda del dibattito.");
  const articleId = requireText(input.articleId, "Seleziona un articolo pubblicato.");
  const post = await insertTribunaPost({
    body: normalizeText(input.body),
    created_by_profile_id: input.createdByProfileId,
    kind: "article_debate",
    linked_article_id: articleId,
    media_profile_id: input.mediaProfileId,
    status: "published",
    title: question,
  });

  return loadCreatedPost(post, input.createdByProfileId);
}

export async function createMediaPlayerVote(
  input: CreateMediaPlayerVoteInput,
): Promise<MediaTribunaPost> {
  const title = requireText(input.title, "Inserisci il titolo della votazione.");
  const options = normalizePlayerOptions(input.options);
  const post = await insertTribunaPost({
    body: normalizeText(input.body),
    created_by_profile_id: input.createdByProfileId,
    kind: "player_vote",
    linked_article_id: null,
    media_profile_id: input.mediaProfileId,
    status: "published",
    title,
  });

  await insertOptions(
    post.id,
    options.map((option, index) => ({
      label: option.displayName,
      player_profile_id: option.playerProfileId,
      sort_order: index,
    })),
  );

  return loadCreatedPost(post, input.createdByProfileId);
}

export async function createMediaCommunityQa(
  input: CreateMediaCommunityQaInput,
): Promise<MediaTribunaPost> {
  const title = requireText(input.title, "Inserisci il titolo del Q&A.");
  const post = await insertTribunaPost({
    body: normalizeText(input.body),
    created_by_profile_id: input.createdByProfileId,
    kind: "community_qa",
    linked_article_id: null,
    media_profile_id: input.mediaProfileId,
    status: "published",
    title,
  });

  return loadCreatedPost(post, input.createdByProfileId);
}

export async function voteMediaTribunaOption(input: {
  optionId: string;
  postId: string;
  profileId: string;
}) {
  const { error } = await supabase.from("media_tribuna_option_votes").upsert(
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

export async function toggleSavedMediaTribuna(
  profileId: string,
  postId: string,
  shouldSave: boolean,
) {
  if (shouldSave) {
    const { error } = await supabase.from("saved_media_tribuna").upsert(
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
    .from("saved_media_tribuna")
    .delete()
    .eq("post_id", postId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

export async function addMediaTribunaComment(input: {
  body: string;
  postId: string;
  profileId: string;
}): Promise<MediaTribunaComment> {
  const body = requireText(input.body, "Scrivi un commento prima di pubblicare.");

  const { data, error } = await supabase
    .from("media_tribuna_comments")
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

  return enrichComment(data as MediaTribunaCommentRow);
}

export async function submitMediaTribunaQuestion(input: {
  body: string;
  postId: string;
  profileId: string;
}): Promise<MediaTribunaQuestion> {
  const body = requireText(input.body, "Scrivi una domanda prima di pubblicare.");

  const { data, error } = await supabase
    .from("media_tribuna_questions")
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
    throw new Error("Domanda non creata.");
  }

  const profiles = await loadProfilesById([input.profileId]);
  const author = profiles.get(input.profileId);

  return {
    author_avatar_url: author?.avatar_url ?? null,
    author_name: author?.full_name?.trim() || "Utente FootMe",
    body: String((data as MediaTribunaQuestionRow).body),
    created_at: String((data as MediaTribunaQuestionRow).created_at),
    id: String((data as MediaTribunaQuestionRow).id),
    is_voted: false,
    profile_id: input.profileId,
    vote_count: 0,
  };
}

export async function voteMediaTribunaQuestion(
  questionId: string,
  profileId: string,
  shouldVote: boolean,
) {
  if (shouldVote) {
    const { error } = await supabase.from("media_tribuna_question_votes").upsert(
      {
        question_id: questionId,
        profile_id: profileId,
      },
      { onConflict: "question_id,profile_id" },
    );

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("media_tribuna_question_votes")
    .delete()
    .eq("question_id", questionId)
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }
}

async function insertTribunaPost(payload: {
  body: string | null;
  created_by_profile_id: string;
  kind: MediaTribunaKind;
  linked_article_id: string | null;
  media_profile_id: string;
  status: "published";
  title: string;
}) {
  const { data, error } = await supabase
    .from("media_tribuna_posts")
    .insert(payload)
    .select(POST_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Contenuto Tribuna non creato.");
  }

  return data as MediaTribunaPostRow;
}

async function insertOptions(
  postId: string,
  options: { label: string; player_profile_id: string | null; sort_order: number }[],
) {
  const { error } = await supabase.from("media_tribuna_options").insert(
    options.map((option) => ({
      label: option.label,
      player_profile_id: option.player_profile_id,
      post_id: postId,
      sort_order: option.sort_order,
    })),
  );

  if (error) {
    throw error;
  }
}

async function loadCreatedPost(row: MediaTribunaPostRow, viewerProfileId: string) {
  const [post] = await enrichMediaTribunaPosts([row], viewerProfileId);

  if (!post) {
    throw new Error("Contenuto Tribuna non trovato.");
  }

  return post;
}

async function enrichMediaTribunaPosts(
  rows: MediaTribunaPostRow[],
  viewerProfileId?: string | null,
): Promise<MediaTribunaPost[]> {
  if (rows.length === 0) {
    return [];
  }

  const postIds = rows.map((row) => row.id);
  const linkedArticleIds = rows
    .map((row) => row.linked_article_id)
    .filter((id): id is string => Boolean(id));
  const [
    commentCounts,
    savedIds,
    optionsByPost,
    optionVoteState,
    commentsByPost,
    questionsByPost,
    linkedArticles,
  ] = await Promise.all([
    loadCountMap("media_tribuna_comments", "post_id", postIds),
    viewerProfileId
      ? loadViewerSavedPostIds(viewerProfileId, postIds)
      : Promise.resolve(new Set<string>()),
    loadOptionsByPost(postIds),
    loadOptionVoteState(postIds, viewerProfileId),
    loadCommentsByPost(postIds),
    loadQuestionsByPost(postIds, viewerProfileId),
    loadLinkedArticles(linkedArticleIds),
  ]);

  return rows.map((row) => {
    const options = (optionsByPost.get(row.id) ?? []).map((option) => {
      const voteCount = optionVoteState.optionCounts.get(option.id) ?? 0;
      const totalVoteCount = optionVoteState.totalCounts.get(row.id) ?? 0;

      return {
        ...option,
        is_voted: optionVoteState.viewerOptionByPost.get(row.id) === option.id,
        percentage:
          totalVoteCount > 0 ? Math.round((voteCount / totalVoteCount) * 100) : 0,
        vote_count: voteCount,
      };
    });

    const questions = questionsByPost.get(row.id) ?? [];

    return {
      body: row.body ?? null,
      comment_count: commentCounts.get(row.id) ?? 0,
      comments: commentsByPost.get(row.id) ?? [],
      created_at: row.created_at,
      created_by_profile_id: row.created_by_profile_id,
      id: row.id,
      is_saved: savedIds.has(row.id),
      kind: normalizeKind(row.kind),
      linked_article: row.linked_article_id
        ? linkedArticles.get(row.linked_article_id) ?? null
        : null,
      linked_article_id: row.linked_article_id ?? null,
      media_profile_id: row.media_profile_id,
      options,
      published_at: row.published_at ?? null,
      question_count: questions.length,
      questions,
      status: normalizeStatus(row.status),
      title: row.title,
      total_vote_count: optionVoteState.totalCounts.get(row.id) ?? 0,
      updated_at: row.updated_at,
    };
  });
}

async function loadOptionsByPost(postIds: string[]) {
  const optionsByPost = new Map<string, MediaTribunaOption[]>();

  if (postIds.length === 0) {
    return optionsByPost;
  }

  const { data, error } = await supabase
    .from("media_tribuna_options")
    .select("id, post_id, label, player_profile_id, sort_order")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MediaTribunaOptionRow[];
  const profiles = await loadProfilesById(
    rows
      .map((row) => row.player_profile_id)
      .filter((id): id is string => Boolean(id)),
  );

  for (const row of rows) {
    const profile = row.player_profile_id
      ? profiles.get(row.player_profile_id)
      : null;
    const list = optionsByPost.get(row.post_id) ?? [];

    list.push({
      id: row.id,
      is_voted: false,
      label: row.label,
      percentage: 0,
      player_avatar_url: profile?.avatar_url ?? null,
      player_display_name: profile?.full_name?.trim() || row.label,
      player_profile_id: row.player_profile_id ?? null,
      sort_order: row.sort_order,
      vote_count: 0,
    });
    optionsByPost.set(row.post_id, list);
  }

  return optionsByPost;
}

async function loadOptionVoteState(
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
    .from("media_tribuna_option_votes")
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

async function loadQuestionsByPost(
  postIds: string[],
  viewerProfileId?: string | null,
) {
  const questionsByPost = new Map<string, MediaTribunaQuestion[]>();

  if (postIds.length === 0) {
    return questionsByPost;
  }

  const { data, error } = await supabase
    .from("media_tribuna_questions")
    .select("id, post_id, profile_id, body, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MediaTribunaQuestionRow[];
  const questionIds = rows.map((row) => row.id);
  const [profiles, voteState] = await Promise.all([
    loadProfilesById(rows.map((row) => row.profile_id)),
    loadQuestionVoteState(questionIds, viewerProfileId),
  ]);

  for (const row of rows) {
    const profile = profiles.get(row.profile_id);
    const list = questionsByPost.get(row.post_id) ?? [];

    list.push({
      author_avatar_url: profile?.avatar_url ?? null,
      author_name: profile?.full_name?.trim() || "Utente FootMe",
      body: row.body,
      created_at: row.created_at,
      id: row.id,
      is_voted: voteState.viewerQuestionIds.has(row.id),
      profile_id: row.profile_id,
      vote_count: voteState.questionCounts.get(row.id) ?? 0,
    });
    questionsByPost.set(row.post_id, sortQuestions(list));
  }

  return questionsByPost;
}

async function loadQuestionVoteState(
  questionIds: string[],
  viewerProfileId?: string | null,
) {
  const questionCounts = new Map<string, number>();
  const viewerQuestionIds = new Set<string>();

  if (questionIds.length === 0) {
    return { questionCounts, viewerQuestionIds };
  }

  const { data, error } = await supabase
    .from("media_tribuna_question_votes")
    .select("question_id, profile_id")
    .in("question_id", questionIds);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as {
    profile_id: string;
    question_id: string;
  }[]) {
    questionCounts.set(row.question_id, (questionCounts.get(row.question_id) ?? 0) + 1);

    if (viewerProfileId && row.profile_id === viewerProfileId) {
      viewerQuestionIds.add(row.question_id);
    }
  }

  return { questionCounts, viewerQuestionIds };
}

async function loadCommentsByPost(postIds: string[]) {
  const commentsByPost = new Map<string, MediaTribunaComment[]>();

  if (postIds.length === 0) {
    return commentsByPost;
  }

  const { data, error } = await supabase
    .from("media_tribuna_comments")
    .select("id, post_id, profile_id, body, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MediaTribunaCommentRow[];
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

async function loadLinkedArticles(articleIds: string[]) {
  const articles = new Map<string, LinkedMediaArticle>();
  const ids = uniqueIds(articleIds);

  if (ids.length === 0) {
    return articles;
  }

  const { data, error } = await supabase
    .from("media_profile_posts")
    .select(LINKED_ARTICLE_SELECT)
    .in("id", ids);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as LinkedArticleRow[]) {
    articles.set(row.id, {
      category: row.category,
      cover_type: normalizeCoverType(row.cover_type),
      cover_url: row.cover_url ?? null,
      excerpt: row.excerpt ?? null,
      id: row.id,
      subtitle: row.subtitle ?? null,
      title: row.title,
    });
  }

  return articles;
}

async function loadCountMap(table: string, column: string, ids: string[]) {
  const counts = new Map<string, number>();

  if (ids.length === 0) {
    return counts;
  }

  const { data, error } = await supabase.from(table).select(column).in(column, ids);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as unknown as Record<string, string>[]) {
    const id = row[column];
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

async function loadViewerSavedPostIds(profileId: string, postIds: string[]) {
  const ids = new Set<string>();

  if (postIds.length === 0) {
    return ids;
  }

  const { data, error } = await supabase
    .from("saved_media_tribuna")
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

async function enrichComment(row: MediaTribunaCommentRow) {
  const profiles = await loadProfilesById([row.profile_id]);
  const author = profiles.get(row.profile_id);

  return {
    author_avatar_url: author?.avatar_url ?? null,
    author_name: author?.full_name?.trim() || "Utente FootMe",
    body: row.body,
    created_at: row.created_at,
    id: row.id,
    profile_id: row.profile_id,
  };
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

function requireText(value: string | null | undefined, message: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function normalizeTextOptions(options: string[], min: number, max: number) {
  const normalized = options
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
  const uniqueOptions = Array.from(
    new Map(normalized.map((option) => [option.toLowerCase(), option])).values(),
  );

  if (uniqueOptions.length < min) {
    throw new Error(`Aggiungi almeno ${min} opzioni.`);
  }

  if (uniqueOptions.length > max) {
    throw new Error(`Puoi aggiungere al massimo ${max} opzioni.`);
  }

  return uniqueOptions;
}

function normalizePlayerOptions(options: MediaTribunaPlayerOptionInput[]) {
  const uniqueOptions = new Map<string, MediaTribunaPlayerOptionInput>();

  options.forEach((option) => {
    const playerProfileId = option.playerProfileId.trim();
    const displayName = option.displayName.trim();

    if (!playerProfileId || !displayName || uniqueOptions.has(playerProfileId)) {
      return;
    }

    uniqueOptions.set(playerProfileId, {
      avatarUrl: option.avatarUrl ?? null,
      displayName,
      playerProfileId,
    });
  });

  if (uniqueOptions.size < 2) {
    throw new Error("Aggiungi almeno due giocatori.");
  }

  if (uniqueOptions.size > 12) {
    throw new Error("Puoi aggiungere al massimo 12 giocatori.");
  }

  return Array.from(uniqueOptions.values());
}

function sortQuestions(questions: MediaTribunaQuestion[]) {
  return [...questions].sort((left, right) => {
    if (left.vote_count !== right.vote_count) {
      return right.vote_count - left.vote_count;
    }

    return left.created_at.localeCompare(right.created_at);
  });
}

function normalizeKind(value: string): MediaTribunaKind {
  if (
    value === "article_debate" ||
    value === "player_vote" ||
    value === "community_qa"
  ) {
    return value;
  }

  return "editorial_poll";
}

function normalizeStatus(value: string): MediaTribunaStatus {
  return value === "draft" || value === "archived" ? value : "published";
}

function normalizeCoverType(value: string | null) {
  return value === "image" || value === "video" ? value : null;
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
