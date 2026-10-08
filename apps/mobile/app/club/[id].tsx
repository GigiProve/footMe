/**
 * Master Profile Società (REV-PROF-17).
 *
 * Una sola route per il club, aperta da Cerca, da un link, da un'affiliata o
 * dal proprio tab Profilo. L'owner mode non dipende da dove si arriva: lo
 * decide il permesso risolto dal backend dentro `fetch_society_master_profile`.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../src/components/ui/screen";
import { KeyboardAwareScrollView } from "../../src/components/ui/keyboard-aware-scroll-view";
import { useSession } from "../../src/features/auth/use-session";
import {
  fetchPublicClubProfile,
  followClub,
  submitClubReport,
  unfollowClub,
  type PublicClubProfile,
} from "../../src/features/clubs/club-service";
import {
  SocietyMasterProfileView,
  SocietyProfileSkeleton,
  type SocietyTab,
} from "../../src/features/clubs/society/SocietyMasterProfileView";
import { fetchSocietyMasterProfile } from "../../src/features/clubs/society/society-profile-service";
import { buildClubShareMessage } from "../../src/features/clubs/society/society-profile-model";
import type { PositionFilter } from "../../src/features/clubs/society/society-profile-model";
import type { SocietyMasterProfile } from "../../src/features/clubs/society/society-profile-types";
import { openDirectConversation } from "../../src/features/messaging/messaging-service";
import { trackProfileEvent } from "../../src/features/profiles/profile-analytics";
import { colors, spacing } from "../../src/theme/tokens";
import { ActionSheet, AppText, Button, useToast } from "../../src/ui";

export default function ClubProfileScreen() {
  const { id, source, tab } = useLocalSearchParams<{
    id: string;
    source?: string;
    tab?: string;
  }>();
  const { profile } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [data, setData] = useState<SocietyMasterProfile | null>(null);
  const [mediaClub, setMediaClub] = useState<PublicClubProfile | null>(null);
  const [activeTab, setActiveTab] = useState<SocietyTab>(parseTab(tab));
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFollowPending, setFollowPending] = useState(false);
  const [isOpeningChat, setOpeningChat] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      /*
        Il club per il modulo Media condiviso arriva dalla lettura già
        esistente: REV-PROF-17 non riscrive quel dominio, gli passa la stessa
        forma che riceveva prima.
      */
      const [societyProfile, clubRecord] = await Promise.all([
        fetchSocietyMasterProfile(id),
        fetchPublicClubProfile(id),
      ]);

      setData(societyProfile);
      setMediaClub(clubRecord);

      if (societyProfile) {
        trackProfileEvent("profile_viewed", {
          profileType: "society",
          source: typeof source === "string" ? source : undefined,
          viewerMode: societyProfile.viewer.mode,
        });
      }
    } catch {
      setHasError(true);
      trackProfileEvent("profile_load_failed", { profileType: "society" });
    } finally {
      setIsLoading(false);
    }
  }, [id, source]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function handleTabChange(next: SocietyTab) {
    setActiveTab(next);
    trackProfileEvent("profile_tab_changed", {
      profileType: "society",
      tab: next,
      viewerMode: data?.viewer.mode,
    });
  }

  async function handleToggleFollow() {
    if (!profile) {
      Alert.alert("Accesso richiesto", "Accedi per seguire questa società.");
      return;
    }

    // Doppio tap: la seconda pressione non parte finché la prima non è chiusa.
    if (!data || isFollowPending) return;

    const wasFollowing = data.viewer.isFollowing;
    setFollowPending(true);
    setData(withFollowState(data, !wasFollowing));

    trackProfileEvent(wasFollowing ? "profile_unfollow_tapped" : "profile_follow_tapped", {
      profileType: "society",
      viewerMode: data.viewer.mode,
    });

    try {
      if (wasFollowing) {
        await unfollowClub(profile.id, data.club.id);
      } else {
        await followClub(profile.id, data.club.id);
      }
    } catch {
      // Rollback: lo stato ottimistico non sopravvive a una scrittura fallita.
      setData((current) => (current ? withFollowState(current, wasFollowing) : current));
      showToast({ message: "Non siamo riusciti ad aggiornare il follow.", tone: "neutral" });
    } finally {
      setFollowPending(false);
      queryClient.invalidateQueries({ queryKey: ["following-count"] });
      queryClient.invalidateQueries({ queryKey: ["followed"] });
    }
  }

  async function handleMessagePress() {
    if (!data || isOpeningChat) return;

    const ownerProfileId = data.club.ownerProfileId;

    if (!ownerProfileId) {
      Alert.alert(
        "Chat non disponibile",
        "Questa società non ha ancora un referente che possa ricevere messaggi.",
      );
      return;
    }

    trackProfileEvent("profile_message_tapped", {
      profileType: "society",
      viewerMode: data.viewer.mode,
    });

    try {
      setOpeningChat(true);
      const conversationId = await openDirectConversation(ownerProfileId);
      router.push({
        params: { conversationId, otherName: data.club.name },
        pathname: "/messages/[conversationId]",
      });
    } catch (error) {
      Alert.alert(
        "Chat non disponibile",
        error instanceof Error ? error.message : "Errore durante l'apertura della conversazione.",
      );
    } finally {
      setOpeningChat(false);
    }
  }

  async function handleShare() {
    if (!data) return;

    trackProfileEvent("profile_share_tapped", {
      profileType: "society",
      viewerMode: data.viewer.mode,
    });

    try {
      await Share.share({
        message: buildClubShareMessage(data.club),
      });
    } catch {
      // Condivisione annullata dall'utente: non è un errore da segnalare.
    }
  }

  async function handleReport() {
    if (!data || !profile) return;

    try {
      await submitClubReport({
        clubId: data.club.id,
        reason: "profile_report",
        reporterProfileId: profile.id,
      });
      showToast({ icon: "flag", message: "Segnalazione inviata. Grazie.", tone: "success" });
    } catch {
      showToast({ message: "Non siamo riusciti a inviare la segnalazione.", tone: "neutral" });
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar onBack={() => router.back()} />
        <SocietyProfileSkeleton />
      </Screen>
    );
  }

  if (hasError || !data || !mediaClub) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar onBack={() => router.back()} />
        <View style={styles.centerContainer}>
          <AppText color="secondary" variant="bodyLg">
            {hasError
              ? "Non è stato possibile caricare il profilo. Riprova."
              : "Società non trovata."}
          </AppText>
          {hasError ? (
            <Button label="Riprova" onPress={() => void loadProfile()} variant="secondary" />
          ) : (
            <Button label="Torna indietro" onPress={() => router.back()} variant="secondary" />
          )}
        </View>
      </Screen>
    );
  }

  const isOwner = data.viewer.mode === "owner";

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <SocietyMasterProfileView
          activeTab={activeTab}
          mediaClub={mediaClub}
          onContactPress={(contactType) =>
            trackProfileEvent("public_contact_tapped", {
              contactType,
              profileType: "society",
              viewerMode: data.viewer.mode,
            })
          }
          onEditProfile={() => {
            trackProfileEvent("profile_edit_tapped", {
              profileType: "society",
              viewerMode: "owner",
            });
            /*
              REV-PROF-18: l'hub ha una rotta propria e accetta il club come
              parametro, cosi' ci arriva anche un amministratore delegato —
              che non e' `club_admin` e non ha un club in sessione. Il
              permesso lo verifica comunque il backend.
            */
            router.push(`/profile/society-edit?clubId=${id}` as never);
          }}
          onFollowPress={() => void handleToggleFollow()}
          onManagePositions={() => {
            trackProfileEvent("society_manage_positions_tapped", {
              profileType: "society",
              viewerMode: data.viewer.mode,
            });
            router.push("/(tabs)/announcements" as never);
          }}
          onMessagePress={() => void handleMessagePress()}
          onMorePress={() => setMenuVisible(true)}
          onOpenAffiliate={(affiliateId) => {
            trackProfileEvent("society_affiliate_opened", { profileType: "society" });
            router.push(`/club/${affiliateId}?source=affiliate` as never);
          }}
          onOpenPosition={(positionId) => router.push(`/position/${positionId}` as never)}
          onOpenProfile={(profileId) => router.push(`/profile/${profileId}` as never)}
          onOpenTeam={(teamId) => {
            trackProfileEvent("society_team_opened", {
              profileType: "society",
              source: "team_row",
            });
            router.push(`/club/team/${teamId}` as never);
          }}
          onPositionFilterChange={(filter) => {
            setPositionFilter(filter);
            trackProfileEvent("profile_filter_changed", {
              profileType: "society",
              tab: "positions",
            });
          }}
          onRetry={() => void loadProfile()}
          onSeeAllTeams={() => {
            trackProfileEvent("society_teams_see_all_tapped", { profileType: "society" });
            router.push(`/club/${data.club.id}/teams` as never);
          }}
          onSharePress={() => void handleShare()}
          onTabChange={handleTabChange}
          positionFilter={positionFilter}
          profile={data}
        />
      </KeyboardAwareScrollView>

      {/*
        Overflow: al visitor le azioni di segnalazione, all'owner nessuna
        azione verso sé stesso e nessuna scorciatoia a Salvati o Seguiti, che
        vivono nelle loro pagine personali.
      */}
      <ActionSheet
        actions={
          isOwner
            ? [
                {
                  icon: "share-outline",
                  label: "Condividi società",
                  onPress: () => void handleShare(),
                },
              ]
            : [
                {
                  icon: "share-outline",
                  label: "Condividi società",
                  onPress: () => void handleShare(),
                },
                {
                  destructive: true,
                  icon: "flag-outline",
                  label: "Segnala società",
                  onPress: () => void handleReport(),
                },
              ]
        }
        onClose={() => setMenuVisible(false)}
        title="Azioni società"
        visible={isMenuVisible}
      />
    </Screen>
  );
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityLabel="Torna indietro"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={styles.topBarButton}
      >
        <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
      </Pressable>
      <AppText align="center" style={styles.topBarTitle} variant="bodySm">
        PROLINK
      </AppText>
      <View style={styles.topBarButton} />
    </View>
  );
}

function parseTab(value: string | undefined): SocietyTab {
  return value === "positions" || value === "media" || value === "info"
    ? value
    : "profile";
}

function withFollowState(
  profile: SocietyMasterProfile,
  isFollowing: boolean,
): SocietyMasterProfile {
  return { ...profile, viewer: { ...profile.viewer, isFollowing } };
}

const styles = StyleSheet.create({
  centerContainer: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[20],
  },
  scrollContent: {
    paddingBottom: spacing[28],
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing[8],
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
