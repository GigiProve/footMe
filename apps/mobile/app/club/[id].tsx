/**
 * Master Profile Società (REV-PROF-17).
 *
 * Una sola route per il club, aperta da Cerca, da un link, da un'affiliata o
 * dal proprio tab Profilo. L'owner mode non dipende da dove si arriva: lo
 * decide il permesso risolto dal backend dentro `fetch_society_master_profile`.
 */
import { useCallback, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { invalidateFollowQueries } from "../../src/features/following/invalidate-follow-queries";
import { blockedIdentityStore, useBlockEntry } from "../../src/features/blocking/blocked-identity-store";
import { trackBlocking } from "../../src/features/blocking/blocking-analytics";
import {
  SHEET_HANDOFF_MS,
  blockMenuLabel,
  blockTargetKey,
  canBlockAs,
  isBlockedPhase,
} from "../../src/features/blocking/blocking-presentation";
import { fetchProfileAvailability } from "../../src/features/blocking/blocking-service";
import type { BlockIdentityRef } from "../../src/features/blocking/blocking-types";
import { BlockConfirmSheet } from "../../src/features/blocking/components/BlockConfirmSheet";
import { BlockedByMeState } from "../../src/features/blocking/components/BlockedByMeState";
import { ProfileUnavailableState } from "../../src/features/blocking/components/ProfileUnavailableState";
import { useBlockActions } from "../../src/features/blocking/use-block-actions";
import { useBlockerIdentity } from "../../src/features/blocking/use-blocker-identity";
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

  /*
    HOM-12: la Società è un'identità a sé (§4, §129): bloccarla non tocca le persone
    collegate. Il cancello server precede il caricamento (§173–§175); lo store di
    sessione è la verità del Block (§193).
  */
  const blockActions = useBlockActions();
  const { blocker, societyCapable } = useBlockerIdentity(profile ?? null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [gateBlocker, setGateBlocker] = useState<BlockIdentityRef | null>(null);
  const [gateName, setGateName] = useState<string | null>(null);
  const [isBlockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const blockEntry = useBlockEntry(id ? blockTargetKey({ id, type: "society" }) : null);
  const isBlockedByMe = isBlockedPhase(blockEntry);

  const loadProfile = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      const gateAt = Date.now();
      const availability = await fetchProfileAvailability({ id, type: "society" });
      const gateKey = blockTargetKey({ id, type: "society" });

      if (availability.state === "unavailable") {
        setIsUnavailable(true);
        setData(null);
        trackBlocking({ identityType: "society", name: "profile_unavailable_state_viewed" });
        return;
      }
      setIsUnavailable(false);

      if (availability.state === "blocked_by_me") {
        blockedIdentityStore.seed(gateKey, true, availability.blockId, gateAt);
        setGateBlocker(availability.blocker);
        setGateName(availability.name);
        setData(null);
        trackBlocking({ identityType: "society", name: "blocked_profile_state_viewed_by_blocker" });
        return;
      }
      blockedIdentityStore.seed(gateKey, false, null, gateAt);

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

  /*
    [BUG FIX] Il salvataggio arriva dall'hub di modifica società
    (/profile/society-edit), schermata separata che invalida chiavi
    react-query non usate qui: questa route tiene i dati in stato locale,
    caricati finora solo al mount. Al "torna indietro" la schermata restava
    con i dati vecchi. useFocusEffect (gia' usato altrove, es.
    (tabs)/profile.tsx) e' la via piu' coerente col resto del file: non
    introduce react-query dove non c'e' e ricarica ad ogni ritorno in
    primo piano, incluso il mount iniziale, senza bisogno di un useEffect
    separato.
  */
  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

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

    let confirmed = false;
    try {
      if (wasFollowing) {
        await unfollowClub(profile.id, data.club.id);
      } else {
        await followClub(profile.id, data.club.id);
      }
      confirmed = true;
    } catch {
      // Rollback: lo stato ottimistico non sopravvive a una scrittura fallita.
      setData((current) => (current ? withFollowState(current, wasFollowing) : current));
      showToast({ message: "Non siamo riusciti ad aggiornare il follow.", tone: "neutral" });
    } finally {
      setFollowPending(false);
      // HOM-15 §179: la lista unica del Follow; il Feed si ritocca solo a server confermato.
      invalidateFollowQueries(
        queryClient,
        profile.id,
        confirmed ? { following: !wasFollowing, source: { id: data.club.id, kind: "club" } } : undefined,
      );
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

  const clubName = data?.club.name ?? null;

  /** §22–§23: la conferma si apre dal menu, dopo che il menu si è chiuso. */
  function handleBlockSelected() {
    trackBlocking({ identityType: "society", name: "block_selected", surface: "profile" });
    setMenuVisible(false);
    setTimeout(() => setBlockConfirmVisible(true), SHEET_HANDOFF_MS);
  }

  function handleBlockCancelled() {
    setBlockConfirmVisible(false);
    trackBlocking({ identityType: "society", name: "block_confirmation_cancelled", surface: "profile" });
  }

  async function handleBlockConfirmed() {
    setBlockConfirmVisible(false);
    if (!blocker || !id) return;

    await blockActions.block({
      blocker,
      surface: "profile",
      target: { id, name: clubName, type: "society" },
    });
  }

  /** §156–§158: Sblocca senza conferma, poi si ricarica il profilo (Follow reale dal server). */
  async function handleUnblockFromGate() {
    const effectiveBlocker = gateBlocker ?? blocker;
    if (!id || !effectiveBlocker) return;

    trackBlocking({ identityType: "society", name: "unblock_from_profile" });
    const ok = await blockActions.unblock({
      blockId: blockEntry?.blockId,
      blocker: effectiveBlocker,
      surface: "profile",
      target: { id, name: clubName ?? gateName, type: "society" },
    });

    if (ok) {
      setGateBlocker(null);
      await loadProfile();
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

  if (isUnavailable) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar onBack={() => router.back()} />
        <ProfileUnavailableState />
      </Screen>
    );
  }

  if (isBlockedByMe) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar onBack={() => router.back()} />
        <BlockedByMeState
          isBusy={blockEntry?.phase === "pending_unblock"}
          onUnblock={() => void handleUnblockFromGate()}
        />
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
          onOpenDashboard={() => router.push("/(tabs)/dashboard" as never)}
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
                /* HOM-12 §14–§15: «Blocca {nome}», solo per chi può bloccare come questa identità. */
                ...(canBlockAs({
                  blocker,
                  societyCapable,
                  target: { id: data.club.id, type: "society" },
                })
                  ? [
                      {
                        destructive: true,
                        icon: "ban-outline" as const,
                        id: "block-profile",
                        label: blockMenuLabel(data.club.name),
                        onPress: handleBlockSelected,
                      },
                    ]
                  : []),
              ]
        }
        onClose={() => setMenuVisible(false)}
        title="Azioni società"
        visible={isMenuVisible}
      />
      <BlockConfirmSheet
        name={data.club.name}
        onCancel={handleBlockCancelled}
        onConfirm={() => void handleBlockConfirmed()}
        visible={isBlockConfirmVisible}
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
