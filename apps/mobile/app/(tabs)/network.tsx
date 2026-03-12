import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useSession } from "../../src/features/auth/use-session";
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
import { colors, radius, spacing, typography } from "../../src/theme/tokens";
import { Button, Input } from "../../src/ui";

const modeOptions: { label: string; value: SearchMode }[] = [
  { label: "Profili", value: "profiles" },
  { label: "Opportunita'", value: "ads" },
];

const roleOptions: { label: string; value: SearchRoleFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Calciatori", value: "player" },
  { label: "Allenatori", value: "coach" },
  { label: "Staff", value: "staff" },
  { label: "Societa'", value: "club_admin" },
];

const positionOptions: { label: string; value: SearchPositionFilter }[] = [
  { label: "Tutte", value: "all" },
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore", value: "defender" },
  { label: "Centrocampista", value: "midfielder" },
  { label: "Attaccante", value: "forward" },
];

const roleLabels: Record<string, string> = {
  club_admin: "Societa'",
  coach: "Allenatore",
  player: "Calciatore",
  staff: "Staff",
};

const positionLabels: Record<string, string> = {
  defender: "Difensore",
  forward: "Attaccante",
  goalkeeper: "Portiere",
  midfielder: "Centrocampista",
};

function formatRole(value: string | null) {
  if (!value) {
    return "Ruolo non definito";
  }

  return roleLabels[value] ?? value;
}

function formatPosition(value: string | null) {
  if (!value) {
    return "Posizione non definita";
  }

  return positionLabels[value] ?? value;
}

function formatLocation(city: string | null, region: string | null) {
  return [city, region].filter(Boolean).join(" · ") || "Localita' non definita";
}

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
      <ScrollView contentContainerStyle={{ gap: spacing[16], paddingBottom: 24 }}>
        <View
          style={{
            gap: spacing[10],
            padding: 22,
            borderRadius: radius[26],
            backgroundColor: colors.textPrimary,
          }}
        >
          <Text
            style={{
              color: colors.heroSoft,
              fontSize: typography.fontSize[12],
              fontWeight: typography.fontWeight.heavy,
              textTransform: "uppercase",
              letterSpacing: typography.letterSpacing.sm,
            }}
          >
            Networking MVP
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize[30],
              lineHeight: typography.lineHeight[34],
              fontWeight: typography.fontWeight.heavy,
              color: colors.inkInvert,
            }}
          >
            Costruisci la tua rete e apri conversazioni dirette
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize[16],
              lineHeight: typography.lineHeight[24],
              color: colors.textInverseMuted,
            }}
          >
            Ora la sezione rete non è più solo discovery: puoi gestire
            richieste, vedere connessioni attive e passare subito alla chat.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: spacing[12] }}>
          <View
            style={{
              flex: 1,
              padding: 16,
              borderRadius: radius[22],
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.fontSize[12],
                fontWeight: typography.fontWeight.bold,
                textTransform: "uppercase",
              }}
            >
              Connessioni attive
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.textPrimary,
                fontSize: typography.fontSize[24],
                fontWeight: typography.fontWeight.heavy,
              }}
            >
              {acceptedConnections.length}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              padding: 16,
              borderRadius: radius[22],
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: typography.fontSize[12],
                fontWeight: typography.fontWeight.bold,
                textTransform: "uppercase",
              }}
            >
              Da gestire
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.textPrimary,
                fontSize: typography.fontSize[24],
                fontWeight: typography.fontWeight.heavy,
              }}
            >
              {incomingRequests.length}
            </Text>
          </View>
        </View>

        <View
          style={{
            gap: spacing[14],
            padding: 18,
            borderRadius: radius[22],
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: typography.fontSize[18], fontWeight: typography.fontWeight.heavy }}>
            Stato della rete
          </Text>
          {isNetworkLoading ? (
            <Text style={{ color: colors.textSecondary }}>
              Caricamento connessioni in corso...
            </Text>
          ) : null}
          {!isNetworkLoading && incomingRequests.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              Nessuna richiesta in attesa. Usa la ricerca qui sotto per ampliare
              il tuo network.
            </Text>
          ) : null}
          {incomingRequests.map((entry) => (
            <View
              key={entry.connection_id}
              style={{
                gap: spacing[10],
                padding: 16,
                borderRadius: radius[18],
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: typography.fontSize[16], fontWeight: typography.fontWeight.heavy }}>
                {entry.other_full_name}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                {formatRole(entry.other_role)}
                {entry.other_role === "player"
                  ? ` · ${formatPosition(entry.other_primary_position)}`
                  : ""}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                {formatLocation(entry.other_city, entry.other_region)}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing[10] }}>
                <Button
                  disabled={actionConnectionId === entry.connection_id}
                  label="Accetta"
                  onPress={() =>
                    handleUpdateConnectionStatus(entry.connection_id, "accepted")
                  }
                  style={{ flex: 1 }}
                />
                <Button
                  disabled={actionConnectionId === entry.connection_id}
                  label="Rifiuta"
                  onPress={() =>
                    handleUpdateConnectionStatus(entry.connection_id, "rejected")
                  }
                  style={{ flex: 1 }}
                  variant="secondary"
                />
              </View>
            </View>
          ))}
          {!isNetworkLoading && acceptedConnections.length > 0 ? (
            <View style={{ gap: spacing[10] }}>
              <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.heavy }}>
                Connessioni pronte per la chat
              </Text>
              {acceptedConnections.slice(0, 3).map((entry) => (
                <View
                  key={entry.connection_id}
                  style={{
                    gap: spacing[8],
                    padding: 16,
                    borderRadius: radius[18],
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: typography.fontSize[16],
                      fontWeight: typography.fontWeight.heavy,
                    }}
                  >
                    {entry.other_full_name}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {formatRole(entry.other_role)}
                    {entry.other_role === "player"
                      ? ` · ${formatPosition(entry.other_primary_position)}`
                      : ""}
                  </Text>
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
                </View>
              ))}
            </View>
          ) : null}
          {!isNetworkLoading && outgoingRequests.length > 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              Richieste inviate in attesa: {outgoingRequests.length}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            gap: spacing[14],
            padding: 18,
            borderRadius: radius[22],
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", gap: spacing[10] }}>
            {modeOptions.map((option) => {
              const isActive = option.value === mode;

              return (
                <Button
                  key={option.value}
                  label={option.label}
                  onPress={() => setMode(option.value)}
                  selected={isActive}
                  size="sm"
                  variant="chipAction"
                />
              );
            })}
          </View>

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
            <View style={{ gap: spacing[8] }}>
              <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
                Ruolo
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[8] }}>
                {roleOptions.map((option) => {
                  const isActive = option.value === roleFilter;

                  return (
                    <Button
                      key={option.value}
                      label={option.label}
                      onPress={() => setRoleFilter(option.value)}
                      selected={isActive}
                      size="sm"
                      variant="chipAction"
                    />
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={{ gap: spacing[8] }}>
            <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
              Posizione
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[8] }}>
              {positionOptions.map((option) => {
                const isActive = option.value === positionFilter;

                return (
                  <Button
                    key={option.value}
                    label={option.label}
                    onPress={() => setPositionFilter(option.value)}
                    selected={isActive}
                    size="sm"
                    variant="chipAction"
                  />
                );
              })}
            </View>
          </View>
        </View>

        {mode === "profiles" && profiles.length === 0 && !isSearchLoading ? (
          <View
            style={{
              padding: 18,
              borderRadius: radius[20],
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textSecondary }}>
              Nessun profilo trovato con i filtri attuali.
            </Text>
          </View>
        ) : null}

        {mode === "ads" && ads.length === 0 && !isSearchLoading ? (
          <View
            style={{
              padding: 18,
              borderRadius: radius[20],
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textSecondary }}>
              Nessuna opportunita' trovata con i filtri attuali.
            </Text>
          </View>
        ) : null}

        {mode === "profiles"
          ? profiles.map((result) => {
              const connection = connectionMap.get(result.profile_id);
              const isBusy = actionProfileId === result.profile_id;
              const statusLabel = getConnectionStatusLabel(connection);

              return (
                <View
                  key={result.profile_id}
                  style={{
                    gap: spacing[10],
                    padding: 18,
                    borderRadius: radius[22],
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize[18],
                      fontWeight: typography.fontWeight.heavy,
                      color: colors.textPrimary,
                    }}
                  >
                    {result.full_name}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {formatRole(result.role)}
                    {result.role === "player"
                      ? ` · ${formatPosition(result.primary_position)}`
                      : ""}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {formatLocation(result.city, result.region)}
                  </Text>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: radius.full,
                      backgroundColor: result.is_available
                        ? colors.accentSoft
                        : colors.surfaceMuted,
                    }}
                  >
                    <Text
                      style={{
                        color: result.is_available
                          ? colors.accentStrong
                          : colors.textSecondary,
                        fontWeight: typography.fontWeight.bold,
                      }}
                    >
                      {result.is_available ? "Disponibile" : "Non disponibile"}
                    </Text>
                  </View>
                  {statusLabel ? (
                    <Text style={{ color: colors.textSecondary }}>{statusLabel}</Text>
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
                    <View style={{ flexDirection: "row", gap: spacing[10] }}>
                      <Button
                        disabled={actionConnectionId === connection.connection_id}
                        label="Accetta"
                        onPress={() =>
                          handleUpdateConnectionStatus(
                            connection.connection_id,
                            "accepted",
                          )
                        }
                        style={{ flex: 1 }}
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
                        style={{ flex: 1 }}
                        variant="secondary"
                      />
                    </View>
                  ) : connection?.status === "pending" && connection.is_requester ? (
                    <View
                      style={{
                        paddingVertical: 12,
                        borderRadius: radius[14],
                        alignItems: "center",
                        backgroundColor: colors.surfaceMuted,
                      }}
                    >
                      <Text style={{ color: colors.textSecondary, fontWeight: typography.fontWeight.bold }}>
                        Richiesta in attesa
                      </Text>
                    </View>
                  ) : connection?.status === "blocked" ? (
                    <View
                      style={{
                        paddingVertical: 12,
                        borderRadius: radius[14],
                        alignItems: "center",
                        backgroundColor: colors.surfaceMuted,
                      }}
                    >
                      <Text style={{ color: colors.textSecondary, fontWeight: typography.fontWeight.bold }}>
                        Connessione bloccata
                      </Text>
                    </View>
                  ) : (
                      <Button
                        disabled={isBusy}
                        fullWidth
                        label={isBusy ? "Invio richiesta..." : "Connettiti"}
                        onPress={() => handleRequestConnection(result.profile_id)}
                        variant="secondary"
                      />
                    )}
                </View>
              );
            })
          : ads.map((result) => (
              <View
                key={result.ad_id}
                style={{
                  gap: spacing[8],
                  padding: 18,
                  borderRadius: radius[22],
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize[18],
                    fontWeight: typography.fontWeight.heavy,
                    color: colors.textPrimary,
                  }}
                >
                  {result.title}
                </Text>
                <Text style={{ color: colors.textSecondary }}>
                  {result.club_name} · {formatPosition(result.role_required)}
                </Text>
                <Text style={{ color: colors.textSecondary }}>
                  {[result.region, result.category].filter(Boolean).join(" · ") ||
                    "Dettagli da definire"}
                </Text>
                {result.compensation_summary ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: radius.full,
                      backgroundColor: colors.accentSoft,
                    }}
                  >
                    <Text style={{ color: colors.accentStrong, fontWeight: typography.fontWeight.bold }}>
                      {result.compensation_summary}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
      </ScrollView>
    </Screen>
  );
}
