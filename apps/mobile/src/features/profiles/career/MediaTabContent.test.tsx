import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { MediaTabContent } from "./MediaTabContent";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
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
            commentCount: 12,
            comments: [],
            description: "Video highlights del profilo.",
            id: "profile-highlight-video",
            isFeatured: false,
            isLiked: false,
            isSaved: false,
            likeCount: 0,
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
            commentCount: 0,
            comments: [],
            description: "",
            id: "normal-item",
            isFeatured: false,
            isLiked: false,
            isSaved: false,
            likeCount: 0,
            tag: { icon: "play-circle-outline", label: "Highlights" },
            thumbnailUrl: "https://example.com/normal.jpg",
            type: "image",
          },
          {
            commentCount: 0,
            comments: [],
            description: "",
            id: "featured-item",
            isFeatured: true,
            isLiked: false,
            isSaved: false,
            likeCount: 0,
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
});
