/**
 * Scenari QA del Master Profile Tifoso (REV-PROF-19).
 *
 * Coprono ciò che distingue questa revisione dal profilo Tifoso precedente:
 * tre tab al posto di Bacheca/Tribuna, la separazione fra contributi e Media,
 * le azioni di Owner e Visitor, il bottom sheet "Crea" a quattro voci e
 * l'assenza di "Appassionato", dei blocchi Salvati/Seguiti e del campo
 * commento dentro le card.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FanTribunaPost } from "./fan-tribuna-service";
import type { CompleteProfessionalProfile } from "./profile-service";

const mocks = vi.hoisted(() => ({
  fetchFanMediaPage: vi.fn(),
  fetchFanTribunaFeed: vi.fn(),
  fetchPublicFanProfile: vi.fn(),
}));

vi.mock("@expo/vector-icons/Ionicons", () => {
  const MockIonicons = Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    { glyphMap: {} },
  );

  return { default: MockIonicons };
});

vi.mock("../../components/ui/video-preview", () => ({
  VideoPreview: (props: Record<string, unknown>) =>
    React.createElement("mock-video", props),
}));

vi.mock("../../components/ui/video-player-modal", () => ({
  VideoPlayerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-video-player-modal", props),
}));

vi.mock("./fan/fan-composers", () => ({
  FanCreateTribunaModal: (props: Record<string, unknown>) =>
    React.createElement("mock-fan-composer", props),
  FanFavoriteTeamModal: (props: Record<string, unknown>) =>
    React.createElement("mock-fan-favorite-team", props),
}));

vi.mock("./fan/fan-public-profile-service", () => ({
  fetchPublicFanProfile: mocks.fetchPublicFanProfile,
}));

vi.mock("./fan/fan-media-tab-service", () => ({
  FAN_MEDIA_INITIAL_CURSOR: { legacyOffset: 0, tribunaOffset: 0 },
  fetchFanMediaPage: mocks.fetchFanMediaPage,
}));

vi.mock("./fan-tribuna-service", () => ({
  FAN_TRIBUNA_PAGE_SIZE: 30,
  fetchFanTribunaFeed: mocks.fetchFanTribunaFeed,
}));

import { FanProfileView } from "./FanProfileView";

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

function collectText(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(collectText).join(" ");
  }

  if (children && typeof children === "object") {
    // I nodi di `toJSON()` portano `children` in cima, gli elementi React
    // dentro `props`: l'albero renderizzato contiene entrambe le forme.
    if ("children" in children) {
      return collectText((children as { children: unknown }).children);
    }

    if (
      "props" in children &&
      children.props &&
      typeof children.props === "object" &&
      "children" in children.props
    ) {
      return collectText((children.props as { children: unknown }).children);
    }
  }

  return "";
}

/** Tutto il testo e tutte le label accessibili dell'albero renderizzato. */
function renderedText(tree: TestRenderer.ReactTestRenderer): string {
  const labels = tree.root
    .findAll(() => true)
    .map((node) =>
      typeof node.props?.accessibilityLabel === "string"
        ? node.props.accessibilityLabel
        : "",
    )
    .join(" ");

  return `${collectText(tree.toJSON())} ${labels}`;
}

function findByTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll((node) => node.props?.testID === testID);
}

function pressTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const node = tree.root.findAll(
    (entry) =>
      entry.props?.testID === testID &&
      typeof entry.props?.onPress === "function",
  )[0];

  if (!node) {
    throw new Error(`Nessun elemento premibile con testID ${testID}`);
  }

  act(() => {
    node.props.onPress();
  });
}

function tribunaPost(overrides: Partial<FanTribunaPost> = {}): FanTribunaPost {
  return {
    body: "Serve più spazio ai giovani.",
    comment_count: 18,
    comments: [],
    created_at: "2026-05-15T08:00:00Z",
    formation: null,
    id: "opinion-1",
    is_saved: false,
    is_supported: false,
    kind: "opinion",
    lineup_players: [],
    media_type: null,
    media_url: null,
    poll_options: [],
    profile_id: "fan-1",
    published_at: "2026-05-15T08:00:00Z",
    reference_category: null,
    reference_club_id: null,
    reference_team_name: null,
    saved_count: 0,
    status: "published",
    support_count: 76,
    tagged_players: [],
    tagged_targets: [],
    thumbnail_url: null,
    title: "Serve più spazio ai giovani",
    total_vote_count: 0,
    updated_at: "2026-05-15T08:00:00Z",
    ...overrides,
  };
}

const publicFanProfile = {
  favoriteClub: {
    id: "club-1",
    logoUrl: null,
    name: "ASD Casteltermini",
    subtitle: "Promozione · Sicilia",
  },
  followedCategories: ["Serie B", "Juniores"],
  footballTypes: ["amateur", "youth"],
  legacyFavoriteTeamName: null,
};

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
    fanProfile: null,
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: null,
      avatar_url: null,
      bio: null,
      birth_date: null,
      city: "Casteltermini",
      current_location_city: null,
      current_location_country: null,
      domicile: null,
      full_name: "Filippo Filippi",
      gender: null,
      id: "fan-1",
      is_open_to_transfer: false,
      legal_status: null,
      languages: [],
      nationality: null,
      region: "Sicilia",
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
  } as unknown as CompleteProfessionalProfile;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchPublicFanProfile.mockResolvedValue(publicFanProfile);
  mocks.fetchFanTribunaFeed.mockResolvedValue([tribunaPost()]);
  mocks.fetchFanMediaPage.mockResolvedValue({
    cursor: { legacyOffset: 0, tribunaOffset: 0 },
    hasMore: false,
    items: [],
  });
});

describe("struttura", () => {
  it("mostra esattamente tre tab, nell'ordine Tribuna, Media, Info", async () => {
    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="owner" />,
    );

    const tabs = tree.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props?.accessibilityRole === "tab",
    );

    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      "Tribuna",
      "Media",
      "Info",
    ]);
  });

  it("apre la Tribuna come tab iniziale", async () => {
    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="visitor" />,
    );

    expect(findByTestId(tree, "fan-tribuna-tab").length).toBeGreaterThan(0);
  });

  it("rispetta il deep link a una tab specifica", async () => {
    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        initialTab="info"
        mode="visitor"
      />,
    );

    expect(findByTestId(tree, "fan-info-tab").length).toBeGreaterThan(0);
  });

  it("non mostra più Bacheca, Salvati o Seguiti nello scroll del profilo", async () => {
    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="owner" />,
    );
    const text = renderedText(tree);

    expect(text).not.toContain("Bacheca");
    expect(text).not.toContain("Salvati");
    expect(text).not.toContain("Seguiti");
  });

  it("non usa mai la parola Appassionato", async () => {
    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="visitor" />,
    );

    expect(renderedText(tree)).not.toMatch(/appassionat/i);
  });

  it("mostra la label Tifoso e la squadra del cuore nell'header", async () => {
    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="visitor" />,
    );
    const text = renderedText(tree);

    expect(text).toContain("Tifoso");
    expect(text).toContain("ASD Casteltermini");
  });
});

describe("Tribuna", () => {
  it("interroga solo opinioni, sondaggi e formazioni", async () => {
    await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="owner" />,
    );

    expect(mocks.fetchFanTribunaFeed).toHaveBeenCalledWith(
      "fan-1",
      undefined,
      expect.objectContaining({
        kinds: ["opinion", "poll", "formation", "proposal"],
      }),
    );
  });

  it("non mette nessun campo commento dentro le card del profilo", async () => {
    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="visitor" />,
    );
    const text = renderedText(tree);

    expect(text).not.toContain("Scrivi un commento");
    expect(text).not.toContain("Invia");
  });

  it("apre il dettaglio condiviso al tap sulla card", async () => {
    const onOpenContent = vi.fn();
    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="visitor"
        onOpenContent={onOpenContent}
      />,
    );

    pressTestId(tree, "fan-tribuna-card-opinion");

    expect(onOpenContent).toHaveBeenCalledWith({
      contentType: "fan_tribuna",
      postId: "opinion-1",
    });
  });

  it("mostra l'empty state dell'Owner con la CTA Crea", async () => {
    mocks.fetchFanTribunaFeed.mockResolvedValue([]);

    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="owner" />,
    );
    const text = renderedText(tree);

    expect(text).toContain("La tua Tribuna è vuota");
    expect(text).toContain("Crea");
  });

  it("mostra al Visitor l'empty state senza CTA Crea", async () => {
    mocks.fetchFanTribunaFeed.mockResolvedValue([]);

    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="visitor" />,
    );

    expect(renderedText(tree)).toContain("Nessun contenuto nella Tribuna");
    expect(findByTestId(tree, "fan-create-button")).toHaveLength(0);
  });

  it("mostra un errore locale con Riprova, non un empty state", async () => {
    mocks.fetchFanTribunaFeed.mockRejectedValue(new Error("offline"));

    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="visitor" />,
    );
    const text = renderedText(tree);

    expect(text).toContain("Non è stato possibile caricare la Tribuna.");
    expect(text).toContain("Riprova");
    expect(text).not.toContain("Nessun contenuto nella Tribuna");
  });
});

describe("Owner e Visitor", () => {
  it("dà all'Owner Modifica profilo e la CTA Crea, mai Segui o Messaggio", async () => {
    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="owner"
        onContactPress={vi.fn()}
        onEditProfilePress={vi.fn()}
        onFollowPress={vi.fn()}
      />,
    );
    const text = renderedText(tree);

    expect(text).toContain("Modifica profilo");
    expect(findByTestId(tree, "fan-create-button").length).toBeGreaterThan(0);
    expect(text).not.toContain("Segui");
    expect(text).not.toContain("Messaggio");
  });

  it("dà al Visitor Segui e Messaggio, mai Modifica profilo o Crea", async () => {
    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        mode="visitor"
        onContactPress={vi.fn()}
        onEditProfilePress={vi.fn()}
        onFollowPress={vi.fn()}
        viewerProfileId="viewer-1"
      />,
    );
    const text = renderedText(tree);

    expect(text).toContain("Segui");
    expect(text).toContain("Messaggio");
    expect(text).not.toContain("Modifica profilo");
    expect(findByTestId(tree, "fan-create-button")).toHaveLength(0);
  });
});

describe("bottom sheet Crea", () => {
  it("mostra esattamente le quattro destinazioni previste", async () => {
    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="owner" />,
    );

    pressTestId(tree, "fan-create-button");

    const options = tree.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        typeof node.props?.testID === "string" &&
        node.props.testID.startsWith("fan-create-option-"),
    );

    expect(options.map((option) => option.props.accessibilityLabel)).toEqual([
      "Scrivi un'opinione",
      "Crea un sondaggio",
      "Crea una formazione",
      "Pubblica foto o video",
    ]);
  });

  it("apre il composer esistente del tipo scelto", async () => {
    const tree = await renderAsync(
      <FanProfileView completeProfile={buildFanProfile()} mode="owner" />,
    );

    pressTestId(tree, "fan-create-button");
    pressTestId(tree, "fan-create-option-poll");

    const composer = tree.root.findAllByType("mock-fan-composer" as never)[0];

    expect(composer.props.kind).toBe("poll");
    expect(composer.props.visible).toBe(true);
  });
});

describe("Info", () => {
  it("mostra squadra del cuore, interessi e categorie, senza aree geografiche", async () => {
    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        initialTab="info"
        mode="visitor"
      />,
    );
    const text = renderedText(tree);

    expect(text).toContain("Squadra del cuore");
    expect(text).toContain("Interessi calcistici");
    expect(text).toContain("Categorie seguite");
    expect(text).toContain("Calcio dilettantistico");
    expect(text).toContain("Serie B");
    expect(text).not.toContain("Sicilia · ");
    expect(text).not.toContain("Tutta Italia");
  });

  it("al Visitor omette la squadra del cuore assente, senza Da completare", async () => {
    mocks.fetchPublicFanProfile.mockResolvedValue({
      ...publicFanProfile,
      favoriteClub: null,
    });

    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        initialTab="info"
        mode="visitor"
      />,
    );
    const text = renderedText(tree);

    expect(text).not.toContain("Da completare");
    expect(findByTestId(tree, "fan-favorite-club-owner-hint")).toHaveLength(0);
  });

  it("all'Owner mostra un richiamo quando la squadra del cuore manca", async () => {
    mocks.fetchPublicFanProfile.mockResolvedValue({
      ...publicFanProfile,
      favoriteClub: null,
    });

    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        initialTab="info"
        mode="owner"
      />,
    );

    expect(
      findByTestId(tree, "fan-favorite-club-owner-hint").length,
    ).toBeGreaterThan(0);
    expect(renderedText(tree)).not.toContain("Da completare");
  });

  it("mostra l'empty state quando non c'è nessuna informazione pubblica", async () => {
    mocks.fetchPublicFanProfile.mockResolvedValue(null);

    const tree = await renderAsync(
      <FanProfileView
        completeProfile={buildFanProfile()}
        initialTab="info"
        mode="visitor"
      />,
    );

    expect(renderedText(tree)).toContain("Informazioni non disponibili");
  });
});
