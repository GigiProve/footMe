import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ClubHeaderStats,
  PublicClubMember,
  PublicClubProfile,
  PublicClubSquadraOverview,
} from "../club-service";
import type { ClubMediaPost } from "../club-media-service";
import type { ClubTeam } from "../team-service";

const mediaMocks = vi.hoisted(() => ({
  addClubMediaComment: vi.fn(),
  createClubMediaPost: vi.fn(),
  fetchClubMediaFeed: vi.fn(),
  fetchClubMediaPostDetail: vi.fn(),
  toggleClubMediaLike: vi.fn(),
  toggleSavedClubMedia: vi.fn(),
}));

vi.mock("../../../components/ui/video-player-modal", () => ({
  VideoPlayerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-video-player-modal", props),
}));

vi.mock("../club-media-service", () => ({
  addClubMediaComment: mediaMocks.addClubMediaComment,
  createClubMediaPost: mediaMocks.createClubMediaPost,
  fetchClubMediaFeed: mediaMocks.fetchClubMediaFeed,
  fetchClubMediaPostDetail: mediaMocks.fetchClubMediaPostDetail,
  toggleClubMediaLike: mediaMocks.toggleClubMediaLike,
  toggleSavedClubMedia: mediaMocks.toggleSavedClubMedia,
}));

vi.mock("../../profiles/profile-service", () => ({
  searchAgentPlayerCandidates: vi.fn(async () => []),
}));

vi.mock("../../profiles/media-upload-service", () => ({
  pickAndUploadMedia: vi.fn(async () => []),
  ProfileMediaUploadError: class ProfileMediaUploadError extends Error {},
}));

import { PublicClubProfileView } from "./PublicClubProfileView";

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
  });

  return tree;
}

function hasText(root: TestRenderer.ReactTestInstance, value: string) {
  return root.findAll((node) => {
    const children = node.props.children;

    if (Array.isArray(children)) {
      return children.join("") === value;
    }

    return children === value;
  }).length > 0;
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

const club: PublicClubProfile = {
  category: "Serie D",
  city: "Como",
  club_colors: null,
  club_email: "info@accomo.test",
  club_phone: null,
  country: "IT",
  description: "Società orientata allo sviluppo del territorio.",
  field_address: null,
  founding_year: 1907,
  gallery_urls: [],
  headquarters_address: null,
  id: "club-1",
  key_results: ["12 stagioni in Serie D", "Finale playoff nazionale"],
  league: "LND",
  logo_url: null,
  name: "AC Como",
  owner_full_name: null,
  region: "Lombardia",
  sports_focus: "Valorizzazione giovani e continuità tra vivaio e prima squadra.",
  stadium: "Sinigaglia",
  top_level_reached: "Serie C",
  verification_status: "verified",
  website_url: null,
};

const stats: ClubHeaderStats = {
  activeTeamsCount: 4,
  playersCount: 88,
  staffCount: 18,
};

const teams: ClubTeam[] = [
  {
    category: "Serie D",
    city: "Como",
    club_id: "club-1",
    id: "team-1",
    inherited: true,
    logo_url: null,
    name: "AC Como",
    parent_team_id: null,
    region: "Lombardia",
    sort_order: 0,
    team_type: "senior",
  },
  {
    category: "Under 17",
    city: "Como",
    club_id: "club-1",
    id: "team-2",
    inherited: false,
    logo_url: null,
    name: "Under 17 Elite",
    parent_team_id: null,
    region: "Lombardia",
    sort_order: 1,
    team_type: "youth",
  },
];

const teamProfiles = {
  "team-1": {
    competition_name: "Serie D Girone B",
    group_name: "B",
    media_urls: [],
    promoted_players_count: 0,
    recent_results: [],
    team_id: "team-1",
  },
  "team-2": {
    competition_name: "Under 17 Elite",
    group_name: "A",
    media_urls: [],
    promoted_players_count: 0,
    recent_results: [],
    team_id: "team-2",
  },
};

const overview: PublicClubSquadraOverview = {
  affiliations: [
    {
      category: "Scuola calcio",
      city: "Cantù",
      id: "affiliate-1",
      logo_url: null,
      name: "Como Academy Cantù",
      region: "Lombardia",
      relationship_label: "Academy ufficiale",
    },
  ],
  parentAffiliation: {
    id: "parent-1",
    name: "AC Como",
    relationship_label: "Academy ufficiale",
  },
  positionPreview: [
    {
      category: "Under 19",
      created_at: "2026-05-01T08:00:00Z",
      id: "ad-1",
      published_at: "2026-05-02T08:00:00Z",
      region: "Lombardia",
      role_required: "forward",
      team_category: "Under 19",
      team_id: "team-2",
      team_name: "Juniores Nazionale",
      title: "Attaccante",
    },
    {
      category: "Under 17",
      created_at: "2026-05-01T08:00:00Z",
      id: "ad-2",
      published_at: "2026-05-02T08:00:00Z",
      region: "Lombardia",
      role_required: "Preparatore atletico",
      team_category: "Under 17",
      team_id: "team-2",
      team_name: "Under 17 Elite",
      title: "Preparatore atletico",
    },
    {
      category: "Prima squadra",
      created_at: "2026-05-01T08:00:00Z",
      id: "ad-3",
      published_at: "2026-05-02T08:00:00Z",
      region: "Lombardia",
      role_required: "defender",
      team_category: "Serie D",
      team_id: "team-1",
      team_name: "Prima squadra",
      title: "Difensore",
    },
    {
      category: "Under 15",
      created_at: "2026-05-01T08:00:00Z",
      id: "ad-4",
      published_at: "2026-05-02T08:00:00Z",
      region: "Lombardia",
      role_required: "midfielder",
      team_category: "Under 15",
      team_id: null,
      team_name: null,
      title: "Centrocampista",
    },
  ],
  positionsTotal: 6,
  seasonSummaries: [
    {
      category: "Serie D",
      seasonsCount: 12,
    },
  ],
};

const members: PublicClubMember[] = [];

const rosterMembers: PublicClubMember[] = [
  {
    avatar_url: null,
    birth_date: "2006-01-10",
    contract_status: null,
    current_condition: null,
    full_name: "Luca Portieri",
    id: "member-player-1",
    manual_name: null,
    member_role: "player",
    primary_position: "goalkeeper",
    profile_id: "profile-player-1",
    staff_title: null,
    team_id: "team-1",
  },
  {
    avatar_url: null,
    birth_date: "2007-04-12",
    contract_status: "free_agent",
    current_condition: null,
    full_name: "Marco Attaccante",
    id: "member-player-2",
    manual_name: null,
    member_role: "player",
    primary_position: "striker",
    profile_id: "profile-player-2",
    staff_title: null,
    team_id: "team-2",
  },
  {
    avatar_url: null,
    birth_date: "2007-09-22",
    contract_status: null,
    current_condition: null,
    full_name: "Paolo Regista",
    id: "member-player-3",
    manual_name: null,
    member_role: "player",
    primary_position: "central_midfielder",
    profile_id: "profile-player-3",
    staff_title: null,
    team_id: "team-2",
  },
  {
    avatar_url: null,
    birth_date: null,
    contract_status: null,
    current_condition: null,
    full_name: "Giovanni Riva",
    id: "member-coach-1",
    manual_name: null,
    member_role: "coach",
    primary_position: null,
    profile_id: "profile-coach-1",
    staff_title: "Allenatore",
    team_id: "team-1",
  },
  {
    avatar_url: null,
    birth_date: null,
    contract_status: null,
    current_condition: null,
    full_name: "Marco Bianchi",
    id: "member-director-1",
    manual_name: null,
    member_role: "director",
    primary_position: null,
    profile_id: "profile-director-1",
    staff_title: "Direttore sportivo",
    team_id: null,
  },
  {
    avatar_url: null,
    birth_date: null,
    contract_status: null,
    current_condition: null,
    full_name: null,
    id: "member-operation-1",
    manual_name: "Sara Costa",
    member_role: "staff",
    primary_position: null,
    profile_id: null,
    staff_title: "Segreteria sportiva",
    team_id: null,
  },
];

const mediaPosts: ClubMediaPost[] = [
  {
    attachment_label: null,
    body: "Le migliori azioni della partita e i momenti decisivi.",
    club_id: "club-1",
    comment_count: 1,
    comments: [],
    created_at: "2026-05-14T08:00:00Z",
    created_by_profile_id: "owner-1",
    event_date: null,
    excerpt: "Le migliori azioni della partita",
    external_url: null,
    id: "media-highlights",
    interviewee_name: null,
    is_liked: false,
    is_saved: false,
    kind: "highlights",
    like_count: 4,
    player_birth_year: null,
    player_name: null,
    player_previous_club: null,
    player_role: null,
    published_at: "2026-05-14T08:00:00Z",
    saved_count: 0,
    status: "published",
    tagged_profiles: [],
    thumbnail_url: "https://cdn.test/highlights.jpg",
    title: "AC Como 2-1 Lecco",
    updated_at: "2026-05-14T08:00:00Z",
    video_duration_seconds: 154,
    visual_type: "video",
    visual_url: "https://cdn.test/highlights.mp4",
  },
  {
    attachment_label: null,
    body: "Il tecnico commenta prestazione e obiettivi.",
    club_id: "club-1",
    comment_count: 0,
    comments: [],
    created_at: "2026-05-13T08:00:00Z",
    created_by_profile_id: "owner-1",
    event_date: null,
    excerpt: "Le parole del mister dopo la gara",
    external_url: null,
    id: "media-interview",
    interviewee_name: "Giovanni Riva",
    is_liked: false,
    is_saved: false,
    kind: "interview",
    like_count: 1,
    player_birth_year: null,
    player_name: null,
    player_previous_club: null,
    player_role: null,
    published_at: "2026-05-13T08:00:00Z",
    saved_count: 0,
    status: "published",
    tagged_profiles: [],
    thumbnail_url: "https://cdn.test/interview.jpg",
    title: "Le parole del mister",
    updated_at: "2026-05-13T08:00:00Z",
    video_duration_seconds: 72,
    visual_type: "video",
    visual_url: "https://cdn.test/interview.mp4",
  },
  {
    attachment_label: null,
    body: "La societa' da' il benvenuto a Marco Rossi.",
    club_id: "club-1",
    comment_count: 0,
    comments: [],
    created_at: "2026-05-12T08:00:00Z",
    created_by_profile_id: "owner-1",
    event_date: null,
    excerpt: "Benvenuto Marco Rossi",
    external_url: null,
    id: "media-market",
    interviewee_name: null,
    is_liked: true,
    is_saved: false,
    kind: "market",
    like_count: 8,
    player_birth_year: 2006,
    player_name: "Marco Rossi",
    player_previous_club: "Lecco Academy",
    player_role: "Attaccante",
    published_at: "2026-05-12T08:00:00Z",
    saved_count: 0,
    status: "published",
    tagged_profiles: [
      {
        avatar_url: null,
        display_name: "Marco Rossi",
        profile_id: "profile-player-2",
        role: "player",
      },
    ],
    thumbnail_url: "https://cdn.test/market.jpg",
    title: "Marco Rossi e' un nuovo giocatore",
    updated_at: "2026-05-12T08:00:00Z",
    video_duration_seconds: null,
    visual_type: "image",
    visual_url: "https://cdn.test/market.jpg",
  },
  {
    attachment_label: "Calendario aggiornato.pdf",
    body: "La societa' comunica una variazione degli orari.",
    club_id: "club-1",
    comment_count: 0,
    comments: [],
    created_at: "2026-05-11T08:00:00Z",
    created_by_profile_id: "owner-1",
    event_date: null,
    excerpt: "Aggiornamento calendario allenamenti",
    external_url: "https://club.test/calendario",
    id: "media-statement",
    interviewee_name: null,
    is_liked: false,
    is_saved: true,
    kind: "statement",
    like_count: 0,
    player_birth_year: null,
    player_name: null,
    player_previous_club: null,
    player_role: null,
    published_at: "2026-05-11T08:00:00Z",
    saved_count: 2,
    status: "published",
    tagged_profiles: [],
    thumbnail_url: null,
    title: "Aggiornamento calendario allenamenti",
    updated_at: "2026-05-11T08:00:00Z",
    video_duration_seconds: null,
    visual_type: null,
    visual_url: null,
  },
];

function createProps(overrides: Partial<React.ComponentProps<typeof PublicClubProfileView>> = {}) {
  return {
    activeTab: "team" as const,
    club,
    isFollowed: false,
    isFollowing: false,
    members,
    onContactPress: vi.fn(),
    onOpenAffiliate: vi.fn(),
    onOpenPositions: vi.fn(),
    onOpenProfile: vi.fn(),
    onOpenTeam: vi.fn(),
    onTabChange: vi.fn(),
    onToggleFollow: vi.fn(),
    overview,
    stats,
    teamProfiles,
    teams,
    ...overrides,
  };
}

describe("PublicClubProfileView", () => {
  beforeEach(() => {
    mediaMocks.fetchClubMediaFeed.mockReset();
    mediaMocks.fetchClubMediaPostDetail.mockReset();
    mediaMocks.createClubMediaPost.mockReset();
    mediaMocks.addClubMediaComment.mockReset();
    mediaMocks.toggleClubMediaLike.mockReset();
    mediaMocks.toggleSavedClubMedia.mockReset();
    mediaMocks.fetchClubMediaFeed.mockResolvedValue([]);
    mediaMocks.fetchClubMediaPostDetail.mockResolvedValue(null);
  });

  it("renders the Squadra tab sections in the required order", () => {
    const tree = render(<PublicClubProfileView {...createProps()} />);
    const sectionIds = Array.from(
      new Set(
        tree.root
          .findAll(
            (node) =>
              typeof node.props.testID === "string" &&
              node.props.testID.startsWith("club-section-"),
          )
          .map((node) => node.props.testID),
      ),
    );

    expect(sectionIds).toEqual([
      "club-section-sport-profile",
      "club-section-highlights",
      "club-section-positions",
      "club-section-teams",
      "club-section-affiliates",
    ]);
    expect(tree.root.findByProps({ children: "Società affiliata ad AC Como" }))
      .toBeTruthy();
    expect(hasText(tree.root, "6 ricerche attive")).toBe(true);
  });

  it("keeps the positions preview compact even if more results are passed", () => {
    const tree = render(<PublicClubProfileView {...createProps()} />);
    const previewRowIds = Array.from(
      new Set(
        tree.root
          .findAll(
            (node) =>
              typeof node.props.testID === "string" &&
              node.props.testID.startsWith("club-position-preview-"),
          )
          .map((node) => node.props.testID),
      ),
    );

    expect(previewRowIds).toHaveLength(3);
    expect(tree.root.findByProps({ testID: "club-position-preview-ad-1" }))
      .toBeTruthy();
    expect(() =>
      tree.root.findByProps({ testID: "club-position-preview-ad-4" }),
    ).toThrow();
  });

  it("exposes clickable rows for internal teams, affiliates, and all positions", () => {
    const onOpenAffiliate = vi.fn();
    const onOpenPositions = vi.fn();
    const onOpenTeam = vi.fn();
    const tree = render(
      <PublicClubProfileView
        {...createProps({ onOpenAffiliate, onOpenPositions, onOpenTeam })}
      />,
    );

    act(() => {
      tree.root.findByProps({ testID: "club-team-row-team-1" }).props.onPress();
      tree.root
        .findByProps({ testID: "club-affiliate-row-affiliate-1" })
        .props.onPress();
      tree.root.findByProps({ testID: "club-positions-view-all" }).props.onPress();
    });

    expect(onOpenTeam).toHaveBeenCalledWith("team-1");
    expect(onOpenAffiliate).toHaveBeenCalledWith("affiliate-1");
    expect(onOpenPositions).toHaveBeenCalledTimes(1);
  });

  it("shows Rose by default and updates team and role filters in place", () => {
    const onOpenProfile = vi.fn();
    const onOpenTeam = vi.fn();
    const tree = render(
      <PublicClubProfileView
        {...createProps({
          activeTab: "roster",
          members: rosterMembers,
          onOpenProfile,
          onOpenTeam,
        })}
      />,
    );

    expect(hasText(tree.root, "Rose")).toBe(true);
    expect(hasText(tree.root, "Vedi rosa")).toBe(false);
    expect(tree.root.findByProps({ testID: "club-roster-player-row-member-player-1" }))
      .toBeTruthy();

    act(() => {
      tree.root
        .findByProps({ testID: "club-roster-team-chip-team-2" })
        .props.onPress();
    });

    expect(onOpenTeam).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ testID: "club-roster-player-row-member-player-2" }))
      .toBeTruthy();
    expect(tree.root.findByProps({ testID: "club-roster-player-row-member-player-3" }))
      .toBeTruthy();
    expect(() =>
      tree.root.findByProps({ testID: "club-roster-player-row-member-player-1" }),
    ).toThrow();

    act(() => {
      tree.root
        .findByProps({ testID: "club-roster-role-filter-forwards" })
        .props.onPress();
    });

    expect(tree.root.findByProps({ testID: "club-roster-player-row-member-player-2" }))
      .toBeTruthy();
    expect(() =>
      tree.root.findByProps({ testID: "club-roster-player-row-member-player-3" }),
    ).toThrow();

    act(() => {
      findPressableByTestId(
        tree.root,
        "club-roster-player-row-member-player-2",
      ).props.onPress();
    });

    expect(onOpenProfile).toHaveBeenCalledWith("profile-player-2");
  });

  it("navigates internal Organico sections and only links connected people", () => {
    const onOpenProfile = vi.fn();
    const tree = render(
      <PublicClubProfileView
        {...createProps({
          activeTab: "roster",
          members: rosterMembers,
          onOpenProfile,
        })}
      />,
    );

    for (const section of ["rosters", "staff", "directors", "operations"]) {
      expect(
        tree.root.findByProps({ testID: `club-roster-section-tab-${section}` }),
      ).toBeTruthy();
    }

    act(() => {
      tree.root
        .findByProps({ testID: "club-roster-section-tab-staff" })
        .props.onPress();
    });
    expect(hasText(tree.root, "Staff tecnico")).toBe(true);
    act(() => {
      findPressableByTestId(
        tree.root,
        "club-roster-person-row-member-coach-1",
      ).props.onPress();
    });
    expect(onOpenProfile).toHaveBeenCalledWith("profile-coach-1");

    act(() => {
      tree.root
        .findByProps({ testID: "club-roster-section-tab-directors" })
        .props.onPress();
    });
    expect(hasText(tree.root, "Direzione sportiva")).toBe(true);

    act(() => {
      tree.root
        .findByProps({ testID: "club-roster-section-tab-operations" })
        .props.onPress();
    });
    expect(hasText(tree.root, "Segreteria sportiva")).toBe(true);
    expect(
      tree.root
        .findAll(
          (node) =>
            node.props.testID === "club-roster-person-row-member-operation-1",
        )
        .some((node) => typeof node.props.onPress === "function"),
    ).toBe(false);
  });

  it("renders the Media tab filters, compact rows and owner publish entry", async () => {
    mediaMocks.fetchClubMediaFeed.mockResolvedValue(mediaPosts);
    const tree = await renderAsync(
      <PublicClubProfileView
        {...createProps({
          activeTab: "media",
          isOwner: true,
          viewerProfileId: "owner-1",
        })}
      />,
    );

    for (const filter of [
      "all",
      "highlights",
      "interview",
      "market",
      "statement",
      "training",
      "event",
    ]) {
      expect(tree.root.findByProps({ testID: `club-media-filter-${filter}` }))
        .toBeTruthy();
    }

    expect(hasText(tree.root, "Under 19")).toBe(false);
    expect(tree.root.findByProps({ testID: "club-media-publish-button" }))
      .toBeTruthy();
    expect(tree.root.findByProps({ testID: "club-media-row-media-highlights" }))
      .toBeTruthy();
    expect(tree.root.findByProps({ testID: "club-media-row-thumbnail-media-highlights" }))
      .toBeTruthy();
    expect(hasText(tree.root, "Marco Rossi e' un nuovo giocatore")).toBe(true);
  });

  it("filters Media rows by content type only", async () => {
    mediaMocks.fetchClubMediaFeed.mockResolvedValue(mediaPosts);
    const tree = await renderAsync(
      <PublicClubProfileView {...createProps({ activeTab: "media" })} />,
    );

    act(() => {
      tree.root.findByProps({ testID: "club-media-filter-market" }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: "club-media-row-media-market" }))
      .toBeTruthy();
    expect(() =>
      tree.root.findByProps({ testID: "club-media-row-media-highlights" }),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({ testID: "club-media-row-media-statement" }),
    ).toThrow();
  });

  it("hides the publish action for visitors", async () => {
    mediaMocks.fetchClubMediaFeed.mockResolvedValue(mediaPosts);
    const tree = await renderAsync(
      <PublicClubProfileView
        {...createProps({
          activeTab: "media",
          isOwner: false,
          viewerProfileId: "visitor-1",
        })}
      />,
    );

    expect(
      tree.root.findAllByProps({ testID: "club-media-publish-button" }),
    ).toHaveLength(0);
  });

  it("opens the owner create menu with all publishable media types", async () => {
    mediaMocks.fetchClubMediaFeed.mockResolvedValue(mediaPosts);
    const tree = await renderAsync(
      <PublicClubProfileView
        {...createProps({
          activeTab: "media",
          isOwner: true,
          viewerProfileId: "owner-1",
        })}
      />,
    );

    act(() => {
      tree.root.findByProps({ testID: "club-media-publish-button" }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: "club-media-create-menu" }))
      .toBeTruthy();
    for (const kind of [
      "highlights",
      "interview",
      "market",
      "statement",
      "training",
      "event",
    ]) {
      expect(tree.root.findByProps({ testID: `club-media-create-option-${kind}` }))
        .toBeTruthy();
    }
    expect(hasText(tree.root, "Carica video partita o azioni")).toBe(true);
    expect(hasText(tree.root, "Annuncia un nuovo giocatore")).toBe(true);
  });

  it("opens adaptive detail layouts for highlights, interview, market and statement", async () => {
    mediaMocks.fetchClubMediaFeed.mockResolvedValue(mediaPosts);
    mediaMocks.fetchClubMediaPostDetail.mockImplementation(async (postId: string) =>
      mediaPosts.find((post) => post.id === postId) ?? null,
    );
    const tree = await renderAsync(
      <PublicClubProfileView
        {...createProps({
          activeTab: "media",
          viewerProfileId: "visitor-1",
        })}
      />,
    );

    for (const [rowId, detailId, expectedText] of [
      ["media-highlights", "highlights", "Mi piace 4"],
      ["media-interview", "interview", "Intervistato"],
      ["media-market", "market", "Profilo giocatore taggato"],
      ["media-statement", "statement", "Calendario aggiornato.pdf"],
    ]) {
      await act(async () => {
        tree.root.findByProps({ testID: `club-media-row-${rowId}` }).props.onPress();
      });

      expect(tree.root.findByProps({ testID: `club-media-detail-${detailId}` }))
        .toBeTruthy();
      expect(hasText(tree.root, expectedText)).toBe(true);

      act(() => {
        tree.root
          .findAll(
            (node) =>
              node.props.accessibilityLabel === "Chiudi contenuto media" &&
              typeof node.props.onPress === "function",
          )[0]
          .props.onPress();
      });
    }
  });
});
