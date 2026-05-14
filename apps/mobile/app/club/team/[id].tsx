import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../src/components/ui/screen";
import { KeyboardAwareScrollView } from "../../../src/components/ui/keyboard-aware-scroll-view";
import {
  fetchPublicClubTeamProfile,
  type PublicClubTeamProfile,
} from "../../../src/features/clubs/club-service";
import type { ClubHeaderTab } from "../../../src/features/clubs/components/PublicClubHeader";
import { colors, radius, spacing, typography } from "../../../src/theme/tokens";
import { AppText, EmptyState } from "../../../src/ui";

export default function ClubTeamProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<PublicClubTeamProfile | null>(null);
  const [activeTab, setActiveTab] = useState<ClubHeaderTab>("team");
  const [isLoading, setIsLoading] = useState(true);

  const loadTeam = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setData(await fetchPublicClubTeamProfile(id));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Torna indietro"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.topBarButton}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
          </Pressable>
          <AppText align="center" style={styles.topBarTitle} variant="bodySm">
            Profilo squadra
          </AppText>
          <View style={styles.topBarButton} />
        </View>

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : data ? (
          <>
            <TeamHeader data={data} />
            <View style={styles.tabBar}>
              {[
                { label: "Squadra", value: "team" as const },
                { label: "Organico", value: "roster" as const },
                { label: "Media", value: "media" as const },
              ].map((tab) => {
                const isActive = tab.value === activeTab;

                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    key={tab.value}
                    onPress={() => setActiveTab(tab.value)}
                    style={styles.tab}
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
            {activeTab === "team" ? (
              <TeamInfoTab data={data} />
            ) : activeTab === "roster" ? (
              <TeamRosterTab data={data} />
            ) : (
              <TeamMediaTab data={data} />
            )}
          </>
        ) : (
          <EmptyState
            description="Questa squadra non è disponibile."
            icon="shield-outline"
            title="Squadra non trovata"
          />
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function TeamHeader({ data }: { data: PublicClubTeamProfile }) {
  const title = data.team.name || data.team.category;
  const subtitle = data.profile?.competition_name ?? data.team.category;

  return (
    <View style={styles.header}>
      <View style={styles.logo}>
        {data.team.logo_url || data.club.logo_url ? (
          <Image
            source={{ uri: data.team.logo_url ?? data.club.logo_url! }}
            style={styles.logoImage}
          />
        ) : (
          <Ionicons color={colors.textMuted} name="shield-outline" size={32} />
        )}
      </View>
      <View style={styles.headerCopy}>
        <AppText align="center" style={styles.teamTitle} variant="headingLg">
          {title}
        </AppText>
        <AppText align="center" color="accent" variant="titleSm">
          {subtitle}
        </AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          {data.club.name}
        </AppText>
      </View>
      <View style={styles.statsRow}>
        <HeaderStat label="Organico" value={String(data.members.length)} />
        <HeaderStat label="Ricerche" value={String(data.positionsTotal)} />
        <HeaderStat
          label="Promossi"
          value={String(data.profile?.promoted_players_count ?? 0)}
        />
      </View>
    </View>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <AppText align="center" style={styles.statValue} variant="titleSm">
        {value}
      </AppText>
      <AppText align="center" color="secondary" style={styles.statLabel} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function TeamInfoTab({ data }: { data: PublicClubTeamProfile }) {
  return (
    <View style={styles.section}>
      <InfoRow label="Categoria" value={data.team.category} />
      <InfoRow
        label="Competizione"
        value={data.profile?.competition_name ?? "Da completare"}
      />
      <InfoRow label="Girone" value={data.profile?.group_name ?? "Da completare"} />
      <InfoRow
        label="Posizioni aperte"
        value={`${data.positionsTotal} ricerche attive`}
      />
    </View>
  );
}

function TeamRosterTab({ data }: { data: PublicClubTeamProfile }) {
  return (
    <View style={styles.section}>
      {data.members.length === 0 ? (
        <EmptyState
          description="Nessun membro associato a questa squadra."
          icon="people-outline"
          title="Organico da completare"
        />
      ) : (
        data.members.map((member) => (
          <View key={member.id} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              {member.avatar_url ? (
                <Image source={{ uri: member.avatar_url }} style={styles.memberImage} />
              ) : (
                <AppText color="secondary" variant="caption">
                  {(member.full_name ?? member.manual_name ?? "FM").slice(0, 2)}
                </AppText>
              )}
            </View>
            <View style={styles.memberText}>
              <AppText style={styles.memberName} variant="bodySm">
                {member.full_name ?? member.manual_name ?? "Membro squadra"}
              </AppText>
              <AppText color="secondary" variant="caption">
                {member.staff_title ?? member.member_role}
              </AppText>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function TeamMediaTab({ data }: { data: PublicClubTeamProfile }) {
  const mediaUrls = data.profile?.media_urls ?? [];

  return (
    <View style={styles.section}>
      {mediaUrls.length === 0 ? (
        <EmptyState
          description="La squadra non ha ancora media pubblicati."
          icon="images-outline"
          title="Media da completare"
        />
      ) : (
        <View style={styles.mediaGrid}>
          {mediaUrls.slice(0, 6).map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.mediaItem} />
          ))}
        </View>
      )}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText color="secondary" variant="bodySm">
        {label}
      </AppText>
      <AppText style={styles.infoValue} variant="bodySm">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
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
  header: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    gap: spacing[16],
    padding: spacing[18],
  },
  headerCopy: {
    gap: spacing[6],
  },
  infoRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[12],
    padding: spacing[14],
  },
  infoValue: {
    flex: 1,
    fontWeight: typography.fontWeight.bold,
    textAlign: "right",
  },
  loadingBlock: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
  },
  logo: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    height: 88,
    justifyContent: "center",
    overflow: "hidden",
    width: 88,
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  mediaItem: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    width: "31.8%",
  },
  memberAvatar: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 38,
    justifyContent: "center",
    overflow: "hidden",
    width: 38,
  },
  memberImage: {
    height: "100%",
    width: "100%",
  },
  memberName: {
    fontWeight: typography.fontWeight.semibold,
  },
  memberRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[14],
  },
  memberText: {
    flex: 1,
    gap: spacing[4],
  },
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[28],
  },
  section: {
    gap: spacing[10],
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    gap: spacing[4],
  },
  statLabel: {
    fontWeight: typography.fontWeight.semibold,
    textTransform: "uppercase",
  },
  statValue: {
    fontWeight: typography.fontWeight.bold,
  },
  statsRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flexDirection: "row",
    gap: spacing[8],
    padding: spacing[12],
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
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing[16],
  },
  tabLabel: {
    fontWeight: typography.fontWeight.semibold,
  },
  teamTitle: {
    fontWeight: typography.fontWeight.heavy,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  topBarButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topBarTitle: {
    flex: 1,
    fontWeight: typography.fontWeight.semibold,
  },
});
