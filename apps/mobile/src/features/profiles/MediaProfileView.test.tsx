import React from "react";
import { Linking } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MediaProfileView } from "./MediaProfileView";
import type { MediaProfilePost } from "./media-profile-post-service";
import type { MediaTribunaPost } from "./media-tribuna-service";
import type { CompleteProfessionalProfile } from "./profile-service";

const followMocks = vi.hoisted(() => ({
  fetchProfileFollowState: vi.fn(),
  followProfile: vi.fn(),
  unfollowProfile: vi.fn(),
}));

const articleMocks = vi.hoisted(() => ({
  addMediaProfilePostComment: vi.fn(),
  createMediaProfilePost: vi.fn(),
  fetchMediaProfilePostDetail: vi.fn(),
  fetchMediaProfilePostFeed: vi.fn(),
  searchMediaProfilePostTargets: vi.fn(),
  toggleSavedMediaProfilePost: vi.fn(),
}));

const tribunaMocks = vi.hoisted(() => ({
  addMediaTribunaComment: vi.fn(),
  createMediaArticleDebate: vi.fn(),
  createMediaCommunityQa: vi.fn(),
  createMediaPlayerVote: vi.fn(),
  createMediaTribunaPoll: vi.fn(),
  fetchMediaTribunaFeed: vi.fn(),
  submitMediaTribunaQuestion: vi.fn(),
  toggleSavedMediaTribuna: vi.fn(),
  voteMediaTribunaOption: vi.fn(),
  voteMediaTribunaQuestion: vi.fn(),
}));

vi.mock("@expo/vector-icons/Ionicons", () => {
  const MockIonicons = Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    {
      glyphMap: {
        bookmark: 1,
        "bookmark-outline": 1,
        "bar-chart-outline": 1,
        "briefcase-outline": 1,
        "call-outline": 1,
        "chatbubble-outline": 1,
        "chatbubbles-outline": 1,
        "chatbox-outline": 1,
        checkmark: 1,
        "checkmark-circle": 1,
        "checkmark-circle-outline": 1,
        "chevron-up": 1,
        "chevron-back": 1,
        close: 1,
        "document-text-outline": 1,
        "flash-outline": 1,
        "globe-outline": 1,
        "help-circle-outline": 1,
        "link-outline": 1,
        "location-outline": 1,
        "logo-facebook": 1,
        "logo-instagram": 1,
        "logo-tiktok": 1,
        "logo-twitter": 1,
        "logo-youtube": 1,
        "mail-outline": 1,
        "newspaper-outline": 1,
        "open-outline": 1,
        "people-outline": 1,
        play: 1,
        "share-outline": 1,
        "shield-checkmark-outline": 1,
        "star-outline": 1,
      },
    },
  );

  return {
    default: MockIonicons,
  };
});

vi.mock("expo-av", () => ({
  ResizeMode: {
    COVER: "cover",
  },
  Video: (props: Record<string, unknown>) =>
    React.createElement("mock-video", props),
}));

vi.mock("../../components/ui/video-player-modal", () => ({
  VideoPlayerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-video-player-modal", props),
}));

vi.mock("./fan-media-service", () => ({
  fetchProfileFollowState: followMocks.fetchProfileFollowState,
  followProfile: followMocks.followProfile,
  unfollowProfile: followMocks.unfollowProfile,
}));

vi.mock("./media-profile-post-service", () => ({
  addMediaProfilePostComment: articleMocks.addMediaProfilePostComment,
  createMediaProfilePost: articleMocks.createMediaProfilePost,
  fetchMediaProfilePostDetail: articleMocks.fetchMediaProfilePostDetail,
  fetchMediaProfilePostFeed: articleMocks.fetchMediaProfilePostFeed,
  searchMediaProfilePostTargets: articleMocks.searchMediaProfilePostTargets,
  toggleSavedMediaProfilePost: articleMocks.toggleSavedMediaProfilePost,
}));

vi.mock("./media-tribuna-service", () => ({
  addMediaTribunaComment: tribunaMocks.addMediaTribunaComment,
  createMediaArticleDebate: tribunaMocks.createMediaArticleDebate,
  createMediaCommunityQa: tribunaMocks.createMediaCommunityQa,
  createMediaPlayerVote: tribunaMocks.createMediaPlayerVote,
  createMediaTribunaPoll: tribunaMocks.createMediaTribunaPoll,
  fetchMediaTribunaFeed: tribunaMocks.fetchMediaTribunaFeed,
  submitMediaTribunaQuestion: tribunaMocks.submitMediaTribunaQuestion,
  toggleSavedMediaTribuna: tribunaMocks.toggleSavedMediaTribuna,
  voteMediaTribunaOption: tribunaMocks.voteMediaTribunaOption,
  voteMediaTribunaQuestion: tribunaMocks.voteMediaTribunaQuestion,
}));

vi.mock("./media-upload-service", () => ({
  pickAndUploadMedia: vi.fn(),
  ProfileMediaUploadError: class ProfileMediaUploadError extends Error {},
}));

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

async function renderAsync(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(element);
  });

  await flushPromises();

  return tree;
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function hasText(root: TestRenderer.ReactTestInstance, value: string) {
  return root.findAll((node) => {
    const text = collectText(node.props.children);
    return text === value || text.includes(value);
  }).length > 0;
}

function collectText(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(collectText).join("");
  }

  if (
    children &&
    typeof children === "object" &&
    "props" in children &&
    children.props &&
    typeof children.props === "object" &&
    "children" in children.props
  ) {
    return collectText(children.props.children);
  }

  return "";
}

function findByTestId(root: TestRenderer.ReactTestInstance, testID: string) {
  const node = root.findAll((entry) => entry.props.testID === testID)[0];

  if (!node) {
    throw new Error(`Node not found for ${testID}`);
  }

  return node;
}

function findPressableByTestId(root: TestRenderer.ReactTestInstance, testID: string) {
  const node = root.findAll(
    (entry) =>
      entry.props.testID === testID && typeof entry.props.onPress === "function",
  )[0];

  if (!node) {
    throw new Error(`Pressable not found for ${testID}`);
  }

  return node;
}

function buildCompleteProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    agentCareerEntries: [],
    agentManagedPlayerEntries: [],
    agentProfile: null,
    club: null,
    clubSeasonEntries: [],
    coachCareerEntries: [],
    coachDirectorCareerEntries: [],
    coachPlayerCareerEntries: [],
    coachProfile: null,
    directorProfile: null,
    fanProfile: null,
    mediaProfile: {
      affiliation_name: "Gazzetta Network",
      affiliation_type: "Testata o sito",
      covered_competitions: ["Serie A", "Serie B", "Nazionale"],
      covered_teams: ["Como", "Milan"],
      covered_territories: ["Italia"],
      covered_topics: ["Calciomercato", "Interviste", "Giovanili", "Opinioni"],
      content_types: ["Calciomercato", "Nazionale"],
      editorial_type: "Testata giornalistica / Media sportivo",
      entity_name: "Gazzetta dello Sport",
      focus_areas: ["Serie A", "Serie B"],
      logo_url: "https://example.com/gazzetta-logo.png",
      profile_id: "media-1",
      short_description: "Notizie, analisi e storie sul calcio italiano.",
      verification_status: "verified",
    },
    mediaProfileAuthors: [
      {
        avatar_url: "https://example.com/marco.jpg",
        display_name: "Marco Bianchi",
        id: "author-1",
        is_public: true,
        is_verified: true,
        media_profile_id: "media-1",
        profile_id: "profile-author-1",
        role_label: "Giornalista",
        sort_order: 0,
      },
      {
        avatar_url: null,
        display_name: "Sara Rossi",
        id: "author-2",
        is_public: true,
        is_verified: false,
        media_profile_id: "media-1",
        profile_id: null,
        role_label: "Settore giovanile",
        sort_order: 1,
      },
    ],
    mediaProfileChannels: [
      {
        channel_type: "x",
        id: "channel-x",
        is_public: true,
        label: "X / Twitter",
        media_profile_id: "media-1",
        sort_order: 4,
        url: "https://x.com/gazzetta",
      },
    ],
    mediaProfileContacts: [
      {
        contact_type: "editorial",
        href: null,
        id: "contact-editorial",
        is_public: true,
        label: "Redazione",
        media_profile_id: "media-1",
        sort_order: 0,
        value: "redazione@gazzetta.example",
      },
      {
        contact_type: "press",
        href: null,
        id: "contact-press",
        is_public: true,
        label: "Comunicati stampa",
        media_profile_id: "media-1",
        sort_order: 1,
        value: "comunicati@gazzetta.example",
      },
    ],
    mediaProfileVerifications: [
      {
        id: "verification-publication",
        is_public: true,
        label: "Testata registrata",
        media_profile_id: "media-1",
        sort_order: 1,
        status: "verified",
        verification_type: "registered_publication",
        verified_at: "2026-05-01T00:00:00Z",
      },
      {
        id: "verification-authors",
        is_public: true,
        label: "Autori verificati",
        media_profile_id: "media-1",
        sort_order: 2,
        status: "verified",
        verification_type: "authors_verified",
        verified_at: "2026-05-01T00:00:00Z",
      },
    ],
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: null,
      avatar_url: null,
      bio: null,
      birth_date: null,
      city: "Milano",
      current_location_city: null,
      current_location_country: "IT",
      domicile: null,
      full_name: "Redazione Gazzetta",
      gender: null,
      id: "media-1",
      is_open_to_transfer: false,
      legal_status: null,
      languages: [],
      nationality: "IT",
      region: "Lombardia",
      residence: null,
      residence_country: null,
      role: "media",
    },
    staffCareerEntries: [],
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: null,
    userContacts: {
      email: "",
      facebook: "https://facebook.com/gazzetta",
      instagram: "@gazzetta",
      phone: "",
      showEmail: false,
      showFacebook: false,
      showInstagram: true,
      showTikTok: false,
      showWebsite: true,
      showYouTube: true,
      tiktok: "",
      website: "gazzetta.example",
      youtube: "https://youtube.com/@gazzetta",
    },
    ...overrides,
  };
}

function buildPost(overrides: Partial<MediaProfilePost> = {}): MediaProfilePost {
  return {
    author_id: "author-1",
    author_name: "Marco Bianchi",
    body:
      "La societa valuta profili giovani per completare il reparto offensivo.\n> Un investimento mirato per il futuro.",
    category: "Mercato",
    comment_count: 24,
    comments: [],
    cover_type: "image",
    cover_url: "https://example.com/cover.jpg",
    created_at: "2026-05-19T08:00:00Z",
    created_by_profile_id: "media-1",
    excerpt: "La societa valuta profili giovani per completare il reparto offensivo.",
    external_url: null,
    id: "post-1",
    is_saved: false,
    kind: "article",
    media_profile_id: "media-1",
    published_at: "2026-05-19T08:00:00Z",
    reading_time_minutes: 3,
    status: "published",
    subtitle: "La redazione segue un profilo Under 19 per il mercato estivo.",
    tagged_targets: [
      {
        avatar_url: null,
        display_name: "AC Como",
        role: "club",
        subtitle: "Serie A - Como",
        target_id: "club-1",
        target_type: "club",
      },
      {
        avatar_url: "https://example.com/player.jpg",
        display_name: "Luca Rossi",
        role: "player",
        subtitle: "Calciatore - Como",
        target_id: "player-1",
        target_type: "profile",
      },
    ],
    title: "Como, occhi su un attaccante Under 19",
    updated_at: "2026-05-19T08:00:00Z",
    ...overrides,
  };
}

function buildTribunaPost(
  overrides: Partial<MediaTribunaPost> = {},
): MediaTribunaPost {
  return {
    body: null,
    comment_count: 86,
    comments: [],
    created_at: "2026-05-19T08:30:00Z",
    created_by_profile_id: "media-1",
    id: "tribuna-poll-1",
    is_saved: false,
    kind: "editorial_poll",
    linked_article: null,
    linked_article_id: null,
    media_profile_id: "media-1",
    options: [
      {
        id: "option-defense",
        is_voted: false,
        label: "Difesa",
        percentage: 24,
        player_avatar_url: null,
        player_display_name: null,
        player_profile_id: null,
        sort_order: 0,
        vote_count: 300,
      },
      {
        id: "option-attack",
        is_voted: true,
        label: "Attacco",
        percentage: 76,
        player_avatar_url: null,
        player_display_name: null,
        player_profile_id: null,
        sort_order: 1,
        vote_count: 948,
      },
    ],
    published_at: "2026-05-19T08:30:00Z",
    question_count: 0,
    questions: [],
    status: "published",
    title: "Quale reparto deve rinforzare il Como?",
    total_vote_count: 1248,
    updated_at: "2026-05-19T08:30:00Z",
    ...overrides,
  };
}

describe("MediaProfileView", () => {
  beforeEach(() => {
    followMocks.fetchProfileFollowState.mockReset();
    followMocks.followProfile.mockReset();
    followMocks.unfollowProfile.mockReset();
    articleMocks.addMediaProfilePostComment.mockReset();
    articleMocks.createMediaProfilePost.mockReset();
    articleMocks.fetchMediaProfilePostDetail.mockReset();
    articleMocks.fetchMediaProfilePostFeed.mockReset();
    articleMocks.searchMediaProfilePostTargets.mockReset();
    articleMocks.toggleSavedMediaProfilePost.mockReset();
    Object.values(tribunaMocks).forEach((mock) => mock.mockReset());
    followMocks.fetchProfileFollowState.mockResolvedValue(false);
    followMocks.followProfile.mockResolvedValue(undefined);
    followMocks.unfollowProfile.mockResolvedValue(undefined);
    articleMocks.fetchMediaProfilePostFeed.mockResolvedValue([]);
    articleMocks.fetchMediaProfilePostDetail.mockResolvedValue(null);
    articleMocks.toggleSavedMediaProfilePost.mockResolvedValue(undefined);
    articleMocks.searchMediaProfilePostTargets.mockResolvedValue([]);
    tribunaMocks.fetchMediaTribunaFeed.mockResolvedValue([]);
    tribunaMocks.voteMediaTribunaOption.mockResolvedValue(undefined);
    tribunaMocks.toggleSavedMediaTribuna.mockResolvedValue(undefined);
    tribunaMocks.voteMediaTribunaQuestion.mockResolvedValue(undefined);
    articleMocks.addMediaProfilePostComment.mockResolvedValue({
      author_avatar_url: null,
      author_name: "Luigi",
      body: "Commento",
      created_at: "2026-05-19T09:00:00Z",
      id: "comment-1",
      profile_id: "viewer-1",
    });
    tribunaMocks.addMediaTribunaComment.mockResolvedValue({
      author_avatar_url: null,
      author_name: "Luigi",
      body: "Serve qualita.",
      created_at: "2026-05-19T09:00:00Z",
      id: "tribuna-comment-1",
      profile_id: "viewer-1",
    });
    tribunaMocks.submitMediaTribunaQuestion.mockResolvedValue({
      author_avatar_url: null,
      author_name: "Luigi",
      body: "Qual e' l'obiettivo stagionale?",
      created_at: "2026-05-19T09:10:00Z",
      id: "question-new",
      is_voted: false,
      profile_id: "viewer-1",
      vote_count: 0,
    });
    vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  });

  it("renders the Banani-style visitor header with media identity, CTA and default articles tab", async () => {
    const tree = await renderAsync(
      <MediaProfileView
        completeProfile={buildCompleteProfile()}
        mode="visitor"
        viewerProfileId="viewer-1"
      />,
    );

    expect(hasText(tree.root, "Gazzetta dello Sport")).toBe(true);
    expect(hasText(tree.root, "Testata giornalistica / Media sportivo")).toBe(true);
    expect(hasText(tree.root, "Serie A • Serie B • Nazionale")).toBe(true);
    expect(hasText(tree.root, "Italia")).toBe(true);
    expect(hasText(tree.root, "Sito web • Instagram • YouTube")).toBe(true);
    expect(hasText(tree.root, "Segui")).toBe(true);
    expect(hasText(tree.root, "Visita sito")).toBe(true);
    expect(hasText(tree.root, "Nessun articolo")).toBe(true);
    expect(findByTestId(tree.root, "media-tab-articles")).toBeTruthy();
    expect(articleMocks.fetchMediaProfilePostFeed).toHaveBeenCalledWith(
      "media-1",
      "viewer-1",
    );
    expect(followMocks.fetchProfileFollowState).toHaveBeenCalledWith(
      "viewer-1",
      "media-1",
    );
  });

  it("renders compact editorial rows, filters and tagged targets", async () => {
    articleMocks.fetchMediaProfilePostFeed.mockResolvedValue([
      buildPost(),
      buildPost({
        category: "Giovanili",
        comment_count: 8,
        id: "post-2",
        kind: "news",
        title: "Como U19, convocato un nuovo attaccante",
      }),
    ]);

    const tree = await renderAsync(
      <MediaProfileView
        completeProfile={buildCompleteProfile()}
        mode="visitor"
        viewerProfileId="viewer-1"
      />,
    );

    expect(hasText(tree.root, "Articoli")).toBe(true);
    expect(hasText(tree.root, "Mercato")).toBe(true);
    expect(hasText(tree.root, "Giovanili")).toBe(true);
    expect(hasText(tree.root, "Como, occhi su un attaccante Under 19")).toBe(true);
    expect(hasText(tree.root, "Como U19, convocato un nuovo attaccante")).toBe(true);
    expect(hasText(tree.root, "Luca Rossi")).toBe(true);
    expect(hasText(tree.root, "Leggi")).toBe(true);

    act(() => {
      findPressableByTestId(tree.root, "media-article-filter-Giovanili").props.onPress();
    });

    expect(hasText(tree.root, "Como, occhi su un attaccante Under 19")).toBe(false);
    expect(hasText(tree.root, "Como U19, convocato un nuovo attaccante")).toBe(true);
  });

  it("opens article detail with author line, actions, external link and target navigation", async () => {
    const post = buildPost({ external_url: "https://gazzetta.example/articolo" });
    const onOpenProfile = vi.fn();
    const onOpenClub = vi.fn();
    articleMocks.fetchMediaProfilePostFeed.mockResolvedValue([post]);
    articleMocks.fetchMediaProfilePostDetail.mockResolvedValue(post);

    const tree = await renderAsync(
      <MediaProfileView
        completeProfile={buildCompleteProfile()}
        mode="visitor"
        onOpenClub={onOpenClub}
        onOpenProfile={onOpenProfile}
        viewerProfileId="viewer-1"
      />,
    );

    await act(async () => {
      findPressableByTestId(tree.root, "media-article-row-post-1").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hasText(tree.root, "di Marco Bianchi - Gazzetta dello Sport")).toBe(true);
    expect(hasText(tree.root, "Profili taggati")).toBe(true);
    expect(hasText(tree.root, "Leggi anche sul sito")).toBe(true);
    expect(hasText(tree.root, "Commenta")).toBe(true);
    expect(hasText(tree.root, "Salva")).toBe(true);
    expect(hasText(tree.root, "Condividi")).toBe(true);

    const playerChip = tree.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Apri Luca Rossi" &&
        typeof node.props.onPress === "function",
    )[0];
    playerChip.props.onPress({ stopPropagation: vi.fn() });

    expect(onOpenProfile).toHaveBeenCalledWith("player-1");
  });

  it("uses profile_follows services for visitor follow and opens the website CTA", async () => {
    const tree = await renderAsync(
      <MediaProfileView
        completeProfile={buildCompleteProfile()}
        mode="visitor"
        viewerProfileId="viewer-1"
      />,
    );

    await act(async () => {
      findPressableByTestId(tree.root, "media-follow-button").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(followMocks.followProfile).toHaveBeenCalledWith("viewer-1", "media-1");
    expect(hasText(tree.root, "Seguito")).toBe(true);

    await act(async () => {
      findPressableByTestId(tree.root, "media-website-button").props.onPress();
      await Promise.resolve();
    });

    expect(Linking.openURL).toHaveBeenCalledWith("https://gazzetta.example");
  });

  it("does not render the follow CTA for owners and shows article creation", async () => {
    const tree = await renderAsync(
      <MediaProfileView
        completeProfile={buildCompleteProfile()}
        mode="owner"
        viewerProfileId="media-1"
      />,
    );

    expect(tree.root.findAllByProps({ testID: "media-follow-button" })).toEqual([]);
    expect(hasText(tree.root, "Visita sito")).toBe(true);
    expect(findByTestId(tree.root, "media-article-new-button")).toBeTruthy();

    act(() => {
      findPressableByTestId(tree.root, "media-tab-info").props.onPress();
    });

    expect(hasText(tree.root, "Identità editoriale")).toBe(true);
    expect(hasText(tree.root, "Copertura")).toBe(true);
    expect(hasText(tree.root, "Canali ufficiali")).toBe(true);
    expect(hasText(tree.root, "Redazione")).toBe(true);
    expect(hasText(tree.root, "Verifiche")).toBe(true);
    expect(hasText(tree.root, "Contatti")).toBe(true);
    expect(findByTestId(tree.root, "media-tab-info")).toBeTruthy();
  });

  it("renders complete media info sections and links authors back to their articles", async () => {
    articleMocks.fetchMediaProfilePostFeed.mockResolvedValue([
      buildPost(),
      buildPost({
        author_id: "author-2",
        author_name: "Sara Rossi",
        category: "Giovanili",
        id: "post-sara",
        title: "Como U19, focus sui nuovi profili",
      }),
    ]);

    const tree = await renderAsync(
      <MediaProfileView
        completeProfile={buildCompleteProfile()}
        mode="visitor"
        viewerProfileId="viewer-1"
      />,
    );

    act(() => {
      findPressableByTestId(tree.root, "media-tab-info").props.onPress();
    });

    expect(hasText(tree.root, "Testata giornalistica / Media sportivo")).toBe(true);
    expect(hasText(tree.root, "Competizioni")).toBe(true);
    expect(hasText(tree.root, "Squadre")).toBe(true);
    expect(hasText(tree.root, "Territori")).toBe(true);
    expect(hasText(tree.root, "Temi")).toBe(true);
    expect(hasText(tree.root, "X / Twitter")).toBe(true);
    expect(hasText(tree.root, "Marco Bianchi")).toBe(true);
    expect(hasText(tree.root, "Sara Rossi")).toBe(true);
    expect(hasText(tree.root, "Profilo verificato")).toBe(true);
    expect(hasText(tree.root, "Testata registrata")).toBe(true);
    expect(hasText(tree.root, "Autori verificati")).toBe(true);
    expect(hasText(tree.root, "redazione@gazzetta.example")).toBe(true);

    await act(async () => {
      findPressableByTestId(tree.root, "media-info-channel-channel-x").props.onPress();
      await Promise.resolve();
    });
    expect(Linking.openURL).toHaveBeenCalledWith("https://x.com/gazzetta");

    await act(async () => {
      findPressableByTestId(tree.root, "media-info-contact-contact-editorial").props.onPress();
      await Promise.resolve();
    });
    expect(Linking.openURL).toHaveBeenCalledWith(
      "mailto:redazione@gazzetta.example",
    );

    act(() => {
      findPressableByTestId(tree.root, "media-info-author-author-2").props.onPress();
    });

    expect(hasText(tree.root, "Autore")).toBe(true);
    expect(hasText(tree.root, "Como U19, focus sui nuovi profili")).toBe(true);
    expect(hasText(tree.root, "Como, occhi su un attaccante Under 19")).toBe(false);
  });

  it("renders Media Tribuna formats and handles voting, save, comments, Q&A and player links", async () => {
    const onOpenProfile = vi.fn();
    const linkedArticle = buildPost();
    const tribunaPosts: MediaTribunaPost[] = [
      buildTribunaPost(),
      buildTribunaPost({
        body: "Raccogliamo il parere della community dopo l'articolo.",
        comment_count: 12,
        id: "tribuna-debate-1",
        kind: "article_debate",
        linked_article: {
          category: "Mercato",
          cover_type: "image",
          cover_url: "https://example.com/cover.jpg",
          excerpt: linkedArticle.excerpt,
          id: linkedArticle.id,
          subtitle: linkedArticle.subtitle,
          title: linkedArticle.title,
        },
        linked_article_id: linkedArticle.id,
        options: [],
        title: "Che tipo di profilo servirebbe davvero?",
        total_vote_count: 0,
      }),
      buildTribunaPost({
        comment_count: 54,
        id: "tribuna-player-vote-1",
        kind: "player_vote",
        options: [
          {
            id: "option-player-1",
            is_voted: false,
            label: "Marco Verdi",
            percentage: 46,
            player_avatar_url: "https://example.com/player.jpg",
            player_display_name: "Marco Verdi",
            player_profile_id: "player-1",
            sort_order: 0,
            vote_count: 430,
          },
          {
            id: "option-player-2",
            is_voted: false,
            label: "Luca Neri",
            percentage: 54,
            player_avatar_url: null,
            player_display_name: "Luca Neri",
            player_profile_id: "player-2",
            sort_order: 1,
            vote_count: 504,
          },
        ],
        title: "Migliore in campo - Como U19 vs Lecco U19",
        total_vote_count: 934,
      }),
      buildTribunaPost({
        body: "Le domande piu votate saranno usate nella prossima intervista.",
        comment_count: 4,
        id: "tribuna-qa-1",
        kind: "community_qa",
        options: [],
        question_count: 1,
        questions: [
          {
            author_avatar_url: null,
            author_name: "Sara",
            body: "Qual e' l'obiettivo della prossima stagione?",
            created_at: "2026-05-19T09:00:00Z",
            id: "question-1",
            is_voted: false,
            profile_id: "viewer-2",
            vote_count: 124,
          },
        ],
        title: "Fai una domanda al DS del Como",
        total_vote_count: 0,
      }),
    ];
    articleMocks.fetchMediaProfilePostFeed.mockResolvedValue([linkedArticle]);
    articleMocks.fetchMediaProfilePostDetail.mockResolvedValue(linkedArticle);
    tribunaMocks.fetchMediaTribunaFeed.mockResolvedValue(tribunaPosts);

    const tree = await renderAsync(
      <MediaProfileView
        completeProfile={buildCompleteProfile()}
        mode="visitor"
        onOpenProfile={onOpenProfile}
        viewerProfileId="viewer-1"
      />,
    );

    act(() => {
      findPressableByTestId(tree.root, "media-tab-tribuna").props.onPress();
    });

    expect(tree.root.findByProps({ testID: "media-tribuna-feed" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "media-tribuna-card-editorial_poll" }))
      .toBeTruthy();
    expect(tree.root.findByProps({ testID: "media-tribuna-card-article_debate" }))
      .toBeTruthy();
    expect(tree.root.findByProps({ testID: "media-tribuna-card-player_vote" }))
      .toBeTruthy();
    expect(tree.root.findByProps({ testID: "media-tribuna-card-community_qa" }))
      .toBeTruthy();
    expect(hasText(tree.root, "Quale reparto deve rinforzare il Como?")).toBe(true);
    expect(hasText(tree.root, "Che tipo di profilo servirebbe davvero?")).toBe(true);
    expect(hasText(tree.root, "Marco Verdi")).toBe(true);
    expect(hasText(tree.root, "Qual e' l'obiettivo della prossima stagione?")).toBe(true);

    await act(async () => {
      findPressableByTestId(tree.root, "media-tribuna-option-option-defense").props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      findPressableByTestId(tree.root, "media-tribuna-save-tribuna-poll-1").props.onPress();
      await Promise.resolve();
    });

    const commentInput = tree.root.findAllByProps({
      placeholder: "Scrivi un commento",
    })[0];
    act(() => {
      commentInput.props.onChangeText("Serve qualita.");
    });
    await act(async () => {
      tree.root
        .findAll((node) => node.props.label === "Invia" && typeof node.props.onPress === "function")[0]
        .props.onPress();
      await Promise.resolve();
    });

    const questionInput = tree.root.findByProps({
      placeholder: "Scrivi una domanda per la community",
    });
    act(() => {
      questionInput.props.onChangeText("Qual e' l'obiettivo stagionale?");
    });
    await act(async () => {
      tree.root
        .findByProps({ testID: "media-tribuna-question-vote-question-1" })
        .props.onPress();
      await Promise.resolve();
    });

    await act(async () => {
      tree.root
        .findAll((node) => node.props.label === "Invia" && typeof node.props.onPress === "function")[3]
        .props.onPress();
      await Promise.resolve();
    });

    act(() => {
      tree.root
        .findByProps({ accessibilityLabel: "Apri profilo Marco Verdi" })
        .props.onPress({ stopPropagation: vi.fn() });
    });
    await act(async () => {
      findPressableByTestId(tree.root, "media-tribuna-linked-article-post-1").props.onPress();
      await Promise.resolve();
    });

    expect(tribunaMocks.voteMediaTribunaOption).toHaveBeenCalledWith({
      optionId: "option-defense",
      postId: "tribuna-poll-1",
      profileId: "viewer-1",
    });
    expect(tribunaMocks.toggleSavedMediaTribuna).toHaveBeenCalledWith(
      "viewer-1",
      "tribuna-poll-1",
      true,
    );
    expect(tribunaMocks.addMediaTribunaComment).toHaveBeenCalledWith({
      body: "Serve qualita.",
      postId: "tribuna-poll-1",
      profileId: "viewer-1",
    });
    expect(tribunaMocks.voteMediaTribunaQuestion).toHaveBeenCalledWith(
      "question-1",
      "viewer-1",
      true,
    );
    expect(tribunaMocks.submitMediaTribunaQuestion).toHaveBeenCalledWith({
      body: "Qual e' l'obiettivo stagionale?",
      postId: "tribuna-qa-1",
      profileId: "viewer-1",
    });
    expect(onOpenProfile).toHaveBeenCalledWith("player-1");
    expect(articleMocks.fetchMediaProfilePostDetail).toHaveBeenCalledWith(
      "post-1",
      "viewer-1",
    );
  });

  it("opens the owner Tribuna create menu and publishes an editorial poll", async () => {
    const createdPoll = buildTribunaPost({
      id: "tribuna-poll-new",
      title: "Confermeresti l'allenatore?",
      total_vote_count: 0,
    });
    tribunaMocks.createMediaTribunaPoll.mockResolvedValue(createdPoll);

    const tree = await renderAsync(
      <MediaProfileView
        completeProfile={buildCompleteProfile()}
        mode="owner"
        viewerProfileId="media-1"
      />,
    );

    act(() => {
      findPressableByTestId(tree.root, "media-tab-tribuna").props.onPress();
    });
    act(() => {
      findPressableByTestId(tree.root, "media-tribuna-create-button").props.onPress();
    });

    expect(hasText(tree.root, "Sondaggio editoriale")).toBe(true);
    expect(hasText(tree.root, "Dibattito da articolo")).toBe(true);
    expect(hasText(tree.root, "Vota il migliore")).toBe(true);
    expect(hasText(tree.root, "Q&A community")).toBe(true);

    act(() => {
      findPressableByTestId(tree.root, "media-tribuna-create-option-editorial_poll").props.onPress();
    });
    act(() => {
      tree.root
        .findByProps({ placeholder: "Quale reparto deve rinforzare il Como?" })
        .props.onChangeText("Confermeresti l'allenatore?");
    });
    act(() => {
      tree.root.findByProps({ placeholder: "Difesa" }).props.onChangeText("Si");
    });
    act(() => {
      tree.root.findByProps({ placeholder: "Centrocampo" }).props.onChangeText("No");
    });

    await act(async () => {
      findPressableByTestId(tree.root, "media-tribuna-publish-button").props.onPress();
      await Promise.resolve();
    });

    expect(tribunaMocks.createMediaTribunaPoll).toHaveBeenCalledWith({
      createdByProfileId: "media-1",
      mediaProfileId: "media-1",
      options: ["Si", "No"],
      question: "Confermeresti l'allenatore?",
    });
    expect(tree.root.findAllByProps({ testID: "media-tribuna-card-editorial_poll" }).length)
      .toBeGreaterThan(0);
  });
});
