import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  StyleSheet,
  View,
} from "react-native";

import { useSession } from "../../src/features/auth/use-session";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { PublicBioBlock } from "../../src/features/profiles/bio-section";
import { Screen } from "../../src/components/ui/screen";
import {
  searchProfiles,
  searchRecruitingAds,
  type ProfileSearchResult,
  type RecruitingAdSearchResult,
  type SearchMode,
  type SearchPositionFilter,
  type SearchRoleFilter,
} from "../../src/features/discovery/discovery-service";
import {
  getNetworkOverview,
  requestConnection,
  startDirectConversation,
  updateConnectionStatus,
  type NetworkOverviewItem,
} from "../../src/features/networking/networking-service";
import {
  formatLocation,
  formatPosition,
  formatRole,
} from "../../src/features/profiles/profile-display-helpers";
import { spacing } from "../../src/theme/tokens";
import {
  AppText,
  Badge,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Input,
  ScreenHeader,
  StatCard,
} from "../../src/ui";

const modeOptions: { label: string; value: SearchMode }[] = [
  { label: "Profili", value: "profiles" },
  { label: "Opportunita'", value: "ads" },
];

const roleOptions: readonly { label: string; value: SearchRoleFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Calciatori", value: "player" },
  { label: "Allenatori", value: "coach" },
  { label: "Staff", value: "staff" },
  { label: "Procuratori", value: "agent" },
  { label: "Dirigenti", value: "director" },
  { label: "Societa'", value: "club_admin" },
];

const positionOptions: readonly { label: string; value: SearchPositionFilter }[] = [
  { label: "Tutte", value: "all" },
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore", value: "defender" },
  { label: "Centrocampista", value: "midfielder" },
  { label: "Attaccante", value: "forward" },
];

function getConnectionStatusLabel(connection: NetworkOverviewItem | undefined) {
  if (!connection) {
    return null;
  }

  if (connection.status === "accepted") {
    return "Connessi";
  }

  if (connection.status === "blocked") {
    return "Bloccata";
  }

  if (connection.status === "rejected") {
    return "Richiesta chiusa";
  }

  return connection.is_requester ? "Richiesta inviata" : "Richiesta ricevuta";
}

export default function NetworkScreen() {
  const router = useRouter();
  const { session } = useSession();
  const [mode, setMode] = useState<SearchMode>("profiles");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [roleFilter, setRoleFilter] = useState<SearchRoleFilter>("all");
  const [positionFilter, setPositionFilter] =
    useState<SearchPositionFilter>("all");
  const [profiles, setProfiles] = useState<ProfileSearchResult[]>([]);
  const [ads, setAds] = useState<RecruitingAdSearchResult[]>([]);
  const [networkEntries, setNetworkEntries] = useState<NetworkOverviewItem[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(true);
  const [isNetworkLoading, setIsNetworkLoading] = useState(true);
  const [actionProfileId, setActionProfileId] = useState<string | null>(null);
  const [actionConnectionId, setActionConnectionId] = useState<string | null>(null);

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
  const connectionMap = useMemo(
    () =>
      new Map(networkEntries.map((entry) => [entry.other_profile_id, entry] as const)),
    [networkEntries],
  );

  const loadSearchResults = useCallback(async () => {
    try {
      setIsSearchLoading(true);

      if (mode === "profiles") {
        const results = await searchProfiles({
          position: positionFilter,
          query,
          region,
          role: roleFilter,
        });
        setProfiles(
          results.filter((result) => result.profile_id !== session?.user?.id),
        );
        setAds([]);
        return;
      }

      const results = await searchRecruitingAds({
        position: positionFilter,
        query,
        region,
      });
      setAds(results);
      setProfiles([]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore nella ricerca profili e opportunita'.";
      Alert.alert("Ricerca non riuscita", message);
    } finally {
      setIsSearchLoading(false);
    }
  }, [mode, positionFilter, query, region, roleFilter, session?.user?.id]);

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
    void loadSearchResults();
  }, [loadSearchResults]);

  useEffect(() => {
    void loadNetworkData();
  }, [loadNetworkData]);

  async function handleRequestConnection(targetProfileId: string) {
    try {
      setActionProfileId(targetProfileId);
      await requestConnection(targetProfileId);
      await loadNetworkData();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'invio della richiesta.";
      Alert.alert("Connessione non inviata", message);
    } finally {
      setActionProfileId(null);
    }
  }

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
      const conversationId = await startDirectConversation(profileId);
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
                    handleUpdateConnectionStatus(entry.connection_id, "accepted")
                  }
                  style={styles.flex1}
                />
                <Button
                  disabled={actionConnectionId === entry.connection_id}
                  label="Rifiuta"
                  onPress={() =>
                    handleUpdateConnectionStatus(entry.connection_id, "rejected")
                  }
                  style={styles.flex1}
                  variant="secondary"
                />
              </View>
            </Card>
          ))}
          {!isNetworkLoading && acceptedConnections.length > 0 ? (
            <View style={styles.sectionGap}>
              <AppText variant="titleSm">Connessioni pronte per la chat</AppText>
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

        <Card>
          <ChipGroup
            onChange={setMode}
            options={modeOptions}
            value={mode}
          />

          <Input
            onChangeText={setQuery}
            placeholder={
              mode === "profiles"
                ? "Cerca per nome o profilo"
                : "Cerca per annuncio o societa'"
            }
            value={query}
          />

          <Input
            onChangeText={setRegion}
            placeholder="Regione"
            value={region}
          />

          {mode === "profiles" ? (
            <View style={styles.filterSection}>
              <AppText variant="caption">Ruolo</AppText>
              <ChipGroup
                onChange={setRoleFilter}
                options={roleOptions}
                value={roleFilter}
              />
            </View>
          ) : null}

          <View style={styles.filterSection}>
            <AppText variant="caption">Posizione</AppText>
            <ChipGroup
              onChange={setPositionFilter}
              options={positionOptions}
              value={positionFilter}
            />
          </View>
        </Card>

        {mode === "profiles" && profiles.length === 0 && !isSearchLoading ? (
          <EmptyState
            icon="search-outline"
            title="Nessun profilo trovato"
            description="Nessun profilo trovato con i filtri attuali."
          />
        ) : null}

        {mode === "ads" && ads.length === 0 && !isSearchLoading ? (
          <EmptyState
            icon="megaphone-outline"
            title="Nessuna opportunita'"
            description="Nessuna opportunita' trovata con i filtri attuali."
          />
        ) : null}

        {mode === "profiles"
          ? profiles.map((result) => {
              const connection = connectionMap.get(result.profile_id);
              const isBusy = actionProfileId === result.profile_id;
              const statusLabel = getConnectionStatusLabel(connection);

              return (
                <Card key={result.profile_id}>
                  <AppText variant="headingSm">{result.full_name}</AppText>
                  <PublicBioBlock bio={result.bio} />
                  <AppText variant="bodySm" color="secondary">
                    {formatRole(result.role)}
                    {result.role === "player"
                      ? ` · ${formatPosition(result.primary_position)}`
                      : ""}
                  </AppText>
                  <AppText variant="bodySm" color="secondary">
                    {formatLocation(result.city, result.region)}
                  </AppText>
                  {statusLabel ? (
                    <AppText variant="bodySm" color="secondary">{statusLabel}</AppText>
                  ) : null}
                  {connection?.status === "accepted" ? (
                    <Button
                      disabled={isBusy}
                      fullWidth
                      label={isBusy ? "Apertura chat..." : "Messaggia"}
                      onPress={() =>
                        handleOpenConversation(result.profile_id, result.full_name)
                      }
                      variant="secondary"
                    />
                  ) : connection?.status === "pending" && !connection.is_requester ? (
                    <View style={styles.actionRow}>
                      <Button
                        disabled={actionConnectionId === connection.connection_id}
                        label="Accetta"
                        onPress={() =>
                          handleUpdateConnectionStatus(
                            connection.connection_id,
                            "accepted",
                          )
                        }
                        style={styles.flex1}
                      />
                      <Button
                        disabled={actionConnectionId === connection.connection_id}
                        label="Rifiuta"
                        onPress={() =>
                          handleUpdateConnectionStatus(
                            connection.connection_id,
                            "rejected",
                          )
                        }
                        style={styles.flex1}
                        variant="secondary"
                      />
                    </View>
                  ) : connection?.status === "pending" && connection.is_requester ? (
                    <Badge label="Richiesta in attesa" />
                  ) : connection?.status === "blocked" ? (
                    <Badge label="Connessione bloccata" />
                  ) : (
                    <Button
                      disabled={isBusy}
                      fullWidth
                      label={isBusy ? "Invio richiesta..." : "Connettiti"}
                      onPress={() => handleRequestConnection(result.profile_id)}
                      variant="secondary"
                    />
                  )}
                </Card>
              );
            })
          : ads.map((result) => (
              <Card key={result.ad_id}>
                <AppText variant="headingSm">{result.title}</AppText>
                <AppText variant="bodySm" color="secondary">
                  {result.club_name} · {formatPosition(result.role_required)}
                </AppText>
                <AppText variant="bodySm" color="secondary">
                  {[result.region, result.category].filter(Boolean).join(" · ") ||
                    "Dettagli da definire"}
                </AppText>
                {result.compensation_summary ? (
                  <Badge label={result.compensation_summary} variant="accent" />
                ) : null}
              </Card>
            ))}
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
  filterSection: {
    gap: spacing[8],
  },
});
