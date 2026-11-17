/**
 * Sheet «Notifiche» sui componenti reali (DAS-REV-34 §9; PNG 02): cinque
 * opzioni esatte, una selezione, il tap applica senza «Salva», chiusura al
 * successo, errore senza chiusura forzata.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationNotificationsSheet } from "./ConversationNotificationsSheet";
import type { ConversationNotificationState, MuteChoice } from "./mute-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const service = vi.hoisted(() => ({
  fetchConversationNotificationState: vi.fn(),
  setConversationMute: vi.fn(),
}));

vi.mock("./mute-service", () => service);

const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../../ui/Toast/ToastProvider", () => ({ useToast: () => toast }));

const stateFor = (choice: MuteChoice, stateVersion: number): ConversationNotificationState => ({
  canChange: true,
  conversationId: "c1",
  conversationType: "direct",
  isMuted: choice !== "active",
  muteOption: choice === "active" ? null : choice,
  mutedUntil: null,
  periodId: null,
  stateVersion,
});

const mounted: TestRenderer.ReactTestRenderer[] = [];

async function flush() {
  for (let turn = 0; turn < 4; turn += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function renderSheet(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={queryClient}>
        <ConversationNotificationsSheet
          conversationId="c1"
          conversationType="direct"
          onClose={onClose}
          periodId={null}
          profileId="me-1"
          visible
        />
      </QueryClientProvider>,
    );
  });
  mounted.push(tree);
  await flush();

  return { onClose, tree };
}

const radios = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findAll((node) => typeof node.type === "string" && node.props?.accessibilityRole === "radio");

const texts = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll((node) => String(node.type) === "Text", { deep: true })
    .map((node) => node.children.filter((child): child is string => typeof child === "string").join(""))
    .filter((value) => value.length > 0);

const checkedValues = (tree: TestRenderer.ReactTestRenderer) =>
  radios(tree)
    .filter((node) => node.props.accessibilityState?.checked === true)
    .map((node) => node.props.testID);

beforeEach(() => {
  service.fetchConversationNotificationState.mockResolvedValue(stateFor("active", 1));
  service.setConversationMute.mockImplementation(({ choice }: { choice: MuteChoice }) =>
    Promise.resolve(stateFor(choice, 2)),
  );
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

describe("ConversationNotificationsSheet", () => {
  it("mostra titolo, cinque opzioni esatte, helper e nessun pulsante Salva", async () => {
    const { tree } = await renderSheet();
    const content = texts(tree);

    expect(content).toEqual(
      expect.arrayContaining([
        "Notifiche",
        "Attive",
        "Silenzia per 1 ora",
        "Silenzia per 8 ore",
        "Silenzia per 1 settimana",
        "Silenzia finché non le riattivi",
        "I messaggi continueranno ad arrivare.",
      ]),
    );
    expect(radios(tree).map((node) => node.props.testID)).toEqual([
      "mute-option-active",
      "mute-option-1h",
      "mute-option-8h",
      "mute-option-1w",
      "mute-option-indefinite",
    ]);
    expect(content).not.toContain("Salva");
  });

  it("una sola selezione, quella confermata dal server", async () => {
    service.fetchConversationNotificationState.mockResolvedValue(stateFor("8h", 4));
    const { tree } = await renderSheet();

    expect(checkedValues(tree)).toEqual(["mute-option-8h"]);
  });

  it("il tap applica la scelta e chiude lo sheet al successo, senza un secondo comando", async () => {
    const { onClose, tree } = await renderSheet();

    await act(async () => {
      radios(tree).find((node) => node.props.testID === "mute-option-8h")?.props.onPress();
    });
    await flush();

    expect(service.setConversationMute).toHaveBeenCalledTimes(1);
    expect(service.setConversationMute.mock.calls[0][0]).toMatchObject({
      choice: "8h",
      conversationId: "c1",
      periodId: null,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(checkedValues(tree)).toEqual(["mute-option-8h"]);
  });

  it("in errore resta aperto con il messaggio e lo stato confermato; il retry è un nuovo tap", async () => {
    const { onClose, tree } = await renderSheet();

    service.setConversationMute.mockRejectedValueOnce({ message: "NOT_MEMBER" });
    await act(async () => {
      radios(tree).find((node) => node.props.testID === "mute-option-1w")?.props.onPress();
    });
    await flush();

    expect(onClose).not.toHaveBeenCalled();
    expect(texts(tree)).toContain("Non è stato possibile aggiornare le notifiche. Riprova.");
    expect(checkedValues(tree)).toEqual(["mute-option-active"]);

    await act(async () => {
      radios(tree).find((node) => node.props.testID === "mute-option-1w")?.props.onPress();
    });
    await flush();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(texts(tree)).not.toContain("Non è stato possibile aggiornare le notifiche. Riprova.");
  });
});
