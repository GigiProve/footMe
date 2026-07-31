import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  View,
  type AlertButton,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

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
import {
  fetchClubSaveState,
  saveClub,
  unsaveClub,
} from "../../src/features/saved/saved-service";
import { openDirectConversation } from "../../src/features/messaging/messaging-service";
import type { ClubHeaderTab } from "../../src/features/clubs/components/PublicClubHeader";
import {
  fetchClubTeamProfiles,
  fetchClubTeams,
  type ClubTeam,
  type ClubTeamProfileDetails,
} from "../../src/features/clubs/team-service";
import { colors, spacing } from "../../src/theme/tokens";
import { ActionSheet, AppText, Button, useToast } from "../../src/ui";

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
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [club, setClub] = useState<PublicClubProfile | null>(null);
  const [teams, setTeams] = useState<ClubTeam[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<
    Record<string, ClubTeamProfileDetails>
  >({});
  const [stats, setStats] = useState<ClubHeaderStats>(emptyHeaderStats);
  const [overview, setOverview] =
    useState<PublicClubSquadraOverview>(emptyOverview);
  const [members, setMembers] = useState<PublicClubMember[]>([]);
  const [isFollowed, setIsFollowed] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clubActionsVisible, setClubActionsVisible] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
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
        saveState,
        overviewData,
        membersData,
      ] = await Promise.all([
        fetchPublicClubProfile(id),
        fetchClubTeams(id),
        fetchPublicClubHeaderStats(id).catch(() => emptyHeaderStats),
        profileId
          ? fetchClubFollowState(profileId, id).catch(() => false)
          : Promise.resolve(false),
        profileId
          ? fetchClubSaveState(profileId, id).catch(() => false)
          : Promise.resolve(false),
        fetchPublicClubSquadraOverview(id).catch(() => emptyOverview),
        fetchPublicClubRoster(id).catch(() => []),
      ]);
      const teamProfilesData = await fetchClubTeamProfiles(
        teamsData.map((team) => team.id),
      ).catch(() => ({}));

      setClub(clubData);
      setTeams(teamsData);
      setTeamProfiles(teamProfilesData);
      setStats(statsData);
      setIsFollowed(followState);
      setIsSaved(saveState);
      setOverview(overviewData);
      setMembers(membersData);
    } catch {
      Alert.alert("Errore", "Impossibile caricare il profilo società.");
      setClub(null);
      setTeams([]);
      setTeamProfiles({});
      setStats(emptyHeaderStats);
      setOverview(emptyOverview);
      setMembers([]);
      setIsFollowed(false);
      setIsSaved(false);
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
      queryClient.invalidateQueries({ queryKey: ["following-count"] });
      queryClient.invalidateQueries({ queryKey: ["followed"] });
    }
  }

  async function handleToggleSave() {
    if (!profile) {
      Alert.alert("Accesso richiesto", "Accedi per salvare questa società.");
      return;
    }

    if (!club || isSaving) {
      return;
    }

    const next = !isSaved;
    setIsSaving(true);
    setIsSaved(next);
    try {
      if (next) {
        await saveClub(profile.id, club.id);
        showToast({ message: "Società salvata", tone: "success", icon: "bookmark" });
      } else {
        await unsaveClub(profile.id, club.id);
        showToast({ message: "Elemento rimosso dai Salvati", tone: "neutral" });
      }
    } catch {
      setIsSaved(!next);
      showToast({ message: "Operazione non riuscita.", tone: "neutral" });
    } finally {
      setIsSaving(false);
      queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
    }
  }

  async function handleShareClub() {
    if (!club) {
      return;
    }
    try {
      await Share.share({
        message: `Dai un'occhiata a ${club.name} su ProLink.`,
      });
    } catch {
      // user cancelled or share unavailable — no-op
    }
  }

  function handleReportClub() {
    showToast({
      message: "Segnalazione inviata. Grazie.",
      tone: "success",
      icon: "flag",
    });
  }

  async function handleContactPress() {
    if (!club) {
      return;
    }

    if (club.owner_profile_id && club.owner_profile_id !== profile?.id) {
      try {
        setIsOpeningChat(true);
        const conversationId = await openDirectConversation(club.owner_profile_id);
        router.push({
          pathname: "/messages/[conversationId]",
          params: { conversationId, otherName: club.name },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Errore durante l'apertura della conversazione.";
        Alert.alert("Chat non disponibile", message);
      } finally {
        setIsOpeningChat(false);
      }
      return;
    }

    handleShowPublicContacts();
  }

  function handleShowPublicContacts() {
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

  function handleOpenProfile(profileId: string) {
    router.push(`/profile/${profileId}` as never);
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
          {profile ? (
            <View style={styles.topBarActions}>
              <Pressable
                accessibilityLabel={
                  isSaved ? "Rimuovi dai salvati" : "Salva società"
                }
                accessibilityRole="button"
                hitSlop={8}
                onPress={handleToggleSave}
                style={({ pressed }) => [
                  styles.topBarIcon,
                  pressed ? styles.topBarIconPressed : null,
                ]}
              >
                <Ionicons
                  color={isSaved ? colors.accent : colors.textPrimary}
                  name={isSaved ? "bookmark" : "bookmark-outline"}
                  size={22}
                />
              </Pressable>
              <Pressable
                accessibilityLabel="Azioni società"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setClubActionsVisible(true)}
                style={({ pressed }) => [
                  styles.topBarIcon,
                  pressed ? styles.topBarIconPressed : null,
                ]}
              >
                <Ionicons
                  color={colors.textPrimary}
                  name="ellipsis-horizontal"
                  size={22}
                />
              </Pressable>
            </View>
          ) : (
            <View style={styles.topBarButton} />
          )}
        </View>

        <View style={styles.publicProfileView}>
          <PublicClubProfileView
            activeTab={activeTab}
            club={club}
            isContacting={isOpeningChat}
            isFollowed={isFollowed}
            isFollowing={isFollowing}
            isSaved={isSaved}
            members={members}
            onContactPress={handleContactPress}
            onOpenAffiliate={handleOpenAffiliate}
            onOpenPositions={handleOpenPositions}
            onOpenProfile={handleOpenProfile}
            onOpenTeam={handleOpenTeam}
            onTabChange={setActiveTab}
            onToggleFollow={handleToggleFollow}
            overview={overview}
            stats={stats}
            teamProfiles={teamProfiles}
            teams={teams}
            viewerProfileId={profile?.id ?? null}
          />
        </View>
      </KeyboardAwareScrollView>
      <ActionSheet
        actions={[
          {
            icon: isSaved ? "bookmark" : "bookmark-outline",
            label: isSaved ? "Rimuovi dai Salvati" : "Salva società",
            subtitle: isSaved ? undefined : "Ritrovala nei tuoi Salvati.",
            onPress: handleToggleSave,
          },
          {
            icon: "call-outline",
            label: "Contatti pubblici",
            onPress: handleShowPublicContacts,
          },
          {
            icon: "share-outline",
            label: "Condividi società",
            onPress: handleShareClub,
          },
          {
            destructive: true,
            icon: "flag-outline",
            label: "Segnala società",
            onPress: handleReportClub,
          },
        ]}
        onClose={() => setClubActionsVisible(false)}
        title="Azioni società"
        visible={clubActionsVisible}
      />
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
  topBarActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  topBarIcon: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 32,
  },
  topBarIconPressed: {
    opacity: 0.6,
  },
  topBarTitle: {
    flex: 1,
    fontWeight: "600",
  },
});
