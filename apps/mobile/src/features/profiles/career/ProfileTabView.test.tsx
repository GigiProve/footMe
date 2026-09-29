/**
 * REV-PROF-01 §5, §6: Owner e Visitor condividono la stessa architettura a tre
 * tab, con Carriera come tab iniziale. Le differenze stanno nelle azioni, non
 * nella struttura.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { ProfileTabView } from "./ProfileTabView";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

vi.mock("../../../components/ui/video-player-modal", () => ({
  VideoPlayerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-video-player-modal", props),
}));

vi.mock("../../content/use-tagged-content", () => ({
  useTaggedMediaItems: () => ({ onOpenTaggedItem: () => undefined, taggedItems: [] }),
}));

const COMPLETE_PROFILE = {
  playerCareerEntries: [
    {
      appearances: 31,
      assists: 8,
      awards: null,
      career_type: "MULTI_SEASON",
      club_id: "club-1",
      club_name: "ASD Romano Prodi",
      competition_name: "Serie A",
      experience_group_id: "exp-a",
      goals: 9,
      id: "entry-1",
      minutes_played: null,
      period_end_month: null,
      period_start_month: null,
      player_profile_id: "profile-1",
      season_label: "2024/2025",
      season_period: "full",
      sort_order: 0,
      team_logo_url: null,
    },
  ],
  playerPalmares: [],
  playerProfile: {
    availability_type: "ITALY",
    contract_status: "tesserato",
    media_items: [],
    open_to_trials: false,
    preferred_categories: [],
    preferred_foot: "right",
    primary_position: "striker",
    secondary_positions: [],
    transfer_provinces: [],
    transfer_regions: [],
  },
  profile: {
    avatar_url: null,
    full_name: "Salvo Salvini",
    id: "profile-1",
    is_open_to_transfer: false,
  },
  userContacts: {
    email: "",
    facebook: "",
    instagram: "",
    phone: "",
    showEmail: false,
    showFacebook: false,
    showInstagram: false,
  },
} as unknown as CompleteProfessionalProfile;

function render(isOwner: boolean) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(
      <ProfileTabView
        completeProfile={COMPLETE_PROFILE}
        isOwner={isOwner}
        onManageMedia={() => undefined}
      />,
    );
  });

  return tree;
}

describe("ProfileTabView", () => {
  it("espone le tre tab Carriera, Media e Dettagli a entrambi i viewer", () => {
    for (const isOwner of [true, false]) {
      const tree = render(isOwner);

      for (const label of ["Carriera", "Media", "Dettagli"]) {
        expect(tree.root.findAllByProps({ children: label }).length).toBeGreaterThan(0);
      }
      // "Info" era il nome della vecchia terza tab.
      expect(() => tree.root.findByProps({ children: "Info" })).toThrow();
    }
  });

  // §10 / Screen Master: le tab coprono tutta la larghezza della testata.
  it("distribuisce le tab su tutta la larghezza", () => {
    const tree = render(false);
    const tabs = tree.root.findAllByProps({ accessibilityRole: "tab" });

    expect(tabs.length).toBeGreaterThan(0);
    for (const tab of tabs) {
      expect(JSON.stringify(tab.props.style)).toContain('"flex":1');
    }
  });

  it("apre sul Percorso professionale", () => {
    const tree = render(false);

    expect(
      tree.root.findAllByProps({ children: "Percorso professionale" }).length,
    ).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "career-tab" }).length).toBeGreaterThan(0);
  });

  it("passa alla tab Dettagli mantenendo la stessa architettura", () => {
    const tree = render(false);

    act(() => {
      tree.root
        .findByProps({ accessibilityLabel: "Dettagli", accessibilityRole: "tab" })
        .props.onPress();
    });

    expect(
      tree.root.findAllByProps({ testID: "player-details-tab" }).length,
    ).toBeGreaterThan(0);
  });
});
