import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { AgentMediaTabContent } from "./AgentMediaTabContent";

vi.mock("react-native", async () => {
  const actual = await vi.importActual<typeof import("react-native")>("react-native");

  return {
    ...actual,
    useWindowDimensions: () => ({
      fontScale: 1,
      height: 812,
      scale: 1,
      width: 375,
    }),
  };
});

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

vi.mock("../../../components/ui/video-player-modal", () => ({
  VideoPlayerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-video-player-modal", props),
}));

function renderAgentMediaTabContent(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

describe("AgentMediaTabContent", () => {
  it("renders add content action only for the owner view", () => {
    const ownerTree = renderAgentMediaTabContent(
      <AgentMediaTabContent
        authorAvatarUrl={null}
        authorName="Andrea Serra"
        mode="owner"
      />,
    );
    const visitorTree = renderAgentMediaTabContent(
      <AgentMediaTabContent
        authorAvatarUrl={null}
        authorName="Andrea Serra"
        mode="visitor"
      />,
    );

    expect(
      ownerTree.root.findAllByProps({
        accessibilityLabel: "Aggiungi contenuto media agente",
      }).length,
    ).toBeGreaterThan(0);
    expect(() =>
      visitorTree.root.findByProps({
        accessibilityLabel: "Aggiungi contenuto media agente",
      }),
    ).toThrow();
  });

  it("shows owner actions and tagged players when opening a content item", () => {
    const tree = renderAgentMediaTabContent(
      <AgentMediaTabContent
        authorAvatarUrl={null}
        authorName="Andrea Serra"
        initialItems={[
          {
            created_at: "2026-04-10T10:00:00.000Z",
            description: "Inserimento attaccante classe 2003",
            id: "agent-media-1",
            operation_type: "insertion",
            tag: "transfer",
            tagged_players: [
              {
                avatar_url: null,
                display_name: "Marco Rossi",
                profile_id: "player-1",
              },
            ],
            thumbnail_url: "https://example.com/thumb.jpg",
            type: "image",
            url: "https://example.com/thumb.jpg",
          },
        ]}
        mode="owner"
      />,
    );

    act(() => {
      tree.root.findByProps({ testID: "agent-media-grid-item-agent-media-1" }).props.onPress();
    });

    expect(
      tree.root.findByProps({ accessibilityLabel: "Modifica contenuto media agente" }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ accessibilityLabel: "Elimina contenuto media agente" }),
    ).toBeTruthy();
    expect(tree.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Inserimento attaccante classe 2003" })).toBeTruthy();
  });

  it("sorts media items by recency in the grid", () => {
    const tree = renderAgentMediaTabContent(
      <AgentMediaTabContent
        authorAvatarUrl={null}
        authorName="Andrea Serra"
        initialItems={[
          {
            created_at: "2026-04-08T10:00:00.000Z",
            description: null,
            id: "older-item",
            operation_type: null,
            tag: "event",
            tagged_players: [],
            thumbnail_url: "https://example.com/older.jpg",
            type: "image",
            url: "https://example.com/older.jpg",
          },
          {
            created_at: "2026-04-10T10:00:00.000Z",
            description: null,
            id: "newer-item",
            operation_type: null,
            tag: "signature",
            tagged_players: [],
            thumbnail_url: "https://example.com/newer.jpg",
            type: "image",
            url: "https://example.com/newer.jpg",
          },
        ]}
        mode="visitor"
      />,
    );

    const gridItemIds = tree.root
      .findAll(
        (node) =>
          node.props.testID === "agent-media-grid-item-newer-item" ||
          node.props.testID === "agent-media-grid-item-older-item",
      )
      .map((node) => node.props.testID);

    expect(gridItemIds[0]).toBe("agent-media-grid-item-newer-item");
  });
});
