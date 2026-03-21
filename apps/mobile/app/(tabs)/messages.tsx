import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { useSession } from "../../src/features/auth/use-session";
import { KeyboardAwareScrollView } from "../../src/components/ui/keyboard-aware-scroll-view";
import { Screen } from "../../src/components/ui/screen";
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
  Badge,
  Button,
  Card,
  EmptyState,
  ScreenHeader,
  StatCard,
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
          subtitle="Gestisci le tue conversazioni e contatta le connessioni"
          action={
            <Button
              label="Aggiorna"
              onPress={() => void loadInbox()}
              size="sm"
              variant="link"
            />
          }
        />

        <View style={styles.statRow}>
          <StatCard
            label="Conversazioni"
            value={String(summaries.length)}
          />
          <StatCard
            label="Non letti"
            tone="muted"
            value={String(unreadCount)}
          />
        </View>

        <Card>
          <AppText variant="headingSm">Pronti a scriverti</AppText>
          {isLoading ? (
            <AppText variant="bodySm" color="secondary">
              Caricamento inbox in corso...
            </AppText>
          ) : null}
          {!isLoading && connectedWithoutConversation.length === 0 ? (
            <AppText variant="bodySm" color="secondary">
              Nessuna connessione pronta per una nuova chat. Vai in Rete per
              ampliare il tuo network professionale.
            </AppText>
          ) : null}
          {connectedWithoutConversation.slice(0, 3).map((entry) => (
            <Card key={entry.connection_id} variant="muted">
              <AppText variant="titleSm">{entry.other_full_name}</AppText>
              <AppText variant="bodySm" color="secondary">
                {formatRole(entry.other_role)}
                {entry.other_role === "player"
                  ? ` · ${formatPosition(entry.other_primary_position)}`
                  : ""}
              </AppText>
              <AppText variant="bodySm" color="secondary">
                {formatLocation(entry.other_city, entry.other_region)}
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
                  handleOpenConversation(entry.other_profile_id, entry.other_full_name)
                }
                variant="secondary"
              />
            </Card>
          ))}
        </Card>

        <View style={styles.sectionGap}>
          <AppText variant="headingSm">Conversazioni recenti</AppText>
          {!isLoading && summaries.length === 0 ? (
            <EmptyState
              icon="chatbubbles-outline"
              title="Inbox vuota"
              description="Accetta una connessione o avvia una chat dalla tab Rete."
            />
          ) : null}
          {summaries.map((summary) => (
            <Pressable
              key={summary.conversation_id}
              onPress={() =>
                router.push({
                  pathname: "/messages/[conversationId]",
                  params: {
                    conversationId: summary.conversation_id,
                    otherName: summary.other_full_name,
                  },
                })
              }
              style={({ pressed }) => [
                styles.conversationCard,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.conversationHeader}>
                <View style={styles.flex1}>
                  <AppText variant="headingSm">{summary.other_full_name}</AppText>
                  <AppText variant="bodySm" color="secondary">
                    {formatRole(summary.other_role)}
                    {summary.other_role === "player"
                      ? ` · ${formatPosition(summary.other_primary_position)}`
                      : ""}
                  </AppText>
                </View>
                {summary.unread_count > 0 ? (
                  <View style={styles.unreadBadge}>
                    <AppText variant="caption" color="inverse">
                      {summary.unread_count}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText variant="bodySm" color="secondary">
                {formatLocation(summary.other_city, summary.other_region)}
              </AppText>
              <AppText variant="bodyLg" numberOfLines={2}>
                {summary.last_message_body ??
                  "Nessun messaggio ancora inviato: apri la chat per iniziare."}
              </AppText>
              <AppText variant="caption" color="muted">
                {summary.last_message_sent_at
                  ? new Date(summary.last_message_sent_at).toLocaleString("it-IT")
                  : "Conversazione pronta"}
              </AppText>
            </Pressable>
          ))}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[24],
  },
  statRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  sectionGap: {
    gap: spacing[12],
  },
  conversationCard: {
    gap: spacing[8],
    padding: spacing[18],
    borderRadius: radius[12],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing[12],
  },
  flex1: {
    flex: 1,
    gap: spacing[4],
  },
  unreadBadge: {
    minWidth: 28,
    paddingHorizontal: spacing[8],
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.hero,
    alignItems: "center",
  },
  pressed: {
    opacity: 0.82,
  },
});
