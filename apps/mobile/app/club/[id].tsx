import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type AlertButton,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../src/components/ui/screen";
import { KeyboardAwareScrollView } from "../../src/components/ui/keyboard-aware-scroll-view";
import { useSession } from "../../src/features/auth/use-session";
import {
  fetchClubFollowState,
  fetchPublicClubRoster,
  fetchPublicClubHeaderStats,
  fetchPublicClubProfile,
  fetchPublicClubSquadraOverview,
  followClub,
  unfollowClub,
  type ClubHeaderStats,
  type PublicClubMember,
  type PublicClubProfile,
  type PublicClubSquadraOverview,
} from "../../src/features/clubs/club-service";
import {
  PublicClubProfileView,
} from "../../src/features/clubs/components/PublicClubProfileView";
import type { ClubHeaderTab } from "../../src/features/clubs/components/PublicClubHeader";
import { fetchClubTeams, type ClubTeam } from "../../src/features/clubs/team-service";
import { colors, spacing } from "../../src/theme/tokens";
import { AppText, Button } from "../../src/ui";

const emptyHeaderStats: ClubHeaderStats = {
  activeTeamsCount: 0,
  playersCount: 0,
  staffCount: 0,
};

const emptyOverview: PublicClubSquadraOverview = {
  affiliations: [],
  parentAffiliation: null,
  positionPreview: [],
  positionsTotal: 0,
  seasonSummaries: [],
};

export default function ClubProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const router = useRouter();

  const [club, setClub] = useState<PublicClubProfile | null>(null);
  const [teams, setTeams] = useState<ClubTeam[]>([]);
  const [stats, setStats] = useState<ClubHeaderStats>(emptyHeaderStats);
  const [overview, setOverview] =
    useState<PublicClubSquadraOverview>(emptyOverview);
  const [members, setMembers] = useState<PublicClubMember[]>([]);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClubHeaderTab>("team");

  const loadClub = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const profileId = profile?.id ?? null;
      const [
        clubData,
        teamsData,
        statsData,
        followState,
        overviewData,
        membersData,
      ] = await Promise.all([
        fetchPublicClubProfile(id),
        fetchClubTeams(id),
        fetchPublicClubHeaderStats(id).catch(() => emptyHeaderStats),
        profileId
          ? fetchClubFollowState(profileId, id).catch(() => false)
          : Promise.resolve(false),
        fetchPublicClubSquadraOverview(id).catch(() => emptyOverview),
        fetchPublicClubRoster(id).catch(() => []),
      ]);

      setClub(clubData);
      setTeams(teamsData);
      setStats(statsData);
      setIsFollowed(followState);
      setOverview(overviewData);
      setMembers(membersData);
    } catch {
      Alert.alert("Errore", "Impossibile caricare il profilo società.");
      setClub(null);
      setTeams([]);
      setStats(emptyHeaderStats);
      setOverview(emptyOverview);
      setMembers([]);
      setIsFollowed(false);
    } finally {
      setIsLoading(false);
    }
  }, [id, profile?.id]);

  useEffect(() => {
    loadClub();
  }, [loadClub]);

  async function handleToggleFollow() {
    if (!profile) {
      Alert.alert("Accesso richiesto", "Accedi per seguire questa società.");
      return;
    }

    if (!club) {
      return;
    }

    try {
      setIsFollowing(true);

      if (isFollowed) {
        await unfollowClub(profile.id, club.id);
        setIsFollowed(false);
        return;
      }

      await followClub(profile.id, club.id);
      setIsFollowed(true);
    } catch {
      Alert.alert("Errore", "Non siamo riusciti ad aggiornare il follow.");
    } finally {
      setIsFollowing(false);
    }
  }

  function handleContactPress() {
    if (!club) {
      return;
    }

    const contactOptions: AlertButton[] = [];

    if (club.club_email) {
      contactOptions.push({
        onPress: () => Linking.openURL(`mailto:${club.club_email}`),
        text: "Email",
      });
    }

    if (club.club_phone) {
      contactOptions.push({
        onPress: () => Linking.openURL(`tel:${club.club_phone}`),
        text: "Telefono",
      });
    }

    if (club.website_url) {
      contactOptions.push({
        onPress: () => Linking.openURL(normalizeExternalUrl(club.website_url!)),
        text: "Sito web",
      });
    }

    if (contactOptions.length === 0) {
      Alert.alert(
        "Contatti non disponibili",
        "Questa società non ha ancora condiviso contatti pubblici.",
      );
      return;
    }

    const contactSummary = [
      club.club_email ? `Email: ${club.club_email}` : null,
      club.club_phone ? `Telefono: ${club.club_phone}` : null,
      club.website_url ? `Sito: ${club.website_url}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    Alert.alert("Contatta la società", contactSummary, [
      { style: "cancel", text: "Annulla" },
      ...contactOptions,
    ]);
  }

  function handleOpenPositions() {
    if (!club) {
      return;
    }

    router.push(`/club/${club.id}/positions` as never);
  }

  function handleOpenTeam(teamId: string) {
    router.push(`/club/team/${teamId}` as never);
  }

  function handleOpenAffiliate(affiliateClubId: string) {
    router.push(`/club/${affiliateClubId}` as never);
  }

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  if (!club) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centerContainer}>
          <AppText variant="bodyLg" color="secondary">
            Società non trovata.
          </AppText>
          <Button
            label="Torna indietro"
            onPress={() => router.back()}
            variant="secondary"
          />
        </View>
      </Screen>
    );
  }

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
            Profilo club
          </AppText>
          <View style={styles.topBarButton} />
        </View>

        <View style={styles.publicProfileView}>
          <PublicClubProfileView
            activeTab={activeTab}
            club={club}
            isFollowed={isFollowed}
            isFollowing={isFollowing}
            members={members}
            onContactPress={handleContactPress}
            onOpenAffiliate={handleOpenAffiliate}
            onOpenPositions={handleOpenPositions}
            onOpenTeam={handleOpenTeam}
            onTabChange={setActiveTab}
            onToggleFollow={handleToggleFollow}
            overview={overview}
            stats={stats}
            teams={teams}
          />
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function normalizeExternalUrl(url: string) {
  const trimmedUrl = url.trim();

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  publicProfileView: {
    marginHorizontal: -spacing[20],
  },
  scrollContent: {
    gap: spacing[12],
    paddingBottom: spacing[28],
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
    fontWeight: "600",
  },
});
