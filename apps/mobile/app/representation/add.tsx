import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../src/components/ui/screen";
import { AppText, Avatar, Button, EmptyState, Input, ScreenHeader } from "../../src/ui";
import {
  searchAgentPlayerCandidates,
} from "../../src/features/profiles/profile-service";
import {
  getPlayerPositionLabel,
  type PlayerPosition,
} from "../../src/features/profiles/player-sports";
import { colors, radius, shadows, spacing, typography } from "../../src/theme/tokens";

type Candidate = {
  avatar_url: string | null;
  birth_year: number | null;
  category_label: string | null;
  full_name: string;
  is_free_agent: boolean;
  primary_position: PlayerPosition | null;
  profile_id: string;
  region: string | null;
};

const POSITION_FILTER_OPTIONS: { label: string; value: PlayerPosition }[] = [
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore", value: "defender" },
  { label: "Centrocampista", value: "midfielder" },
  { label: "Attaccante", value: "forward" },
];

export default function AddRepresentationScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [positionFilter, setPositionFilter] = useState<PlayerPosition | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    let active = true;
    setLoading(true);

    searchAgentPlayerCandidates(trimmed)
      .then((data) => {
        if (!active) return;
        setResults(data as Candidate[]);
        setSearched(true);
      })
      .catch(() => {
        if (!active) return;
        setResults([]);
        setSearched(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  const filtered =
    positionFilter != null
      ? results.filter((r) => r.primary_position === positionFilter)
      : results;

  function handleSendRequest(candidate: Candidate) {
    router.push({
      pathname: "/representation/request",
      params: {
        playerId: candidate.profile_id,
        name: candidate.full_name,
        position: candidate.primary_position ?? "",
        team: candidate.is_free_agent
          ? "Svincolato"
          : (candidate.category_label ?? ""),
        birthYear: candidate.birth_year != null ? String(candidate.birth_year) : "",
        region: candidate.region ?? "",
      },
    });
  }

  const showEmpty = !loading && searched && filtered.length === 0;
  const showIdle = !loading && !searched && query.trim().length < 2;

  return (
    <Screen>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Aggiungi assistito"
          action={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons
                color={colors.textPrimary}
                name="arrow-back"
                size={20}
              />
            </Pressable>
          }
        />
      </View>

      <View style={styles.searchRow}>
        <Input
          autoFocus
          placeholder="Cerca per nome, squadra, ruolo o città"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <View style={styles.filtersRow}>
        {POSITION_FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            label={opt.label}
            onPress={() =>
              setPositionFilter(
                positionFilter === opt.value ? null : opt.value,
              )
            }
            selected={positionFilter === opt.value}
            size="sm"
            variant="chipAction"
          />
        ))}
        <Button
          label="Età"
          onPress={() => {}}
          disabled
          size="sm"
          variant="chipAction"
        />
        <Button
          label="Zona"
          onPress={() => {}}
          disabled
          size="sm"
          variant="chipAction"
        />
        <Button
          label="Disponibilità"
          onPress={() => {}}
          disabled
          size="sm"
          variant="chipAction"
        />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : showIdle ? (
        <EmptyState
          icon="search-outline"
          title="Cerca un calciatore"
          description="Digita almeno 2 caratteri per iniziare la ricerca."
        />
      ) : showEmpty ? (
        <EmptyState
          icon="person-outline"
          title="Nessun calciatore trovato"
          description="Prova con un nome, squadra o città diversi."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.profile_id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <CandidateRow
              candidate={item}
              onSendRequest={() => handleSendRequest(item)}
            />
          )}
        />
      )}
    </Screen>
  );
}

type CandidateRowProps = {
  candidate: Candidate;
  onSendRequest: () => void;
};

function CandidateRow({ candidate, onSendRequest }: CandidateRowProps) {
  const positionLabel = candidate.primary_position
    ? getPlayerPositionLabel(candidate.primary_position)
    : null;
  const teamLabel = candidate.is_free_agent
    ? "Svincolato"
    : (candidate.category_label ?? "—");
  const subtitleLine = [positionLabel, teamLabel].filter(Boolean).join(" • ");
  const metaLine = [
    candidate.birth_year ? `Classe ${candidate.birth_year}` : null,
    candidate.region ?? null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <View style={styles.row}>
      <Avatar
        uri={candidate.avatar_url}
        name={candidate.full_name}
        size="md"
      />
      <View style={styles.rowBody}>
        <AppText variant="titleSm" numberOfLines={1}>
          {candidate.full_name}
        </AppText>
        {subtitleLine ? (
          <AppText variant="bodySm" color="accent" numberOfLines={1}>
            {subtitleLine}
          </AppText>
        ) : null}
        {metaLine ? (
          <AppText
            variant="bodySm"
            color="muted"
            numberOfLines={1}
            style={styles.metaText}
          >
            {metaLine}
          </AppText>
        ) : null}
      </View>
      <Button
        label="Invia richiesta"
        onPress={onSendRequest}
        size="sm"
        variant="primary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: spacing[16],
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.75,
  },
  searchRow: {
    marginBottom: spacing[12],
  },
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginBottom: spacing[16],
  },
  loaderContainer: {
    paddingVertical: spacing[40],
    alignItems: "center",
  },
  listContent: {
    gap: spacing[0],
  },
  separator: {
    height: spacing[8],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[14],
    ...shadows.subtle,
  },
  rowBody: {
    flex: 1,
    gap: spacing[4],
  },
  metaText: {
    fontSize: typography.fontSize[12],
  },
});
