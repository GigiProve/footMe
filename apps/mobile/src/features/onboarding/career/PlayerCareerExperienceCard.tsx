import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { PlayerCareerEntry } from "./player-career-types";
import { computePlayerSeasonsFromPeriod } from "./player-career-utils";

type PlayerCareerExperienceCardProps = {
  entry: PlayerCareerEntry;
  onDelete?: () => void;
  onEdit: () => void;
};

function formatDuration(entry: PlayerCareerEntry): string {
  if (entry.type === "CUSTOM_PERIOD" && entry.period) {
    const { startMonth, startYear, endMonth, endYear } = entry.period;
    const start = startMonth ? `${startMonth} ${startYear}` : startYear;
    const end = endMonth ? `${endMonth} ${endYear}` : endYear;
    return `Da ${start} a ${end}`;
  }

  return entry.seasons
    .map((s) => {
      const parts = s.split("/");
      if (parts.length !== 2) return s;
      const endYear = parts[1];
      return `${parts[0]}/${endYear.length === 4 ? endYear.slice(2) : endYear}`;
    })
    .join(", ");
}

function formatSeasonShort(season: string): string {
  const parts = season.split("/");
  if (parts.length !== 2) return season;
  const endYear = parts[1];
  return `${parts[0]}/${endYear.length === 4 ? endYear.slice(2) : endYear}`;
}

function getPartialSeasonLabel(entry: PlayerCareerEntry): string | null {
  if (entry.type !== "CUSTOM_PERIOD" || !entry.period) {
    return null;
  }

  const seasons = computePlayerSeasonsFromPeriod(entry.period);
  if (seasons.length !== 1) {
    return null;
  }

  return `Stagione parziale ${formatSeasonShort(seasons[0])}`;
}

export function PlayerCareerExperienceCard({
  entry,
  onDelete,
  onEdit,
}: PlayerCareerExperienceCardProps) {
  const duration = formatDuration(entry);
  const partialSeasonLabel = getPartialSeasonLabel(entry);

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.content}>
        <View style={cardStyles.header}>
          <AppText variant="titleMd" style={cardStyles.teamName}>
            {entry.teamName}
          </AppText>
          <View style={cardStyles.actions}>
            <Pressable
              accessibilityLabel="Modifica esperienza"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onEdit}
              style={cardStyles.editButton}
            >
              <Ionicons name="pencil" size={14} color={colors.textSecondary} />
            </Pressable>
            {onDelete ? (
              <Pressable
                accessibilityLabel="Elimina esperienza"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onDelete}
                style={cardStyles.editButton}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {entry.category ? (
          <AppText variant="bodySm" color="secondary">
            {entry.category}
          </AppText>
        ) : null}

        {partialSeasonLabel ? (
          <View style={cardStyles.partialBadge}>
            <AppText variant="caption" style={cardStyles.partialBadgeText}>
              {partialSeasonLabel}
            </AppText>
          </View>
        ) : null}

        {duration ? (
          <View style={cardStyles.durationRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textSecondary}
            />
            <AppText variant="bodySm" color="secondary">
              {duration}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
    padding: spacing[16],
  },
  content: {
    gap: spacing[4],
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teamName: {
    flex: 1,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  partialBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.heroSoft,
    borderWidth: 1,
    borderColor: colors.hero,
    marginTop: spacing[4],
  },
  partialBadgeText: {
    color: colors.hero,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    marginTop: spacing[4],
  },
});
