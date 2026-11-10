import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { useSession } from "../../auth/use-session";
import { colors } from "../../../theme/tokens";
import { ConfirmModal, useToast } from "../../../ui";
import { sendMediaMessage, uploadChatMedia } from "../chat-media-service";
import {
  buildChatListItems,
  buildChatSubtitle,
  filterMessagesForSearch,
  resolveChatBanners,
} from "../chat-helpers";
import { GROUPS_COPY } from "../../dashboard/groups/groups-copy";
import {
  GROUP_CHAT_COPY,
  isAccessLostError,
  isGroupComposerAvailable,
  systemEventAffectsGroupMeta,
} from "../group-chat-presentation";
import { MESSAGING_QK } from "../messaging-keys";
import { GROUP_INFO_AVAILABLE, groupInfoRoute } from "../messaging-routes";
import { useGroupAccessSignals, useGroupChatAccess } from "../use-group-chat-access";
import {
  blockUser,
  fetchConversationType,
  fetchDirectConversationMeta,
  fetchGroupConversationMeta,
  getConversationMessages,
  getShareablePhoneContact,
  markConversationRead,
  reportConversation,
  sendContactCardMessage,
  sendMessage,
  setConversationArchived,
  subscribeToConversation,
  unblockUser,
  unsubscribeFromConversation,
  type ConversationReportReason,
} from "../messaging-service";
import { ShareContactModal } from "../share-contact-modal";
import { ChatActionsSheet } from "./ChatActionsSheet";
import { ChatComposer } from "./ChatComposer";
import { ChatContextCard } from "./ChatContextCard";
import { ChatHeader } from "./ChatHeader";
import { ChatRelationshipNote } from "./ChatRelationshipNote";
import { ChatSoftNotice } from "./ChatSoftNotice";
import { GroupArchivedNotice } from "./GroupArchivedNotice";
import { GroupChatEmptyState } from "./GroupChatEmptyState";
import { InlineSafetyRow } from "./InlineSafetyRow";
import { MessageList } from "./MessageList";
import { ReportConversationModal } from "./ReportConversationModal";

type ChatScreenProps = {
  conversationId: string;
  initialName: string;
};

export function ChatScreen({ conversationId, initialName }: ChatScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile, session } = useSession();
  const myProfileId = session?.user?.id ?? profile?.id ?? "";

  const [draft, setDraft] = useState("");
  const [isActionsSheetVisible, setIsActionsSheetVisible] = useState(false);
  const [isBlockConfirmVisible, setIsBlockConfirmVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isSharingContact, setIsSharingContact] = useState(false);
  const [shareablePhone, setShareablePhone] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  /*
    DAS-REV-33 §23/§26: a revoca avvenuta ogni query della conversazione si
    spegne, così nessuna risposta tardiva né un re-render la ripopola.
  */
  const access = useGroupChatAccess({ conversationId, myProfileId });
  const { isRevoked } = access;

  const messagesQuery = useQuery({
    enabled: !!conversationId && !isRevoked,
    queryFn: () => getConversationMessages(conversationId),
    queryKey: MESSAGING_QK.conversationMessages(conversationId),
  });

  /*
    DAS-REV-32 §25: la testata dipende dal tipo. Il tipo si legge prima, così
    il meta sbagliato non viene mai chiesto (fetch_direct_conversation_meta
    rifiuta i gruppi, fetch_group_conversation_meta le chat dirette). Se la
    lettura del tipo fallisce si resta sul ramo diretto, come prima.
  */
  const typeQuery = useQuery({
    enabled: !!conversationId && !isRevoked,
    queryFn: () => fetchConversationType(conversationId),
    queryKey: MESSAGING_QK.conversationType(conversationId),
    staleTime: Infinity,
  });
  const isGroup = typeQuery.data === "group";

  const metaQuery = useQuery({
    enabled: !!conversationId && !isRevoked && !isGroup && !typeQuery.isPending,
    queryFn: () => fetchDirectConversationMeta(conversationId),
    queryKey: MESSAGING_QK.conversationMeta(conversationId),
  });

  const groupMetaQuery = useQuery({
    enabled: !!conversationId && !isRevoked && isGroup,
    queryFn: () => fetchGroupConversationMeta(conversationId),
    queryKey: MESSAGING_QK.groupMeta(conversationId),
    // Accesso perso: ritentare ritarda soltanto la revoca.
    retry: (failureCount, error) => !isAccessLostError(error) && failureCount < 3,
  });

  useGroupAccessSignals({
    conversationId,
    isGroup,
    isRevoked,
    metaError: groupMetaQuery.error,
    myProfileId,
    periodId: groupMetaQuery.data?.periodId ?? null,
    revoke: access.revoke,
  });

  useEffect(() => {
    if (!conversationId || isRevoked) {
      return undefined;
    }

    const channel = subscribeToConversation(conversationId, (change) => {
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMessages(conversationId) });
      // i_have_sent/other_has_sent drive the notices: refresh them too.
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMeta(conversationId) });

      // DAS-REV-33 §24: archivia/riattiva/rinomina e le variazioni di persone
      // cambiano la testata del gruppo.
      if (systemEventAffectsGroupMeta(change?.systemEventType)) {
        queryClient.invalidateQueries({ queryKey: MESSAGING_QK.groupMeta(conversationId) });
      }
    });

    return () => {
      void unsubscribeFromConversation(channel);
    };
  }, [conversationId, isRevoked, queryClient]);

  useEffect(() => {
    if (!conversationId || isRevoked || !messagesQuery.dataUpdatedAt) {
      return;
    }

    markConversationRead(conversationId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(myProfileId) });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, isRevoked, messagesQuery.dataUpdatedAt]);

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      sendMessage({ body, conversationId, senderProfileId: myProfileId }),
    onError: (error: unknown, body) => {
      // DAS-REV-33 §21/§23: invio rifiutato per gruppo archiviato o accesso
      // perso. La chat cambia stato (o si chiude): niente bozza da ripristinare.
      if (isGroup && access.handleAccessError(error)) {
        return;
      }

      setDraft(body);
      showToast({
        message:
          error instanceof Error ? error.message : "Errore durante l'invio del messaggio.",
        tone: "neutral",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMessages(conversationId) });
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMeta(conversationId) });
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(metaQuery.data?.other_profile_id ?? ""),
    onError: (error: unknown) => {
      showToast({
        message: error instanceof Error ? error.message : "Impossibile bloccare l'utente.",
        tone: "neutral",
      });
    },
    onSuccess: () => {
      setIsBlockConfirmVisible(false);
      showToast({ message: "Utente bloccato.", tone: "success" });
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMeta(conversationId) });
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(myProfileId) });
      router.back();
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(metaQuery.data?.other_profile_id ?? ""),
    onError: (error: unknown) => {
      showToast({
        message: error instanceof Error ? error.message : "Impossibile sbloccare l'utente.",
        tone: "neutral",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMeta(conversationId) });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => setConversationArchived(conversationId, archived),
    onError: (error: unknown) => {
      showToast({
        message: error instanceof Error ? error.message : "Impossibile aggiornare la chat.",
        tone: "neutral",
      });
    },
    onSuccess: (_data, archived) => {
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(myProfileId) });
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMeta(conversationId) });

      if (archived) {
        showToast({ message: "Chat archiviata.", tone: "success" });
        router.back();
        return;
      }

      showToast({ message: "Chat ripristinata.", tone: "success" });
    },
  });

  const reportMutation = useMutation({
    mutationFn: (input: { reason: ConversationReportReason; details?: string }) =>
      reportConversation({ conversationId, ...input }),
    onError: (error: unknown) => {
      showToast({
        message: error instanceof Error ? error.message : "Impossibile inviare la segnalazione.",
        tone: "neutral",
      });
    },
    onSuccess: () => {
      setIsReportModalVisible(false);
      showToast({ message: "Segnalazione inviata. Grazie.", tone: "success" });
    },
  });

  const meta = isGroup ? null : (metaQuery.data ?? null);
  const groupMeta = isGroup ? (groupMetaQuery.data ?? null) : null;
  const messages = messagesQuery.data ?? [];
  const displayName = groupMeta?.title || meta?.other_full_name || initialName;
  const subtitle = groupMeta
    ? GROUPS_COPY.chatSubtitle(groupMeta.clubName, groupMeta.peopleCount)
    : meta
      ? buildChatSubtitle(meta)
      : undefined;
  // DAS-REV-33 §21: stato e scrittura arrivano dal server.
  const isGroupArchived = groupMeta?.status === "archived";
  const showComposer = !isGroup || isGroupComposerAvailable(groupMeta);
  const banners = meta ? resolveChatBanners(meta) : null;
  const isSearching = isSearchMode && searchQuery.trim().length >= 2;
  const displayedMessages = isSearching ? filterMessagesForSearch(messages, searchQuery) : messages;
  const items = useMemo(() => buildChatListItems(displayedMessages), [displayedMessages]);
  const resultsCount = isSearchMode ? (isSearching ? displayedMessages.length : null) : null;

  function handleSend() {
    const body = draft.trim();

    if (!body || sendMutation.isPending) {
      return;
    }

    setDraft("");
    sendMutation.mutate(body);
  }

  function handleOpenProfile() {
    if (!meta) {
      return;
    }

    if (meta.club_id) {
      router.push({ params: { id: meta.club_id }, pathname: "/club/[id]" });
      return;
    }

    router.push({ params: { id: meta.other_profile_id }, pathname: "/profile/[id]" });
  }

  function handleOpenContextCard() {
    router.push("/(tabs)/announcements");
  }

  async function handleCopyContactPhone(phone: string) {
    await Clipboard.setStringAsync(phone);
    showToast({ message: "Numero copiato.", tone: "success" });
  }

  async function handlePickMedia() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showToast({
          message: "Consenti l'accesso alla libreria foto per allegare un file.",
          tone: "neutral",
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ["images", "videos"],
        quality: 1,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const kind = asset.type === "video" ? "video" : "image";

      setIsUploadingMedia(true);
      const path = await uploadChatMedia({
        conversationId,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        uri: asset.uri,
      });
      await sendMediaMessage({
        conversationId,
        fileName: asset.fileName,
        kind,
        mediaPath: path,
        senderProfileId: myProfileId,
      });
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMessages(conversationId) });
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMeta(conversationId) });
    } catch (error) {
      if (isGroup && access.handleAccessError(error)) {
        return;
      }

      showToast({
        message: error instanceof Error ? error.message : "Caricamento del file non riuscito.",
        tone: "neutral",
      });
    } finally {
      setIsUploadingMedia(false);
    }
  }

  async function handlePickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];

      setIsUploadingMedia(true);
      const path = await uploadChatMedia({
        conversationId,
        fileName: asset.name,
        mimeType: asset.mimeType,
        uri: asset.uri,
      });
      await sendMediaMessage({
        conversationId,
        fileName: asset.name,
        kind: "document",
        mediaPath: path,
        senderProfileId: myProfileId,
      });
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMessages(conversationId) });
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMeta(conversationId) });
    } catch (error) {
      if (isGroup && access.handleAccessError(error)) {
        return;
      }

      showToast({
        message: error instanceof Error ? error.message : "Caricamento del documento non riuscito.",
        tone: "neutral",
      });
    } finally {
      setIsUploadingMedia(false);
    }
  }

  async function handleOpenShareContact() {
    try {
      const shareableContact = await getShareablePhoneContact(myProfileId);

      if (!shareableContact.phone.trim()) {
        throw new Error(
          "Aggiungi prima il tuo numero nella sezione Contatti del profilo per condividerlo in chat.",
        );
      }

      setShareablePhone(shareableContact.phone);
      setIsShareModalVisible(true);
    } catch (error) {
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Errore durante il recupero del contatto da condividere.",
        tone: "neutral",
      });
    }
  }

  async function handleConfirmShareContact() {
    if (!shareablePhone.trim()) {
      return;
    }

    try {
      setIsSharingContact(true);
      await sendContactCardMessage({
        contactName: profile?.full_name?.trim() || "Utente ProLink",
        conversationId,
        phone: shareablePhone,
        senderProfileId: myProfileId,
      });
      setIsShareModalVisible(false);
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMessages(conversationId) });
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMeta(conversationId) });
    } catch (error) {
      showToast({
        message:
          error instanceof Error ? error.message : "Errore durante la condivisione del contatto.",
        tone: "neutral",
      });
    } finally {
      setIsSharingContact(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ChatHeader
        avatarUrl={meta?.other_avatar_url}
        group={
          isGroup
            ? {
                avatarPath: groupMeta?.avatarPath ?? null,
                onOpenInfo: GROUP_INFO_AVAILABLE
                  ? () => router.push(groupInfoRoute(conversationId) as never)
                  : undefined,
              }
            : null
        }
        isSearchMode={isSearchMode}
        name={displayName}
        onBack={() => router.back()}
        onCloseSearch={() => {
          setIsSearchMode(false);
          setSearchQuery("");
        }}
        onOpenActions={() => setIsActionsSheetVisible(true)}
        onOpenProfile={handleOpenProfile}
        onSearchQueryChange={setSearchQuery}
        resultsCount={resultsCount}
        searchQuery={searchQuery}
        statusLabel={isGroupArchived ? GROUP_CHAT_COPY.archivedLabel : undefined}
        subtitle={subtitle}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        {banners?.contextCard ? (
          <ChatContextCard
            onPress={handleOpenContextCard}
            subtitle={banners.contextCard.subtitle}
            title={banners.contextCard.title}
          />
        ) : null}
        {banners?.relationshipNote ? (
          <ChatRelationshipNote
            icon={banners.relationshipNote.icon}
            label={banners.relationshipNote.label}
          />
        ) : null}
        {banners?.softNotice ? (
          <ChatSoftNotice body={banners.softNotice.body} title={banners.softNotice.title} />
        ) : null}

        <MessageList
          emptyState={
            isGroup &&
            !isGroupArchived &&
            messagesQuery.isSuccess &&
            messages.length === 0 &&
            !isSearchMode ? (
              <GroupChatEmptyState title={displayName} />
            ) : undefined
          }
          items={items}
          myProfileId={myProfileId}
          onCopyContactPhone={handleCopyContactPhone}
          showSenderNames={isGroup}
        />

        {banners?.showInlineSafetyRow ? (
          <InlineSafetyRow
            onArchive={() => archiveMutation.mutate(!(meta?.archived ?? false))}
            onBlock={() => setIsBlockConfirmVisible(true)}
            onReport={() => setIsReportModalVisible(true)}
          />
        ) : null}

        {showComposer ? (
          <ChatComposer
            allowContactShare={!isGroup}
            blocked={meta?.blocked_by_me ?? false}
            draft={draft}
            isSending={sendMutation.isPending}
            isUploading={isUploadingMedia}
            onChangeDraft={setDraft}
            onPickDocument={() => void handlePickDocument()}
            onPickMedia={() => void handlePickMedia()}
            onSend={handleSend}
            onShareContact={() => void handleOpenShareContact()}
          />
        ) : (
          <GroupArchivedNotice />
        )}
      </KeyboardAvoidingView>

      <ChatActionsSheet
        isArchived={meta?.archived ?? false}
        isBlocked={meta?.blocked_by_me ?? false}
        isGroup={isGroup}
        onArchiveToggle={() => archiveMutation.mutate(!(meta?.archived ?? false))}
        onBlockToggle={() => {
          // Without meta (e.g. a group conversation) there is no one to block.
          if (!meta) {
            return;
          }

          if (meta.blocked_by_me) {
            unblockMutation.mutate();
            return;
          }

          setIsBlockConfirmVisible(true);
        }}
        onClose={() => setIsActionsSheetVisible(false)}
        onOpenProfile={handleOpenProfile}
        onReport={() => setIsReportModalVisible(true)}
        onSearch={() => setIsSearchMode(true)}
        visible={isActionsSheetVisible}
      />

      <ConfirmModal
        cancelLabel="Annulla"
        confirmLabel="Blocca"
        isBusy={blockMutation.isPending}
        message="Non riceverai più messaggi da questo profilo."
        onCancel={() => setIsBlockConfirmVisible(false)}
        onConfirm={() => {
          if (meta) {
            blockMutation.mutate();
          }
        }}
        title="Bloccare utente?"
        visible={isBlockConfirmVisible}
      />

      <ReportConversationModal
        isSubmitting={reportMutation.isPending}
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={(input) => reportMutation.mutate(input)}
        visible={isReportModalVisible}
      />

      <ShareContactModal
        isLoading={isSharingContact}
        onCancel={() => {
          if (!isSharingContact) {
            setIsShareModalVisible(false);
          }
        }}
        onConfirm={() => void handleConfirmShareContact()}
        phone={shareablePhone}
        visible={isShareModalVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
