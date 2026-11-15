import React from "react";
import { Share } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { colors } from "../../../theme/tokens";
import { ToastProvider } from "../../../ui";
import {
  countTestId,
  hostByTestId,
  makePostItem,
  textOf,
} from "../../feed/components/feed-test-helpers";
import type { InboxConversation } from "../../messaging/messaging-service";
import { buildShareTarget } from "../share-presentation";
import type { ShareDestinationPayload, ShareRecipient } from "../share-types";
import { ContentShareHost } from "./ContentShareHost";

const mocks = vi.hoisted(() => ({
  fetchInboxConversations: vi.fn(),
  fetchShareRecipients: vi.fn(),
  recordContentShareEvent: vi.fn(),
  sendContentShare: vi.fn(),
  setStringAsync: vi.fn(),
}));

vi.mock("expo-clipboard", () => ({ setStringAsync: mocks.setStringAsync }));

vi.mock("../../auth/use-session", () => ({
  useSession: () => ({ profile: { id: "me" } }),
}));

// Il modulo reale importa il client Supabase, che non si carica nell'ambiente di test.
vi.mock("../../messaging/messaging-service", () => ({
  fetchInboxConversations: mocks.fetchInboxConversations,
}));

vi.mock("../share-service", () => ({
  fetchShareRecipients: mocks.fetchShareRecipients,
  recordContentShareEvent: mocks.recordContentShareEvent,
  sendContentShare: mocks.sendContentShare,
}));

// Il debounce reale (e la catena del composer) non servono: il valore passa subito.
vi.mock("../../post-composer/use-mention-autocomplete", () => ({
  SEARCH_DEBOUNCE_MS: 0,
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock("../../dashboard/groups/groups-service", () => ({
  fetchGroupAvatarUrl: vi.fn().mockResolvedValue(null),
}));

const mounted: TestRenderer.ReactTestRenderer[] = [];

function conversation(overrides: Partial<InboxConversation> = {}): InboxConversation {
  return {
    archived: false,
    avatar_url: null,
    blocked_by_me: false,
    conversation_id: "c1",
    conversation_type: "direct",
    display_title: "Marco Bianchi",
    group_avatar_path: null,
    last_message_body: null,
    last_message_kind: null,
    last_message_sender_name: null,
    last_message_sender_profile_id: null,
    last_message_sent_at: null,
    other_profile_id: "p1",
    participant_count: 2,
    unread_count: 0,
    ...overrides,
  };
}

/** L'id del contenuto è un UUID, come in produzione: il link canonico rifiuta id brevi. */
const CONTENT_ID = "11111111-2222-4333-8444-555555555555";

function recipientRow(overrides: Partial<ShareRecipient>): ShareRecipient {
  return {
    available: true,
    avatarUrl: null,
    clubId: null,
    contextLabel: null,
    conversationId: null,
    displayName: "",
    groupAvatarPath: null,
    isVerified: false,
    key: "",
    kind: "direct",
    participantCount: null,
    profileId: null,
    role: null,
    ...overrides,
  };
}

/** Le righe come le restituisce il service (già mappate): direct, persona senza DIRECT, gruppo. */
const ROWS: ShareRecipient[] = [
  recipientRow({ conversationId: "c1", displayName: "Marco Bianchi", key: "conv:c1", kind: "direct" }),
  recipientRow({ displayName: "Luca Ferri", key: "profile:p2", kind: "person", profileId: "p2" }),
  recipientRow({
    conversationId: "g1",
    displayName: "Staff Prima Squadra",
    key: "conv:g1",
    kind: "group",
    participantCount: 8,
  }),
];

function okFor(destinations: ShareDestinationPayload[], failing: string[] = []) {
  const outcomes = destinations.map((destination) => {
    const failed = failing.some((key) => destination.delivery_key.endsWith(key));

    return {
      conversationId: failed ? null : "conv-x",
      deliveryKey: destination.delivery_key,
      messageId: failed ? null : "m1",
      ok: !failed,
      retryable: failed,
    };
  });
  const okCount = outcomes.filter((outcome) => outcome.ok).length;

  return {
    outcomes,
    status: okCount === outcomes.length ? "ok" : okCount === 0 ? "failed" : "partial",
  };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function mount() {
  const onClosed = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <ContentShareHost
            onClosed={onClosed}
            origin="HOME_PER_TE"
            target={buildShareTarget(
              makePostItem({}, { body: "Grande vittoria oggi!", postId: CONTENT_ID }),
            )}
          />
        </ToastProvider>
      </QueryClientProvider>,
    );
  });
  mounted.push(tree);
  await flush();

  return { onClosed, tree };
}

function modals(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.findAll((node) => (node.type as unknown) === "Modal");
}

/** I Modal del test non rispondono a `visible`: lo si legge dalle props. */
function sheetVisible(tree: TestRenderer.ReactTestRenderer) {
  return modals(tree)[0].props.visible as boolean;
}

function fullScreenVisible(tree: TestRenderer.ReactTestRenderer) {
  return modals(tree)[1].props.visible as boolean;
}

/** Su iOS il passaggio sheet ↔ modale completa all'`onDismiss` del Modal che si chiude. */
function dismiss(tree: TestRenderer.ReactTestRenderer, index: 0 | 1) {
  act(() => {
    modals(tree)[index].props.onDismiss();
  });
}

async function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = hostByTestId(tree, testID).find((node) => typeof node.props.onPress === "function");

  if (!target) {
    throw new Error(`Nessun elemento premibile con testID "${testID}"`);
  }

  await act(async () => {
    target.props.onPress();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchInboxConversations.mockResolvedValue([conversation()]);
  mocks.fetchShareRecipients.mockResolvedValue({ items: [], nextCursor: null });
  mocks.recordContentShareEvent.mockResolvedValue(undefined);
  mocks.setStringAsync.mockResolvedValue(true);
  mocks.sendContentShare.mockImplementation(async (input: { destinations: ShareDestinationPayload[] }) =>
    okFor(input.destinations),
  );
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.restoreAllMocks();
});

describe("ContentShareHost — pannello (§10–§12, §22, §34)", () => {
  it("apre il pannello con preview, «Invia su PROLINK», Recenti, Copia link e Condividi tramite…", async () => {
    const { tree } = await mount();
    const json = textOf(tree);

    expect(sheetVisible(tree)).toBe(true);
    expect(fullScreenVisible(tree)).toBe(false);
    expect(json).toContain("Grande vittoria oggi!");
    expect(json).toContain("Invia su PROLINK");
    expect(json).toContain("Marco Bianchi");
    expect(json).toContain("Altro");
    expect(json).toContain("Copia link");
    expect(json).toContain("Condividi tramite…");
  });

  it("non ricostruisce app esterne dentro PROLINK (§160)", async () => {
    const { tree } = await mount();
    const json = textOf(tree);

    for (const app of ["WhatsApp", "Instagram", "Facebook", "Telegram", "Messenger"]) {
      expect(json).not.toContain(app);
    }
  });

  it("il tap sul Condividi non invia né crea nulla: apre solo il pannello (§9)", async () => {
    await mount();

    expect(mocks.sendContentShare).not.toHaveBeenCalled();
    expect(mocks.recordContentShareEvent).not.toHaveBeenCalled();
  });

  it("senza Recenti: niente avatar segnaposto, la riga di ricerca e le altre azioni restano (§77–§79, §313)", async () => {
    mocks.fetchInboxConversations.mockResolvedValue([]);
    const { tree } = await mount();

    expect(countTestId(tree, "share-recents-search-entry")).toBe(1);
    expect(countTestId(tree, "share-recents-list")).toBe(0);
    expect(countTestId(tree, "share-copy-link")).toBe(1);
    expect(countTestId(tree, "share-external")).toBe(1);
  });

  it("i Recenti non bloccano Copia link né share esterno mentre caricano (§81, §314)", async () => {
    mocks.fetchInboxConversations.mockReturnValue(new Promise(() => undefined));
    const { tree } = await mount();

    expect(countTestId(tree, "share-recents-loading")).toBe(1);
    expect(countTestId(tree, "share-copy-link")).toBe(1);
    expect(countTestId(tree, "share-external")).toBe(1);
  });

  it("gli skeleton dei Recenti si distinguono dal fondo del foglio", async () => {
    mocks.fetchInboxConversations.mockReturnValue(new Promise(() => undefined));
    const { tree } = await mount();
    const backgroundOf = (style: unknown): unknown =>
      Array.isArray(style)
        ? style.map(backgroundOf).filter(Boolean).pop()
        : (style as { backgroundColor?: unknown } | null | undefined)?.backgroundColor;
    const blocks = hostByTestId(tree, "share-recents-loading")[0].findAll(
      (node) =>
        (node.type as unknown) === "View" &&
        backgroundOf(node.props.style) === colors.surfacePlaceholder,
    );

    // Un cerchio e una riga per ciascuno dei cinque segnaposto.
    expect(blocks).toHaveLength(10);
    expect(colors.surfacePlaceholder).not.toBe(colors.background);
  });

  it("esclude gruppi non attivi e chat bloccate dai Recenti", async () => {
    mocks.fetchInboxConversations.mockResolvedValue([
      conversation({ conversation_id: "c1" }),
      conversation({ conversation_id: "g9", conversation_type: "group", group_status: "archived" }),
      conversation({ blocked_by_me: true, conversation_id: "b9", display_title: "Bloccato" }),
    ]);
    const { tree } = await mount();

    expect(countTestId(tree, "share-recent-conv:c1")).toBe(1);
    expect(countTestId(tree, "share-recent-conv:g9")).toBe(0);
    expect(countTestId(tree, "share-recent-conv:b9")).toBe(0);
  });
});

describe("ContentShareHost — Recente → «Condividi» (§40–§42, §277)", () => {
  it("il tap su un Recente non invia: apre il passo con destinatario, messaggio e CTA", async () => {
    const { tree } = await mount();

    await press(tree, "share-recent-conv:c1");

    expect(mocks.sendContentShare).not.toHaveBeenCalled();
    expect(sheetVisible(tree)).toBe(false);

    dismiss(tree, 0);

    expect(fullScreenVisible(tree)).toBe(true);
    expect(countTestId(tree, "share-compose")).toBe(1);
    expect(textOf(tree)).toContain("Marco Bianchi");
    expect(countTestId(tree, "share-message-input")).toBe(1);
    expect(hostByTestId(tree, "share-cta")[0].props.accessibilityLabel).toBe("Invia");
    expect(mocks.sendContentShare).not.toHaveBeenCalled();
  });

  it("il messaggio è facoltativo: si invia anche senza testo (§88)", async () => {
    const { tree } = await mount();

    await press(tree, "share-recent-conv:c1");
    dismiss(tree, 0);
    await press(tree, "share-cta");

    expect(mocks.sendContentShare).toHaveBeenCalledTimes(1);
    expect(mocks.sendContentShare.mock.calls[0][0]).toMatchObject({
      contentId: CONTENT_ID,
      contentType: "club_media",
      text: "",
    });
  });

  it("successo singolo: chiude il flusso e dice «Inviato», senza aprire la chat (§130, §132)", async () => {
    const { onClosed, tree } = await mount();

    await press(tree, "share-recent-conv:c1");
    dismiss(tree, 0);
    await press(tree, "share-cta");

    const [call] = mocks.sendContentShare.mock.calls;
    expect(call[0].destinations).toEqual([
      expect.objectContaining({ conversation_id: "c1", kind: "conversation" }),
    ]);
    expect(sheetVisible(tree)).toBe(false);
    expect(fullScreenVisible(tree)).toBe(false);
    expect(onClosed).toHaveBeenCalled();
    expect(textOf(tree)).toContain("Inviato");
    // §246: toast neutro con la sola icona di successo verde, non un fondo verde.
    const successIcons = tree.root.findAll(
      (node) =>
        (node.type as unknown) === "Ionicons" &&
        node.props.name === "checkmark-circle" &&
        node.props.color === colors.success,
    );
    expect(successIcons.length).toBeGreaterThan(0);
  });

  it("doppio tap sulla CTA: un solo invio (§126, §298)", async () => {
    let resolveSend: (value: unknown) => void = () => undefined;
    mocks.sendContentShare.mockImplementation(
      () => new Promise((resolve) => (resolveSend = resolve)),
    );
    const { tree } = await mount();

    await press(tree, "share-recent-conv:c1");
    dismiss(tree, 0);
    await act(async () => {
      const cta = hostByTestId(tree, "share-cta").find((node) => typeof node.props.onPress === "function");
      cta?.props.onPress();
      cta?.props.onPress();
    });

    expect(mocks.sendContentShare).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSend({ outcomes: [], status: "failed" });
    });
  });

  it("errore totale: resta nel passo con «Invio non riuscito» e «Riprova», dati preservati (§135–§137)", async () => {
    mocks.sendContentShare.mockRejectedValue(new Error("boom-errore-tecnico"));
    const { tree } = await mount();

    await press(tree, "share-recent-conv:c1");
    dismiss(tree, 0);
    await press(tree, "share-cta");

    expect(fullScreenVisible(tree)).toBe(true);
    expect(countTestId(tree, "share-banner-failed")).toBe(1);
    expect(textOf(tree)).toContain("Invio non riuscito");
    expect(textOf(tree)).toContain("Riprova");
    expect(textOf(tree)).not.toContain("boom-errore-tecnico");
    expect(textOf(tree)).toContain("Marco Bianchi");
  });

  it("timeout → indietro → riselezione: stesso batch e stessa delivery_key, nessun duplicato", async () => {
    mocks.sendContentShare.mockRejectedValueOnce(new Error("timeout"));
    const { tree } = await mount();

    await press(tree, "share-recent-conv:c1");
    dismiss(tree, 0);
    await press(tree, "share-cta");
    await press(tree, "share-step-leading");
    dismiss(tree, 1);
    await press(tree, "share-recent-conv:c1");
    dismiss(tree, 0);
    await press(tree, "share-cta");

    expect(mocks.sendContentShare).toHaveBeenCalledTimes(2);

    const [first, second] = mocks.sendContentShare.mock.calls.map((call) => call[0]);

    expect(second.batchId).toBe(first.batchId);
    expect(second.destinations[0].delivery_key).toBe(first.destinations[0].delivery_key);
  });

  it("dopo un esito ambiguo il testo si blocca; dopo un input rifiutato (22023) no", async () => {
    mocks.sendContentShare.mockRejectedValueOnce(new Error("timeout"));
    const ambiguous = await mount();

    await press(ambiguous.tree, "share-recent-conv:c1");
    dismiss(ambiguous.tree, 0);
    await press(ambiguous.tree, "share-cta");

    expect(hostByTestId(ambiguous.tree, "share-message-input")[0].props.editable).toBe(false);

    mocks.sendContentShare.mockRejectedValueOnce({ code: "22023", message: "bad input" });
    const malformed = await mount();

    await press(malformed.tree, "share-recent-conv:c1");
    dismiss(malformed.tree, 0);
    await press(malformed.tree, "share-cta");

    expect(hostByTestId(malformed.tree, "share-message-input")[0].props.editable).toBe(true);
    expect(countTestId(malformed.tree, "share-banner-failed")).toBe(1);
    expect(hostByTestId(malformed.tree, "share-cta")[0].props.accessibilityLabel).toBe("Chiudi");
    expect(textOf(malformed.tree)).not.toContain("bad input");
  });

  it("un errore non ritentabile non mostra un «Riprova» inutile (§216)", async () => {
    mocks.sendContentShare.mockImplementation(async (input: { destinations: ShareDestinationPayload[] }) => ({
      outcomes: input.destinations.map((d) => ({
        conversationId: null,
        deliveryKey: d.delivery_key,
        messageId: null,
        ok: false,
        retryable: false,
      })),
      status: "failed",
    }));
    const { tree } = await mount();

    await press(tree, "share-recent-conv:c1");
    dismiss(tree, 0);
    await press(tree, "share-cta");

    expect(countTestId(tree, "share-banner-failed")).toBe(1);
    // Niente «Riprova» inutile, ma un'uscita sì.
    expect(hostByTestId(tree, "share-cta")[0].props.accessibilityLabel).toBe("Chiudi");
    expect(textOf(tree)).not.toContain("Riprova");

    await press(tree, "share-cta");

    expect(fullScreenVisible(tree)).toBe(false);
  });

  it("contenuto non disponibile: «Contenuto non disponibile» e nessun invio riuscito (§212–§213)", async () => {
    mocks.sendContentShare.mockResolvedValue({ outcomes: [], status: "content_unavailable" });
    const { tree } = await mount();

    await press(tree, "share-recent-conv:c1");
    dismiss(tree, 0);
    await press(tree, "share-cta");

    expect(countTestId(tree, "share-banner-unavailable")).toBe(1);
    expect(textOf(tree)).toContain("Contenuto non disponibile");
    expect(fullScreenVisible(tree)).toBe(true);
  });
});

describe("ContentShareHost — Altro → «Invia a» → multi-send (§43–§74, §125–§143)", () => {
  async function openPickerWithThreeSelected() {
    mocks.fetchShareRecipients.mockResolvedValue({ items: ROWS, nextCursor: null });
    const mountResult = await mount();
    const { tree } = mountResult;

    await press(tree, "share-recents-more");
    dismiss(tree, 0);
    await flush();
    await press(tree, "share-recipient-conv:c1");
    await press(tree, "share-recipient-profile:p2");
    await press(tree, "share-recipient-conv:g1");

    return mountResult;
  }

  it("«Avanti» è disabilitato a zero e diventa «Avanti (N)»", async () => {
    mocks.fetchShareRecipients.mockResolvedValue({ items: ROWS, nextCursor: null });
    const { tree } = await mount();

    await press(tree, "share-recents-more");
    dismiss(tree, 0);
    await flush();

    expect(hostByTestId(tree, "share-next")[0].props.disabled).toBe(true);

    await press(tree, "share-recipient-conv:c1");
    expect(hostByTestId(tree, "share-next")[0].props.accessibilityLabel).toBe("Avanti (1)");

    await press(tree, "share-recipient-profile:p2");
    await press(tree, "share-recipient-conv:g1");
    expect(hostByTestId(tree, "share-next")[0].props.accessibilityLabel).toBe("Avanti (3)");
  });

  it("nella lista nessuna tab e nessun chip dei destinatari scelti (§46, §68)", async () => {
    const { tree } = await openPickerWithThreeSelected();

    expect(countTestId(tree, "share-picker")).toBe(1);
    expect(textOf(tree)).not.toContain("Persone");
    expect(textOf(tree)).not.toContain("Gruppi");
  });

  it("il passo «Condividi» sintetizza «3 conversazioni selezionate» e spiega l'invio separato (§85–§86)", async () => {
    const { tree } = await openPickerWithThreeSelected();

    await press(tree, "share-next");

    expect(countTestId(tree, "share-compose")).toBe(1);
    expect(textOf(tree)).toContain("3 conversazioni selezionate");
    expect(countTestId(tree, "share-multi-helper")).toBe(1);
    expect(hostByTestId(tree, "share-cta")[0].props.accessibilityLabel).toBe("Invia a 3 conversazioni");
    expect(textOf(tree)).toContain("Invia a 3");
  });

  it("un multi-send è un solo batch: una chiamata, tre destinazioni separate, nessun gruppo (§70–§71, §195)", async () => {
    const { tree } = await openPickerWithThreeSelected();

    await press(tree, "share-next");
    await press(tree, "share-cta");

    expect(mocks.sendContentShare).toHaveBeenCalledTimes(1);

    const [input] = mocks.sendContentShare.mock.calls[0];
    expect(input.destinations.map((d: ShareDestinationPayload) => d.kind)).toEqual([
      "conversation",
      "profile",
      "conversation",
    ]);
    expect(new Set(input.destinations.map((d: ShareDestinationPayload) => d.delivery_key)).size).toBe(3);
    expect(textOf(tree)).toContain("Inviato a 3 conversazioni");
  });

  it("successo parziale: «Inviato a 2 di 3», «1 invio non riuscito» e «Riprova 1 invio» (§139)", async () => {
    mocks.sendContentShare.mockImplementation(async (input: { destinations: ShareDestinationPayload[] }) =>
      okFor(input.destinations, [":conv:g1"]),
    );
    const { tree } = await openPickerWithThreeSelected();

    await press(tree, "share-next");
    await press(tree, "share-cta");

    const json = textOf(tree);
    expect(fullScreenVisible(tree)).toBe(true);
    expect(json).toContain("Inviato a 2 di 3 conversazioni");
    expect(json).toContain("1 invio non riuscito");
    expect(json).toContain("Riprova 1 invio");
    expect(countTestId(tree, "share-outcomes")).toBe(1);
  });

  it("il retry rimanda solo i falliti con lo stesso batch e le stesse chiavi (§141–§142, §200)", async () => {
    mocks.sendContentShare
      .mockImplementationOnce(async (input: { destinations: ShareDestinationPayload[] }) =>
        okFor(input.destinations, [":conv:g1"]),
      )
      .mockImplementationOnce(async (input: { destinations: ShareDestinationPayload[] }) =>
        okFor(input.destinations),
      );
    const { tree } = await openPickerWithThreeSelected();

    await press(tree, "share-next");
    await press(tree, "share-cta");
    await press(tree, "share-cta");

    expect(mocks.sendContentShare).toHaveBeenCalledTimes(2);

    const [first, second] = mocks.sendContentShare.mock.calls.map((call) => call[0]);
    const failedKey = first.destinations.find((d: ShareDestinationPayload) =>
      d.delivery_key.endsWith(":conv:g1"),
    ).delivery_key;

    expect(second.batchId).toBe(first.batchId);
    expect(second.destinations).toHaveLength(1);
    expect(second.destinations[0].delivery_key).toBe(failedKey);
    expect(textOf(tree)).toContain("Inviato a 3 conversazioni");
    expect(fullScreenVisible(tree)).toBe(false);
  });

  it("dopo un invio parziale il testo si blocca e il passo si chiude, non si ricomincia", async () => {
    mocks.sendContentShare.mockImplementation(async (input: { destinations: ShareDestinationPayload[] }) =>
      okFor(input.destinations, [":conv:g1"]),
    );
    const { tree } = await openPickerWithThreeSelected();

    await press(tree, "share-next");
    await press(tree, "share-cta");

    expect(hostByTestId(tree, "share-message-input")[0].props.editable).toBe(false);
    expect(hostByTestId(tree, "share-step-leading")[0].props.accessibilityLabel).toBe("Chiudi");

    await press(tree, "share-step-leading");

    expect(fullScreenVisible(tree)).toBe(false);
  });

  it("un retry su contenuto sparito: «Contenuto non disponibile» e i successi restano elencati", async () => {
    mocks.sendContentShare
      .mockImplementationOnce(async (input: { destinations: ShareDestinationPayload[] }) =>
        okFor(input.destinations, [":conv:g1"]),
      )
      .mockResolvedValueOnce({ outcomes: [], status: "content_unavailable" });
    const { tree } = await openPickerWithThreeSelected();

    await press(tree, "share-next");
    await press(tree, "share-cta");
    await press(tree, "share-cta");

    expect(countTestId(tree, "share-banner-unavailable")).toBe(1);
    expect(countTestId(tree, "share-outcomes")).toBe(1);
    expect(textOf(tree)).toContain("Marco Bianchi, inviato");
    expect(hostByTestId(tree, "share-step-leading")[0].props.accessibilityLabel).toBe("Chiudi");
  });

  it("persona P e Società di cui P è titolare: una consegna, CTA «Invia», toast «Inviato» (dedup)", async () => {
    mocks.fetchShareRecipients.mockResolvedValue({
      items: [
        recipientRow({ displayName: "Luca Ferri", key: "profile:p2", kind: "person", profileId: "p2" }),
        recipientRow({
          clubId: "club-1",
          contextLabel: "Serie D",
          displayName: "AC Como",
          key: "club:club-1",
          kind: "club",
          profileId: "p2",
        }),
      ],
      nextCursor: null,
    });
    const { tree } = await mount();

    await press(tree, "share-recents-more");
    dismiss(tree, 0);
    await flush();
    await press(tree, "share-recipient-profile:p2");
    await press(tree, "share-recipient-club:club-1");
    await press(tree, "share-next");

    expect(hostByTestId(tree, "share-cta")[0].props.accessibilityLabel).toBe("Invia");
    expect(textOf(tree)).not.toContain("conversazioni selezionate");
    expect(countTestId(tree, "share-multi-helper")).toBe(0);

    await press(tree, "share-cta");

    const [input] = mocks.sendContentShare.mock.calls[0];
    expect(input.destinations).toHaveLength(1);
    expect(input.destinations[0]).toMatchObject({ kind: "profile", profile_id: "p2" });
    expect(textOf(tree)).toContain("Inviato");
    expect(textOf(tree)).not.toContain("Inviato a 2");
  });

  it("il testo scritto viaggia nella RPC e il campo è limitato a 500 (§87–§90)", async () => {
    const { tree } = await openPickerWithThreeSelected();

    await press(tree, "share-next");

    const input = hostByTestId(tree, "share-message-input")[0];
    expect(input.props.maxLength).toBe(500);

    act(() => {
      input.props.onChangeText("Guarda questo giocatore");
    });
    await press(tree, "share-cta");

    expect(mocks.sendContentShare.mock.calls[0][0].text).toBe("Guarda questo giocatore");
  });
});

describe("ContentShareHost — Copia link e Condividi tramite… (§144–§173)", () => {
  it("Copia link copia l'URL canonico, mostra «Link copiato» e registra l'evento dedicato", async () => {
    const { tree } = await mount();

    await press(tree, "share-copy-link");

    expect(mocks.setStringAsync).toHaveBeenCalledTimes(1);
    const url = mocks.setStringAsync.mock.calls[0][0] as string;
    expect(url).toContain(`/content/club_media/${CONTENT_ID}`);
    expect(url).not.toMatch(/supabase|storage|cdn|signed/i);
    expect(textOf(tree)).toContain("Link copiato");
    expect(mocks.recordContentShareEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        contentId: CONTENT_ID,
        contentType: "club_media",
        kind: "copy_link",
      }),
    );
    expect(mocks.sendContentShare).not.toHaveBeenCalled();
    expect(sheetVisible(tree)).toBe(false);
  });

  it("se la copia fallisce non dichiara «Link copiato» né registra l'evento", async () => {
    mocks.setStringAsync.mockRejectedValue(new Error("no"));
    const { tree } = await mount();

    await press(tree, "share-copy-link");

    expect(textOf(tree)).not.toContain("Link copiato");
    expect(mocks.recordContentShareEvent).not.toHaveBeenCalled();
  });

  it("Condividi tramite… apre la share sheet di sistema con testo breve e URL, e registra solo l'apertura", async () => {
    const shareSpy = vi.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    const { tree } = await mount();

    await press(tree, "share-external");
    await act(async () => {
      dismiss(tree, 0);
    });

    expect(shareSpy).toHaveBeenCalledTimes(1);
    const payload = shareSpy.mock.calls[0][0] as { message: string };
    expect(payload.message).toContain("Como 1907 su PROLINK");
    expect(payload.message).toContain(`/content/club_media/${CONTENT_ID}`);
    expect(payload.message).not.toContain("cdn.test");
    expect(mocks.recordContentShareEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "external_sheet_open" }),
    );
    // Mai un «completato»: la sheet non dice se l'utente abbia davvero condiviso (§203).
    expect(mocks.recordContentShareEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "external_share_completed" }),
    );
    expect(mocks.sendContentShare).not.toHaveBeenCalled();
  });
});
