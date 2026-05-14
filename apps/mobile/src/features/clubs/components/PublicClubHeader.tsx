import { useState, type ComponentProps } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import type {
  ClubHeaderStats,
  PublicClubProfile,
} from "../club-service";
import type { ClubTeam } from "../team-service";

type ClubHeaderTab = "team" | "roster" | "media";

type MetadataItem = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
};

type PublicClubHeaderProps = {
  club: PublicClubProfile;
  isFollowed: boolean;
  isFollowing: boolean;
  onContactPress: () => void;
  onToggleFollow: () => void;
  stats: ClubHeaderStats;
  style?: StyleProp<ViewStyle>;
  teams: ClubTeam[];
};

const tabs: { label: string; value: ClubHeaderTab }[] = [
  { label: "Squadra", value: "team" },
  { label: "Organico", value: "roster" },
  { label: "Media", value: "media" },
];

export function PublicClubHeader({
  club,
  isFollowed,
  isFollowing,
  onContactPress,
  onToggleFollow,
  stats,
  style,
  teams,
}: PublicClubHeaderProps) {
  const [activeTab, setActiveTab] = useState<ClubHeaderTab>("team");
  const categoryLabel = getClubCategoryLabel(club, teams);
  const metadataItems = getMetadataItems(club);
  const initials = getClubInitials(club.name);

  return (
    <View style={[styles.container, style]} testID="club-profile-header">
      <View style={styles.identitySection}>
        <View style={styles.logoWrapper}>
          {club.logo_url ? (
            <Image
              accessibilityLabel={`Logo ${club.name}`}
              resizeMode="cover"
              source={{ uri: club.logo_url }}
              style={styles.logo}
            />
          ) : (
            <View style={styles.logoFallback} testID="club-logo-fallback">
              <AppText variant="headingLg" color="inverse">
                {initials}
              </AppText>
            </View>
          )}
          {club.verification_status === "verified" ? (
            <View style={styles.verifiedBadge}>
              <Ionicons color={colors.inkInvert} name="checkmark" size={14} />
            </View>
          ) : null}
        </View>

        <View style={styles.titleBlock}>
          <AppText
            align="center"
            numberOfLines={2}
            style={styles.clubName}
            variant="headingLg"
          >
            {club.name}
          </AppText>
          <View style={styles.categoryBadge}>
            <AppText style={styles.categoryLabel} variant="caption">
              {categoryLabel}
            </AppText>
          </View>
        </View>

        {metadataItems.length > 0 ? (
          <View style={styles.metadataRow}>
            {metadataItems.map((item, index) => (
              <View key={item.label} style={styles.metadataGroup}>
                {index > 0 ? <View style={styles.metadataDot} /> : null}
                <View style={styles.metadataItem}>
                  <Ionicons
                    color={colors.textSecondary}
                    name={item.icon}
                    size={14}
                  />
                  <AppText
                    color="secondary"
                    numberOfLines={1}
                    style={styles.metadataText}
                    variant="caption"
                  >
                    {item.label}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <HeaderStat
            label="Squadre attive"
            valueTestID="club-stat-active-teams-value"
            value={String(stats.activeTeamsCount)}
          />
          <View style={styles.statDivider} />
          <HeaderStat
            label="Giocatori"
            value={String(stats.playersCount)}
            valueTestID="club-stat-players-value"
          />
          <View style={styles.statDivider} />
          <HeaderStat
            label="Membri staff"
            value={String(stats.staffCount)}
            valueTestID="club-stat-staff-value"
          />
        </View>

        <View style={styles.actionsRow}>
          <Button
            label={isFollowed ? "Seguito" : "Segui"}
            loading={isFollowing}
            onPress={onToggleFollow}
            size="sm"
            style={styles.actionButton}
            variant={isFollowed ? "secondary" : "primary"}
          />
          <Button
            label="Contatta"
            onPress={onContactPress}
            size="sm"
            style={styles.actionButton}
            variant="outline"
          />
        </View>
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={styles.tab}
              testID={`club-tab-${tab.value}`}
            >
              <AppText
                align="center"
                color={isActive ? "primary" : "secondary"}
                style={[styles.tabLabel, isActive ? styles.activeTabLabel : null]}
                variant="bodySm"
              >
                {tab.label}
              </AppText>
              {isActive ? <View style={styles.activeTabIndicator} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function HeaderStat({
  label,
  value,
  valueTestID,
}: {
  label: string;
  value: string;
  valueTestID: string;
}) {
  return (
    <View style={styles.statItem}>
      <AppText
        align="center"
        style={styles.statValue}
        testID={valueTestID}
        variant="titleSm"
      >
        {value}
      </AppText>
      <AppText
        align="center"
        color="secondary"
        numberOfLines={1}
        style={styles.statLabel}
        variant="caption"
      >
        {label}
      </AppText>
    </View>
  );
}

function getClubCategoryLabel(club: PublicClubProfile, teams: ClubTeam[]) {
  const seniorTeam = teams.find((team) => team.team_type === "senior");

  return (
    club.category?.trim() ||
    seniorTeam?.category?.trim() ||
    club.league?.trim() ||
    "Categoria non indicata"
  );
}

function getMetadataItems(club: PublicClubProfile): MetadataItem[] {
  const stadium = club.stadium?.trim() || club.field_address?.trim();
  const items: MetadataItem[] = [];

  if (club.city.trim()) {
    items.push({ icon: "location-outline", label: club.city.trim() });
  }

  if (stadium) {
    items.push({ icon: "football-outline", label: stadium });
  }

  if (club.founding_year) {
    items.push({
      icon: "calendar-outline",
      label: `Fondato nel ${club.founding_year}`,
    });
  }

  return items;
}

function getClubInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return initials || "FC";
}

const styles = StyleSheet.create({
  actionButton: {
    borderRadius: radius.full,
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing[12],
    width: "100%",
  },
  activeTabIndicator: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.full,
    bottom: -1,
    height: 2,
    left: 0,
    position: "absolute",
    right: 0,
  },
  activeTabLabel: {
    fontWeight: typography.fontWeight.bold,
  },
  categoryBadge: {
    alignSelf: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[6],
    borderWidth: 1,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  categoryLabel: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  clubName: {
    fontWeight: typography.fontWeight.heavy,
  },
  container: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  identitySection: {
    alignItems: "center",
    gap: spacing[16],
    paddingBottom: spacing[20],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  logo: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surface,
    borderRadius: 44,
    borderWidth: 3,
    height: 88,
    width: 88,
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentStrong,
    borderColor: colors.surface,
    borderRadius: 44,
    borderWidth: 3,
    height: 88,
    justifyContent: "center",
    width: 88,
  },
  logoWrapper: {
    position: "relative",
  },
  metadataDot: {
    backgroundColor: colors.borderStrong,
    borderRadius: radius.full,
    height: 4,
    width: 4,
  },
  metadataGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    maxWidth: "100%",
  },
  metadataItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    maxWidth: 260,
  },
  metadataRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  metadataText: {
    fontSize: typography.fontSize[13],
    fontWeight: typography.fontWeight.medium,
    letterSpacing: 0,
    lineHeight: 18,
  },
  statDivider: {
    backgroundColor: colors.border,
    height: 24,
    width: 1,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  statLabel: {
    fontSize: typography.fontSize[11],
    fontWeight: typography.fontWeight.medium,
    letterSpacing: 0,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.bold,
    lineHeight: 18,
  },
  statsRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    width: "100%",
  },
  tab: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    position: "relative",
  },
  tabBar: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing[16],
  },
  tabLabel: {
    fontWeight: typography.fontWeight.semibold,
  },
  titleBlock: {
    alignItems: "center",
    gap: spacing[8],
    maxWidth: "100%",
  },
  verifiedBadge: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 2,
    bottom: 0,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 24,
  },
});
