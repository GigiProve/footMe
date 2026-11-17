/**
 * Fallback 11/12 sui componenti reali (DAS-REV-34 §22): testi esatti, una sola
 * CTA primaria verso i Messaggi, nessun retry né composer, nessun nome.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationUnavailableScreen } from "./ConversationUnavailableScreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  replace: vi.fn(),
}));

vi.mock("expo-router", () => ({ useRouter: () => routerMocks }));

const mounted: TestRenderer.ReactTestRenderer[] = [];

function render(reason: "deleted" | "revoked" | "unavailable") {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(<ConversationUnavailableScreen reason={reason} />);
  });
  mounted.push(tree);

  return tree;
}

const texts = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll((node) => String(node.type) === "Text", { deep: true })
    .map((node) => node.children.filter((child): child is string => typeof child === "string").join(""))
    .filter((value) => value.length > 0);

const byTestID = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((node) => node.props?.testID === id && typeof node.props?.onPress === "function")[0];

beforeEach(() => {
  routerMocks.canGoBack.mockReturnValue(true);
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

describe("ConversationUnavailableScreen", () => {
  it("accesso revocato: titolo e testo del PNG 11", () => {
    const content = texts(render("revoked"));

    expect(content).toContain("Non fai più parte di questo gruppo");
    expect(content).toContain("Non puoi più accedere alla conversazione.");
    expect(content).toContain("Torna ai messaggi");
  });

  it("gruppo eliminato: titolo e testo del PNG 12, nessun retry", () => {
    const content = texts(render("deleted"));

    expect(content).toContain("Il gruppo è stato eliminato");
    expect(content).toContain("Questa conversazione non è più disponibile.");
    expect(content).not.toContain("Riprova");
  });

  it("caso neutro: un solo testo, senza motivo", () => {
    const content = texts(render("unavailable"));

    expect(content.filter((value) => value === "Questa conversazione non è più disponibile.")).toHaveLength(1);
    expect(content).not.toContain("Il gruppo è stato eliminato");
    expect(content).not.toContain("Non fai più parte di questo gruppo");
  });

  it("nessun composer, nessuna timeline e nessuna bottom navigation sotto lo stato", () => {
    const tree = render("revoked");

    expect(tree.root.findAll((node) => node.props?.placeholder === "Scrivi un messaggio...")).toHaveLength(0);
    expect(tree.root.findAll((node) => node.props?.accessibilityLabel === "Invia messaggio")).toHaveLength(0);
    expect(tree.root.findAll((node) => node.props?.accessibilityRole === "tab")).toHaveLength(0);
  });

  it("la CTA primaria porta sempre all'Inbox Messaggi", () => {
    const tree = render("deleted");

    act(() => {
      byTestID(tree, "conversation-unavailable-primary").props.onPress();
    });

    expect(routerMocks.replace).toHaveBeenCalledWith("/(tabs)/messages");
  });

  it("il back torna indietro; senza storia porta ai Messaggi", () => {
    const tree = render("revoked");

    act(() => {
      byTestID(tree, "conversation-unavailable-back").props.onPress();
    });
    expect(routerMocks.back).toHaveBeenCalledTimes(1);

    routerMocks.canGoBack.mockReturnValue(false);
    act(() => {
      byTestID(tree, "conversation-unavailable-back").props.onPress();
    });
    expect(routerMocks.replace).toHaveBeenCalledWith("/(tabs)/messages");
  });
});
