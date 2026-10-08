/**
 * Profilo della singola squadra (REV-PROF-17).
 *
 * Route dedicata con deep link stabile, back verso il Master Profile della
 * Società e stati propri. La squadra resta una sottoentità: il follow e la
 * messaggistica usano l'identità della Società madre, perché una squadra non
 * ha amministratori né permessi suoi.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../src/components/ui/screen";
import { KeyboardAwareScrollView } from "../../../src/components/ui/keyboard-aware-scroll-view";
import { useSession } from "../../../src/features/auth/use-session";
import { followClub, unfollowClub } from "../../../src/features/clubs/club-service";
import {
  SocietyTeamProfileView,
  type SocietyTeamTab,
} from "../../../src/features/clubs/society/SocietyTeamProfileView";
import { SocietyProfileSkeleton } from "../../../src/features/clubs/society/SocietyMasterProfileView";
import { fetchSocietyTeamProfile } from "../../../src/features/clubs/society/society-profile-service";
import { buildTeamShareMessage } from "../../../src/features/clubs/society/society-profile-model";
import type { SocietyTeamDetail } from "../../../src/features/clubs/society/society-profile-types";
import { openDirectConversation } from "../../../src/features/messaging/messaging-service";
import { trackProfileEvent } from "../../../src/features/profiles/profile-analytics";
import { colors, spacing } from "../../../src/theme/tokens";
import { ActionSheet, AppText, Button, useToast } from "../../../src/ui";

export default function ClubTeamProfileScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { profile } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [detail, setDetail] = useState<SocietyTeamDetail | null>(null);
  const [activeTab, setActiveTab] = useState<SocietyTeamTab>(
    tab === "media" ? "media" : "squad",
  );
  const [isLoading, setLoading] = useState(true);
  const [hasError, setError] = useState(false);
  const [isFollowPending, setFollowPending] = useState(false);
  const [isOpeningChat, setOpeningChat] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const data = await fetchSocietyTeamProfile(id);
      setDetail(data);

      if (data) {
        trackProfileEvent("society_team_opened", {
          profileType: "society_team",
          viewerMode: data.viewer.mode,
        });
      }
    } catch {
      setError(true);
      trackProfileEvent("profile_load_failed", { profileType: "society_team" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleFollow() {
    if (!profile) {
      Alert.alert("Accesso richiesto", "Accedi per seguire questa società.");
      return;
    }

    if (!detail || isFollowPending) return;

    const wasFollowing = detail.viewer.isFollowing;
    setFollowPending(true);
    setDetail({ ...detail, viewer: { ...detail.viewer, isFollowing: !wasFollowing } });

    try {
      /*
        Il modello follow non conosce la squadra: il target canonico è la
        Società madre. Inventare qui una relazione parallela creerebbe un
        secondo dominio da mantenere.
      */
      if (wasFollowing) {
        await unfollowClub(profile.id, detail.club.id);
      } else {
        await followClub(profile.id, detail.club.id);
      }
    } catch {
      setDetail((current) =>
        current ? { ...current, viewer: { ...current.viewer, isFollowing: wasFollowing } } : current,
      );
      showToast({ message: "Non siamo riusciti ad aggiornare il follow.", tone: "neutral" });
    } finally {
      setFollowPending(false);
      queryClient.invalidateQueries({ queryKey: ["following-count"] });
      queryClient.invalidateQueries({ queryKey: ["followed"] });
    }
  }

  async function handleMessage() {
    if (!detail || isOpeningChat) return;

    const ownerProfileId = detail.club.ownerProfileId;

    if (!ownerProfileId) {
      Alert.alert(
        "Chat non disponibile",
        "Questa società non ha ancora un referente che possa ricevere messaggi.",
      );
      return;
    }

    try {
      setOpeningChat(true);
      const conversationId = await openDirectConversation(ownerProfileId);
      router.push({
        params: { conversationId, otherName: detail.club.name },
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
    if (!detail) return;

    try {
      await Share.share({
        message: buildTeamShareMessage(
          detail.club.name,
          detail.team.name,
          detail.team.id,
        ),
      });
    } catch {
      // Condivisione annullata: nessun errore da mostrare.
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <TeamTopBar clubName={null} onBack={() => router.back()} />
        <SocietyProfileSkeleton />
      </Screen>
    );
  }

  if (hasError || !detail) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <TeamTopBar clubName={null} onBack={() => router.back()} />
        <View style={styles.center}>
          <AppText color="secondary" variant="bodyLg">
            {hasError
              ? "Non è stato possibile caricare il profilo. Riprova."
              : "Squadra non disponibile."}
          </AppText>
          {hasError ? (
            <Button label="Riprova" onPress={() => void load()} variant="secondary" />
          ) : (
            <Button label="Torna indietro" onPress={() => router.back()} variant="secondary" />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <TeamTopBar clubName={detail.club.name} onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <SocietyTeamProfileView
          activeTab={activeTab}
          detail={detail}
          onFollowPress={() => void handleToggleFollow()}
          onMessagePress={() => void handleMessage()}
          onMorePress={() => setMenuVisible(true)}
          onOpenProfile={(profileId) => router.push(`/profile/${profileId}` as never)}
          onOpenSquadList={() => {
            trackProfileEvent("society_team_squad_opened", {
              profileType: "society_team",
            });
            router.push(`/club/team/${detail.team.id}/squad` as never);
          }}
          onSharePress={() => void handleShare()}
          onTabChange={(next) => {
            setActiveTab(next);
            trackProfileEvent("society_team_tab_changed", {
              profileType: "society_team",
              tab: next,
            });
          }}
        />
      </KeyboardAwareScrollView>

      <ActionSheet
        actions={[
          {
            icon: "share-outline",
            label: "Condividi squadra",
            onPress: () => void handleShare(),
          },
          {
            icon: "shield-outline",
            label: "Vai al profilo della società",
            onPress: () => router.push(`/club/${detail.club.id}` as never),
          },
        ]}
        onClose={() => setMenuVisible(false)}
        title="Azioni squadra"
        visible={isMenuVisible}
      />
    </Screen>
  );
}

function TeamTopBar({
  clubName,
  onBack,
}: {
  clubName: string | null;
  onBack: () => void;
}) {
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
      <AppText
        align="center"
        numberOfLines={1}
        style={styles.topBarTitle}
        variant="bodySm"
      >
        {clubName ?? "PROLINK"}
      </AppText>
      <View style={styles.topBarButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
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
