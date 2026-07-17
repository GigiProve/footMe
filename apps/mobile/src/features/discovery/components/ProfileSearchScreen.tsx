import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";

import { useSession } from "../../auth/use-session";
import {
  searchProfiles,
  searchRecruitingAds,
  type ProfileSearchResult,
  type RecruitingAdSearchResult,
  type SearchMode,
  type SearchPositionFilter,
  type SearchRoleFilter,
} from "../discovery-service";
import {
  getNetworkOverview,
  requestConnection,
  updateConnectionStatus,
  type NetworkOverviewItem,
} from "../../networking/networking-service";
import { openDirectConversation } from "../../messaging/messaging-service";
import { PlayerSearchCard } from "../../networking/components/PlayerSearchCard";
import {
  formatLocation,
  formatPosition,
  formatRole,
} from "../../profiles/profile-display-helpers";
import { spacing } from "../../../theme/tokens";
import {
  AppText,
  Badge,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Input,
  ScreenHeader,
} from "../../../ui";

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

const positionOptions: readonly {
  label: string;
  value: SearchPositionFilter;
}[] = [
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

type ProfileSearchScreenProps = {
  /** Hides the internal section heading. Enable when the host screen already
   * renders its own ScreenHeader / section title above the search UI. */
  hideHeader?: boolean;
};

export function ProfileSearchScreen({
  hideHeader = true,
}: ProfileSearchScreenProps) {
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
  const [networkEntries, setNetworkEntries] = useState<NetworkOverviewItem[]>(
    [],
  );
  const [isSearchLoading, setIsSearchLoading] = useState(true);
  const [actionProfileId, setActionProfileId] = useState<string | null>(null);
  const [actionConnectionId, setActionConnectionId] = useState<string | null>(
    null,
  );

  const connectionMap = useMemo(
    () =>
      new Map(
        networkEntries.map((entry) => [entry.other_profile_id, entry] as const),
      ),
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
      return;
    }

    try {
      const result = await getNetworkOverview();
      setNetworkEntries(result);
    } catch {
      // Connection status is a secondary affordance here; ignore silently.
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
    <View style={styles.container}>
      {!hideHeader ? (
        <ScreenHeader
          title="Cerca"
          subtitle="Trova giocatori, allenatori e opportunita'"
        />
      ) : null}

      <Card>
        <ChipGroup onChange={(value) => { if (value !== null) setMode(value); }} options={modeOptions} value={mode} />

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
              onChange={(value) => { if (value !== null) setRoleFilter(value); }}
              options={roleOptions}
              value={roleFilter}
            />
          </View>
        ) : null}

        <View style={styles.filterSection}>
          <AppText variant="caption">Posizione</AppText>
          <ChipGroup
            onChange={(value) => { if (value !== null) setPositionFilter(value); }}
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
            const roleLabel = formatRole(result.role);
            const posLabel =
              result.role === "player"
                ? formatPosition(result.primary_position)
                : "";
            const subtitle = [roleLabel, posLabel]
              .filter(Boolean)
              .join(" · ");
            const location = formatLocation(result.city, result.region);

            return (
              <View key={result.profile_id} style={styles.resultItem}>
                <PlayerSearchCard
                  avatarUrl={null}
                  category={location}
                  name={result.full_name}
                  onPress={() => {}}
                  onViewProfile={() => {}}
                  region={result.region ?? ""}
                  role={result.role}
                  subtitle={subtitle}
                />
                {statusLabel ? (
                  <AppText
                    variant="bodySm"
                    color="secondary"
                    style={styles.statusLabel}
                  >
                    {statusLabel}
                  </AppText>
                ) : null}
                {connection?.status !== "blocked" ? (
                  <Button
                    disabled={isBusy}
                    fullWidth
                    label={isBusy ? "Apertura chat..." : "Messaggia"}
                    onPress={() =>
                      handleOpenConversation(
                        result.profile_id,
                        result.full_name,
                      )
                    }
                    size="sm"
                    variant="secondary"
                  />
                ) : null}
                {connection?.status === "accepted" ? null : connection?.status ===
                    "pending" && !connection.is_requester ? (
                  <View style={styles.actionRow}>
                    <Button
                      disabled={
                        actionConnectionId === connection.connection_id
                      }
                      label="Accetta"
                      onPress={() =>
                        handleUpdateConnectionStatus(
                          connection.connection_id,
                          "accepted",
                        )
                      }
                      size="sm"
                      style={styles.flex1}
                    />
                    <Button
                      disabled={
                        actionConnectionId === connection.connection_id
                      }
                      label="Rifiuta"
                      onPress={() =>
                        handleUpdateConnectionStatus(
                          connection.connection_id,
                          "rejected",
                        )
                      }
                      size="sm"
                      style={styles.flex1}
                      variant="secondary"
                    />
                  </View>
                ) : connection?.status === "pending" &&
                  connection.is_requester ? (
                  <Badge label="Richiesta in attesa" />
                ) : connection?.status === "blocked" ? (
                  <Badge label="Connessione bloccata" />
                ) : (
                  <Button
                    disabled={isBusy}
                    fullWidth
                    label={isBusy ? "Invio richiesta..." : "Connettiti"}
                    onPress={() => handleRequestConnection(result.profile_id)}
                    size="sm"
                    variant="secondary"
                  />
                )}
              </View>
            );
          })
        : ads.map((result) => (
            <Card key={result.ad_id}>
              <AppText variant="headingSm">{result.title}</AppText>
              <AppText variant="bodySm" color="secondary">
                {result.club_name} · {formatPosition(result.role_required)}
              </AppText>
              <AppText variant="bodySm" color="secondary">
                {[result.region, result.category]
                  .filter(Boolean)
                  .join(" · ") || "Dettagli da definire"}
              </AppText>
              {result.compensation_summary ? (
                <Badge label={result.compensation_summary} variant="accent" />
              ) : null}
            </Card>
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  flex1: {
    flex: 1,
  },
  filterSection: {
    gap: spacing[8],
  },
  resultItem: {
    gap: spacing[8],
  },
  statusLabel: {
    paddingHorizontal: spacing[4],
  },
});
