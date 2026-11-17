/**
 * Riga Inbox (DAS-REV-34 §10, §13, §29; PNG 03): icona mute discreta e badge dei
 * non letti compresenti, label accessibile con lo stato, archiviato senza counter.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationRow } from "./ConversationRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// GroupAvatar pesca l'URL firmato da groups-service, la cui catena arriva al client supabase.
vi.mock("../../dashboard/groups/groups-service", () => ({
  fetchGroupAvatarUrl: vi.fn().mockResolvedValue(null),
}));

const mounted: TestRenderer.ReactTestRenderer[] = [];

function render(props: Partial<React.ComponentProps<typeof ConversationRow>> = {}) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(
      <ConversationRow
        isGroup
        lastMessage="Mister Bianchi: Domani allenamento alle 18:00"
        name="Staff Primavera"
        onPress={() => {}}
        timestamp="10:24"
        unreadCount={0}
        {...props}
      />,
    );
  });
  mounted.push(tree);

  return tree;
}

const texts = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll((node) => String(node.type) === "Text", { deep: true })
    .map((node) => node.children.filter((child): child is string => typeof child === "string").join(""))
    .filter((value) => value.length > 0);

const hasMuteIcon = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll((node) => node.props?.testID === "conversation-row-muted").length > 0;

const rowLabel = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll((node) => node.props?.accessibilityRole === "button")[0]?.props.accessibilityLabel;

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
});

describe("ConversationRow", () => {
  it("muta con non letti: icona mute e counter reale insieme, l'uno non sostituisce l'altro (QA-026)", () => {
    const tree = render({ isMuted: true, unreadCount: 17 });

    expect(hasMuteIcon(tree)).toBe(true);
    expect(texts(tree)).toContain("17");
    expect(texts(tree)).toContain("10:24");
    expect(rowLabel(tree)).toBe("Staff Primavera, notifiche silenziose, 17 messaggi non letti");
  });

  it("non silenziata: nessuna icona", () => {
    const tree = render({ unreadCount: 2 });

    expect(hasMuteIcon(tree)).toBe(false);
    expect(rowLabel(tree)).toBe("Staff Primavera, 2 messaggi non letti");
  });

  it("GROUP archiviato: label neutra «Archiviato», nessun counter né badge", () => {
    const tree = render({ statusLabel: "Archiviato", unreadCount: 0 });

    expect(texts(tree)).toContain("Archiviato · 10:24");
    expect(rowLabel(tree)).toBe("Staff Primavera, archiviato");
  });
});
