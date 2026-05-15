import { useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, EmptyState } from "../../../ui";
import { withDefaultProfileAvatar } from "../profile-avatar";
import type { CompleteProfessionalProfile } from "../profile-service";
import { DirectorInfoTab } from "./DirectorInfoTab";
import { ProfileTabBar, type ProfileTab } from "./ProfileTabBar";

type DirectorProfileTabViewProps = {
  completeProfile: CompleteProfessionalProfile;
  isConnecting?: boolean;
  isMessaging?: boolean;
  isOwner?: boolean;
  onConnect?: () => void;
  onMessage?: () => void;
};

type DirectorCareerPreview = {
  id: string;
  meta: string;
  role: string;
  teamName: string;
};

const DIRECTOR_TABS: { label: string; value: ProfileTab }[] = [
  { label: "Info", value: "info" },
  { label: "Carriera", value: "career" },
  { label: "Media", value: "media" },
];

const bananiColors = {
  background: "#F7FAFD",
  border: "#00000014",
  foreground: "#061223",
  mutedForeground: "#2F3B45",
  primary: "#0A66CC",
} as const;

export function DirectorProfileTabView({
  completeProfile,
  isConnecting = false,
  isMessaging = false,
  isOwner = false,
  onConnect,
  onMessage,
}: DirectorProfileTabViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("info");

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
        <DirectorMediaTabContent />
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
  const entries = useMemo(
    () => buildCareerPreviews(completeProfile.directorProfile?.career_entries ?? []),
    [completeProfile.directorProfile?.career_entries],
  );

  if (entries.length === 0) {
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
      {entries.map((entry) => (
        <View key={entry.id} style={styles.careerItem}>
          <View style={styles.careerIcon}>
            <Ionicons color={colors.accent} name="briefcase-outline" size={18} />
          </View>
          <View style={styles.careerCopy}>
            <AppText style={styles.careerTeam} variant="titleSm">
              {entry.teamName}
            </AppText>
            <AppText style={styles.careerRole} variant="bodySm">
              {entry.role}
            </AppText>
            {entry.meta ? (
              <AppText color="secondary" variant="bodySm">
                {entry.meta}
              </AppText>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function DirectorMediaTabContent() {
  return (
    <View style={styles.emptyContainer}>
      <EmptyState
        description="Questo profilo dirigente non ha ancora pubblicato contenuti."
        title="Nessun contenuto"
      />
    </View>
  );
}

function buildHeaderMeta(completeProfile: CompleteProfessionalProfile) {
  const careerEntry = getFirstCareerEntry(completeProfile.directorProfile?.career_entries ?? []);
  const teamName =
    getString(careerEntry?.teamName) ||
    getString(careerEntry?.team_name);
  const category =
    getString(careerEntry?.category) ||
    completeProfile.directorProfile?.experience_categories?.[0]?.trim();

  return [teamName, category, completeProfile.profile.region?.trim()].filter(
    (item): item is string => Boolean(item),
  );
}

function getFirstCareerEntry(entries: unknown[]) {
  const first = entries.find((entry) => entry && typeof entry === "object");
  return first ? (first as Record<string, unknown>) : null;
}

function buildCareerPreviews(entries: unknown[]) {
  return entries
    .map((entry, index): DirectorCareerPreview | null => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const teamName =
        getString(record.teamName) ||
        getString(record.team_name) ||
        "Societa da completare";
      const role =
        getString(record.role) ||
        getString(record.primaryRole) ||
        "Dirigente";
      const category = getString(record.category);
      const seasons = getStringArray(record.seasons);
      const meta = [category, seasons.join(" / ")].filter(Boolean).join(" - ");

      return {
        id: getString(record.id) || `${teamName}-${role}-${index}`,
        meta,
        role,
        teamName,
      };
    })
    .filter((entry): entry is DirectorCareerPreview => Boolean(entry));
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

const styles = StyleSheet.create({
  careerContainer: {
    backgroundColor: bananiColors.background,
    gap: spacing[8],
    paddingBottom: spacing[32],
    paddingTop: spacing[12],
  },
  careerCopy: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  careerIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  careerItem: {
    backgroundColor: bananiColors.background,
    borderColor: bananiColors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
  },
  careerRole: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  careerTeam: {
    color: colors.textPrimary,
  },
  container: {
    backgroundColor: bananiColors.background,
    flex: 1,
  },
  emptyContainer: {
    backgroundColor: bananiColors.background,
    flex: 1,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
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
});
