import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";

import { useSession } from "../../src/features/auth/use-session";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { Screen } from "../../src/components/ui/screen";
import { ProfileSearchScreen } from "../../src/features/discovery/components/ProfileSearchScreen";
import {
  getNetworkOverview,
  updateConnectionStatus,
  type NetworkOverviewItem,
} from "../../src/features/networking/networking-service";
import { openDirectConversation } from "../../src/features/messaging/messaging-service";
import {
  formatLocation,
  formatPosition,
  formatRole,
} from "../../src/features/profiles/profile-display-helpers";
import { spacing } from "../../src/theme/tokens";
import { AppText, Button, Card, ScreenHeader, StatCard } from "../../src/ui";

export default function NetworkScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [networkEntries, setNetworkEntries] = useState<NetworkOverviewItem[]>(
    [],
  );
  const [isNetworkLoading, setIsNetworkLoading] = useState(true);
  const [actionProfileId, setActionProfileId] = useState<string | null>(null);
  const [actionConnectionId, setActionConnectionId] = useState<string | null>(
    null,
  );

  const acceptedConnections = useMemo(
    () => networkEntries.filter((entry) => entry.status === "accepted"),
    [networkEntries],
  );
  const incomingRequests = useMemo(
    () =>
      networkEntries.filter(
        (entry) => entry.status === "pending" && !entry.is_requester,
      ),
    [networkEntries],
  );
  const outgoingRequests = useMemo(
    () =>
      networkEntries.filter(
        (entry) => entry.status === "pending" && entry.is_requester,
      ),
    [networkEntries],
  );

  const loadNetworkData = useCallback(async () => {
    if (!session?.user) {
      setNetworkEntries([]);
      setIsNetworkLoading(false);
      return;
    }

    try {
      setIsNetworkLoading(true);
      const result = await getNetworkOverview();
      setNetworkEntries(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nel caricamento della rete.";
      Alert.alert("Rete non disponibile", message);
    } finally {
      setIsNetworkLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void loadNetworkData();
  }, [loadNetworkData]);

  async function handleUpdateConnectionStatus(
    connectionId: string,
    nextStatus: "accepted" | "rejected",
  ) {
    try {
      setActionConnectionId(connectionId);
      await updateConnectionStatus(connectionId, nextStatus);
      await loadNetworkData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'aggiornamento della richiesta.";
      Alert.alert("Operazione non riuscita", message);
    } finally {
      setActionConnectionId(null);
    }
  }

  async function handleOpenConversation(profileId: string, otherName: string) {
    try {
      setActionProfileId(profileId);
      const conversationId = await openDirectConversation(profileId);
      router.push({
        pathname: "/messages/[conversationId]",
        params: { conversationId, otherName },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'apertura della conversazione.";
      Alert.alert("Chat non disponibile", message);
    } finally {
      setActionProfileId(null);
    }
  }

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          title="Rete"
          subtitle="Gestisci connessioni e cerca profili e opportunita'"
        />

        <View style={styles.statRow}>
          <StatCard
            label="Connessioni attive"
            value={String(acceptedConnections.length)}
          />
          <StatCard
            label="Da gestire"
            tone="muted"
            value={String(incomingRequests.length)}
          />
        </View>

        <Card>
          <AppText variant="headingSm">Stato della rete</AppText>
          {isNetworkLoading ? (
            <AppText variant="bodySm" color="secondary">
              Caricamento connessioni in corso...
            </AppText>
          ) : null}
          {!isNetworkLoading && incomingRequests.length === 0 ? (
            <AppText variant="bodySm" color="secondary">
              Nessuna richiesta in attesa. Usa la ricerca qui sotto per ampliare
              il tuo network.
            </AppText>
          ) : null}
          {incomingRequests.map((entry) => (
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
              <View style={styles.actionRow}>
                <Button
                  disabled={actionConnectionId === entry.connection_id}
                  label="Accetta"
                  onPress={() =>
                    handleUpdateConnectionStatus(
                      entry.connection_id,
                      "accepted",
                    )
                  }
                  style={styles.flex1}
                />
                <Button
                  disabled={actionConnectionId === entry.connection_id}
                  label="Rifiuta"
                  onPress={() =>
                    handleUpdateConnectionStatus(
                      entry.connection_id,
                      "rejected",
                    )
                  }
                  style={styles.flex1}
                  variant="secondary"
                />
              </View>
            </Card>
          ))}
          {!isNetworkLoading && acceptedConnections.length > 0 ? (
            <View style={styles.sectionGap}>
              <AppText variant="titleSm">
                Connessioni pronte per la chat
              </AppText>
              {acceptedConnections.slice(0, 3).map((entry) => (
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
                        : "Apri chat"
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
          {!isNetworkLoading && outgoingRequests.length > 0 ? (
            <AppText variant="bodySm" color="secondary">
              Richieste inviate in attesa: {outgoingRequests.length}
            </AppText>
          ) : null}
        </Card>

        <ProfileSearchScreen hideHeader />
      </KeyboardAwareForm>
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
  actionRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  flex1: {
    flex: 1,
  },
  sectionGap: {
    gap: spacing[10],
  },
});
