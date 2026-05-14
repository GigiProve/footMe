import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type {
  ClubHeaderStats,
  PublicClubMember,
  PublicClubProfile,
  PublicClubSquadraOverview,
} from "../club-service";
import type { ClubTeam } from "../team-service";
import { PublicClubProfileView } from "./PublicClubProfileView";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
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
});
