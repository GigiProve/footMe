import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { SimplePlayerCareerEntry } from "./coach-career-types";
import { formatSeasonShort } from "./coach-career-utils";

type SimplePlayerCareerCardProps = {
  entry: SimplePlayerCareerEntry;
  onEdit: () => void;
};

export function SimplePlayerCareerCard({
  entry,
  onEdit,
}: SimplePlayerCareerCardProps) {
  const seasonLabel = formatSeasonShort(entry.season);

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.content}>
        <View style={cardStyles.header}>
          <AppText variant="titleMd" style={cardStyles.teamName}>
            {entry.teamName}
          </AppText>
          <Pressable
            accessibilityLabel="Modifica carriera"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onEdit}
            style={cardStyles.editButton}
          >
            <Ionicons name="pencil" size={14} color={colors.textSecondary} />
          </Pressable>
        </View>

        <AppText variant="bodySm" color="secondary">
          {entry.position}
          {entry.category ? ` • ${entry.category}` : ""}
        </AppText>

        {seasonLabel ? (
          <View style={cardStyles.durationRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textSecondary}
            />
            <AppText variant="bodySm" color="secondary">
              {seasonLabel}
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
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    marginTop: spacing[4],
  },
});
