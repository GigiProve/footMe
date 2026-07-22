import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationMessage, DirectConversationMeta } from "../messaging-service";

const backMock = vi.fn();
const pushMock = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: backMock, push: pushMock }),
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

const serviceMocks = vi.hoisted(() => ({
  blockUser: vi.fn(),
  fetchDirectConversationMeta: vi.fn(),
  getConversationMessages: vi.fn(),
  getShareablePhoneContact: vi.fn(),
  markConversationRead: vi.fn(),
  reportConversation: vi.fn(),
  sendContactCardMessage: vi.fn(),
  sendMessage: vi.fn(),
  setConversationArchived: vi.fn(),
  subscribeToConversation: vi.fn(),
  unblockUser: vi.fn(),
  unsubscribeFromConversation: vi.fn(),
}));

// No importOriginal: the real module imports the supabase client, which
// crashes in the vitest environment (react-native-url-polyfill BlobModule).
vi.mock("../messaging-service", () => {
  return {
    getChatMediaSignedUrl: vi.fn(),
    blockUser: serviceMocks.blockUser,
    fetchDirectConversationMeta: serviceMocks.fetchDirectConversationMeta,
    getConversationMessages: serviceMocks.getConversationMessages,
    getShareablePhoneContact: serviceMocks.getShareablePhoneContact,
    markConversationRead: serviceMocks.markConversationRead,
    reportConversation: serviceMocks.reportConversation,
    sendContactCardMessage: serviceMocks.sendContactCardMessage,
    sendMessage: serviceMocks.sendMessage,
    setConversationArchived: serviceMocks.setConversationArchived,
    subscribeToConversation: serviceMocks.subscribeToConversation,
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

beforeEach(async () => {
  vi.clearAllMocks();

  serviceMocks.subscribeToConversation.mockReturnValue({});
  serviceMocks.unsubscribeFromConversation.mockResolvedValue(undefined);
  serviceMocks.markConversationRead.mockResolvedValue(undefined);
  serviceMocks.getConversationMessages.mockResolvedValue([]);
  serviceMocks.fetchDirectConversationMeta.mockResolvedValue(null);
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

async function renderScreen(seed?: {
  messages?: ConversationMessage[];
  meta?: DirectConversationMeta;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // Seed the cache so data-driven UI renders synchronously: async query
  // commits are not flushed reliably by act() in this environment.
  queryClient.setQueryData(["conversation-messages", "conv-1"], seed?.messages ?? []);
  if (seed?.meta) {
    queryClient.setQueryData(["conversation-meta", "conv-1"], seed.meta);
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
});
