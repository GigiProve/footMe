import { useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { radius, spacing } from "../../../theme/tokens";
import { AppText, EmptyState } from "../../../ui";
import type { DirectorMediaLinkedTarget } from "../director-media";
import { withDefaultProfileAvatar } from "../profile-avatar";
import type { CompleteProfessionalProfile } from "../profile-service";
import { DirectorMediaTabContent } from "./DirectorMediaTabContent";
import { DirectorInfoTab } from "./DirectorInfoTab";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";

type DirectorProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isConnecting?: boolean;
  isMessaging?: boolean;
  isOwner?: boolean;
  onConnect?: () => void;
  onDeleteMedia?: (itemId: string) => void;
  onEditMedia?: (itemId: string) => void;
  onManageMedia?: () => void;
  onMessage?: () => void;
  onOpenLinkedTarget?: (target: DirectorMediaLinkedTarget) => void;
  onToggleMediaFeatured?: (itemId: string) => void;
};

type DirectorCareerPreview = {
  category: string;
  description: string;
  id: string;
  meta: string;
  period: string;
  role: string;
  teamLogoUrl: string;
  teamName: string;
};

type PreviousCareerPreview = DirectorCareerPreview;

const DIRECTOR_TABS: { label: string; value: ProfileTab }[] = [
  { label: "Info", value: "info" },
  { label: "Carriera", value: "career" },
  { label: "Media", value: "media" },
];

const bananiColors = {
  background: "#F7FAFD",
  border: "#00000014",
  foreground: "#061223",
  muted: "#F3F6F9",
  mutedForeground: "#2F3B45",
  primary: "#0A66CC",
} as const;

export function DirectorProfileTabView({
  completeProfile,
  isConnecting = false,
  isMessaging = false,
  isOwner = false,
  onConnect,
  onDeleteMedia,
  onEditMedia,
  onManageMedia,
  onMessage,
  onOpenLinkedTarget,
  onToggleMediaFeatured,
}: DirectorProfileTabViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("career");

  return (
    <View style={styles.container}>
      <DirectorProfileHeader completeProfile={completeProfile} />
      <ProfileTabBar
        activeColor={bananiColors.foreground}
        activeTab={activeTab}
        backgroundColor={bananiColors.background}
        borderColor={bananiColors.border}
        inactiveColor={bananiColors.mutedForeground}
        indicatorColor={bananiColors.foreground}
        onTabChange={setActiveTab}
        tabs={DIRECTOR_TABS}
      />

      {activeTab === "career" ? (
        <DirectorCareerTabContent completeProfile={completeProfile} />
      ) : activeTab === "media" ? (
        <DirectorMediaTabContent
          authorAvatarUrl={completeProfile.profile.avatar_url}
          authorName={completeProfile.profile.full_name}
          initialItems={completeProfile.directorProfile?.media_items ?? []}
          mode={isOwner ? "owner" : "visitor"}
          onAddContentPress={isOwner ? onManageMedia : undefined}
          onDeleteContentPress={isOwner ? onDeleteMedia : undefined}
          onEditContentPress={isOwner ? onEditMedia : undefined}
          onOpenLinkedTarget={onOpenLinkedTarget}
          onToggleFeaturedPress={isOwner ? onToggleMediaFeatured : undefined}
        />
      ) : (
        <DirectorInfoTab
          completeProfile={completeProfile}
          isConnecting={isConnecting}
          isMessaging={isMessaging}
          isOwner={isOwner}
          onConnect={onConnect}
          onMessage={onMessage}
        />
      )}
    </View>
  );
}

function DirectorProfileHeader({
  completeProfile,
}: {
  completeProfile: CompleteProfessionalProfile;
}) {
  const directorProfile = completeProfile.directorProfile;
  const primaryRole =
    directorProfile?.primary_role?.trim() ||
    directorProfile?.director_roles.find((role) => role.trim())?.trim() ||
    "Dirigente";
  const meta = buildHeaderMeta(completeProfile);

  return (
    <View style={styles.profileHeader}>
      <Image
        accessibilityLabel={completeProfile.profile.full_name}
        source={{
          uri: withDefaultProfileAvatar(completeProfile.profile.avatar_url),
        }}
        style={styles.profileImage}
      />
      <AppText style={styles.profileName}>
        {completeProfile.profile.full_name}
      </AppText>
      <AppText style={styles.profileRole}>{primaryRole}</AppText>
      {meta.length > 0 ? (
        <View style={styles.profileMeta}>
          {meta.map((item, index) => (
            <View key={`${item}-${index}`} style={styles.metaItem}>
              {index > 0 ? <View style={styles.metaDot} /> : null}
              {item === completeProfile.profile.region ? (
                <Ionicons
                  color={bananiColors.mutedForeground}
                  name="location-outline"
                  size={14}
                />
              ) : null}
              <AppText style={[styles.metaText, index === 0 ? styles.metaTextStrong : null]}>
                {item}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DirectorCareerTabContent({
  completeProfile,
}: {
  completeProfile: CompleteProfessionalProfile;
}) {
  const directorProfile = completeProfile.directorProfile;
  const directorEntries = useMemo(
    () => buildDirectorCareerPreviews(directorProfile?.career_entries ?? []),
    [directorProfile?.career_entries],
  );
  const coachEntries = useMemo(
    () =>
      buildPreviousCoachPreviews(directorProfile?.coach_career_entries ?? []),
    [directorProfile?.coach_career_entries],
  );
  const playerEntries = useMemo(
    () =>
      buildPreviousPlayerPreviews(directorProfile?.player_career_entries ?? []),
    [directorProfile?.player_career_entries],
  );
  const hasAnyEntry =
    directorEntries.length > 0 ||
    coachEntries.length > 0 ||
    playerEntries.length > 0;
  const intro = getString(completeProfile.profile.bio);

  if (!hasAnyEntry) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          description="Questo dirigente non ha ancora aggiunto esperienze di carriera."
          title="Carriera in definizione"
        />
      </View>
    );
  }

  return (
    <View style={styles.careerContainer}>
      {intro ? (
        <AppText style={styles.introText}>{intro}</AppText>
      ) : null}

      {directorEntries.length > 0 ? (
        <View style={styles.mainSection}>
          <AppText style={styles.sectionTitle}>Carriera dirigenziale</AppText>
          <View style={styles.timeline}>
            {directorEntries.map((entry, index) => (
              <DirectorTimelineItem
                entry={entry}
                isActive={index === 0}
                isLast={index === directorEntries.length - 1}
                key={entry.id}
              />
            ))}
          </View>
        </View>
      ) : null}

      {coachEntries.length > 0 || playerEntries.length > 0 ? (
        <View style={styles.previousSection}>
          <View style={styles.divider} />
          <AppText style={styles.sectionTitle}>Esperienze precedenti</AppText>

          {coachEntries.length > 0 ? (
            <PreviousExperienceGroup
              items={coachEntries}
              title="Allenatore"
            />
          ) : null}

          {playerEntries.length > 0 ? (
            <PreviousExperienceGroup
              items={playerEntries}
              title="Calciatore"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DirectorTimelineItem({
  entry,
  isActive,
  isLast,
}: {
  entry: DirectorCareerPreview;
  isActive: boolean;
  isLast: boolean;
}) {
  return (
    <View style={styles.timelineItem}>
      {!isLast ? <View style={styles.timelineRail} /> : null}
      <View style={[styles.timelineMarker, isActive ? styles.timelineMarkerActive : null]} />
      <View style={styles.timelineContent}>
        <View style={styles.clubHeader}>
          <TeamLogo logoUrl={entry.teamLogoUrl} name={entry.teamName} size={32} />
          <AppText style={styles.timelineClub}>{entry.teamName}</AppText>
        </View>
        <AppText style={styles.timelineRole}>{entry.role}</AppText>
        {entry.meta ? (
          <AppText style={styles.timelineMeta}>{entry.meta}</AppText>
        ) : null}
        {entry.description ? (
          <AppText numberOfLines={3} style={styles.timelineDescription}>
            {entry.description}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function PreviousExperienceGroup({
  items,
  title,
}: {
  items: PreviousCareerPreview[];
  title: string;
}) {
  return (
    <View style={styles.previousGroup}>
      <AppText style={styles.previousGroupTitle}>{title}</AppText>
      {items.map((entry) => (
        <View key={entry.id} style={styles.previousItem}>
          <TeamLogo logoUrl={entry.teamLogoUrl} name={entry.teamName} size={32} />
          <View style={styles.previousContent}>
            <AppText style={styles.previousClub}>{entry.teamName}</AppText>
            <AppText style={styles.previousRole}>{entry.role}</AppText>
            {entry.meta ? (
              <AppText style={styles.previousMeta}>{entry.meta}</AppText>
            ) : null}
            {entry.description ? (
              <AppText numberOfLines={2} style={styles.previousDescription}>
                {entry.description}
              </AppText>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function TeamLogo({
  logoUrl,
  name,
  size,
}: {
  logoUrl: string;
  name: string;
  size: number;
}) {
  const [hasError, setHasError] = useState(false);

  if (logoUrl && !hasError) {
    return (
      <View style={[styles.logoContainer, { height: size, width: size }]}>
        <Image
          accessibilityLabel={`Logo ${name}`}
          onError={() => setHasError(true)}
          source={{ uri: logoUrl }}
          style={styles.logoImage}
        />
      </View>
    );
  }

  return (
    <View style={[styles.logoFallback, { height: size, width: size }]}>
      <Ionicons color={bananiColors.primary} name="shield" size={18} />
    </View>
  );
}

function buildHeaderMeta(completeProfile: CompleteProfessionalProfile) {
  const careerEntry = getFirstCareerEntry(completeProfile.directorProfile?.career_entries ?? []);
  const teamName = getRecordString(careerEntry, ["teamName", "team_name"]);
  const category =
    getRecordString(careerEntry, ["category"]) ||
    completeProfile.directorProfile?.experience_categories?.[0]?.trim();

  return [teamName, category, completeProfile.profile.region?.trim()].filter(
    (item): item is string => Boolean(item),
  );
}

function buildDirectorCareerPreviews(entries: unknown[]) {
  return normalizeCareerEntries(entries, "Dirigente")
    .sort(compareCareerPreviews);
}

function buildPreviousCoachPreviews(entries: unknown[]) {
  return normalizeCareerEntries(entries, "Allenatore")
    .sort(compareCareerPreviews);
}

function buildPreviousPlayerPreviews(entries: unknown[]) {
  return entries
    .map((entry, index): PreviousCareerPreview | null => {
      const record = toRecord(entry);
      if (!record) {
        return null;
      }

      const teamName =
        getRecordString(record, ["clubName", "club_name", "teamName", "team_name"]) ||
        "Societa da completare";
      const category = getRecordString(record, ["category", "competition_name"]);
      const period = getRecordString(record, ["seasonLabel", "season_label", "season"]) ||
        formatSeasonRange(getRecordStringArray(record, ["seasons"]));
      const role = getRecordString(record, ["position", "role"]) || "Calciatore";
      const description = buildPlayerDescription(record);
      const meta = [period, category].filter(Boolean).join(" - ");

      return {
        category,
        description,
        id: getRecordString(record, ["id"]) || `${teamName}-${period}-${index}`,
        meta,
        period,
        role,
        teamLogoUrl: getRecordString(record, ["teamLogoUrl", "team_logo_url"]),
        teamName,
      };
    })
    .filter((entry): entry is PreviousCareerPreview => Boolean(entry))
    .sort(compareCareerPreviews);
}

function normalizeCareerEntries(
  entries: unknown[],
  fallbackRole: string,
): DirectorCareerPreview[] {
  return entries
    .map((entry, index): PreviousCareerPreview | null => {
      const record = toRecord(entry);
      if (!record) {
        return null;
      }

      const teamName =
        getRecordString(record, ["teamName", "team_name", "clubName", "club_name"]) ||
        "Societa da completare";
      const role =
        getRecordString(record, ["role", "primaryRole", "primary_role"]) ||
        fallbackRole;
      const category = getRecordString(record, ["category"]);
      const period = formatPeriod(record);
      const meta = [period, category].filter(Boolean).join(" - ");

      return {
        category,
        description: getRecordString(record, ["description"]),
        id: getRecordString(record, ["id"]) || `${teamName}-${role}-${index}`,
        meta,
        period,
        role,
        teamLogoUrl: getRecordString(record, ["teamLogoUrl", "team_logo_url"]),
        teamName,
      };
    })
    .filter((entry): entry is PreviousCareerPreview => Boolean(entry));
}

function compareCareerPreviews(left: DirectorCareerPreview, right: DirectorCareerPreview) {
  return getLatestYear(right.period) - getLatestYear(left.period);
}

function getLatestYear(period: string) {
  const matches = period.match(/\d{4}/g);
  if (!matches || matches.length === 0) {
    return 0;
  }
  return Math.max(...matches.map((value) => Number.parseInt(value, 10)));
}

function formatPeriod(record: Record<string, unknown>) {
  const nestedPeriod = toRecord(record.period);
  if (nestedPeriod) {
    const start = monthYearLabel(
      getRecordString(nestedPeriod, ["startMonth"]),
      getRecordNumberOrString(nestedPeriod, ["startYear"]),
    );
    const end = monthYearLabel(
      getRecordString(nestedPeriod, ["endMonth"]),
      getRecordNumberOrString(nestedPeriod, ["endYear"]),
    );
    return [start, end || "oggi"].filter(Boolean).join(" - ");
  }

  const start = monthYearLabel(
    getRecordString(record, ["period_start_month"]),
    getRecordNumberOrString(record, ["period_start_year"]),
  );
  const end = monthYearLabel(
    getRecordString(record, ["period_end_month"]),
    getRecordNumberOrString(record, ["period_end_year"]),
  );
  if (start || end) {
    return [start, end || "oggi"].filter(Boolean).join(" - ");
  }

  return formatSeasonRange(getRecordStringArray(record, ["seasons"]));
}

function formatSeasonRange(seasons: string[]) {
  const sorted = [...seasons]
    .filter(Boolean)
    .sort((left, right) => getSeasonStartYear(left) - getSeasonStartYear(right));

  if (sorted.length === 0) {
    return "";
  }

  if (sorted.length === 1) {
    return shortSeasonLabel(sorted[0]);
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${shortSeasonLabel(first)} - ${shortSeasonLabel(last)}`;
}

function shortSeasonLabel(season: string) {
  const parts = season.split("/");
  if (parts.length !== 2) {
    return season;
  }
  return `${parts[0]}/${parts[1]?.slice(-2) ?? ""}`;
}

function getSeasonStartYear(season: string) {
  const year = Number.parseInt(season.split("/")[0] ?? "", 10);
  return Number.isNaN(year) ? 0 : year;
}

function monthYearLabel(month: string, year: string) {
  if (!year) {
    return "";
  }
  return month ? `${month} ${year}` : year;
}

function buildPlayerDescription(record: Record<string, unknown>) {
  const details = [
    formatStat(record, "appearances", "presenze"),
    formatStat(record, "goals", "gol"),
    formatStat(record, "assists", "assist"),
  ].filter(Boolean);

  return details.join(", ");
}

function formatStat(record: Record<string, unknown>, key: string, label: string) {
  const value = getRecordNumberOrString(record, [key]);
  if (!value || value === "0") {
    return "";
  }
  return `${value} ${label}`;
}

function getFirstCareerEntry(entries: unknown[]) {
  const first = entries.find((entry) => entry && typeof entry === "object");
  return first ? (first as Record<string, unknown>) : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getRecordString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) {
    return "";
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getRecordStringArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim());
    }
  }

  return [];
}

function getRecordNumberOrString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const styles = StyleSheet.create({
  careerContainer: {
    backgroundColor: bananiColors.background,
    gap: spacing[32],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  clubHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[8],
  },
  container: {
    backgroundColor: bananiColors.background,
    flex: 1,
  },
  divider: {
    backgroundColor: bananiColors.border,
    height: 1,
    marginBottom: spacing[28],
  },
  emptyContainer: {
    backgroundColor: bananiColors.background,
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  introText: {
    color: bananiColors.mutedForeground,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },
  logoContainer: {
    backgroundColor: bananiColors.muted,
    borderColor: bananiColors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    overflow: "hidden",
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: bananiColors.muted,
    borderColor: bananiColors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    justifyContent: "center",
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
  mainSection: {
    gap: spacing[24],
  },
  metaDot: {
    backgroundColor: bananiColors.mutedForeground,
    borderRadius: radius.full,
    height: 3,
    opacity: 0.5,
    width: 3,
  },
  metaItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  metaText: {
    color: bananiColors.mutedForeground,
    fontSize: 14,
    fontWeight: "500",
  },
  metaTextStrong: {
    color: bananiColors.foreground,
    fontWeight: "700",
  },
  previousClub: {
    color: bananiColors.foreground,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  previousContent: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  previousDescription: {
    color: bananiColors.foreground,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing[4],
    opacity: 0.8,
  },
  previousGroup: {
    gap: spacing[16],
  },
  previousGroupTitle: {
    color: bananiColors.mutedForeground,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 18,
    textTransform: "uppercase",
  },
  previousItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[14],
  },
  previousMeta: {
    color: bananiColors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  previousRole: {
    color: bananiColors.foreground,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  previousSection: {
    gap: spacing[28],
  },
  profileHeader: {
    alignItems: "center",
    backgroundColor: bananiColors.background,
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[24],
    paddingTop: spacing[12],
  },
  profileImage: {
    borderRadius: 44,
    height: 88,
    marginBottom: spacing[16],
    width: 88,
  },
  profileMeta: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
    justifyContent: "center",
    marginTop: spacing[12],
  },
  profileName: {
    color: bananiColors.foreground,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  profileRole: {
    color: bananiColors.mutedForeground,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
    marginTop: spacing[4],
  },
  sectionTitle: {
    color: bananiColors.foreground,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  timeline: {
    gap: spacing[32],
    position: "relative",
  },
  timelineClub: {
    color: bananiColors.foreground,
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  timelineContent: {
    flex: 1,
    minWidth: 0,
  },
  timelineDescription: {
    color: bananiColors.foreground,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing[10],
    opacity: 0.85,
  },
  timelineItem: {
    flexDirection: "row",
    gap: spacing[20],
    position: "relative",
  },
  timelineMarker: {
    backgroundColor: bananiColors.border,
    borderColor: bananiColors.background,
    borderRadius: radius.full,
    borderWidth: 4,
    height: 18,
    marginLeft: 1,
    marginTop: spacing[8],
    width: 18,
  },
  timelineMarkerActive: {
    backgroundColor: bananiColors.foreground,
  },
  timelineRail: {
    backgroundColor: bananiColors.border,
    bottom: -spacing[32],
    left: 9,
    opacity: 0.4,
    position: "absolute",
    top: spacing[18],
    width: 2,
  },
  timelineMeta: {
    color: bananiColors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing[4],
  },
  timelineRole: {
    color: bananiColors.foreground,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
});
