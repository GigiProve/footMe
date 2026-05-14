import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { ClubHeaderStats, PublicClubProfile } from "../club-service";
import type { ClubTeam } from "../team-service";
import { PublicClubHeader } from "./PublicClubHeader";

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

const baseClub: PublicClubProfile = {
  category: "Serie D",
  city: "Como",
  club_colors: null,
  club_email: "info@accomo.test",
  club_phone: "+39031123456",
  country: "IT",
  description: null,
  field_address: null,
  founding_year: 1907,
  headquarters_address: null,
  id: "club-1",
  league: "Lega Nazionale Dilettanti",
  logo_url: "https://example.com/logo.png",
  name: "AC Como",
  owner_full_name: null,
  region: "Lombardia",
  stadium: "Stadio Giuseppe Sinigaglia",
  verification_status: "verified",
  website_url: "https://accomo.test",
};

const baseStats: ClubHeaderStats = {
  activeTeamsCount: 5,
  playersCount: 142,
  staffCount: 28,
};

const baseTeams: ClubTeam[] = [
  {
    category: "Eccellenza",
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
];

describe("PublicClubHeader", () => {
  it("renders the club identity, metadata, compact stats, actions, and active default tab", () => {
    const tree = render(
      <PublicClubHeader
        club={baseClub}
        isFollowed={false}
        isFollowing={false}
        onContactPress={vi.fn()}
        onToggleFollow={vi.fn()}
        stats={baseStats}
        teams={baseTeams}
      />,
    );
    const root = tree.root;

    expect(root.findByProps({ children: "AC Como" })).toBeTruthy();
    expect(root.findByProps({ children: "Serie D" })).toBeTruthy();
    expect(root.findByProps({ children: "Como" })).toBeTruthy();
    expect(
      root.findByProps({ children: "Stadio Giuseppe Sinigaglia" }),
    ).toBeTruthy();
    expect(root.findByProps({ children: "Fondato nel 1907" })).toBeTruthy();
    expect(root.findByProps({ children: "Squadre attive" })).toBeTruthy();
    expect(root.findByProps({ children: "Giocatori" })).toBeTruthy();
    expect(root.findByProps({ children: "Membri staff" })).toBeTruthy();
    expect(root.findByProps({ children: "Segui" })).toBeTruthy();
    expect(root.findByProps({ children: "Contatta" })).toBeTruthy();
    expect(root.findByProps({ testID: "club-tab-team" }).props.accessibilityState)
      .toEqual({ selected: true });
  });

  it("uses lightweight fallbacks when logo, category, stadium, and founding year are missing", () => {
    const tree = render(
      <PublicClubHeader
        club={{
          ...baseClub,
          category: null,
          field_address: null,
          founding_year: null,
          league: null,
          logo_url: null,
          name: "Società Sportiva",
          stadium: null,
          verification_status: "unverified",
        }}
        isFollowed
        isFollowing={false}
        onContactPress={vi.fn()}
        onToggleFollow={vi.fn()}
        stats={{
          activeTeamsCount: 0,
          playersCount: 0,
          staffCount: 0,
        }}
        teams={[]}
      />,
    );
    const root = tree.root;

    expect(root.findByProps({ testID: "club-logo-fallback" })).toBeTruthy();
    expect(root.findByProps({ children: "SS" })).toBeTruthy();
    expect(root.findByProps({ children: "Categoria non indicata" })).toBeTruthy();
    expect(root.findByProps({ testID: "club-stat-active-teams-value" }).props.children)
      .toBe("0");
    expect(root.findByProps({ testID: "club-stat-players-value" }).props.children)
      .toBe("0");
    expect(root.findByProps({ testID: "club-stat-staff-value" }).props.children)
      .toBe("0");
    expect(root.findByProps({ children: "Seguito" })).toBeTruthy();
    expect(root.findAllByType("Image" as never)).toHaveLength(0);
  });

  it("falls back to the senior team category when the club category is empty", () => {
    const tree = render(
      <PublicClubHeader
        club={{ ...baseClub, category: null, league: "Serie C" }}
        isFollowed={false}
        isFollowing={false}
        onContactPress={vi.fn()}
        onToggleFollow={vi.fn()}
        stats={baseStats}
        teams={baseTeams}
      />,
    );

    expect(tree.root.findByProps({ children: "Eccellenza" })).toBeTruthy();
  });
});
