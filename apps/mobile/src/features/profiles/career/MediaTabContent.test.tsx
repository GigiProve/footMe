import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { MediaTabContent, type MediaContentItem } from "./MediaTabContent";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

const careerMocks = vi.hoisted(() => ({
  useCareerMediaActions: vi.fn(),
}));

// HOM-15: il motore reale (store Like/Salvati, sessione, RPC) ha i suoi test;
// qui conta solo che il viewer lo usi e non finga più lo stato.
vi.mock("./use-career-media-actions", () => ({
  useCareerMediaActions: careerMocks.useCareerMediaActions,
}));

vi.mock("../../../components/ui/video-player-modal", () => ({
  VideoPlayerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-video-player-modal", props),
}));

function renderMediaTabContent(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

describe("MediaTabContent", () => {
  it("renders the add content action only for the owner view", () => {
    const ownerTree = renderMediaTabContent(
      <MediaTabContent authorName="Alessandro Bianchi" mode="owner" />,
    );
    const visitorTree = renderMediaTabContent(
      <MediaTabContent authorName="Alessandro Bianchi" mode="visitor" />,
    );

    expect(
      ownerTree.root.findAllByProps({ accessibilityLabel: "Aggiungi contenuto" }).length,
    ).toBeGreaterThan(0);
    expect(() =>
      visitorTree.root.findByProps({ accessibilityLabel: "Aggiungi contenuto" }),
    ).toThrow();
  });

  it("does not render default media when no real items are provided", () => {
    const tree = renderMediaTabContent(
      <MediaTabContent authorName="Alessandro Bianchi" mode="visitor" />,
    );

    expect(tree.root.findAllByProps({ testID: "media-grid" }).length).toBe(0);
    expect(tree.root.findAllByProps({ children: "Gol" }).length).toBe(0);
  });

  it("shows owner actions when opening a content item in owner mode", () => {
    const tree = renderMediaTabContent(
      <MediaTabContent
        authorName="Alessandro Bianchi"
        initialItems={[
          {
            description: "Video highlights del profilo.",
            id: "profile-highlight-video",
            isFeatured: false,
            tag: { icon: "play-circle-outline", label: "Highlights" },
            thumbnailUrl: "https://example.com/thumb.jpg",
            type: "video",
            videoUrl: "https://example.com/video.mp4",
          },
        ]}
        mode="owner"
      />,
    );

    act(() => {
      tree.root.findByProps({ testID: "media-grid-item-profile-highlight-video" }).props.onPress();
    });

    expect(tree.root.findByProps({ accessibilityLabel: "Modifica" })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: "Elimina" })).toBeTruthy();
  });

  it("renders featured items first in the grid", () => {
    const tree = renderMediaTabContent(
      <MediaTabContent
        authorName="Alessandro Bianchi"
        initialItems={[
          {
            description: "",
            id: "normal-item",
            isFeatured: false,
            tag: { icon: "play-circle-outline", label: "Highlights" },
            thumbnailUrl: "https://example.com/normal.jpg",
            type: "image",
          },
          {
            description: "",
            id: "featured-item",
            isFeatured: true,
            tag: { icon: "play-circle-outline", label: "Highlights" },
            thumbnailUrl: "https://example.com/featured.jpg",
            type: "image",
          },
        ]}
        mode="visitor"
      />,
    );

    const gridItemIds = tree.root
      .findAll(
        (node) =>
          node.props.testID === "media-grid-item-featured-item" ||
          node.props.testID === "media-grid-item-normal-item",
      )
      .map((node) => node.props.testID);

    expect(gridItemIds[0]).toBe("media-grid-item-featured-item");
  });

  /*
    REV-PROF-12: la griglia Media non ha più alcun "Salva" sulle thumbnail —
    né icona, né stato, né hit-area invisibile — mentre il dettaglio contenuto
    lo conserva. Il test vale per tutti i Master Profile, visto che montano
    tutti questo componente.
  */
  const REV_PROF_12_ITEMS: MediaContentItem[] = [
    {
      description: "Assist di tacco.",
      durationSeconds: 24,
      id: "clip",
      isFeatured: false,
      thumbnailUrl: "https://example.com/clip.jpg",
      type: "video",
      videoUrl: "https://example.com/clip.mp4",
    },
    {
      description: "",
      id: "shot",
      isFeatured: false,
      thumbnailUrl: "https://example.com/shot.jpg",
      type: "image",
    },
  ];

  it.each(["owner", "visitor"] as const)(
    "never renders a save control over the grid thumbnails (%s)",
    (mode) => {
      const tree = renderMediaTabContent(
        <MediaTabContent
          authorName="Alessandro Bianchi"
          filtersEnabled
          initialItems={[...REV_PROF_12_ITEMS]}
          mode={mode}
        />,
      );

      const grid = tree.root.findByProps({ testID: "media-grid" });

      expect(
        grid.findAll(
          (node) =>
            typeof node.props.name === "string" && node.props.name.startsWith("bookmark"),
        ),
      ).toHaveLength(0);
      expect(
        grid.findAll(
          (node) =>
            typeof node.props.accessibilityLabel === "string" &&
            /salv/i.test(node.props.accessibilityLabel),
        ),
      ).toHaveLength(0);

      /*
        Un solo gesto per thumbnail: ogni nodo premibile dentro la cella è la
        Pressable "apri contenuto" (o il suo host), nessun pulsante nascosto.
      */
      const tile = grid.findByProps({ testID: "media-grid-item-clip" });

      expect(
        tile
          .findAll((node) => typeof node.props.onPress === "function")
          .every((node) => node.props.testID === "media-grid-item-clip"),
      ).toBe(true);

      // Il badge durata resta: la rimozione tocca solo il bookmark.
      expect(grid.findAllByProps({ children: "0:24" }).length).toBeGreaterThan(0);
    },
  );

  function openClip(tree: TestRenderer.ReactTestRenderer) {
    act(() => {
      tree.root.findByProps({ testID: "media-grid-item-clip" }).props.onPress();
    });
  }

  function findByLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
    return tree.root.findAll(
      (node) => typeof node.props.icon === "string" && node.props.accessibilityLabel === label,
    );
  }

  it("HOM-15: senza proprietario dei media il viewer Visitor non finge Mi piace né Salva", () => {
    careerMocks.useCareerMediaActions.mockReset();
    const tree = renderMediaTabContent(
      <MediaTabContent authorName="Alessandro Bianchi" initialItems={[...REV_PROF_12_ITEMS]} mode="visitor" />,
    );

    openClip(tree);

    expect(findByLabel(tree, "Metti like al contenuto")).toHaveLength(0);
    expect(findByLabel(tree, "Salva contenuto")).toHaveLength(0);
    expect(careerMocks.useCareerMediaActions).not.toHaveBeenCalled();
  });

  it("HOM-15: con il proprietario mostra lo stato del server e usa i motori condivisi", () => {
    const toggleLike = vi.fn();
    const toggleSaved = vi.fn();
    careerMocks.useCareerMediaActions.mockReset();
    careerMocks.useCareerMediaActions.mockImplementation((_owner: string, itemKey: string) =>
      itemKey === "clip"
        ? { canSave: true, isLiked: true, isSaved: true, likesCount: 12, toggleLike, toggleSaved }
        : null,
    );
    const tree = renderMediaTabContent(
      <MediaTabContent
        authorName="Alessandro Bianchi"
        careerMediaOwnerId="owner-1"
        initialItems={[...REV_PROF_12_ITEMS]}
        mode="visitor"
      />,
    );

    openClip(tree);

    expect(careerMocks.useCareerMediaActions).toHaveBeenCalledWith("owner-1", "clip");
    const [like] = findByLabel(tree, "Togli Mi piace");
    const [save] = findByLabel(tree, "Rimuovi dai salvati");
    expect(like?.props.active).toBe(true);
    expect(like?.props.count).toBe("12");
    expect(save?.props.active).toBe(true);

    act(() => {
      like?.props.onPress();
      save?.props.onPress();
    });

    expect(toggleLike).toHaveBeenCalledTimes(1);
    expect(toggleSaved).toHaveBeenCalledTimes(1);
    // L'elemento senza stato server («shot») non ha controlli: uno solo per tipo.
    expect(findByLabel(tree, "Togli Mi piace")).toHaveLength(1);
  });

  it("HOM-15: il rail Owner resta evidenza/modifica/elimina, senza Mi piace né Salva", () => {
    careerMocks.useCareerMediaActions.mockReset();
    const tree = renderMediaTabContent(
      <MediaTabContent
        authorName="Alessandro Bianchi"
        careerMediaOwnerId="owner-1"
        initialItems={[...REV_PROF_12_ITEMS]}
        mode="owner"
      />,
    );

    openClip(tree);

    expect(careerMocks.useCareerMediaActions).not.toHaveBeenCalled();
    expect(findByLabel(tree, "Elimina").length).toBeGreaterThan(0);
  });

  it("non mostra più commenti finti né l'Alert «Apri la lista» nel viewer (HOM-08)", () => {
    const tree = renderMediaTabContent(
      <MediaTabContent
        authorName="Alessandro Bianchi"
        initialItems={[...REV_PROF_12_ITEMS]}
        mode="visitor"
      />,
    );

    act(() => {
      tree.root.findByProps({ testID: "media-grid-item-clip" }).props.onPress();
    });

    expect(tree.root.findAllByProps({ accessibilityLabel: "Apri commenti contenuto" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: "Vedi tutti i commenti" })).toHaveLength(0);
  });
});
