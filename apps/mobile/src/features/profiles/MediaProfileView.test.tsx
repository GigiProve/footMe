/**
 * Master Profile Media/Creator (REV-PROF-21).
 *
 * Il test fissa le regole che non devono poter regredire: una sola struttura
 * per Owner e Visitor, quattro tab in un ordine fisso con Articoli per prima,
 * le differenze limitate alle azioni, e nessun dato personale del
 * proprietario a schermo.
 */
import React from "react";
import { Linking } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MediaProfileView } from "./MediaProfileView";
import type { MediaProfilePost } from "./media-profile-post-service";
import type { MediaTribunaPost } from "./media-tribuna-service";
import type { CompleteProfessionalProfile } from "./profile-service";
import type { MediaPublicProfile } from "./media/media-public-profile-service";

const publicProfileMocks = vi.hoisted(() => ({
  fetchPublicMediaProfile: vi.fn(),
}));

const articleMocks = vi.hoisted(() => ({
  fetchMediaProfileArticleCategories: vi.fn(),
  fetchMediaProfilePostFeed: vi.fn(),
}));

const tribunaMocks = vi.hoisted(() => ({
  fetchMediaTribunaFeed: vi.fn(),
  voteMediaTribunaOption: vi.fn(),
}));

const mediaTabProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock("@expo/vector-icons/Ionicons", () => {
  const MockIonicons = Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    {
      glyphMap: {
        "bar-chart-outline": 1,
        bookmark: 1,
        "bookmark-outline": 1,
        "chatbox-outline": 1,
        "chatbubble-outline": 1,
        "chatbubbles-outline": 1,
        checkmark: 1,
        "checkmark-circle": 1,
        "chevron-forward": 1,
        "chevron-up": 1,
        close: 1,
        "create-outline": 1,
        "ellipsis-horizontal": 1,
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
        "mic-outline": 1,
        "newspaper-outline": 1,
        "open-outline": 1,
        "people-outline": 1,
        "person-add-outline": 1,
        "share-outline": 1,
        "star-outline": 1,
      },
    },
  );

  return { default: MockIonicons };
});

vi.mock("./media/media-public-profile-service", () => ({
  fetchPublicMediaProfile: publicProfileMocks.fetchPublicMediaProfile,
}));

vi.mock("./media-profile-post-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    fetchMediaProfileArticleCategories:
      articleMocks.fetchMediaProfileArticleCategories,
    fetchMediaProfilePostFeed: articleMocks.fetchMediaProfilePostFeed,
  };
});

vi.mock("./media-tribuna-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    fetchMediaTribunaFeed: tribunaMocks.fetchMediaTribunaFeed,
    voteMediaTribunaOption: tribunaMocks.voteMediaTribunaOption,
  };
});

/*
  La griglia Media è il componente condiviso di REV-PROF-12, che ha già i suoi
  test: qui interessa che sia quello e con quali props venga montato.
*/
vi.mock("./career/MediaTabContent", () => ({
  MediaTabContent: (props: Record<string, unknown>) => {
    mediaTabProps.last = props;
    return React.createElement("mock-media-tab-content", { testID: "shared-media-tab" });
  },
}));

vi.mock("./media-posts/MediaPostComposer", () => ({
  MediaPostComposer: (props: Record<string, unknown>) =>
    React.createElement("mock-editorial-composer", {
      testID: "editorial-composer",
      visible: props.visible,
    }),
}));

vi.mock("./media/MediaContentComposer", () => ({
  MediaContentComposer: (props: Record<string, unknown>) =>
    React.createElement("mock-media-composer", {
      testID: "media-composer",
      visible: props.visible,
    }),
}));

vi.mock("./media/media-tribuna-composers", () => ({
  MediaTribunaComposerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-tribuna-composer", {
      testID: "tribuna-composer",
      visible: props.visible,
    }),
  MediaTribunaCreateSheet: (props: Record<string, unknown>) =>
    React.createElement("mock-tribuna-sheet", {
      testID: "tribuna-sheet",
      visible: props.visible,
    }),
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function buildPublicProfile(
  overrides: {
    capabilities?: Partial<MediaPublicProfile["capabilities"]>;
    entity?: Partial<MediaPublicProfile["entity"]>;
    mode?: "owner" | "visitor";
  } = {},
): MediaPublicProfile {
  const isOwner = overrides.mode === "owner";

  return {
    capabilities: {
      canAddMedia: isOwner,
      canBlock: !isOwner,
      canCreateTribunaContent: isOwner,
      canEditProfile: isOwner,
      canFollow: !isOwner,
      canManageTribunaContent: isOwner,
      canMessage: !isOwner,
      canPublishArticle: isOwner,
      canReport: !isOwner,
      canShare: true,
      canViewWebsite: true,
      ...overrides.capabilities,
    },
    entity: {
      affiliationType: null,
      channels: [
        { channelType: "website", label: null, url: "tuttodilettanti.it" },
        { channelType: "instagram", label: null, url: "instagram.com/td" },
      ],
      contentTypes: ["Notizie", "Interviste", "Analisi"],
      coverageScope: "REGIONS",
      coverUrl: "https://cdn.test/cover.jpg",
      coveredCompetitions: [],
      coveredProvinces: [],
      coveredTeams: [],
      coveredTerritories: ["Lombardia", "Piemonte", "Liguria"],
      coveredTopics: [],
      creatorType: "news_outlet",
      creatorTypeOther: null,
      editorialType: null,
      entityName: "TuttoDilettanti",
      focusAreas: ["Calcio dilettantistico", "Calcio locale"],
      isVerified: false,
      logoUrl: "https://cdn.test/logo.png",
      profileId: "media-1",
      shortDescription: "Notizie e storie del calcio dilettantistico.",
      websiteUrl: "https://tuttodilettanti.it",
      ...overrides.entity,
    },
    isFollowing: false,
    mode: overrides.mode ?? "visitor",
  };
}

function buildArticle(
  overrides: Partial<MediaProfilePost> = {},
): MediaProfilePost {
  return {
    author_id: "author-1",
    author_name: "Marco Rossi",
    body: "Le trattative si infiammano.",
    category: "Mercato",
    comment_count: 4,
    comments: [],
    cover_type: "image",
    cover_url: "https://cdn.test/articolo.jpg",
    created_at: "2026-06-19T08:00:00Z",
    created_by_profile_id: "media-1",
    display_mode: "full",
    excerpt: "Ecco i movimenti più importanti del weekend.",
    external_url: null,
    id: "article-1",
    is_saved: false,
    kind: "article",
    media_profile_id: "media-1",
    published_at: "2026-06-19T08:00:00Z",
    publisher_name: "TuttoDilettanti",
    reading_time_minutes: 3,
    source_name: null,
    source_type: "platform",
    status: "published",
    subtitle: null,
    tagged_targets: [],
    title: "Promozione, il mercato entra nella fase decisiva",
    updated_at: "2026-06-19T08:00:00Z",
    ...overrides,
  };
}

function buildTribunaPost(
  overrides: Partial<MediaTribunaPost> = {},
): MediaTribunaPost {
  return {
    body: null,
    comment_count: 52,
    comments: [],
    created_at: "2026-06-19T08:00:00Z",
    created_by_profile_id: "media-1",
    id: "tribuna-1",
    is_saved: false,
    kind: "editorial_poll",
    linked_article: null,
    linked_article_id: null,
    media_profile_id: "media-1",
    options: [
      {
        id: "option-a",
        is_voted: false,
        label: "ASD Predappio",
        percentage: 42,
        player_avatar_url: null,
        player_display_name: null,
        player_profile_id: null,
        sort_order: 0,
        vote_count: 155,
      },
      {
        id: "option-b",
        is_voted: false,
        label: "US Virtus",
        percentage: 33,
        player_avatar_url: null,
        player_display_name: null,
        player_profile_id: null,
        sort_order: 1,
        vote_count: 121,
      },
    ],
    published_at: "2026-06-19T08:00:00Z",
    question_count: 0,
    questions: [],
    status: "published",
    title: "Chi vincerà il campionato?",
    total_vote_count: 368,
    updated_at: "2026-06-19T08:00:00Z",
    ...overrides,
  };
}

function buildCompleteProfile(): CompleteProfessionalProfile {
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
    mediaProfile: null,
    mediaProfileAuthors: [],
    mediaProfileChannels: [],
    mediaProfileContacts: [],
    mediaProfileVerifications: [],
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: null,
      avatar_url: "https://cdn.test/owner-avatar.jpg",
      bio: null,
      birth_date: "1990-01-01",
      city: "Milano",
      current_location_city: null,
      current_location_country: "IT",
      domicile: null,
      full_name: "Luigi Provenzano",
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
      email: "owner@example.com",
      facebook: "",
      instagram: "",
      phone: "+39 333 1234567",
      showEmail: false,
      showFacebook: false,
      showInstagram: false,
      showTikTok: false,
      showWebsite: false,
      showYouTube: false,
      tiktok: "",
      website: "",
      youtube: "",
    },
  } as unknown as CompleteProfessionalProfile;
}

// ---------------------------------------------------------------------------
// Helper di rendering
// ---------------------------------------------------------------------------

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
    await Promise.resolve();
  });
}

function collectText(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(collectText).join("");
  }

  if (children && typeof children === "object" && "props" in children) {
    return collectText(
      (children as { props?: { children?: unknown } }).props?.children,
    );
  }

  return "";
}

function hasText(root: TestRenderer.ReactTestInstance, value: string) {
  return (
    root.findAll((node) => collectText(node.props.children).includes(value))
      .length > 0
  );
}

function findByTestId(root: TestRenderer.ReactTestInstance, testID: string) {
  const node = root.findAll((entry) => entry.props.testID === testID)[0];

  if (!node) {
    throw new Error(`Node not found for ${testID}`);
  }

  return node;
}

function queryByTestId(root: TestRenderer.ReactTestInstance, testID: string) {
  return root.findAll((entry) => entry.props.testID === testID)[0] ?? null;
}

function pressByTestId(root: TestRenderer.ReactTestInstance, testID: string) {
  const node = root.findAll(
    (entry) =>
      entry.props.testID === testID && typeof entry.props.onPress === "function",
  )[0];

  if (!node) {
    throw new Error(`Pressable not found for ${testID}`);
  }

  act(() => {
    node.props.onPress();
  });
}

/**
 * `Pressable` propaga le props al `View` che rende, quindi ogni tab compare
 * due volte nell'albero: si guardano solo i nodi host.
 */
function findTabNodes(root: TestRenderer.ReactTestInstance) {
  return findByTestId(root, "media-profile-tabs").findAll(
    (node) =>
      node.props.accessibilityRole === "tab" && typeof node.type === "string",
  );
}

function findTabLabels(root: TestRenderer.ReactTestInstance) {
  return findTabNodes(root).map((node) => node.props.accessibilityLabel);
}

/** La `TabBar` condivisa identifica le tab dall'etichetta accessibile. */
function pressTab(root: TestRenderer.ReactTestInstance, label: string) {
  const node = findTabNodes(root).filter(
    (entry) => entry.props.accessibilityLabel === label,
  )[0];

  if (!node) {
    throw new Error(`Tab non trovata: ${label}`);
  }

  act(() => {
    node.props.onPress();
  });
}

// ---------------------------------------------------------------------------

describe("MediaProfileView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaTabProps.last = null;
    publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
      buildPublicProfile(),
    );
    articleMocks.fetchMediaProfilePostFeed.mockResolvedValue([]);
    articleMocks.fetchMediaProfileArticleCategories.mockResolvedValue([]);
    tribunaMocks.fetchMediaTribunaFeed.mockResolvedValue([]);
    tribunaMocks.voteMediaTribunaOption.mockResolvedValue(undefined);
    vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  });

  describe("struttura condivisa", () => {
    it("mostra quattro tab, nell'ordine fisso, con Articoli attiva", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(findTabLabels(tree.root)).toEqual([
        "Articoli",
        "Tribuna",
        "Media",
        "Info",
      ]);
      expect(queryByTestId(tree.root, "media-articles-tab")).not.toBeNull();
    });

    it("non cambia l'ordine delle tab fra Owner e Visitor", async () => {
      const visitor = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({ mode: "owner" }),
      );

      const owner = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          viewerProfileId="media-1"
        />,
      );

      expect(findTabLabels(owner.root)).toEqual(findTabLabels(visitor.root));
    });

    it("apre la tab richiesta dal deep link", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          initialTab="info"
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(queryByTestId(tree.root, "media-info-tab")).not.toBeNull();
      expect(queryByTestId(tree.root, "media-articles-tab")).toBeNull();
    });

    it("mostra l'identità editoriale e non quella del proprietario", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(hasText(tree.root, "TuttoDilettanti")).toBe(true);
      expect(hasText(tree.root, "Testata giornalistica")).toBe(true);
      expect(
        hasText(tree.root, "Notizie e storie del calcio dilettantistico."),
      ).toBe(true);
      // Dati personali dell'owner: nessuno di questi deve comparire.
      expect(hasText(tree.root, "Luigi Provenzano")).toBe(false);
      expect(hasText(tree.root, "Milano")).toBe(false);
      expect(hasText(tree.root, "owner@example.com")).toBe(false);
      expect(hasText(tree.root, "333 1234567")).toBe(false);
    });

    it("non mostra blocchi Salvati o Seguiti nello scroll del profilo", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          viewerProfileId="media-1"
        />,
      );

      expect(hasText(tree.root, "Salvati")).toBe(false);
      expect(hasText(tree.root, "Seguiti")).toBe(false);
      expect(hasText(tree.root, "Vedi tutti")).toBe(false);
    });
  });

  describe("azioni", () => {
    it("l'Owner vede Modifica profilo e non Segui o Messaggio", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({ mode: "owner" }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          onContactPress={vi.fn()}
          onEditProfilePress={vi.fn()}
          onFollowPress={vi.fn()}
          viewerProfileId="media-1"
        />,
      );

      expect(hasText(tree.root, "Modifica profilo")).toBe(true);
      expect(hasText(tree.root, "Segui")).toBe(false);
      expect(hasText(tree.root, "Messaggio")).toBe(false);
    });

    it("il Visitor vede Segui e Messaggio e non Modifica profilo", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          onContactPress={vi.fn()}
          onEditProfilePress={vi.fn()}
          onFollowPress={vi.fn()}
          viewerProfileId="viewer-1"
        />,
      );

      expect(hasText(tree.root, "Segui")).toBe(true);
      expect(hasText(tree.root, "Messaggio")).toBe(true);
      expect(hasText(tree.root, "Modifica profilo")).toBe(false);
    });

    it("mostra lo stato \"Seguito\" quando il viewer segue già", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          isFollowed
          mode="visitor"
          onFollowPress={vi.fn()}
          viewerProfileId="viewer-1"
        />,
      );

      expect(hasText(tree.root, "Seguito")).toBe(true);
    });

    it("mostra Visita sito solo con un URL pubblico valido", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressByTestId(tree.root, "media-website-link");

      expect(Linking.openURL).toHaveBeenCalledWith("https://tuttodilettanti.it");
    });

    it("non mostra Visita sito senza URL, nemmeno disabilitato", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({
          capabilities: { canViewWebsite: false },
          entity: { websiteUrl: null },
        }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(queryByTestId(tree.root, "media-website-link")).toBeNull();
      expect(hasText(tree.root, "Visita sito")).toBe(false);
    });

    it("non mostra Visita sito se l'URL non è apribile", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({ entity: { websiteUrl: "javascript:alert(1)" } }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(queryByTestId(tree.root, "media-website-link")).toBeNull();
    });
  });

  describe("tab Articoli", () => {
    it("chiede soltanto articoli e news, paginati", async () => {
      await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(articleMocks.fetchMediaProfilePostFeed).toHaveBeenCalledWith(
        "media-1",
        "viewer-1",
        { category: null, limit: 10, offset: 0 },
      );
    });

    it("mostra la card con categoria, titolo, estratto e metadati", async () => {
      articleMocks.fetchMediaProfilePostFeed.mockImplementation(
        async (_id: string, _viewer: unknown, options: { kinds?: string[] }) =>
          options?.kinds?.[0] === "media" ? [] : [buildArticle()],
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(hasText(tree.root, "MERCATO")).toBe(true);
      expect(
        hasText(tree.root, "Promozione, il mercato entra nella fase decisiva"),
      ).toBe(true);
      expect(
        hasText(tree.root, "Ecco i movimenti più importanti del weekend."),
      ).toBe(true);
      expect(hasText(tree.root, "di Marco Rossi")).toBe(true);
      expect(hasText(tree.root, "3 min")).toBe(true);
    });

    it("firma un articolo collegato da un link senza attribuirlo a PROLINK", async () => {
      articleMocks.fetchMediaProfilePostFeed.mockImplementation(
        async (_id: string, _viewer: unknown, options: { kinds?: string[] }) =>
          options?.kinds?.[0] === "media"
            ? []
            : [
                buildArticle({
                  display_mode: "preview",
                  external_url: "https://www.dominio.it/articolo",
                  source_type: "link",
                }),
              ],
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(hasText(tree.root, "Condiviso da TuttoDilettanti")).toBe(true);
      expect(hasText(tree.root, "Fonte originale · dominio.it")).toBe(true);
    });

    it("costruisce i chip filtro dalle categorie del backend", async () => {
      articleMocks.fetchMediaProfileArticleCategories.mockResolvedValue([
        { articleCount: 4, category: "Mercato" },
        { articleCount: 2, category: "Interviste" },
      ]);

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(queryByTestId(tree.root, "media-article-filter-all")).not.toBeNull();
      expect(
        queryByTestId(tree.root, "media-article-filter-Mercato"),
      ).not.toBeNull();
      expect(
        queryByTestId(tree.root, "media-article-filter-Interviste"),
      ).not.toBeNull();
      // Una categoria non presente nei dati non diventa un chip.
      expect(queryByTestId(tree.root, "media-article-filter-Opinioni")).toBeNull();
    });

    it("rifà la query sul filtro scelto, ripartendo dalla prima pagina", async () => {
      articleMocks.fetchMediaProfileArticleCategories.mockResolvedValue([
        { articleCount: 2, category: "Interviste" },
      ]);

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressByTestId(tree.root, "media-article-filter-Interviste");
      await flushPromises();

      expect(articleMocks.fetchMediaProfilePostFeed).toHaveBeenCalledWith(
        "media-1",
        "viewer-1",
        { category: "Interviste", limit: 10, offset: 0 },
      );
    });

    it("mostra l'empty state del filtro quando la categoria è vuota", async () => {
      articleMocks.fetchMediaProfileArticleCategories.mockResolvedValue([
        { articleCount: 1, category: "Opinioni" },
      ]);

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressByTestId(tree.root, "media-article-filter-Opinioni");
      await flushPromises();

      expect(
        queryByTestId(tree.root, "media-articles-empty-filter"),
      ).not.toBeNull();
      expect(hasText(tree.root, "Nessun articolo in questa categoria")).toBe(
        true,
      );
    });

    it("l'Owner autorizzato vede Nuovo articolo, il Visitor no", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({ mode: "owner" }),
      );

      const owner = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          viewerProfileId="media-1"
        />,
      );

      expect(queryByTestId(owner.root, "media-new-article-button")).not.toBeNull();

      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile(),
      );

      const visitor = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(queryByTestId(visitor.root, "media-new-article-button")).toBeNull();
    });

    it("un Owner senza permesso di pubblicare non vede la CTA", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({
          capabilities: { canPublishArticle: false },
          mode: "owner",
        }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          viewerProfileId="media-1"
        />,
      );

      expect(queryByTestId(tree.root, "media-new-article-button")).toBeNull();
    });

    it("consegna la creazione al flusso editoriale esistente", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({ mode: "owner" }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          viewerProfileId="media-1"
        />,
      );

      expect(findByTestId(tree.root, "editorial-composer").props.visible).toBe(
        false,
      );

      pressByTestId(tree.root, "media-new-article-button");

      expect(findByTestId(tree.root, "editorial-composer").props.visible).toBe(
        true,
      );
    });

    it("pagina gli articoli senza ricaricare la pagina precedente", async () => {
      const page = Array.from({ length: 10 }, (_unused, index) =>
        buildArticle({ id: `article-${index}` }),
      );
      articleMocks.fetchMediaProfilePostFeed.mockImplementation(
        async (_id: string, _viewer: unknown, options: { kinds?: string[] }) =>
          options?.kinds?.[0] === "media" ? [] : page,
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressByTestId(tree.root, "media-articles-load-more");
      await flushPromises();

      expect(articleMocks.fetchMediaProfilePostFeed).toHaveBeenCalledWith(
        "media-1",
        "viewer-1",
        { category: null, limit: 10, offset: 10 },
      );
    });

    it("mostra l'empty state dell'Owner con la CTA, quello del Visitor senza", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({ mode: "owner" }),
      );

      const owner = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          viewerProfileId="media-1"
        />,
      );

      expect(hasText(owner.root, "Pubblica il tuo primo articolo")).toBe(true);
      expect(queryByTestId(owner.root, "media-articles-empty-cta")).not.toBeNull();

      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile(),
      );

      const visitor = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(hasText(visitor.root, "Nessun articolo")).toBe(true);
      expect(queryByTestId(visitor.root, "media-articles-empty-cta")).toBeNull();
    });

    it("un errore sugli articoli non blocca le altre tab", async () => {
      articleMocks.fetchMediaProfilePostFeed.mockImplementation(
        async (_id: string, _viewer: unknown, options: { kinds?: string[] }) => {
          if (options?.kinds?.[0] === "media") {
            return [];
          }

          throw new Error("rete");
        },
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(queryByTestId(tree.root, "media-articles-error")).not.toBeNull();
      expect(
        hasText(tree.root, "Non è stato possibile caricare gli articoli."),
      ).toBe(true);
      // La tab bar resta raggiungibile e le altre tab si aprono.
      expect(findTabLabels(tree.root)).toHaveLength(4);
    });

    it("apre il dettaglio condiviso dell'articolo", async () => {
      const onOpenContent = vi.fn();
      articleMocks.fetchMediaProfilePostFeed.mockImplementation(
        async (_id: string, _viewer: unknown, options: { kinds?: string[] }) =>
          options?.kinds?.[0] === "media" ? [] : [buildArticle()],
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          onOpenContent={onOpenContent}
          viewerProfileId="viewer-1"
        />,
      );

      const card = findByTestId(tree.root, "media-article-card-article-1");

      act(() => {
        card
          .findAll((node) => typeof node.props.onPress === "function")[0]
          ?.props.onPress();
      });

      expect(onOpenContent).toHaveBeenCalledWith({
        contentType: "media_profile",
        postId: "article-1",
      });
    });
  });

  describe("tab Tribuna", () => {
    it("mostra soltanto contenuti interattivi, con percentuali e conteggi", async () => {
      tribunaMocks.fetchMediaTribunaFeed.mockResolvedValue([buildTribunaPost()]);

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressTab(tree.root, "Tribuna");
      await flushPromises();

      expect(hasText(tree.root, "Chi vincerà il campionato?")).toBe(true);
      expect(hasText(tree.root, "368 voti")).toBe(true);
      expect(hasText(tree.root, "52 commenti")).toBe(true);
      // Nessun articolo finisce nella Tribuna.
      expect(
        hasText(tree.root, "Promozione, il mercato entra nella fase decisiva"),
      ).toBe(false);
    });

    it("registra il voto e mostra il risultato", async () => {
      tribunaMocks.fetchMediaTribunaFeed.mockResolvedValue([buildTribunaPost()]);

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressTab(tree.root, "Tribuna");
      await flushPromises();

      pressByTestId(tree.root, "media-tribuna-option-option-a");
      await flushPromises();

      expect(tribunaMocks.voteMediaTribunaOption).toHaveBeenCalledWith({
        optionId: "option-a",
        postId: "tribuna-1",
        profileId: "viewer-1",
      });
    });

    it("il Visitor non vede la CTA Crea", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressTab(tree.root, "Tribuna");
      await flushPromises();

      expect(queryByTestId(tree.root, "media-tribuna-create-button")).toBeNull();
      expect(hasText(tree.root, "Tribuna vuota")).toBe(true);
    });

    it("l'Owner autorizzato apre il bottom sheet condiviso", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({ mode: "owner" }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          viewerProfileId="media-1"
        />,
      );

      pressTab(tree.root, "Tribuna");
      await flushPromises();

      expect(hasText(tree.root, "La tua Tribuna è vuota")).toBe(true);
      pressByTestId(tree.root, "media-tribuna-create-button");

      expect(findByTestId(tree.root, "tribuna-sheet").props.visible).toBe(true);
    });
  });

  describe("tab Media", () => {
    it("riusa il modulo Media condiviso con i filtri Tutti/Foto/Video", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressTab(tree.root, "Media");
      await flushPromises();

      expect(queryByTestId(tree.root, "shared-media-tab")).not.toBeNull();
      expect(mediaTabProps.last?.filtersEnabled).toBe(true);
      expect(mediaTabProps.last?.mode).toBe("visitor");
      // Il Visitor non riceve la CTA di pubblicazione.
      expect(mediaTabProps.last?.onAddContentPress).toBeUndefined();
    });

    it("l'Owner autorizzato riceve la CTA di aggiunta", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({ mode: "owner" }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          viewerProfileId="media-1"
        />,
      );

      pressTab(tree.root, "Media");
      await flushPromises();

      expect(typeof mediaTabProps.last?.onAddContentPress).toBe("function");
      expect(mediaTabProps.last?.emptyCtaLabel).toBe("Aggiungi contenuto");
    });

    it("legge soltanto i contenuti visivi della redazione", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressTab(tree.root, "Media");
      await flushPromises();

      expect(articleMocks.fetchMediaProfilePostFeed).toHaveBeenCalledWith(
        "media-1",
        "viewer-1",
        { kinds: ["media"], limit: 10, offset: 0 },
      );
    });

    it("non interroga le altre tab finché non vengono aperte", async () => {
      await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      // Si apre sugli Articoli: una sola richiesta, e nessuna per Tribuna o
      // Media.
      expect(articleMocks.fetchMediaProfilePostFeed).toHaveBeenCalledTimes(1);
      expect(tribunaMocks.fetchMediaTribunaFeed).not.toHaveBeenCalled();
    });
  });

  describe("tab Info", () => {
    it("tiene copertura, contenuti, aree e canali in sezioni distinte", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          initialTab="info"
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(hasText(tree.root, "Identità editoriale")).toBe(true);
      expect(hasText(tree.root, "Copertura")).toBe(true);
      expect(hasText(tree.root, "Contenuti")).toBe(true);
      expect(hasText(tree.root, "Aree coperte")).toBe(true);
      expect(hasText(tree.root, "Canali ufficiali")).toBe(true);
      expect(hasText(tree.root, "Lombardia · Piemonte · Liguria")).toBe(true);
      expect(queryByTestId(tree.root, "media-info-channel-website")).not.toBeNull();
      expect(
        queryByTestId(tree.root, "media-info-channel-instagram"),
      ).not.toBeNull();
    });

    it("al Visitor non mostra placeholder per i dati mancanti", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({
          entity: {
            channels: [],
            contentTypes: [],
            coveredTerritories: [],
            focusAreas: [],
            shortDescription: null,
            websiteUrl: null,
          },
        }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          initialTab="info"
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(hasText(tree.root, "Da completare")).toBe(false);
      expect(hasText(tree.root, "Aree coperte")).toBe(false);
      expect(hasText(tree.root, "Canali ufficiali")).toBe(false);
      expect(queryByTestId(tree.root, "media-info-empty-cta")).toBeNull();
    });

    it("all'Owner con Info vuota propone Modifica profilo", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({
          entity: {
            channels: [],
            contentTypes: [],
            coveredTerritories: [],
            creatorType: null,
            editorialType: null,
            focusAreas: [],
            shortDescription: null,
            websiteUrl: null,
          },
          mode: "owner",
        }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          initialTab="info"
          mode="owner"
          onEditProfilePress={vi.fn()}
          viewerProfileId="media-1"
        />,
      );

      expect(hasText(tree.root, "Completa le informazioni del profilo")).toBe(
        true,
      );
      expect(queryByTestId(tree.root, "media-info-empty-cta")).not.toBeNull();
    });

    it("apre un canale solo con un URL normalizzato", async () => {
      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          initialTab="info"
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      pressByTestId(tree.root, "media-info-channel-instagram");

      expect(Linking.openURL).toHaveBeenCalledWith("https://instagram.com/td");
    });
  });

  describe("stati globali", () => {
    it("mostra lo scheletro finché l'identità non è arrivata", () => {
      let resolved = false;
      publicProfileMocks.fetchPublicMediaProfile.mockImplementation(
        () =>
          new Promise(() => {
            resolved = true;
          }),
      );

      let tree!: TestRenderer.ReactTestRenderer;

      act(() => {
        tree = TestRenderer.create(
          <MediaProfileView
            completeProfile={buildCompleteProfile()}
            mode="visitor"
            viewerProfileId="viewer-1"
          />,
        );
      });

      expect(resolved).toBe(true);
      expect(queryByTestId(tree.root, "media-profile-skeleton")).not.toBeNull();
      expect(queryByTestId(tree.root, "media-profile-tabs")).toBeNull();
    });

    it("distingue un profilo non disponibile da un errore di rete", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(null);

      const missing = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(
        queryByTestId(missing.root, "media-profile-unavailable"),
      ).not.toBeNull();
      expect(hasText(missing.root, "Profilo non disponibile")).toBe(true);

      publicProfileMocks.fetchPublicMediaProfile.mockRejectedValue(
        new Error("rete"),
      );

      const failed = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="visitor"
          viewerProfileId="viewer-1"
        />,
      );

      expect(queryByTestId(failed.root, "media-profile-error")).not.toBeNull();
      expect(
        hasText(failed.root, "Non è stato possibile caricare il profilo"),
      ).toBe(true);
      expect(queryByTestId(failed.root, "media-profile-retry")).not.toBeNull();
    });

    it("non disegna azioni prima che le capabilities siano arrivate", async () => {
      publicProfileMocks.fetchPublicMediaProfile.mockResolvedValue(
        buildPublicProfile({
          capabilities: {
            canEditProfile: false,
            canFollow: false,
            canMessage: false,
            canPublishArticle: false,
          },
          mode: "owner",
        }),
      );

      const tree = await renderAsync(
        <MediaProfileView
          completeProfile={buildCompleteProfile()}
          mode="owner"
          onContactPress={vi.fn()}
          onEditProfilePress={vi.fn()}
          onFollowPress={vi.fn()}
          viewerProfileId="media-1"
        />,
      );

      expect(hasText(tree.root, "Modifica profilo")).toBe(false);
      expect(hasText(tree.root, "Segui")).toBe(false);
      expect(queryByTestId(tree.root, "media-new-article-button")).toBeNull();
    });
  });
});
