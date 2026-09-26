import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  createManagedPlayerDraftFromCandidate,
  type AgentManagedPlayerEntryDraft,
  type AgentPlayerCandidate,
} from "../../profiles/agent-profile";
import { getPlayerPositionLabel } from "../../profiles/player-sports";
import { colors } from "../../../styles";
import { AppText, Avatar } from "../../../ui";
import { OnboardingTextField } from "../ui";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

type AgentPortfolioLinkFieldProps = {
  entries: AgentManagedPlayerEntryDraft[];
  onChange: (entries: AgentManagedPlayerEntryDraft[]) => void;
  onLinked?: (count: number) => void;
  searchPlayers: (query: string) => Promise<AgentPlayerCandidate[]>;
};

/** Riga di disambiguazione: quel poco che serve a riconoscere la persona (§T). */
function buildCandidateDetail(candidate: {
  birth_year: number | null;
  category_label: string | null;
  primary_position: AgentPlayerCandidate["primary_position"];
  region?: string | null;
}) {
  return [
    candidate.primary_position
      ? getPlayerPositionLabel(candidate.primary_position)
      : null,
    candidate.category_label?.trim() || null,
    candidate.birth_year ? String(candidate.birth_year) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Collegamento dei calciatori già presenti su ProLink (REV-ONB-06 §T–§V).
 *
 * Si cerca una identity esistente e la si collega: nessuna scheda da
 * compilare campo per campo durante la registrazione. Il collegamento resta
 * facoltativo (§U) e non sostituisce il futuro workflow di rappresentanza
 * (§W) — qui si dichiara soltanto chi si segue.
 */
export function AgentPortfolioLinkField({
  entries,
  onChange,
  onLinked,
  searchPlayers,
}: AgentPortfolioLinkFieldProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AgentPlayerCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const linkedIds = useMemo(
    () =>
      new Set(
        entries
          .map((entry) => entry.linked_profile_id)
          .filter((value): value is string => Boolean(value)),
      ),
    [entries],
  );

  const trimmedQuery = query.trim();
  const isQueryLongEnough = trimmedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!isQueryLongEnough) {
      return undefined;
    }

    let isActive = true;

    const timeout = setTimeout(() => {
      setIsSearching(true);
      searchPlayers(trimmedQuery)
        .then((results) => {
          if (isActive) {
            setSuggestions(results);
          }
        })
        .catch(() => {
          if (isActive) {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (isActive) {
            setIsSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [isQueryLongEnough, searchPlayers, trimmedQuery]);

  function handleLink(candidate: AgentPlayerCandidate) {
    setQuery("");
    setSuggestions([]);

    if (linkedIds.has(candidate.profile_id)) {
      return;
    }

    const next = [...entries, createManagedPlayerDraftFromCandidate(candidate)];
    onChange(next);
    onLinked?.(next.length);
  }

  function handleUnlink(entryId: string) {
    onChange(entries.filter((entry) => entry.id !== entryId));
  }

  // Le vecchie proposte non sopravvivono a una query troppo corta: si
  // filtrano qui invece di azzerarle dentro l'effetto.
  const visibleSuggestions = isQueryLongEnough
    ? suggestions.filter((candidate) => !linkedIds.has(candidate.profile_id))
    : [];

  return (
    <View style={styles.container}>
      <OnboardingTextField
        autoCapitalize="words"
        autoCorrect={false}
        label="Collega calciatori su ProLink"
        onChangeText={setQuery}
        optional
        placeholder="Digita nome e cognome"
        testID="agent-portfolio-search"
        trailing={
          isSearching ? (
            <ActivityIndicator color={colors.textSecondary} size="small" />
          ) : (
            <Ionicons
              color={colors.textSecondary}
              name="search-outline"
              size={18}
            />
          )
        }
        value={query}
      />

      {isQueryLongEnough && !isSearching && visibleSuggestions.length === 0 ? (
        <AppText color="secondary" style={styles.hint} variant="meta">
          Nessun calciatore trovato con questo nome.
        </AppText>
      ) : null}

      {visibleSuggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {visibleSuggestions.map((candidate) => {
            const detail = buildCandidateDetail(candidate);

            return (
              <Pressable
                accessibilityHint="Collega questo calciatore al tuo portfolio"
                accessibilityRole="button"
                key={candidate.profile_id}
                onPress={() => handleLink(candidate)}
                style={styles.row}
                testID={`agent-portfolio-candidate-${candidate.profile_id}`}
              >
                <Avatar
                  name={candidate.full_name}
                  size="sm"
                  uri={candidate.avatar_url ?? undefined}
                />
                <View style={styles.rowText}>
                  <AppText numberOfLines={1} variant="titleSm">
                    {candidate.full_name}
                  </AppText>
                  {detail ? (
                    <AppText color="secondary" numberOfLines={1} variant="meta">
                      {detail}
                    </AppText>
                  ) : null}
                </View>
                <Ionicons color={colors.accent} name="add" size={20} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {entries.length > 0 ? (
        <View style={styles.linked}>
          {/* La lista può contenere anche voci inserite a mano con il
              vecchio onboarding (§BR): si parla di portfolio, non solo di
              collegamenti. */}
          <AppText color="secondary" variant="meta">
            {entries.length === 1
              ? "1 calciatore nel portfolio"
              : `${entries.length} calciatori nel portfolio`}
          </AppText>

          {entries.map((entry) => {
            const detail = buildCandidateDetail(entry);

            return (
              <View key={entry.id} style={styles.row}>
                <Avatar
                  name={entry.display_name}
                  size="sm"
                  uri={entry.avatar_url ?? undefined}
                />
                <View style={styles.rowText}>
                  <AppText numberOfLines={1} variant="titleSm">
                    {entry.display_name}
                  </AppText>
                  {detail ? (
                    <AppText color="secondary" numberOfLines={1} variant="meta">
                      {detail}
                    </AppText>
                  ) : null}
                </View>
                <Pressable
                  accessibilityLabel={`Rimuovi ${entry.display_name}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => handleUnlink(entry.id)}
                  testID={`agent-portfolio-remove-${entry.id}`}
                >
                  <Ionicons
                    color={colors.textSecondary}
                    name="close"
                    size={20}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingSpacing.s,
  },
  hint: {
    paddingHorizontal: onboardingSpacing.xs,
  },
  linked: {
    gap: onboardingSpacing.s,
    marginTop: onboardingSpacing.xs,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.s + 2,
    minHeight: onboardingLayout.rowMinHeight,
    paddingHorizontal: onboardingSpacing.m - 2,
    paddingVertical: onboardingSpacing.s,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  suggestions: {
    gap: onboardingSpacing.s,
  },
});
