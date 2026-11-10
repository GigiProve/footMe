import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ConversationMessage,
  DirectConversationMeta,
  GroupConversationMeta,
} from "../messaging-service";

const backMock = vi.fn();
const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock("expo-router", () => ({
  /*
    Il guard delle modifiche non salvate si aggancia a "beforeRemove" del
    navigatore: senza questo stub le schermate di modifica non montano.
  */
  useNavigation: () => ({
    addListener: () => () => {},
    dispatch: () => {},
  }),
  useRouter: () => ({
    back: backMock,
    canGoBack: () => true,
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock("expo-clipboard", () => ({
  setStringAsync: vi.fn(),
}));

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
}));

vi.mock("expo-document-picker", () => ({
  getDocumentAsync: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("../../auth/use-session", () => ({
  useSession: sessionMocks.useSession,
}));

// GroupAvatar (header) pulls the signed-URL helper from groups-service, whose
// import chain reaches the supabase client.
vi.mock("../../dashboard/groups/groups-service", () => ({
  fetchGroupAvatarUrl: vi.fn().mockResolvedValue(null),
}));

const serviceMocks = vi.hoisted(() => ({
  blockUser: vi.fn(),
  fetchConversationType: vi.fn(),
  fetchDirectConversationMeta: vi.fn(),
  fetchGroupConversationMeta: vi.fn(),
  getConversationMessages: vi.fn(),
  getShareablePhoneContact: vi.fn(),
  markConversationRead: vi.fn(),
  reportConversation: vi.fn(),
  sendContactCardMessage: vi.fn(),
  sendMessage: vi.fn(),
  setConversationArchived: vi.fn(),
  subscribeToConversation: vi.fn(),
  subscribeToMyGroupPeriods: vi.fn(),
  unblockUser: vi.fn(),
  unsubscribeFromConversation: vi.fn(),
}));

// No importOriginal: the real module imports the supabase client, which
// crashes in the vitest environment (react-native-url-polyfill BlobModule).
vi.mock("../messaging-service", () => {
  return {
    getChatMediaSignedUrl: vi.fn(),
    blockUser: serviceMocks.blockUser,
    fetchConversationType: serviceMocks.fetchConversationType,
    fetchDirectConversationMeta: serviceMocks.fetchDirectConversationMeta,
    fetchGroupConversationMeta: serviceMocks.fetchGroupConversationMeta,
    getConversationMessages: serviceMocks.getConversationMessages,
    getShareablePhoneContact: serviceMocks.getShareablePhoneContact,
    markConversationRead: serviceMocks.markConversationRead,
    reportConversation: serviceMocks.reportConversation,
    sendContactCardMessage: serviceMocks.sendContactCardMessage,
    sendMessage: serviceMocks.sendMessage,
    setConversationArchived: serviceMocks.setConversationArchived,
    subscribeToConversation: serviceMocks.subscribeToConversation,
    subscribeToMyGroupPeriods: serviceMocks.subscribeToMyGroupPeriods,
    unblockUser: serviceMocks.unblockUser,
    unsubscribeFromConversation: serviceMocks.unsubscribeFromConversation,
  };
});

vi.mock("../chat-media-service", () => ({
  sendMediaMessage: vi.fn(),
  uploadChatMedia: vi.fn(),
}));

vi.mock("../use-chat-media-url", () => ({
  useChatMediaUrl: () => ({ data: null, isLoading: false }),
}));

let ChatScreen: typeof import("./ChatScreen").ChatScreen;
let ToastProvider: typeof import("../../../ui").ToastProvider;
let AppText: typeof import("../../../ui").AppText;

/* Gli alberi dei test precedenti vanno smontati: le loro query pendenti
   altrimenti chiamano i mock durante il test successivo. */
const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
});

beforeEach(async () => {
  vi.clearAllMocks();

  serviceMocks.subscribeToConversation.mockReturnValue({});
  serviceMocks.subscribeToMyGroupPeriods.mockReturnValue({});
  serviceMocks.unsubscribeFromConversation.mockResolvedValue(undefined);
  serviceMocks.markConversationRead.mockResolvedValue(undefined);
  serviceMocks.getConversationMessages.mockResolvedValue([]);
  serviceMocks.fetchDirectConversationMeta.mockResolvedValue(null);
  serviceMocks.fetchConversationType.mockResolvedValue("direct");
  serviceMocks.sendMessage.mockResolvedValue(undefined);

  sessionMocks.useSession.mockReturnValue({
    isLoading: false,
    needsOnboarding: false,
    profile: {
      avatar_url: null,
      city: null,
      club_id: null,
      club_name: null,
      full_name: "Mario Rossi",
      id: "me-1",
      is_admin: false,
      region: null,
      role: "player",
    },
    refreshProfile: vi.fn(),
    session: { user: { id: "me-1" } } as never,
  });

  const chatScreenModule = await import("./ChatScreen");
  ChatScreen = chatScreenModule.ChatScreen;

  const uiModule = await import("../../../ui");
  ToastProvider = uiModule.ToastProvider;
  AppText = uiModule.AppText;
});

function buildMeta(overrides: Partial<DirectConversationMeta> = {}): DirectConversationMeta {
  return {
    ad_id: null,
    ad_title: null,
    application_id: null,
    application_status: null,
    applicant_full_name: null,
    archived: false,
    blocked_by_me: false,
    club_category: null,
    club_id: null,
    club_name: null,
    i_have_sent: true,
    mutual_follow: true,
    other_avatar_url: null,
    other_full_name: "Luca Bianchi",
    other_has_sent: true,
    other_primary_position: "forward",
    other_profile_id: "other-1",
    other_role: "player",
    representation_active: false,
    representation_type: null,
    roster_linked: false,
    shortlisted: false,
    ...overrides,
  };
}

function buildMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    body: "Ciao!",
    media_url: null,
    message_id: "msg-1",
    message_kind: "text",
    read_at: null,
    sender_full_name: "Luca Bianchi",
    sender_profile_id: "other-1",
    sent_at: "2026-07-01T10:00:00.000Z",
    shared_contact_name: null,
    shared_contact_phone: null,
    ...overrides,
  };
}

const groupMeta: GroupConversationMeta = {
  avatarPath: null,
  avatarUrl: null,
  canSend: true,
  clubName: "AC Como",
  groupVersion: 3,
  myRole: "admin",
  peopleCount: 4,
  periodId: "period-1",
  periodVersion: 1,
  status: "active",
  title: "Staff Primavera",
};

const archivedGroupMeta: GroupConversationMeta = {
  ...groupMeta,
  canSend: false,
  status: "archived",
};

let lastQueryClient: QueryClient | null = null;

async function renderScreen(seed?: {
  groupMeta?: GroupConversationMeta;
  messages?: ConversationMessage[];
  meta?: DirectConversationMeta;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  lastQueryClient = queryClient;

  // Seed the cache so data-driven UI renders synchronously: async query
  // commits are not flushed reliably by act() in this environment.
  queryClient.setQueryData(["conversation-messages", "conv-1"], seed?.messages ?? []);
  // The seeded query is stale (staleTime 0), so the mount refetch always runs;
  // whether its result lands before the assertions is a timer race. Make the
  // server answer with the same messages so the outcome never depends on it.
  if (seed?.messages) {
    serviceMocks.getConversationMessages.mockResolvedValue(seed.messages);
  }
  if (seed?.meta) {
    queryClient.setQueryData(["conversation-meta", "conv-1"], seed.meta);
  }
  if (seed?.groupMeta) {
    queryClient.setQueryData(["conversation-type", "conv-1"], "group");
    queryClient.setQueryData(["group-conversation-meta", "conv-1"], seed.groupMeta);
  }

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ChatScreen conversationId="conv-1" initialName="Luca Bianchi" />
        </ToastProvider>
      </QueryClientProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  mounted.push(tree);
  return tree;
}

describe("ChatScreen", () => {
  it("renders the mutual-follow relationship note when the meta says so", async () => {
    serviceMocks.fetchDirectConversationMeta.mockResolvedValue(buildMeta());
    serviceMocks.getConversationMessages.mockResolvedValue([buildMessage()]);

    const tree = await renderScreen({ messages: [buildMessage()], meta: buildMeta() });

    const texts = tree.root
      .findAllByType(AppText)
      .map((node) => node.props.children)
      .flat();

    expect(texts).toContain("Vi seguite reciprocamente");
  });

  it("renders the group header, the ready state and no direct-only UI", async () => {
    serviceMocks.fetchConversationType.mockResolvedValue("group");
    serviceMocks.fetchGroupConversationMeta.mockResolvedValue(groupMeta);

    const tree = await renderScreen({ groupMeta, messages: [] });

    const texts = tree.root
      .findAllByType(AppText)
      .map((node) => node.props.children)
      .flat();

    expect(texts).toContain("AC Como · 4 persone");
    expect(texts).toContain("Staff Primavera è pronto");
    expect(texts).toContain("Ora puoi iniziare a scrivere al gruppo.");
    expect(tree.root.findAllByProps({ accessibilityLabel: "Apri profilo" })).toHaveLength(0);
    expect(serviceMocks.fetchDirectConversationMeta).not.toHaveBeenCalled();
  });

  it("shows the sender name above other people's group messages", async () => {
    serviceMocks.fetchConversationType.mockResolvedValue("group");
    serviceMocks.fetchGroupConversationMeta.mockResolvedValue(groupMeta);

    const tree = await renderScreen({
      groupMeta,
      messages: [buildMessage({ sender_full_name: "Mister Bianchi" })],
    });

    const texts = tree.root
      .findAllByType(AppText)
      .map((node) => node.props.children)
      .flat();

    expect(texts).toContain("Mister Bianchi");
    expect(texts).not.toContain("Staff Primavera è pronto");
  });

  it("calls sendMessage with the drafted body when the composer sends", async () => {
    serviceMocks.fetchDirectConversationMeta.mockResolvedValue(buildMeta());
    serviceMocks.getConversationMessages.mockResolvedValue([]);

    const tree = await renderScreen();

    const input = tree.root.findByProps({ placeholder: "Scrivi un messaggio..." });

    await act(async () => {
      input.props.onChangeText("Ciao a te");
      await Promise.resolve();
    });

    const sendButton = tree.root.findByProps({ accessibilityLabel: "Invia messaggio" });

    await act(async () => {
      sendButton.props.onPress();
      await Promise.resolve();
    });

    expect(serviceMocks.sendMessage).toHaveBeenCalledWith({
      body: "Ciao a te",
      conversationId: "conv-1",
      senderProfileId: "me-1",
    });
  });

  describe("DAS-REV-33 group lifecycle", () => {
    function textsOf(tree: TestRenderer.ReactTestRenderer) {
      return tree.root
        .findAllByType(AppText)
        .map((node) => node.props.children)
        .flat();
    }

    /*
      Query commits and the revocation flow settle on timers (react-query
      notifies on setTimeout, revoke awaits cancelQueries). Under parallel load
      a fixed flush is a race, so the positive expectations are polled: the
      expectation is retried until it holds or the deadline passes, and the
      last failure is rethrown unchanged.
    */
    async function waitUntil(expectation: () => void, timeoutMs = 1000) {
      const deadline = Date.now() + timeoutMs;

      for (;;) {
        try {
          expectation();
          return;
        } catch (error) {
          if (Date.now() >= deadline) {
            throw error;
          }
        }

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
      }
    }

    /** For negative expectations only: give pending work a few timer turns to (wrongly) happen. */
    async function settle(turns = 5) {
      for (let turn = 0; turn < turns; turn += 1) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
      }
    }

    beforeEach(() => {
      serviceMocks.fetchConversationType.mockResolvedValue("group");
    });

    it("renders system events as centered metadata, never as a bubble with an author", async () => {
      serviceMocks.fetchGroupConversationMeta.mockResolvedValue(groupMeta);

      const tree = await renderScreen({
        groupMeta,
        messages: [
          buildMessage({
            body: "",
            message_id: "evt-1",
            message_kind: "system_event",
            sender_full_name: null,
            sender_profile_id: null,
            system_event_type: "GROUP_MEMBERS_ADDED",
            system_payload: { count: 3 },
          }),
          buildMessage({
            message_id: "evt-2",
            message_kind: "system_event",
            sender_full_name: null,
            sender_profile_id: null,
            system_event_type: "FUTURE_EVENT",
          }),
        ],
      });

      await waitUntil(() => {
        const texts = textsOf(tree);

        expect(texts).toContain("3 persone sono state aggiunte al gruppo.");
        expect(texts).toContain("Il gruppo è stato aggiornato.");
      });
    });

    it("replaces the composer with the archived line and labels the header", async () => {
      serviceMocks.fetchGroupConversationMeta.mockResolvedValue(archivedGroupMeta);

      const tree = await renderScreen({
        groupMeta: archivedGroupMeta,
        messages: [buildMessage()],
      });

      await waitUntil(() => {
        const texts = textsOf(tree);

        expect(texts).toContain("Archiviato");
        expect(texts).toContain("Questo gruppo è archiviato.");
      });
      expect(tree.root.findAllByProps({ placeholder: "Scrivi un messaggio..." })).toHaveLength(0);
      expect(tree.root.findAllByProps({ accessibilityLabel: "Invia messaggio" })).toHaveLength(0);
      expect(tree.root.findAllByProps({ accessibilityLabel: "Allega file" })).toHaveLength(0);
    });

    it("shows the archived state when a stale send is rejected as archived", async () => {
      // The mount refetch still sees an active group; only the refetch that the
      // rejected send triggers sees the archived one.
      serviceMocks.fetchGroupConversationMeta
        .mockResolvedValueOnce(groupMeta)
        .mockResolvedValue(archivedGroupMeta);
      serviceMocks.sendMessage.mockRejectedValue({ message: "SOCIETY_GROUP_ARCHIVED" });

      const tree = await renderScreen({ groupMeta, messages: [buildMessage()] });

      await act(async () => {
        tree.root.findByProps({ placeholder: "Scrivi un messaggio..." }).props.onChangeText("Ciao");
        await Promise.resolve();
      });
      await act(async () => {
        tree.root.findByProps({ accessibilityLabel: "Invia messaggio" }).props.onPress();
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitUntil(() => {
        expect(textsOf(tree)).toContain("Questo gruppo è archiviato.");
        expect(tree.root.findAllByProps({ accessibilityLabel: "Invia messaggio" })).toHaveLength(0);
      });
      expect(serviceMocks.sendMessage).toHaveBeenCalledTimes(1);
      expect(serviceMocks.fetchGroupConversationMeta.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("clears the cache, goes back and warns when my active period ends", async () => {
      serviceMocks.fetchGroupConversationMeta.mockResolvedValue(groupMeta);

      const tree = await renderScreen({ groupMeta, messages: [buildMessage()] });
      const onPeriodChange = serviceMocks.subscribeToMyGroupPeriods.mock.calls[0][2] as (
        record: unknown,
      ) => void;

      await act(async () => {
        onPeriodChange({
          conversation_id: "conv-1",
          ended_at: "2026-11-10T10:00:00Z",
          id: "period-1",
          profile_id: "me-1",
          revoked_kind: "ended",
        });
      });

      await waitUntil(() => {
        expect(backMock).toHaveBeenCalledTimes(1);
        expect(textsOf(tree)).toContain("Non fai più parte di questo gruppo.");
      });
      await settle();
      expect(backMock).toHaveBeenCalledTimes(1);
      expect(lastQueryClient?.getQueryData(["conversation-messages", "conv-1"])).toBeUndefined();
      expect(lastQueryClient?.getQueryData(["group-conversation-meta", "conv-1"])).toBeUndefined();
    });

    it("ignores the end of an older period and uses the deleted copy for revoked_kind = deleted", async () => {
      serviceMocks.fetchGroupConversationMeta.mockResolvedValue(groupMeta);

      const tree = await renderScreen({ groupMeta, messages: [buildMessage()] });
      const onPeriodChange = serviceMocks.subscribeToMyGroupPeriods.mock.calls[0][2] as (
        record: unknown,
      ) => void;
      const periodRow = (overrides: Record<string, unknown>) => ({
        conversation_id: "conv-1",
        ended_at: "2026-11-10T10:00:00Z",
        id: "period-0",
        profile_id: "me-1",
        revoked_kind: "ended",
        ...overrides,
      });

      await act(async () => {
        onPeriodChange(periodRow({}));
      });
      await settle();

      expect(backMock).not.toHaveBeenCalled();

      await act(async () => {
        onPeriodChange(periodRow({ id: "period-1", revoked_kind: "deleted" }));
      });

      // The deleted copy proves the first (older) period did not already revoke:
      // a second revoke is a no-op, so an earlier "ended" revoke would win.
      await waitUntil(() => {
        expect(backMock).toHaveBeenCalledTimes(1);
        expect(textsOf(tree)).toContain("Il gruppo è stato eliminato.");
      });
      expect(textsOf(tree)).not.toContain("Non fai più parte di questo gruppo.");
    });

    it("revokes when the meta fetch says the membership is gone", async () => {
      serviceMocks.fetchGroupConversationMeta.mockRejectedValue({
        message: "SOCIETY_GROUP_NOT_MEMBER",
      });

      await renderScreen({ messages: [] });

      await waitUntil(() => {
        expect(backMock).toHaveBeenCalledTimes(1);
      });
      // Access lost is final: the meta must not be retried or refetched into a loop.
      await settle();
      expect(backMock).toHaveBeenCalledTimes(1);
      expect(serviceMocks.fetchGroupConversationMeta).toHaveBeenCalledTimes(1);
    });
  });
});
