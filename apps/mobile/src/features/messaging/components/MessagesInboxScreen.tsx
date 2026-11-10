import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../components/ui/screen";
import { useSession } from "../../auth/use-session";
import { getUnreadCount } from "../../clubs/notification-service";
import { formatRelativeTime } from "../../../lib/relative-time";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, EmptyState, HeaderBell, ScreenHeader } from "../../../ui";
import { GROUPS_QK } from "../../dashboard/groups/groups-keys";
import { GROUPS_HREFS } from "../../dashboard/groups/groups-routes";
import { fetchGroupCreateContexts } from "../../dashboard/groups/groups-service";
import {
  fetchCommunications,
  type CommunicationSummary,
} from "../communications-service";
import {
  fetchInboxConversations,
  markInboxAllRead,
  type InboxConversation,
} from "../messaging-service";
import {
  buildConversationPreview,
  buildSearchSections,
  filterCommunications,
  filterConversations,
  type ChatFilter,
  type CommunicationFilter,
} from "../inbox-helpers";
import { ChatFilterChips } from "./ChatFilterChips";
import { CommunicationFilterChips } from "./CommunicationFilterChips";
import { CommunicationRow } from "./CommunicationRow";
import { ConversationRow } from "./ConversationRow";
import { InboxActionsSheet } from "./InboxActionsSheet";
import { InboxSearchBar } from "./InboxSearchBar";
import { InboxTabBar, type InboxTab } from "./InboxTabBar";
import { NewConversationSheet } from "./NewConversationSheet";

function conversationTimestamp(conversation: InboxConversation): string {
  return conversation.last_message_sent_at
    ? formatRelativeTime(conversation.last_message_sent_at)
    : "";
}

export function MessagesInboxScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const profileId = profile?.id ?? "";

  const [activeTab, setActiveTab] = useState<InboxTab>("chat");
  const [chatFilter, setChatFilter] = useState<ChatFilter>("all");
  const [communicationFilter, setCommunicationFilter] =
    useState<CommunicationFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isActionsSheetVisible, setIsActionsSheetVisible] = useState(false);
  const [isLauncherVisible, setIsLauncherVisible] = useState(false);

  // DAS-REV-32 §12: «Crea gruppo» esiste solo con almeno un contesto Società
  // in cui la create è consentita. Finché carica o se fallisce resta nascosto.
  const createContextsQuery = useQuery({
    enabled: !!profileId,
    queryFn: fetchGroupCreateContexts,
    queryKey: GROUPS_QK.contexts(profileId),
  });

  const conversationsQuery = useQuery({
    enabled: !!profileId,
    queryFn: () => fetchInboxConversations(),
    queryKey: ["inbox-conversations", profileId],
  });

  const communicationsQuery = useQuery({
    enabled: !!profileId,
    queryFn: () => fetchCommunications(),
    queryKey: ["communications", profileId],
  });

  const { data: unreadCount = 0 } = useQuery({
    enabled: !!profileId,
    queryFn: () => getUnreadCount(profileId),
    queryKey: ["notifications-unread", profileId],
  });

  useFocusEffect(
    useCallback(() => {
      if (!profileId) {
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["inbox-conversations", profileId] });
      queryClient.invalidateQueries({ queryKey: ["communications", profileId] });
    }, [profileId, queryClient]),
  );

  const markAllReadMutation = useMutation({
    mutationFn: markInboxAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations", profileId] });
      queryClient.invalidateQueries({ queryKey: ["communications", profileId] });
    },
  });

  const conversations = conversationsQuery.data ?? [];
  const communications = communicationsQuery.data ?? [];
  const chatCount = conversations.filter((item) => item.unread_count > 0).length;
  const comunicazioniCount = communications.filter((item) => !item.is_read).length;
  const isLoading = conversationsQuery.isLoading || communicationsQuery.isLoading;
  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length >= 2;

  function handleOpenConversation(conversation: InboxConversation) {
    router.push({
      params: {
        conversationId: conversation.conversation_id,
        otherName: conversation.display_title,
      },
      pathname: "/messages/[conversationId]",
    });
  }

  const createContexts = createContextsQuery.data ?? [];

  function handleNewMessage() {
    // Nessun selettore destinatari: la chat diretta parte da un profilo.
    router.push("/search/profiles");
  }

  function handleCreateGroup() {
    // Una sola Società: impostata direttamente. Più Società: il wizard apre il
    // selector «Crea gruppo per».
    const clubId = createContexts.length === 1 ? createContexts[0].clubId : null;

    router.push(GROUPS_HREFS.create("messages", clubId) as never);
  }

  function handleOpenCommunication(communication: CommunicationSummary) {
    router.push({
      params: { communicationId: communication.communication_id },
      pathname: "/comunicazioni/[communicationId]",
    });
  }

  const searchPlaceholder =
    activeTab === "chat"
      ? "Cerca messaggi, gruppi o comunicazioni..."
      : "Cerca comunicazioni...";

  const isFullyEmpty = conversations.length === 0 && communications.length === 0;

  return (
    <Screen>
      <View style={styles.container}>
        <ScreenHeader
          action={
            <View style={styles.headerActions}>
              <HeaderBell count={unreadCount} onPress={() => router.push("/notifications")} />
              <Pressable
                accessibilityLabel="Nuova conversazione"
                accessibilityRole="button"
                onPress={() => setIsLauncherVisible(true)}
                style={styles.actionsButton}
                testID="inbox-new-conversation"
              >
                <Ionicons color={colors.textMuted} name="create-outline" size={20} />
              </Pressable>
              <Pressable
                accessibilityLabel="Gestisci messaggi"
                accessibilityRole="button"
                onPress={() => setIsActionsSheetVisible(true)}
                style={styles.actionsButton}
              >
                <Ionicons color={colors.textMuted} name="ellipsis-horizontal" size={20} />
              </Pressable>
            </View>
          }
          title="Messaggi"
        />

        <InboxTabBar
          activeTab={activeTab}
          chatCount={chatCount}
          comunicazioniCount={comunicazioniCount}
          onTabChange={setActiveTab}
        />

        <View style={styles.searchWrapper}>
          <InboxSearchBar onQueryChange={setSearchQuery} placeholder={searchPlaceholder} />
        </View>

        {isLoading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : isSearching ? (
          <SearchResults
            communications={communications}
            conversations={conversations}
            onOpenCommunication={handleOpenCommunication}
            onOpenConversation={handleOpenConversation}
            query={searchQuery}
            viewerProfileId={profileId}
          />
        ) : isFullyEmpty ? (
          <EmptyState
            action={
              <Button
                label="Esplora profili"
                onPress={() => router.push("/(tabs)/cerca")}
                variant="primary"
              />
            }
            description="Quando ricevi chat o comunicazioni, le trovi qui."
            icon="chatbubbles-outline"
            title="Nessun messaggio"
          />
        ) : activeTab === "chat" ? (
          <ChatTabContent
            conversations={conversations}
            filter={chatFilter}
            onChangeFilter={setChatFilter}
            onOpenConversation={handleOpenConversation}
            viewerProfileId={profileId}
          />
        ) : (
          <CommunicationsTabContent
            communications={communications}
            filter={communicationFilter}
            onChangeFilter={setCommunicationFilter}
            onOpenCommunication={handleOpenCommunication}
          />
        )}
      </View>

      <InboxActionsSheet
        onClose={() => setIsActionsSheetVisible(false)}
        onMarkAllRead={() => markAllReadMutation.mutate()}
        visible={isActionsSheetVisible}
      />

      <NewConversationSheet
        canCreateGroup={createContexts.length > 0}
        onClose={() => setIsLauncherVisible(false)}
        onCreateGroup={handleCreateGroup}
        onNewMessage={handleNewMessage}
        visible={isLauncherVisible}
      />
    </Screen>
  );
}

function ChatTabContent({
  conversations,
  filter,
  onChangeFilter,
  onOpenConversation,
  viewerProfileId,
}: {
  conversations: InboxConversation[];
  filter: ChatFilter;
  onChangeFilter: (filter: ChatFilter) => void;
  onOpenConversation: (conversation: InboxConversation) => void;
  viewerProfileId: string;
}) {
  const filtered = filterConversations(conversations, filter);

  return (
    <View style={styles.tabContent}>
      <ChatFilterChips onChange={onChangeFilter} value={filter} />
      {filtered.length === 0 ? (
        <AppText color="muted" style={styles.emptyCaption} variant="bodySm">
          Nessuna conversazione trovata
        </AppText>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.conversation_id}
          renderItem={({ item }) => (
            <ConversationRow
              avatarUrl={item.avatar_url}
              groupAvatarPath={item.group_avatar_path}
              isGroup={item.conversation_type === "group"}
              lastMessage={buildConversationPreview(item, viewerProfileId)}
              name={item.display_title}
              onPress={() => onOpenConversation(item)}
              timestamp={conversationTimestamp(item)}
              unreadCount={item.unread_count}
            />
          )}
          style={styles.listContainer}
        />
      )}
    </View>
  );
}

function CommunicationsTabContent({
  communications,
  filter,
  onChangeFilter,
  onOpenCommunication,
}: {
  communications: CommunicationSummary[];
  filter: CommunicationFilter;
  onChangeFilter: (filter: CommunicationFilter) => void;
  onOpenCommunication: (communication: CommunicationSummary) => void;
}) {
  const filtered = filterCommunications(communications, filter);

  return (
    <View style={styles.tabContent}>
      <CommunicationFilterChips onChange={onChangeFilter} value={filter} />
      {filtered.length === 0 ? (
        <AppText color="muted" style={styles.emptyCaption} variant="bodySm">
          Nessuna comunicazione trovata
        </AppText>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.communication_id}
          renderItem={({ item }) => (
            <CommunicationRow
              communication={item}
              onPress={() => onOpenCommunication(item)}
            />
          )}
          style={styles.listContainer}
        />
      )}
    </View>
  );
}

function SearchResults({
  communications,
  conversations,
  onOpenCommunication,
  onOpenConversation,
  query,
  viewerProfileId,
}: {
  communications: CommunicationSummary[];
  conversations: InboxConversation[];
  onOpenCommunication: (communication: CommunicationSummary) => void;
  onOpenConversation: (conversation: InboxConversation) => void;
  query: string;
  viewerProfileId: string;
}) {
  const { chatResults, communicationResults } = buildSearchSections(
    conversations,
    communications,
    query,
  );

  return (
    <ScrollView contentContainerStyle={styles.searchResultsContent} style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <AppText color="muted" variant="overline">
          Risultati chat
        </AppText>
      </View>
      {chatResults.length === 0 ? (
        <AppText color="muted" style={styles.emptyCaption} variant="bodySm">
          Nessun risultato
        </AppText>
      ) : (
        <View style={styles.listContainer}>
          {chatResults.map((conversation) => (
            <ConversationRow
              avatarUrl={conversation.avatar_url}
              groupAvatarPath={conversation.group_avatar_path}
              isGroup={conversation.conversation_type === "group"}
              key={conversation.conversation_id}
              lastMessage={buildConversationPreview(conversation, viewerProfileId)}
              name={conversation.display_title}
              onPress={() => onOpenConversation(conversation)}
              timestamp={conversationTimestamp(conversation)}
              unreadCount={conversation.unread_count}
            />
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <AppText color="muted" variant="overline">
          Risultati comunicazioni
        </AppText>
      </View>
      {communicationResults.length === 0 ? (
        <AppText color="muted" style={styles.emptyCaption} variant="bodySm">
          Nessun risultato
        </AppText>
      ) : (
        <View style={styles.listContainer}>
          {communicationResults.map((communication) => (
            <CommunicationRow
              communication={communication}
              key={communication.communication_id}
              onPress={() => onOpenCommunication(communication)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionsButton: {
    padding: spacing[4],
  },
  container: {
    flex: 1,
    gap: spacing[12],
  },
  emptyCaption: {
    paddingVertical: spacing[16],
    textAlign: "center",
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  listContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  loadingWrapper: {
    alignItems: "center",
    paddingVertical: spacing[40],
  },
  sectionHeader: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[4],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },
  searchResultsContent: {
    gap: spacing[8],
    paddingBottom: spacing[24],
  },
  searchWrapper: {
    paddingBottom: spacing[4],
  },
  tabContent: {
    flex: 1,
    gap: spacing[8],
  },
});
