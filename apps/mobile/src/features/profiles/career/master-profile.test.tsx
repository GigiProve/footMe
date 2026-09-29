/**
 * Scenari QA del Master Profile Calciatore (REV-PROF-01 §43).
 *
 * Coprono ciò che distingue questa revisione dal profilo precedente: la stessa
 * architettura per Owner e Visitor con azioni diverse, la carriera per
 * esperienza, i filtri media e le macroaree dei Dettagli.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { PlayerExperienceForm } from "../player-sports";
import type { CompleteProfessionalProfile } from "../profile-service";
import { CareerTabContent } from "./CareerTabContent";
import { MediaTabContent } from "./MediaTabContent";
import { buildPlayerCareerView } from "./player-career-model";
import { PlayerDetailsTab } from "./PlayerDetailsTab";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

vi.mock("../../../components/ui/video-player-modal", () => ({
  VideoPlayerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-video-player-modal", props),
}));

const NOW = new Date("2025-03-01T00:00:00.000Z");

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

function season(
  overrides: Partial<PlayerExperienceForm> &
    Pick<PlayerExperienceForm, "seasonLabel">,
): PlayerExperienceForm {
  return {
    appearances: "31",
    assists: "8",
    awards: "",
    category: "Serie A",
    clubId: "club-1",
    clubName: "ASD Romano Prodi",
    goals: "9",
    minutesPlayed: "",
    periodEndMonth: "",
    periodStartMonth: "",
    seasonPeriod: "full",
    teamCity: "",
    teamLogoUrl: "",
    ...overrides,
  };
}

const CAREER_VIEW = buildPlayerCareerView(
  [
    season({ groupId: "exp-a", seasonLabel: "2024/2025" }),
    season({ groupId: "exp-a", seasonLabel: "2023/2024" }),
    season({
      clubId: "club-2",
      clubName: "FC Trastevere",
      groupId: "exp-b",
      seasonLabel: "2021/2022",
    }),
  ],
  { now: NOW },
);

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    playerPalmares: [],
    playerProfile: {
      availability_type: "REGIONS",
      contract_expiry: null,
      contract_status: "tesserato",
      current_condition: null,
      height_cm: 192,
      highlight_video_url: null,
      media_items: [],
      media_urls: [],
      open_to_trials: true,
      player_objectives: [],
      preferred_categories: ["Serie C", "Primavera"],
      preferred_foot: "both",
      primary_position: "striker",
      profile_id: "profile-1",
      secondary_positions: ["right_winger"],
      show_regions_badge: false,
      show_transfer_badge: false,
      transfer_provinces: [],
      transfer_regions: ["lazio", "sicilia"],
      weight_kg: 92,
      willing_to_change_club: true,
    },
    profile: { is_open_to_transfer: true },
    userContacts: {
      email: "salvo@example.com",
      facebook: "",
      instagram: "salvosalvini_9",
      phone: "+39 345 678 9012",
      showEmail: true,
      showFacebook: false,
      showInstagram: true,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

describe("Master Profile Calciatore — Carriera", () => {
  it("mostra un solo header per esperienza e tutte le stagioni, senza accordion", () => {
    const tree = render(<CareerTabContent isOwner={false} view={CAREER_VIEW} />);

    expect(tree.root.findAllByProps({ testID: "career-experience-exp-a" }).length)
      .toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "career-experience-exp-b" }).length)
      .toBeGreaterThan(0);
    // Le tre stagioni sono tutte renderizzate: nessuna è dietro a un toggle.
    for (const key of ["2024/2025", "2023/2024", "2021/2022"]) {
      expect(tree.root.findAllByProps({ testID: `career-season-${key}` }).length)
        .toBeGreaterThan(0);
    }
    expect(() =>
      tree.root.findByProps({ children: "Mostra tutte le stagioni" }),
    ).toThrow();
  });

  it("non mostra controlli di modifica inline nemmeno all'Owner (§32)", () => {
    const tree = render(<CareerTabContent isOwner view={CAREER_VIEW} />);

    for (const label of [
      "Aggiungi esperienza",
      "Modifica esperienza",
      "Elimina esperienza",
    ]) {
      expect(() => tree.root.findByProps({ accessibilityLabel: label })).toThrow();
    }
  });

  it("mostra i Totali carriera aggregati dopo l'ultima esperienza", () => {
    const tree = render(<CareerTabContent isOwner={false} view={CAREER_VIEW} />);

    expect(tree.root.findAllByProps({ testID: "career-totals" }).length)
      .toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ accessibilityLabel: "93 Presenze" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ accessibilityLabel: "27 Gol" }).length,
    ).toBeGreaterThan(0);
  });

  it("usa il grafico a barre e non più il line chart", () => {
    const tree = render(<CareerTabContent isOwner={false} view={CAREER_VIEW} />);

    expect(tree.root.findAllByProps({ testID: "career-performance-chart" }).length)
      .toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ children: "Andamento carriera" }).length)
      .toBeGreaterThan(0);
    // Il selettore della metrica parte da Gol (§21).
    expect(
      tree.root.findByProps({ testID: "career-metric-goals" }).props
        .accessibilityState.checked,
    ).toBe(true);
  });

  it("mostra un empty state diverso per Owner e Visitor", () => {
    const emptyView = buildPlayerCareerView([], { now: NOW });
    const ownerTree = render(<CareerTabContent isOwner view={emptyView} />);
    const visitorTree = render(
      <CareerTabContent isOwner={false} view={emptyView} />,
    );

    expect(
      ownerTree.root.findAllByProps({
        children: "Aggiungi il tuo percorso sportivo da Modifica profilo.",
      }).length,
    ).toBeGreaterThan(0);
    expect(
      visitorTree.root.findAllByProps({
        children:
          "Questo profilo non ha ancora inserito il proprio percorso sportivo.",
      }).length,
    ).toBeGreaterThan(0);
  });
});

describe("Master Profile Calciatore — Media", () => {
  const items = [
    {
      commentCount: 0,
      comments: [],
      description: "",
      id: "photo-1",
      isFeatured: false,
      isLiked: false,
      isSaved: false,
      likeCount: 0,
      thumbnailUrl: "https://example.com/photo.jpg",
      type: "image" as const,
    },
    {
      commentCount: 0,
      comments: [],
      description: "",
      durationSeconds: 24,
      id: "video-1",
      isFeatured: false,
      isLiked: false,
      isSaved: false,
      likeCount: 0,
      thumbnailUrl: "https://example.com/video.jpg",
      type: "video" as const,
      videoUrl: "https://example.com/video.mp4",
    },
  ];

  it("filtra davvero i contenuti mostrati", () => {
    const tree = render(
      <MediaTabContent
        authorName="Salvo Salvini"
        filtersEnabled
        initialItems={items}
        mode="visitor"
      />,
    );

    expect(
      tree.root.findAllByProps({ testID: "media-grid-item-photo-1" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ testID: "media-grid-item-video-1" }).length,
    ).toBeGreaterThan(0);

    act(() => {
      tree.root.findByProps({ testID: "media-filter-video" }).props.onPress();
    });

    expect(tree.root.findAllByProps({ testID: "media-grid-item-photo-1" }).length).toBe(0);
    expect(
      tree.root.findAllByProps({ testID: "media-grid-item-video-1" }).length,
    ).toBeGreaterThan(0);

    act(() => {
      tree.root.findByProps({ testID: "media-filter-photo" }).props.onPress();
    });

    expect(
      tree.root.findAllByProps({ testID: "media-grid-item-photo-1" }).length,
    ).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "media-grid-item-video-1" }).length).toBe(0);
  });

  it("annuncia il video con la sua durata e la mostra sulla cella", () => {
    const tree = render(
      <MediaTabContent
        authorName="Salvo Salvini"
        filtersEnabled
        initialItems={items}
        mode="visitor"
      />,
    );

    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Video, durata 0:24" }).length,
    ).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ children: "0:24" }).length).toBeGreaterThan(0);
  });

  it("mostra l'azione di aggiunta solo all'Owner", () => {
    const ownerTree = render(
      <MediaTabContent
        authorName="Salvo Salvini"
        filtersEnabled
        initialItems={items}
        mode="owner"
      />,
    );
    const visitorTree = render(
      <MediaTabContent
        authorName="Salvo Salvini"
        filtersEnabled
        initialItems={items}
        mode="visitor"
      />,
    );

    expect(ownerTree.root.findAllByProps({ testID: "media-add" }).length)
      .toBeGreaterThan(0);
    expect(visitorTree.root.findAllByProps({ testID: "media-add" }).length).toBe(0);
  });

  it("usa le copy dell'empty state richieste dalla task", () => {
    const ownerTree = render(
      <MediaTabContent
        authorName="Salvo Salvini"
        emptyDescription="Condividi foto e video del tuo percorso sportivo."
        emptyTitle="Nessun contenuto ancora"
        filtersEnabled
        mode="owner"
      />,
    );
    const visitorTree = render(
      <MediaTabContent
        authorName="Salvo Salvini"
        emptyDescription="Questo profilo non ha ancora pubblicato contenuti."
        emptyTitle="Nessun contenuto ancora"
        filtersEnabled
        mode="visitor"
      />,
    );

    expect(
      ownerTree.root.findAllByProps({ children: "Nessun contenuto ancora" }).length,
    ).toBeGreaterThan(0);
    expect(
      ownerTree.root.findAllByProps({
        children: "Condividi foto e video del tuo percorso sportivo.",
      }).length,
    ).toBeGreaterThan(0);
    // Il Visitor non riceve nessuna CTA (§24).
    expect(
      visitorTree.root.findAllByProps({ accessibilityLabel: "Aggiungi contenuto" })
        .length,
    ).toBe(0);
  });
});

describe("Master Profile Calciatore — Dettagli", () => {
  it("usa la label 'Categorie d'interesse' e le zone configurate", () => {
    const tree = render(
      <PlayerDetailsTab
        careerView={CAREER_VIEW}
        completeProfile={buildProfile()}
      />,
    );

    expect(
      tree.root.findAllByProps({ children: "Categorie d'interesse" }).length,
    ).toBeGreaterThan(0);
    expect(() => tree.root.findByProps({ children: "Categorie" })).toThrow();
    expect(
      tree.root.findAllByProps({ children: "Serie C, Primavera" }).length,
    ).toBeGreaterThan(0);
  });

  it("con disponibilità su tutta Italia mostra solo 'Ovunque in Italia'", () => {
    const profile = buildProfile();
    const tree = render(
      <PlayerDetailsTab
        careerView={CAREER_VIEW}
        completeProfile={buildProfile({
          playerProfile: {
            ...profile.playerProfile!,
            availability_type: "ITALY",
          },
        } as Partial<CompleteProfessionalProfile>)}
      />,
    );

    expect(
      tree.root.findAllByProps({ children: "Ovunque in Italia" }).length,
    ).toBeGreaterThan(0);
    expect(() => tree.root.findByProps({ children: "Lazio, Sicilia" })).toThrow();
  });

  it("mostra il campo con ruolo principale e secondario, senza duplicare altezza e peso", () => {
    const tree = render(
      <PlayerDetailsTab
        careerView={CAREER_VIEW}
        completeProfile={buildProfile()}
      />,
    );

    expect(
      tree.root.findAllByProps({ testID: "player-technical-pitch" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Ruolo principale, Attaccante" })
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Ruolo secondario, Ala destra" })
        .length,
    ).toBeGreaterThan(0);
    // Piede normalizzato con l'onboarding: "Ambidestro", mai "Entrambi" (§9).
    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Piede, Ambidestro" }).length,
    ).toBeGreaterThan(0);
    expect(() => tree.root.findByProps({ children: "Altezza" })).toThrow();
    expect(() => tree.root.findByProps({ children: "Peso" })).toThrow();
  });

  it("nasconde il ruolo secondario quando non è valorizzato", () => {
    const profile = buildProfile();
    const tree = render(
      <PlayerDetailsTab
        careerView={CAREER_VIEW}
        completeProfile={buildProfile({
          playerProfile: {
            ...profile.playerProfile!,
            secondary_positions: [],
          },
        } as Partial<CompleteProfessionalProfile>)}
      />,
    );

    expect(() => tree.root.findByProps({ children: "Ruolo secondario" })).toThrow();
  });

  it("mostra solo i contatti pubblici e mai il telefono privato", () => {
    const tree = render(
      <PlayerDetailsTab
        careerView={CAREER_VIEW}
        completeProfile={buildProfile()}
      />,
    );

    expect(
      tree.root.findAllByProps({ children: "salvo@example.com" }).length,
    ).toBeGreaterThan(0);
    // Instagram è pubblico, Facebook no, il telefono non è mai pubblicabile.
    expect(() => tree.root.findByProps({ children: "+39 345 678 9012" })).toThrow();
    expect(() => tree.root.findByProps({ label: "Facebook" })).toThrow();
  });

  it("spiega all'Owner perché i suoi contatti non compaiono, senza mostrarli", () => {
    const privateContacts = buildProfile({
      userContacts: {
        email: "salvo@example.com",
        facebook: "",
        instagram: "salvosalvini_9",
        phone: "+39 345 678 9012",
        showEmail: false,
        showFacebook: false,
        showInstagram: false,
      },
    } as Partial<CompleteProfessionalProfile>);

    const ownerTree = render(
      <PlayerDetailsTab
        careerView={CAREER_VIEW}
        completeProfile={privateContacts}
        isOwner
      />,
    );
    const visitorTree = render(
      <PlayerDetailsTab careerView={CAREER_VIEW} completeProfile={privateContacts} />,
    );

    expect(ownerTree.root.findAllByProps({ testID: "details-contacts" }).length)
      .toBeGreaterThan(0);
    // Il valore resta privato anche per l'Owner: compare solo il rimando.
    expect(() =>
      ownerTree.root.findByProps({ children: "salvo@example.com" }),
    ).toThrow();
    // Al Visitor non arriva nemmeno la sezione.
    expect(visitorTree.root.findAllByProps({ testID: "details-contacts" }).length)
      .toBe(0);
  });

  it("nasconde Palmarès e Situazione attuale quando non ci sono dati", () => {
    const profile = buildProfile();
    const tree = render(
      <PlayerDetailsTab
        careerView={buildPlayerCareerView([], { now: NOW })}
        completeProfile={buildProfile({
          playerProfile: {
            ...profile.playerProfile!,
            contract_status: null,
          },
        } as Partial<CompleteProfessionalProfile>)}
      />,
    );

    expect(tree.root.findAllByProps({ testID: "details-palmares" }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: "details-situation" }).length).toBe(0);
  });

  it("mostra la situazione attuale dall'esperienza in corso, non dall'ultima riga", () => {
    const tree = render(
      <PlayerDetailsTab
        careerView={CAREER_VIEW}
        completeProfile={buildProfile()}
      />,
    );

    expect(tree.root.findAllByProps({ testID: "details-situation" }).length)
      .toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "ASD Romano Prodi, Serie A, Sotto contratto",
      }).length,
    ).toBeGreaterThan(0);
  });
});
