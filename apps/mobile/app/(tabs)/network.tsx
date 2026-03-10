import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

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
import { colors } from "../../src/theme/tokens";

const modeOptions: Array<{ label: string; value: SearchMode }> = [
  { label: "Profili", value: "profiles" },
  { label: "Opportunita'", value: "ads" },
];

const roleOptions: Array<{ label: string; value: SearchRoleFilter }> = [
  { label: "Tutti", value: "all" },
  { label: "Calciatori", value: "player" },
  { label: "Allenatori", value: "coach" },
  { label: "Staff", value: "staff" },
  { label: "Societa'", value: "club_admin" },
];

const positionOptions: Array<{ label: string; value: SearchPositionFilter }> = [
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

export default function NetworkScreen() {
  const [mode, setMode] = useState<SearchMode>("profiles");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [roleFilter, setRoleFilter] = useState<SearchRoleFilter>("all");
  const [positionFilter, setPositionFilter] =
    useState<SearchPositionFilter>("all");
  const [profiles, setProfiles] = useState<ProfileSearchResult[]>([]);
  const [ads, setAds] = useState<RecruitingAdSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [mode, positionFilter, query, region, roleFilter]);

  async function loadResults() {
    try {
      setIsLoading(true);

      if (mode === "profiles") {
        const results = await searchProfiles({
          position: positionFilter,
          query,
          region,
          role: roleFilter,
        });
        setProfiles(results);
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
      setIsLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        <View
          style={{
            gap: 10,
            padding: 22,
            borderRadius: 26,
            backgroundColor: colors.textPrimary,
          }}
        >
          <Text
            style={{
              color: colors.heroSoft,
              fontSize: 12,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Discovery
          </Text>
          <Text
            style={{
              fontSize: 30,
              lineHeight: 34,
              fontWeight: "800",
              color: colors.inkInvert,
            }}
          >
            Cerca profili e opportunita'
          </Text>
          <Text
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: "rgba(255,253,252,0.78)",
            }}
          >
            La tab rete inizia a diventare utile: puoi cercare persone o annunci
            aperti con testo libero e filtri essenziali.
          </Text>
        </View>

        <View
          style={{
            gap: 14,
            padding: 18,
            borderRadius: 22,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", gap: 10 }}>
            {modeOptions.map((option) => {
              const isActive = option.value === mode;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setMode(option.value)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: isActive
                      ? colors.textPrimary
                      : colors.background,
                    borderWidth: 1,
                    borderColor: isActive ? colors.textPrimary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: isActive ? colors.inkInvert : colors.textPrimary,
                      fontWeight: "700",
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            onChangeText={setQuery}
            placeholder={
              mode === "profiles"
                ? "Cerca per nome o profilo"
                : "Cerca per annuncio o societa'"
            }
            placeholderTextColor={colors.textMuted}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.background,
            }}
            value={query}
          />

          <TextInput
            onChangeText={setRegion}
            placeholder="Regione"
            placeholderTextColor={colors.textMuted}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.background,
            }}
            value={region}
          />

          {mode === "profiles" ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                Ruolo
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {roleOptions.map((option) => {
                  const isActive = option.value === roleFilter;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setRoleFilter(option.value)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 999,
                        backgroundColor: isActive
                          ? colors.accent
                          : colors.background,
                        borderWidth: 1,
                        borderColor: isActive ? colors.accent : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive
                            ? colors.inkInvert
                            : colors.textPrimary,
                          fontWeight: "700",
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
              Posizione
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {positionOptions.map((option) => {
                const isActive = option.value === positionFilter;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setPositionFilter(option.value)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: isActive
                        ? colors.hero
                        : colors.background,
                      borderWidth: 1,
                      borderColor: isActive ? colors.hero : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: isActive ? colors.inkInvert : colors.textPrimary,
                        fontWeight: "700",
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {mode === "profiles" && profiles.length === 0 && !isLoading ? (
          <View
            style={{
              padding: 18,
              borderRadius: 20,
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

        {mode === "ads" && ads.length === 0 && !isLoading ? (
          <View
            style={{
              padding: 18,
              borderRadius: 20,
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
          ? profiles.map((result) => (
              <View
                key={result.profile_id}
                style={{
                  gap: 8,
                  padding: 18,
                  borderRadius: 22,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
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
                  {[result.city, result.region].filter(Boolean).join(" · ") ||
                    "Localita' non definita"}
                </Text>
                <View
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
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
                      fontWeight: "700",
                    }}
                  >
                    {result.is_available ? "Disponibile" : "Non disponibile"}
                  </Text>
                </View>
              </View>
            ))
          : ads.map((result) => (
              <View
                key={result.ad_id}
                style={{
                  gap: 8,
                  padding: 18,
                  borderRadius: 22,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: colors.textPrimary,
                  }}
                >
                  {result.title}
                </Text>
                <Text style={{ color: colors.textSecondary }}>
                  {result.club_name} · {formatPosition(result.role_required)}
                </Text>
                <Text style={{ color: colors.textSecondary }}>
                  {[result.region, result.category]
                    .filter(Boolean)
                    .join(" · ") || "Dettagli da definire"}
                </Text>
                {result.compensation_summary ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: colors.accentSoft,
                    }}
                  >
                    <Text
                      style={{ color: colors.accentStrong, fontWeight: "700" }}
                    >
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
