/**
 * Scenari QA del Master Profile Società (REV-PROF-17 §"TEST FUNZIONALI").
 *
 * Coprono ciò che distingue questa revisione dal profilo precedente: una sola
 * superficie per Owner e Visitor con azioni diverse, quattro tab, la struttura
 * sportiva nella tab Profilo e le due sole tab del profilo squadra.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { SocietyProfileTab } from "./SocietyProfileTab";
import { SocietyPositionsTab } from "./SocietyPositionsTab";
import { SocietyInfoTab } from "./SocietyInfoTab";
import { SocietyTeamProfileView } from "./SocietyTeamProfileView";
import type {
  SocietyAffiliate,
  SocietyClub,
  SocietyPosition,
  SocietyTeamDetail,
  SocietyTeamMember,
  SocietyTeamSummary,
  SocietyViewer,
} from "./society-profile-types";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

vi.mock("../../content/components/TaggedContentGrid", () => ({
  TaggedContentGrid: (props: Record<string, unknown>) =>
    React.createElement("mock-tagged-content-grid", { ...props, testID: "mock-tagged-grid" }),
}));

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => typeof node.type === "string" && node.children.length > 0)
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === "string");
}

function viewer(overrides: Partial<SocietyViewer> = {}): SocietyViewer {
  return {
    canManage: false,
    canManagePositions: false,
    canPublishMedia: false,
    isFollowing: false,
    mode: "visitor",
    profileId: "viewer-1",
    ...overrides,
  };
}

function team(overrides: Partial<SocietyTeamSummary> = {}): SocietyTeamSummary {
  return {
    category: "Primavera 4",
    city: "Predappio",
    clubId: "club-1",
    competitionName: null,
    coverUrl: null,
    id: "team-1",
    logoUrl: null,
    name: "Primavera",
    region: "Emilia-Romagna",
    season: "2026/27",
    sortOrder: 0,
    teamType: "youth",
    venueName: "Stadio Comunale",
    ...overrides,
  };
}

function affiliate(overrides: Partial<SocietyAffiliate> = {}): SocietyAffiliate {
  return {
    category: null,
    city: "Predappio",
    id: "affiliate-1",
    logoUrl: null,
    name: "Predappio Academy",
    region: "Emilia-Romagna",
    relationshipLabel: "Settore giovanile",
    ...overrides,
  };
}

function position(overrides: Partial<SocietyPosition> = {}): SocietyPosition {
  return {
    category: "Primavera 4",
    city: "Predappio",
    id: "ad-1",
    publishedAt: null,
    region: "FC",
    roleRequired: "goalkeeper",
    targetRole: "player",
    teamId: "team-1",
    teamName: "Primavera",
    teamType: "youth",
    title: "Portiere",
    ...overrides,
  };
}

function club(overrides: Partial<SocietyClub> = {}): SocietyClub {
  return {
    category: "Serie D",
    city: "Predappio",
    clubColors: "Giallo, Blu",
    clubEmail: "info@asdpredappio.it",
    clubPhone: "+39 0543 000000",
    coverUrl: null,
    description: "Una società con una lunga tradizione territoriale.",
    facebook: null,
    fieldAddress: "Via dello Sport, 1",
    foundingYear: 1945,
    headquartersAddress: null,
    id: "club-1",
    instagram: null,
    logoUrl: null,
    name: "ASD Predappio",
    ownerProfileId: "owner-1",
    province: "FC",
    region: "Emilia-Romagna",
    stadium: "Stadio Comunale",
    verificationStatus: "verified",
    websiteUrl: "asdpredappio.it",
    ...overrides,
  };
}

function member(overrides: Partial<SocietyTeamMember> = {}): SocietyTeamMember {
  return {
    avatarUrl: null,
    fullName: "Luca Bianchi",
    id: "member-1",
    isLinked: true,
    primaryPosition: null,
    profileId: "profile-1",
    roleLabel: "coach",
    ...overrides,
  };
}

function teamDetail(overrides: Partial<SocietyTeamDetail> = {}): SocietyTeamDetail {
  return {
    club: {
      id: "club-1",
      logoUrl: null,
      name: "ASD Predappio",
      ownerProfileId: "owner-1",
      verificationStatus: "verified",
    },
    squad: [member({ fullName: "Marco Rossi", id: "p1", profileId: "profile-2" })],
    staff: [member()],
    team: team(),
    viewer: viewer(),
    ...overrides,
  };
}

function profileTabProps(overrides: Record<string, unknown> = {}) {
  return {
    affiliates: [] as SocietyAffiliate[],
    onOpenAffiliate: vi.fn(),
    onOpenTeam: vi.fn(),
    onSeeAllTeams: vi.fn(),
    teams: [team()],
    viewer: viewer(),
    ...overrides,
  };
}

describe("tab Profilo — squadre del club", () => {
  it("conta le squadre e usa il plurale corretto", () => {
    const tree = render(
      <SocietyProfileTab
        {...profileTabProps({ teams: [team(), team({ id: "t2", name: "Under 18" })] })}
      />,
    );

    expect(
      tree.root.findByProps({ testID: "society-teams-count" }).props.children,
    ).toBe("2 squadre");
  });

  it("non include le affiliate nel conteggio delle squadre", () => {
    const tree = render(
      <SocietyProfileTab
        {...profileTabProps({
          affiliates: [affiliate(), affiliate({ id: "a2", name: "Altro Club" })],
          teams: [team()],
        })}
      />,
    );

    expect(
      tree.root.findByProps({ testID: "society-teams-count" }).props.children,
    ).toBe("1 squadra");
  });

  it("mostra Vedi tutte solo oltre le tre righe di anteprima", () => {
    const threeTeams = render(
      <SocietyProfileTab
        {...profileTabProps({
          teams: [team(), team({ id: "t2" }), team({ id: "t3" })],
        })}
      />,
    );

    expect(
      threeTeams.root.findAllByProps({ testID: "society-teams-see-all" }),
    ).toHaveLength(0);

    const fourTeams = render(
      <SocietyProfileTab
        {...profileTabProps({
          teams: [team(), team({ id: "t2" }), team({ id: "t3" }), team({ id: "t4" })],
        })}
      />,
    );

    expect(
      fourTeams.root.findAllByProps({ testID: "society-teams-see-all" }).length,
    ).toBeGreaterThan(0);
  });

  it("apre il profilo squadra dal tap sulla riga", () => {
    const onOpenTeam = vi.fn();
    const tree = render(
      <SocietyProfileTab {...profileTabProps({ onOpenTeam })} />,
    );

    act(() => {
      tree.root.findByProps({ testID: "society-team-row-team-1" }).props.onPress();
    });

    expect(onOpenTeam).toHaveBeenCalledWith("team-1");
  });

  it("apre la Società affiliata, non un profilo squadra", () => {
    const onOpenAffiliate = vi.fn();
    const tree = render(
      <SocietyProfileTab
        {...profileTabProps({ affiliates: [affiliate()], onOpenAffiliate })}
      />,
    );

    act(() => {
      tree.root
        .findByProps({ testID: "society-affiliate-row-affiliate-1" })
        .props.onPress();
    });

    expect(onOpenAffiliate).toHaveBeenCalledWith("affiliate-1");
  });

  it("omette del tutto la sezione affiliate quando non ce ne sono", () => {
    const tree = render(<SocietyProfileTab {...profileTabProps()} />);

    expect(
      tree.root.findAllByProps({ testID: "society-affiliates-section" }),
    ).toHaveLength(0);
  });

  it("non mostra descrizione, contatti o colori sociali", () => {
    const tree = render(<SocietyProfileTab {...profileTabProps()} />);
    const content = texts(tree).join(" ");

    expect(content).not.toContain("info@asdpredappio.it");
    expect(content).not.toContain("Colori sociali");
    expect(content).not.toContain("Descrizione");
  });
});

describe("tab Posizioni", () => {
  function positionsProps(overrides: Record<string, unknown> = {}) {
    return {
      activeFilter: "all" as const,
      onFilterChange: vi.fn(),
      onManagePositions: vi.fn(),
      onOpenPosition: vi.fn(),
      positions: [position(), position({ id: "ad-2", teamType: "senior" })],
      viewer: viewer(),
      ...overrides,
    };
  }

  it("filtra per destinazione sportiva", () => {
    const senior = render(
      <SocietyPositionsTab {...positionsProps({ activeFilter: "senior" })} />,
    );

    expect(
      senior.root.findByProps({ testID: "society-positions-count" }).props.children,
    ).toBe("1 opportunità nel club");
    expect(
      senior.root.findAllByProps({ testID: "society-position-card-ad-1" }),
    ).toHaveLength(0);
  });

  it("non mostra alcun badge Aperta", () => {
    const tree = render(<SocietyPositionsTab {...positionsProps()} />);

    expect(texts(tree).join(" ")).not.toContain("Aperta");
  });

  it("apre il dettaglio posizione già esistente", () => {
    const onOpenPosition = vi.fn();
    const tree = render(
      <SocietyPositionsTab {...positionsProps({ onOpenPosition })} />,
    );

    act(() => {
      tree.root
        .findByProps({ testID: "society-position-card-ad-1" })
        .props.onPress();
    });

    expect(onOpenPosition).toHaveBeenCalledWith("ad-1");
  });

  it("mostra Gestisci posizioni solo a chi ha il permesso", () => {
    const asVisitor = render(<SocietyPositionsTab {...positionsProps()} />);
    expect(
      asVisitor.root.findAllByProps({ testID: "society-manage-positions" }),
    ).toHaveLength(0);

    const asManager = render(
      <SocietyPositionsTab
        {...positionsProps({
          viewer: viewer({ canManage: true, canManagePositions: true, mode: "owner" }),
        })}
      />,
    );
    expect(
      asManager.root.findAllByProps({ testID: "society-manage-positions" }).length,
    ).toBeGreaterThan(0);
  });
});

describe("tab Info", () => {
  it("mostra i contatti pubblici valorizzati", () => {
    const tree = render(<SocietyInfoTab club={club()} />);

    expect(
      tree.root.findAllByProps({ testID: "society-contact-email" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ testID: "society-contact-website" }).length,
    ).toBeGreaterThan(0);
  });

  it("omette le righe dei contatti non valorizzati", () => {
    const tree = render(
      <SocietyInfoTab club={club({ clubPhone: null, websiteUrl: null })} />,
    );

    expect(
      tree.root.findAllByProps({ testID: "society-contact-phone" }),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({ testID: "society-contact-website" }),
    ).toHaveLength(0);
  });

  it("mostra i colori sociali con il nome, non solo un pallino", () => {
    const tree = render(<SocietyInfoTab club={club()} />);

    expect(texts(tree).join(" ")).toContain("Giallo · Blu");
  });

  it("mostra un empty state sobrio quando non c'è nulla da pubblicare", () => {
    const tree = render(
      <SocietyInfoTab
        club={club({
          city: "",
          clubColors: null,
          clubEmail: null,
          clubPhone: null,
          description: null,
          fieldAddress: null,
          foundingYear: null,
          headquartersAddress: null,
          name: "",
          stadium: null,
          websiteUrl: null,
        })}
      />,
    );

    expect(texts(tree).join(" ")).toContain("Informazioni non disponibili");
  });
});

describe("profilo squadra", () => {
  function teamProps(overrides: Record<string, unknown> = {}) {
    return {
      activeTab: "squad" as const,
      detail: teamDetail(),
      onFollowPress: vi.fn(),
      onMessagePress: vi.fn(),
      onMorePress: vi.fn(),
      onOpenProfile: vi.fn(),
      onOpenSquadList: vi.fn(),
      onSharePress: vi.fn(),
      onTabChange: vi.fn(),
      ...overrides,
    };
  }

  it("compone il nome con la Società", () => {
    const tree = render(<SocietyTeamProfileView {...teamProps()} />);

    expect(texts(tree).join(" ")).toContain("ASD Predappio Primavera");
  });

  it("ha esattamente due tab: Organico e Media", () => {
    const tree = render(<SocietyTeamProfileView {...teamProps()} />);
    const tabs = tree.root
      .findByProps({ testID: "society-team-tab-bar" })
      .props.items as { label: string }[];

    expect(tabs.map((tab) => tab.label)).toEqual(["Organico", "Media"]);
  });

  it("tiene l'allenatore dentro lo Staff tecnico dell'Organico", () => {
    const tree = render(<SocietyTeamProfileView {...teamProps()} />);
    const content = texts(tree).join(" ");

    expect(content).toContain("Staff tecnico");
    expect(content).toContain("Luca Bianchi");
    expect(content).toContain("Allenatore");
  });

  it("non mostra la griglia Media dentro l'Organico", () => {
    const tree = render(<SocietyTeamProfileView {...teamProps()} />);

    expect(tree.root.findAllByProps({ testID: "mock-tagged-grid" })).toHaveLength(0);
  });

  it("non mostra l'Organico dentro la tab Media", () => {
    const tree = render(
      <SocietyTeamProfileView {...teamProps({ activeTab: "media" })} />,
    );

    expect(texts(tree).join(" ")).not.toContain("Staff tecnico");
    expect(tree.root.findAllByProps({ testID: "mock-tagged-grid" }).length).toBe(1);
  });

  it("non espone un record manuale come profilo tappabile", () => {
    const tree = render(
      <SocietyTeamProfileView
        {...teamProps({
          detail: teamDetail({
            staff: [
              member({ id: "manual-1", isLinked: false, profileId: null }),
            ],
          }),
        })}
      />,
    );

    expect(
      tree.root.findByProps({ testID: "society-team-staff-manual-1" }).props
        .accessibilityRole,
    ).toBeUndefined();
  });

  it("all'owner non propone Segui o Messaggio verso sé stesso", () => {
    const tree = render(
      <SocietyTeamProfileView
        {...teamProps({
          detail: teamDetail({ viewer: viewer({ canManage: true, mode: "owner" }) }),
        })}
      />,
    );

    expect(tree.root.findAllByProps({ testID: "society-team-follow" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "society-team-message" })).toHaveLength(0);
  });

  it("mostra la rosa vuota senza riempirla con contenuti del club", () => {
    const tree = render(
      <SocietyTeamProfileView
        {...teamProps({ detail: teamDetail({ squad: [] }) })}
      />,
    );

    expect(texts(tree).join(" ")).toContain("Rosa non ancora disponibile");
  });
});
