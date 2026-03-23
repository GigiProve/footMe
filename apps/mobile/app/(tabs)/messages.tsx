import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";

import { useSession } from "../../src/features/auth/use-session";
import { KeyboardAwareScrollView } from "../../src/components/ui/keyboard-aware-scroll-view";
import { Screen } from "../../src/components/ui/screen";
import { ConversationRow } from "../../src/features/messaging/components/ConversationRow";
import {
  getConversationSummaries,
  type ConversationSummary,
} from "../../src/features/messaging/messaging-service";
import {
  getNetworkOverview,
  startDirectConversation,
  type NetworkOverviewItem,
} from "../../src/features/networking/networking-service";
import {
  formatLocation,
  formatPosition,
  formatRole,
} from "../../src/features/profiles/profile-display-helpers";
import { colors, radius, spacing } from "../../src/theme/tokens";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Input,
  ScreenHeader,
} from "../../src/ui";

export default function MessagesScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [connections, setConnections] = useState<NetworkOverviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionProfileId, setActionProfileId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => summaries.reduce((total, summary) => total + summary.unread_count, 0),
    [summaries],
  );
  const existingConversationProfiles = useMemo(
    () => new Set(summaries.map((summary) => summary.other_profile_id)),
    [summaries],
  );
  const connectedWithoutConversation = useMemo(() => {
    return connections.filter(
      (entry) =>
        entry.status === "accepted" &&
        !existingConversationProfiles.has(entry.other_profile_id),
    );
  }, [connections, existingConversationProfiles]);

  const loadInbox = useCallback(async () => {
    if (!session?.user) {
      setSummaries([]);
      setConnections([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [nextSummaries, nextConnections] = await Promise.all([
        getConversationSummaries(),
        getNetworkOverview(),
      ]);
      setSummaries(nextSummaries);
      setConnections(nextConnections);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nel caricamento della messaggistica.";
      Alert.alert("Inbox non disponibile", message);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function handleOpenConversation(profileId: string, otherName: string) {
    try {
      setActionProfileId(profileId);
      const conversationId = await startDirectConversation(profileId);
      router.push({
        pathname: "/messages/[conversationId]",
        params: { conversationId, otherName },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'apertura della chat.";
      Alert.alert("Chat non disponibile", message);
    } finally {
      setActionProfileId(null);
    }
  }

  return (
    <Screen>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          title="Messaggi"
          subtitle={`${summaries.length} conversazioni · ${unreadCount} non letti`}
        />

        <View style={styles.searchBox}>
          <Input placeholder="Cerca conversazioni..." editable={false} />
        </View>

        {!isLoading &&
        summaries.length === 0 &&
        connectedWithoutConversation.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="Inbox vuota"
            description="Accetta una connessione o avvia una chat dalla tab Rete."
          />
        ) : null}

        {connectedWithoutConversation.length > 0 ? (
          <View style={styles.sectionGap}>
            <AppText variant="titleSm">Pronti a scriverti</AppText>
            {connectedWithoutConversation.slice(0, 3).map((entry) => (
              <Card key={entry.connection_id} variant="muted">
                <AppText variant="titleSm">{entry.other_full_name}</AppText>
                <AppText variant="bodySm" color="secondary">
                  {formatRole(entry.other_role)}
                  {entry.other_role === "player"
                    ? ` · ${formatPosition(entry.other_primary_position)}`
                    : ""}
                </AppText>
                <Button
                  disabled={actionProfileId === entry.other_profile_id}
                  fullWidth
                  label={
                    actionProfileId === entry.other_profile_id
                      ? "Apertura chat..."
                      : "Scrivi ora"
                  }
                  onPress={() =>
                    handleOpenConversation(
                      entry.other_profile_id,
                      entry.other_full_name,
                    )
                  }
                  variant="secondary"
                />
              </Card>
            ))}
          </View>
        ) : null}

        {summaries.length > 0 ? (
          <View style={styles.conversationList}>
            {summaries.map((summary) => {
              const roleLabel = formatRole(summary.other_role);
              const posLabel =
                summary.other_role === "player"
                  ? formatPosition(summary.other_primary_position)
                  : "";
              const subtitle = [roleLabel, posLabel]
                .filter(Boolean)
                .join(" · ");
              const lastMsg =
                summary.last_message_body ?? "Apri la chat per iniziare.";
              const timeLabel = summary.last_message_sent_at
                ? formatRelativeTime(summary.last_message_sent_at)
                : "";

              return (
                <ConversationRow
                  key={summary.conversation_id}
                  avatarUrl={null}
                  lastMessage={lastMsg}
                  name={summary.other_full_name}
                  onPress={() =>
                    router.push({
                      pathname: "/messages/[conversationId]",
                      params: {
                        conversationId: summary.conversation_id,
                        otherName: summary.other_full_name,
                      },
                    })
                  }
                  timestamp={timeLabel}
                  unreadCount={summary.unread_count}
                />
              );
            })}
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}g`;
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[24],
  },
  searchBox: {
    paddingHorizontal: spacing[0],
  },
  sectionGap: {
    gap: spacing[12],
  },
  conversationList: {
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
