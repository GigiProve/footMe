import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Card } from "../../../ui";
import type { CareerExperience } from "./career-types";
import { formatExperienceDuration, getStatsSummary } from "./career-utils";

type ExperienceCardProps = {
  experience: CareerExperience;
  onEdit: () => void;
};

export function ExperienceCard({ experience, onEdit }: ExperienceCardProps) {
  const duration = formatExperienceDuration(experience);
  const statsSummary = getStatsSummary(experience);

  return (
    <Card style={cardStyles.card}>
      <View style={cardStyles.row}>
        <View style={cardStyles.iconCircle}>
          <Ionicons name="shield-outline" size={24} color={colors.hero} />
        </View>

        <View style={cardStyles.content}>
          <View style={cardStyles.header}>
            <AppText variant="titleMd" style={cardStyles.teamName}>
              {experience.teamName}
            </AppText>
            <Pressable
              accessibilityLabel="Modifica esperienza"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onEdit}
              style={cardStyles.editButton}
            >
              <Ionicons name="pencil" size={14} color={colors.textSecondary} />
            </Pressable>
          </View>

          <AppText variant="bodySm" color="secondary">
            {experience.category}
          </AppText>

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

          {statsSummary ? (
            <View style={cardStyles.statsRow}>
              <Ionicons
                name="stats-chart-outline"
                size={14}
                color={colors.textSecondary}
              />
              <AppText variant="bodySm" color="secondary">
                {statsSummary}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    padding: spacing[16],
  },
  row: {
    flexDirection: "row",
    gap: spacing[14],
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.heroSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
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
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
  },
});
