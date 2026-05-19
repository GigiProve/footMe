import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FanMediaPost } from "./fan-media-service";
import type { FanTribunaPost } from "./fan-tribuna-service";
import type { CompleteProfessionalProfile } from "./profile-service";

const fanMediaMocks = vi.hoisted(() => ({
  addFanMediaComment: vi.fn(),
  createFanMediaPost: vi.fn(),
  fetchFanMediaFeed: vi.fn(),
  fetchProfileFollowState: vi.fn(),
  followProfile: vi.fn(),
  toggleFanMediaLike: vi.fn(),
  toggleSavedFanMedia: vi.fn(),
  unfollowProfile: vi.fn(),
}));

const fanTribunaMocks = vi.hoisted(() => ({
  addFanTribunaComment: vi.fn(),
  createFanTribunaFormation: vi.fn(),
  createFanTribunaPoll: vi.fn(),
  createFanTribunaProposal: vi.fn(),
  fetchFanTribunaFeed: vi.fn(),
  toggleFanTribunaSupport: vi.fn(),
  toggleSavedFanTribuna: vi.fn(),
  voteFanTribunaPoll: vi.fn(),
}));

const mediaUploadMocks = vi.hoisted(() => ({
  pickAndUploadMedia: vi.fn(),
}));

const profileServiceMocks = vi.hoisted(() => ({
  searchAgentPlayerCandidates: vi.fn(),
  searchTeams: vi.fn(),
  updateFanFavoriteTeam: vi.fn(),
}));

vi.mock("@expo/vector-icons/Ionicons", () => {
  const MockIonicons = Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    {
      glyphMap: {
        "arrow-back": 1,
        "bookmark": 1,
        "bookmark-outline": 1,
        "bulb-outline": 1,
        "chatbubble-outline": 1,
        "chatbubbles-outline": 1,
        "checkmark": 1,
        "create-outline": 1,
        "football-outline": 1,
        "heart": 1,
        "heart-outline": 1,
        "image-outline": 1,
        "images-outline": 1,
        "location-outline": 1,
        "play": 1,
        "play-circle": 1,
        "shield-outline": 1,
        "stats-chart-outline": 1,
        "thumbs-up": 1,
        "thumbs-up-outline": 1,
        "videocam": 1,
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

vi.mock("./profile-service", () => ({
  searchAgentPlayerCandidates: profileServiceMocks.searchAgentPlayerCandidates,
  searchTeams: profileServiceMocks.searchTeams,
  updateFanFavoriteTeam: profileServiceMocks.updateFanFavoriteTeam,
}));

vi.mock("./player-sports-section", () => ({
  TeamAutocompleteInput: (props: Record<string, unknown>) =>
    React.createElement("MockTeamAutocompleteInput", props),
}));

vi.mock("./media-upload-service", () => ({
  pickAndUploadMedia: mediaUploadMocks.pickAndUploadMedia,
  ProfileMediaUploadError: class ProfileMediaUploadError extends Error {},
}));

vi.mock("./fan-media-service", () => ({
  addFanMediaComment: fanMediaMocks.addFanMediaComment,
  createFanMediaPost: fanMediaMocks.createFanMediaPost,
  FAN_MEDIA_TAG_OPTIONS: [
    { label: "Partita", value: "Partita" },
    { label: "Tifo", value: "Tifo" },
    { label: "Mercato", value: "Mercato" },
    { label: "Giovani", value: "Giovani" },
    { label: "Serie D", value: "Serie D" },
    { label: "Eccellenza", value: "Eccellenza" },
    { label: "Opinione", value: "Opinione" },
    { label: "Domanda", value: "Domanda" },
    { label: "Highlights", value: "Highlights" },
  ],
  fetchFanMediaFeed: fanMediaMocks.fetchFanMediaFeed,
  fetchProfileFollowState: fanMediaMocks.fetchProfileFollowState,
  followProfile: fanMediaMocks.followProfile,
  toggleFanMediaLike: fanMediaMocks.toggleFanMediaLike,
  toggleSavedFanMedia: fanMediaMocks.toggleSavedFanMedia,
  unfollowProfile: fanMediaMocks.unfollowProfile,
}));

vi.mock("./fan-tribuna-service", () => ({
  addFanTribunaComment: fanTribunaMocks.addFanTribunaComment,
  createFanTribunaFormation: fanTribunaMocks.createFanTribunaFormation,
  createFanTribunaPoll: fanTribunaMocks.createFanTribunaPoll,
  createFanTribunaProposal: fanTribunaMocks.createFanTribunaProposal,
  FAN_TRIBUNA_FORMATIONS: ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1"],
  fetchFanTribunaFeed: fanTribunaMocks.fetchFanTribunaFeed,
  toggleFanTribunaSupport: fanTribunaMocks.toggleFanTribunaSupport,
  toggleSavedFanTribuna: fanTribunaMocks.toggleSavedFanTribuna,
  voteFanTribunaPoll: fanTribunaMocks.voteFanTribunaPoll,
}));

import { FanProfileView } from "./FanProfileView";

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

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return tree;
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

const mediaPosts: FanMediaPost[] = [
  {
    comment_count: 1,
    comments: [
      {
        author_avatar_url: null,
        author_name: "Sara",
        body: "Che curva.",
        created_at: "2026-05-14T09:00:00Z",
        id: "comment-1",
        profile_id: "commenter-1",
      },
    ],
    created_at: "2026-05-14T08:00:00Z",
    description: "Dagli spalti, domenica vera.",
    id: "fan-post-photo",
    is_liked: false,
    is_saved: false,
    like_count: 4,
    profile_id: "fan-1",
    published_at: "2026-05-14T08:00:00Z",
    saved_count: 0,
    status: "published",
    tag: "Tifo",
    thumbnail_url: null,
    updated_at: "2026-05-14T08:00:00Z",
    visual_type: "image",
    visual_url: "https://cdn.test/spalti.jpg",
  },
  {
    comment_count: 0,
    comments: [],
    created_at: "2026-05-13T08:00:00Z",
    description: "Highlight amatoriale dal settore ospiti.",
    id: "fan-post-video",
    is_liked: true,
    is_saved: true,
    like_count: 8,
    profile_id: "fan-1",
    published_at: "2026-05-13T08:00:00Z",
    saved_count: 2,
    status: "published",
    tag: null,
    thumbnail_url: null,
    updated_at: "2026-05-13T08:00:00Z",
    visual_type: "video",
    visual_url: "https://cdn.test/highlight.mp4",
  },
];

const tribunaPosts: FanTribunaPost[] = [
  {
    body: null,
    comment_count: 0,
    comments: [],
    created_at: "2026-05-15T08:00:00Z",
    formation: null,
    id: "poll-1",
    is_saved: false,
    is_supported: false,
    kind: "poll",
    lineup_players: [],
    poll_options: [
      {
        id: "option-yes",
        is_voted: false,
        label: "Si",
        percentage: 67,
        sort_order: 0,
        vote_count: 2,
      },
      {
        id: "option-no",
        is_voted: false,
        label: "No",
        percentage: 33,
        sort_order: 1,
        vote_count: 1,
      },
    ],
    profile_id: "fan-1",
    published_at: "2026-05-15T08:00:00Z",
    reference_category: null,
    reference_club_id: null,
    reference_team_name: null,
    saved_count: 0,
    status: "published",
    support_count: 0,
    tagged_players: [],
    title: "Confermeresti l'allenatore?",
    total_vote_count: 3,
    updated_at: "2026-05-15T08:00:00Z",
  },
  {
    body: "Porterei due Under 19 in prima squadra.",
    comment_count: 1,
    comments: [],
    created_at: "2026-05-15T07:00:00Z",
    formation: null,
    id: "proposal-1",
    is_saved: false,
    is_supported: false,
    kind: "proposal",
    lineup_players: [],
    poll_options: [],
    profile_id: "fan-1",
    published_at: "2026-05-15T07:00:00Z",
    reference_category: "Under 19",
    reference_club_id: "club-1",
    reference_team_name: "AC Como",
    saved_count: 0,
    status: "published",
    support_count: 5,
    tagged_players: [
      {
        avatar_url: null,
        display_name: "Marco Verdi",
        player_profile_id: "player-1",
        sort_order: 0,
      },
    ],
    title: "Due Under 19 in prima squadra",
    total_vote_count: 0,
    updated_at: "2026-05-15T07:00:00Z",
  },
  {
    body: "Pressing alto e ampiezza.",
    comment_count: 0,
    comments: [],
    created_at: "2026-05-15T06:00:00Z",
    formation: "4-3-3",
    id: "formation-1",
    is_saved: false,
    is_supported: false,
    kind: "formation",
    lineup_players: [
      {
        avatar_url: null,
        display_name: "Luca Neri",
        player_profile_id: "player-2",
        slot_key: "goalkeeper",
        sort_order: 0,
        x_percent: 50,
        y_percent: 88,
      },
    ],
    poll_options: [],
    profile_id: "fan-1",
    published_at: "2026-05-15T06:00:00Z",
    reference_category: null,
    reference_club_id: "club-1",
    reference_team_name: "AC Como",
    saved_count: 0,
    status: "published",
    support_count: 2,
    tagged_players: [],
    title: "Il mio 4-3-3",
    total_vote_count: 0,
    updated_at: "2026-05-15T06:00:00Z",
  },
];

function buildFanProfile(): CompleteProfessionalProfile {
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
    fanProfile: {
      favorite_club_id: "club-1",
      favorite_team_name: "AC Como",
      interest_categories: ["Serie D", "Eccellenza", "Giovani talenti"],
      interest_regions: ["Lombardia"],
      profile_id: "fan-1",
    },
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: null,
      avatar_url: null,
      bio: null,
      birth_date: null,
      city: "Como",
      current_location_city: null,
      current_location_country: null,
      domicile: null,
      full_name: "Luigi Bianchi",
      gender: null,
      id: "fan-1",
      is_open_to_transfer: false,
      legal_status: null,
      languages: [],
      nationality: null,
      region: "Lombardia",
      residence: null,
      residence_country: null,
      role: "fan",
    },
    staffCareerEntries: [],
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: null,
    userContacts: {
      email: "",
      facebook: "",
      instagram: "",
      phone: "",
      showEmail: false,
      showFacebook: false,
      showInstagram: false,
    },
  };
}

describe("FanProfileView", () => {
  beforeEach(() => {
    Object.values(fanMediaMocks).forEach((mock) => mock.mockReset());
    Object.values(fanTribunaMocks).forEach((mock) => mock.mockReset());
    mediaUploadMocks.pickAndUploadMedia.mockReset();
    profileServiceMocks.searchAgentPlayerCandidates.mockReset();
    profileServiceMocks.searchTeams.mockReset();
    profileServiceMocks.updateFanFavoriteTeam.mockReset();

    fanMediaMocks.fetchFanMediaFeed.mockResolvedValue(mediaPosts);
    fanMediaMocks.fetchProfileFollowState.mockResolvedValue(false);
    fanMediaMocks.followProfile.mockResolvedValue(undefined);
    fanMediaMocks.unfollowProfile.mockResolvedValue(undefined);
    fanMediaMocks.toggleFanMediaLike.mockResolvedValue(undefined);
    fanMediaMocks.toggleSavedFanMedia.mockResolvedValue(undefined);
    fanMediaMocks.addFanMediaComment.mockResolvedValue({
      author_avatar_url: null,
      author_name: "Viewer",
      body: "Che atmosfera.",
      created_at: "2026-05-14T10:00:00Z",
      id: "comment-new",
      profile_id: "viewer-1",
    });

    fanTribunaMocks.fetchFanTribunaFeed.mockResolvedValue(tribunaPosts);
    fanTribunaMocks.voteFanTribunaPoll.mockResolvedValue(undefined);
    fanTribunaMocks.toggleFanTribunaSupport.mockResolvedValue(undefined);
    fanTribunaMocks.toggleSavedFanTribuna.mockResolvedValue(undefined);
    fanTribunaMocks.addFanTribunaComment.mockResolvedValue({
      author_avatar_url: null,
      author_name: "Viewer",
      body: "Sono d'accordo.",
      created_at: "2026-05-15T10:00:00Z",
      id: "tribuna-comment-new",
      profile_id: "viewer-1",
    });
    profileServiceMocks.searchAgentPlayerCandidates.mockResolvedValue([]);
    profileServiceMocks.searchTeams.mockResolvedValue([]);
    profileServiceMocks.updateFanFavoriteTeam.mockResolvedValue(undefined);
  });

  it("renders only Bacheca and Tribuna tabs with the fan header and Bacheca feed", async () => {
    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="visitor"
        viewerProfileId="viewer-1"
      />,
    );

    expect(hasText(tree.root, "Appassionato calcio dilettantistico")).toBe(true);
    expect(hasText(tree.root, "Tifa:")).toBe(true);
    expect(hasText(tree.root, "AC Como")).toBe(true);
    expect(hasText(tree.root, "Serie D")).toBe(true);
    expect(hasText(tree.root, "Eccellenza")).toBe(true);
    expect(hasText(tree.root, "Lombardia")).toBe(true);
    expect(tree.root.findByProps({ testID: "fan-follow-button" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "fan-profile-tabs" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "fan-bacheca-feed" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "fan-bacheca-post-fan-post-photo" }))
      .toBeTruthy();
    expect(tree.root.findByProps({ testID: "fan-bacheca-post-fan-post-video" }))
      .toBeTruthy();
    expect(hasText(tree.root, "Info")).toBe(false);
    expect(hasText(tree.root, "Carriera")).toBe(false);
    expect(hasText(tree.root, "Media")).toBe(false);
    expect(hasText(tree.root, "Sondaggio")).toBe(false);
  });

  it("uses a contextual + Crea menu for Bacheca and Tribuna", async () => {
    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="owner"
        viewerProfileId="fan-1"
      />,
    );

    expect(tree.root.findByProps({ testID: "fan-create-button" })).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: "fan-follow-button" })).toHaveLength(0);

    act(() => {
      findPressableByTestId(tree.root, "fan-create-button").props.onPress();
    });

    expect(tree.root.findByProps({ testID: "fan-create-menu" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "fan-create-option-post" })).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: "fan-create-option-poll" })).toHaveLength(0);

    act(() => {
      findPressableByTestId(tree.root, "fan-create-option-post").props.onPress();
    });

    expect(tree.root.findByProps({ testID: "fan-create-post-modal" })).toBeTruthy();

    const secondTree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="owner"
        viewerProfileId="fan-1"
      />,
    );

    act(() => {
      findPressableByTestId(secondTree.root, "fan-tab-Tribuna").props.onPress();
    });
    act(() => {
      findPressableByTestId(secondTree.root, "fan-create-button").props.onPress();
    });

    expect(secondTree.root.findByProps({ testID: "fan-create-option-poll" }))
      .toBeTruthy();
    expect(secondTree.root.findByProps({ testID: "fan-create-option-proposal" }))
      .toBeTruthy();
    expect(secondTree.root.findByProps({ testID: "fan-create-option-formation" }))
      .toBeTruthy();
    expect(secondTree.root.findAllByProps({ testID: "fan-create-option-post" }))
      .toHaveLength(0);
  });

  it("renders Tribuna formats and handles voting, save, support and comments", async () => {
    const onOpenPlayerProfile = vi.fn();
    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="visitor"
        onOpenPlayerProfile={onOpenPlayerProfile}
        viewerProfileId="viewer-1"
      />,
    );

    act(() => {
      findPressableByTestId(tree.root, "fan-tab-Tribuna").props.onPress();
    });

    expect(tree.root.findByProps({ testID: "fan-tribuna-feed" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "fan-tribuna-card-poll" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "fan-tribuna-card-proposal" }))
      .toBeTruthy();
    expect(tree.root.findByProps({ testID: "fan-tribuna-card-formation" }))
      .toBeTruthy();
    expect(tree.root.findByProps({ testID: "fan-formation-pitch" })).toBeTruthy();
    expect(hasText(tree.root, "Confermeresti l'allenatore?")).toBe(true);
    expect(hasText(tree.root, "Due Under 19 in prima squadra")).toBe(true);
    expect(hasText(tree.root, "Marco Verdi")).toBe(true);
    expect(hasText(tree.root, "Luca Neri")).toBe(true);

    await act(async () => {
      findPressableByTestId(tree.root, "fan-poll-option-option-yes").props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root
        .findAllByProps({ accessibilityLabel: "Vota contenuto tribuna" })[0]
        .props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root
        .findAllByProps({ accessibilityLabel: "Salva contenuto tribuna" })[0]
        .props.onPress();
      await Promise.resolve();
    });

    const commentInput = tree.root.findAllByProps({
      placeholder: "Scrivi un commento",
    })[0];

    act(() => {
      commentInput.props.onChangeText("Sono d'accordo.");
    });

    await act(async () => {
      tree.root
        .findAll(
          (node) =>
            node.props.label === "Invia" &&
            typeof node.props.onPress === "function",
        )[0]
        .props.onPress();
      await Promise.resolve();
    });

    act(() => {
      tree.root
        .findByProps({ accessibilityLabel: "Apri profilo Marco Verdi" })
        .props.onPress();
    });

    expect(fanTribunaMocks.voteFanTribunaPoll).toHaveBeenCalledWith({
      optionId: "option-yes",
      postId: "poll-1",
      profileId: "viewer-1",
    });
    expect(fanTribunaMocks.toggleFanTribunaSupport).toHaveBeenCalledWith(
      "viewer-1",
      "proposal-1",
      true,
    );
    expect(fanTribunaMocks.toggleSavedFanTribuna).toHaveBeenCalledWith(
      "viewer-1",
      "poll-1",
      true,
    );
    expect(fanTribunaMocks.addFanTribunaComment).toHaveBeenCalledWith({
      body: "Sono d'accordo.",
      postId: "poll-1",
      profileId: "viewer-1",
    });
    expect(onOpenPlayerProfile).toHaveBeenCalledWith("player-1");
  });

  it("keeps Bacheca social actions on media posts only", async () => {
    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="visitor"
        viewerProfileId="viewer-1"
      />,
    );

    await act(async () => {
      tree.root
        .findAllByProps({ accessibilityLabel: "Metti like al post" })[0]
        .props.onPress();
      await Promise.resolve();
    });
    await act(async () => {
      tree.root
        .findAllByProps({ accessibilityLabel: "Salva post" })[0]
        .props.onPress();
      await Promise.resolve();
    });

    const commentInput = tree.root.findAllByProps({
      placeholder: "Scrivi un commento",
    })[0];

    act(() => {
      commentInput.props.onChangeText("Che atmosfera.");
    });

    await act(async () => {
      tree.root
        .findAll(
          (node) =>
            node.props.label === "Invia" &&
            typeof node.props.onPress === "function",
        )[0]
        .props.onPress();
      await Promise.resolve();
    });

    expect(fanMediaMocks.toggleFanMediaLike).toHaveBeenCalledWith(
      "viewer-1",
      "fan-post-photo",
      true,
    );
    expect(fanMediaMocks.toggleSavedFanMedia).toHaveBeenCalledWith(
      "viewer-1",
      "fan-post-photo",
      true,
    );
    expect(fanMediaMocks.addFanMediaComment).toHaveBeenCalledWith({
      body: "Che atmosfera.",
      postId: "fan-post-photo",
      profileId: "viewer-1",
    });
  });

  it("publishes a new media-backed post with optional tag from the Bacheca menu", async () => {
    const createdPost: FanMediaPost = {
      ...mediaPosts[0],
      description: "Bella domanda alla community.",
      id: "fan-post-new",
      tag: "Domanda",
      visual_url: "https://cdn.test/domanda.jpg",
    };
    mediaUploadMocks.pickAndUploadMedia.mockResolvedValue([
      {
        type: "image",
        url: "https://cdn.test/domanda.jpg",
      },
    ]);
    fanMediaMocks.createFanMediaPost.mockResolvedValue(createdPost);

    const tree = render(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="owner"
        viewerProfileId="fan-1"
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      findPressableByTestId(tree.root, "fan-create-button").props.onPress();
    });
    act(() => {
      findPressableByTestId(tree.root, "fan-create-option-post").props.onPress();
    });

    await act(async () => {
      tree.root
        .findAll(
          (node) =>
            node.props.accessibilityLabel === "Scegli foto o video" &&
            typeof node.props.onPress === "function",
        )[0]
        .props.onPress();
      await Promise.resolve();
    });

    act(() => {
      tree.root
        .findByProps({
          placeholder: "Scrivi un pensiero sulla partita, un'opinione o una domanda...",
        })
        .props.onChangeText("Bella domanda alla community.");
    });

    act(() => {
      tree.root.findByProps({ testID: "fan-create-tag-Domanda" }).props.onPress();
    });

    await act(async () => {
      tree.root
        .findAll(
          (node) =>
            node.props.accessibilityLabel === "Pubblica post" &&
            typeof node.props.onPress === "function",
        )[0]
        .props.onPress();
      await Promise.resolve();
    });

    expect(fanMediaMocks.createFanMediaPost).toHaveBeenCalledWith({
      description: "Bella domanda alla community.",
      profileId: "fan-1",
      tag: "Domanda",
      thumbnailUrl: "https://cdn.test/domanda.jpg",
      visualType: "image",
      visualUrl: "https://cdn.test/domanda.jpg",
    });
    expect(tree.root.findByProps({ testID: "fan-bacheca-post-fan-post-new" }))
      .toBeTruthy();
  });

  it("publishes a new poll from the Tribuna menu", async () => {
    const createdPoll: FanTribunaPost = {
      ...tribunaPosts[0],
      id: "poll-new",
      poll_options: [
        { ...tribunaPosts[0].poll_options[0], id: "poll-new-yes", vote_count: 0 },
        { ...tribunaPosts[0].poll_options[1], id: "poll-new-no", vote_count: 0 },
      ],
      title: "Con quale modulo giocheresti domenica?",
      total_vote_count: 0,
    };
    fanTribunaMocks.createFanTribunaPoll.mockResolvedValue(createdPoll);

    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="owner"
        viewerProfileId="fan-1"
      />,
    );

    act(() => {
      findPressableByTestId(tree.root, "fan-tab-Tribuna").props.onPress();
    });
    act(() => {
      findPressableByTestId(tree.root, "fan-create-button").props.onPress();
    });
    act(() => {
      findPressableByTestId(tree.root, "fan-create-option-poll").props.onPress();
    });

    act(() => {
      tree.root
        .findByProps({ placeholder: "Confermeresti l'allenatore?" })
        .props.onChangeText("Con quale modulo giocheresti domenica?");
    });
    act(() => {
      tree.root.findByProps({ placeholder: "Si" }).props.onChangeText("4-3-3");
    });
    act(() => {
      tree.root.findByProps({ placeholder: "No" }).props.onChangeText("4-4-2");
    });

    await act(async () => {
      tree.root
        .findAll(
          (node) =>
            node.props.accessibilityLabel === "Pubblica contenuto tribuna" &&
            typeof node.props.onPress === "function",
        )[0]
        .props.onPress();
      await Promise.resolve();
    });

    expect(fanTribunaMocks.createFanTribunaPoll).toHaveBeenCalledWith({
      options: ["4-3-3", "4-4-2"],
      profileId: "fan-1",
      question: "Con quale modulo giocheresti domenica?",
    });
    expect(tree.root.findAllByProps({ testID: "fan-tribuna-card-poll" }).length)
      .toBeGreaterThan(0);
  });
});
