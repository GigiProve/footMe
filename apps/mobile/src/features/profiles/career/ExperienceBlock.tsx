import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { GroupedExperience } from "./career-grouping";
import { SeasonTimeline } from "./SeasonTimeline";

type ExperienceBlockProps = {
  group: GroupedExperience;
  isLast: boolean;
  isOwner: boolean;
  onDelete: (group: GroupedExperience) => void;
  onEdit: (group: GroupedExperience) => void;
};

export function ExperienceBlock({
  group,
  isLast,
  isOwner,
  onDelete,
  onEdit,
}: ExperienceBlockProps) {
  return (
    <View style={[styles.container, isLast ? styles.containerLast : null]}>
      <TeamLogo logoUrl={group.teamLogoUrl} name={group.clubName} />
      <View style={styles.main}>
        <View style={styles.head}>
          <View style={styles.headInfo}>
            <AppText style={styles.teamName} variant="headingSm">
              {group.clubName}
            </AppText>
            <AppText color="muted" variant="bodySm">
              {group.durationLabel}
            </AppText>
          </View>
          {isOwner ? (
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Modifica esperienza"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onEdit(group)}
                style={styles.actionBtn}
              >
                <Ionicons color={colors.textSecondary} name="pencil-outline" size={14} />
              </Pressable>
              <Pressable
                accessibilityLabel="Elimina esperienza"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => onDelete(group)}
                style={styles.actionBtnDelete}
              >
                <Ionicons color={colors.danger} name="trash-outline" size={14} />
              </Pressable>
            </View>
          ) : null}
        </View>
        <SeasonTimeline seasons={group.seasons} />
      </View>
    </View>
  );
}

function TeamLogo({ logoUrl, name }: { logoUrl: string; name: string }) {
  if (logoUrl) {
    return (
      <View style={styles.logoContainer}>
        <Image
          source={{ uri: logoUrl }}
          style={styles.logoImage}
        />
      </View>
    );
  }

  return (
    <View style={styles.logoFallback}>
      <Ionicons color={colors.accent} name="shield" size={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  actionBtnDelete: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.full,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[10],
    paddingTop: spacing[4],
  },
  container: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingBottom: spacing[18],
  },
  containerLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  head: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[10],
    justifyContent: "space-between",
    marginBottom: spacing[14],
  },
  headInfo: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  logoContainer: {
    borderRadius: radius.full,
    flexShrink: 0,
    height: 36,
    marginTop: 2,
    overflow: "hidden",
    width: 36,
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexShrink: 0,
    height: 36,
    justifyContent: "center",
    marginTop: 2,
    width: 36,
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  teamName: {
    fontSize: typography.fontSize[17],
    fontWeight: typography.fontWeight.bold,
    lineHeight: 22,
  },
});
