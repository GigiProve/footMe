import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";

import { KeyboardAwareForm } from "../../components/ui/keyboard-aware-form";
import { useSession } from "../auth/use-session";
import type { AppRole } from "../onboarding/create-initial-profile";
import {
  buildAgentProfileHeaderDetails,
  buildCoachProfileHeaderDetails,
  buildDirectorProfileHeaderDetails,
  buildHeaderDetails,
  buildPlayerProfileHeaderDetails,
  buildStaffProfileHeaderDetails,
} from "./profile-edit-helpers";
import { ProfileReadonlyView } from "./ProfileReadonlyView";
import {
  AgentProfileHeader,
  CoachProfileHeader,
  DirectorProfileHeader,
  PlayerProfileHeader,
  ProfileHeader,
  StaffProfileHeader,
} from "./profile-screen-components";
import {
  getCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "./profile-service";
import { ProfileSectionError } from "./master/ProfileSectionBlock";
import { ProfileSkeleton } from "./master/ProfileSkeleton";
import {
  trackPlayerProfileViewed,
  trackProfileViewed,
  trackProfileEvent,
} from "./profile-analytics";
import { CoachProfileTabView } from "./career/CoachProfileTabView";
import { ProfileTabView } from "./career/ProfileTabView";
import { StaffProfileTabView } from "./career/StaffProfileTabView";
import { AgentProfileTabView } from "./career/AgentProfileTabView";
import { DirectorProfileTabView } from "./career/DirectorProfileTabView";
import type { MediaLinkedTarget } from "./career/MediaTabContent";
import { FanProfileView, type FanProfileTab } from "./FanProfileView";
import { MediaProfileView } from "./MediaProfileView";
import { openDirectConversation } from "../messaging/messaging-service";
import {
  fetchPlayerAgent,
  fetchPlayerRepresentations,
  fetchRepresentationState,
  respondRepresentation,
  type AgentRepresentation,
} from "../relationships/agent-representation-service";
import { RepresentationSection } from "../relationships/RepresentationSection";
import {
  fetchProfileFollowState,
  followProfile,
  unfollowProfile,
} from "./fan-media-service";
import {
  fetchProfileSaveState,
  saveProfile,
  unsaveProfile,
} from "../saved/saved-service";
import { AddToShortlistFlow } from "../shortlist/components/AddToShortlistFlow";
import { useShortlistPermissions } from "../shortlist/use-shortlist-permissions";
import { fetchProfileShortlistMemberships } from "../shortlist/shortlist-service";
import { colors, spacing } from "../../theme/tokens";
import { ActionSheet, AppText, Button, useToast } from "../../ui";

const noop = () => undefined;

export function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    /** REV-PROF-19: deep link a una tab del Master Profile Tifoso. */
    tab?: string | string[];
  }>();
  const { isLoading: isSessionLoading, needsOnboarding, profile: viewerProfile, session } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [completeProfile, setCompleteProfile] =
    useState<CompleteProfessionalProfile | null>(null);
  const [profileAction, setProfileAction] = useState<{
    profileId: string;
    type: "message";
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Representation state (agent↔player)
  const [representationState, setRepresentationState] =
    useState<AgentRepresentation | null>(null);
  const [playerAgent, setPlayerAgent] = useState<{
    agent_full_name: string | null;
    agent_profile_id: string;
  } | null>(null);
  const [playerRepresentations, setPlayerRepresentations] = useState<
    Awaited<ReturnType<typeof fetchPlayerRepresentations>>
  >([]);
  const [isRepresentationLoading, setIsRepresentationLoading] = useState(false);

  // Follow / Save state for the viewed profile (visitor only).
  const [isFollowed, setIsFollowed] = useState(false);
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [isSavePending, setIsSavePending] = useState(false);
  const [profileActionsVisible, setProfileActionsVisible] = useState(false);
  const [shortlistFlow, setShortlistFlow] = useState<{
    initialMode: "picker" | "manage";
    open: boolean;
  }>({ initialMode: "picker", open: false });

  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const fanInitialTab = parseFanProfileTab(
    Array.isArray(params.tab) ? params.tab[0] : params.tab,
  );
  const currentUserId = session?.user.id ?? null;
  const viewerRole = (viewerProfile?.role ?? null) as AppRole | null;
  const viewedProfileId = completeProfile?.profile.id ?? null;
  const canFollowOrSave =
    !!currentUserId && !!viewedProfileId && currentUserId !== viewedProfileId;

  const { data: shortlistPermissions } = useShortlistPermissions();
  const canViewShortlist = !!shortlistPermissions?.can_view && canFollowOrSave;

  const { data: shortlistMemberships } = useQuery({
    enabled: canViewShortlist && !!viewedProfileId,
    queryFn: () =>
      fetchProfileShortlistMemberships(
        viewedProfileId as string,
        shortlistPermissions?.club_id as string,
      ),
    queryKey: ["shortlist-memberships", viewedProfileId],
  });
  const isShortlisted = (shortlistMemberships?.length ?? 0) > 0;
  // Con il solo permesso di visualizzazione la stella comparirebbe ma il
  // flusso di aggiunta fallirebbe alla RLS: la mostriamo solo a chi può
  // aggiungere profili o gestire una presenza già esistente.
  const canUseShortlistStar =
    canViewShortlist &&
    (!!shortlistPermissions?.can_add_profiles || isShortlisted);

  function handleShortlistPress() {
    setShortlistFlow({
      initialMode: isShortlisted ? "manage" : "picker",
      open: true,
    });
  }

  const headerDetails = useMemo(
    () => (completeProfile ? buildHeaderDetails(completeProfile) : null),
    [completeProfile],
  );
  const playerHeaderDetails = useMemo(
    () =>
      completeProfile ? buildPlayerProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );
  const coachHeaderDetails = useMemo(
    () =>
      completeProfile ? buildCoachProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );
  const agentHeaderDetails = useMemo(
    () =>
      completeProfile ? buildAgentProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );
  const staffHeaderDetails = useMemo(
    () =>
      completeProfile ? buildStaffProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );
  const directorHeaderDetails = useMemo(
    () =>
      completeProfile ? buildDirectorProfileHeaderDetails(completeProfile) : null,
    [completeProfile],
  );

  // Una sola visualizzazione per profilo aperto: un rebuild o un cambio tab
  // non devono rimandare lo stesso evento (§42).
  const viewedProfilesRef = useRef(new Set<string>());

  useEffect(() => {
    if (!viewedProfileId || completeProfile?.profile.role !== "player") {
      return;
    }

    trackPlayerProfileViewed(
      viewedProfileId,
      "visitor",
      viewedProfilesRef.current,
    );
  }, [completeProfile?.profile.role, viewedProfileId]);

  useEffect(() => {
    const role = completeProfile?.profile.role;

    if (
      !viewedProfileId ||
      (role !== "coach" &&
        role !== "staff" &&
        role !== "director" &&
        // REV-PROF-19: anche il Master Profile Tifoso conta un'apertura.
        role !== "fan")
    ) {
      return;
    }

    trackProfileViewed(viewedProfileId, {
      profileType: role,
      seen: viewedProfilesRef.current,
      source: "profile_link",
      viewerMode: "visitor",
    });
  }, [completeProfile?.profile.role, viewedProfileId]);

  const shortlistProfileSubtitle =
    playerHeaderDetails?.primaryRole ??
    coachHeaderDetails?.primaryRole ??
    staffHeaderDetails?.primaryRole ??
    directorHeaderDetails?.primaryRole ??
    agentHeaderDetails?.primaryRole ??
    "";

  const loadProfile = useCallback(async () => {
    if (!profileId || !session?.user) {
      setCompleteProfile(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await getCompleteProfessionalProfile(profileId);
      setCompleteProfile(data);
    } catch {
      // Copy leggibile: il messaggio del backend può contenere nomi di RPC,
      // enum e status code, che non devono arrivare all'utente (§36).
      setCompleteProfile(null);
      setErrorMessage("Non è stato possibile caricare il profilo. Riprova.");
    } finally {
      setIsLoading(false);
    }
  }, [profileId, session?.user]);

  // Load representation state when viewer is agent viewing a player, or viewer
  // is a player being viewed by an agent.
  const loadRepresentationData = useCallback(async () => {
    if (!completeProfile || !currentUserId) {
      setRepresentationState(null);
      setPlayerAgent(null);
      setPlayerRepresentations([]);
      return;
    }

    const viewedRole = completeProfile.profile.role as AppRole;
    const viewedProfileId = completeProfile.profile.id;

    // Agent viewing a player profile
    if (viewerRole === "agent" && viewedRole === "player") {
      try {
        setIsRepresentationLoading(true);
        const state = await fetchRepresentationState(currentUserId, viewedProfileId);
        setRepresentationState(state);
      } catch {
        setRepresentationState(null);
      } finally {
        setIsRepresentationLoading(false);
      }
      return;
    }

    // Player viewing another profile — check if this viewer-player has any
    // pending incoming request from the viewed agent
    if (viewerRole === "player" && viewedRole === "agent") {
      try {
        setIsRepresentationLoading(true);
        const state = await fetchRepresentationState(viewedProfileId, currentUserId);
        setRepresentationState(state);
      } catch {
        setRepresentationState(null);
      } finally {
        setIsRepresentationLoading(false);
      }
      return;
    }

    // Any viewer looking at a player profile — surface accepted representations
    if (viewedRole === "player") {
      try {
        setIsRepresentationLoading(true);
        const [agent, reps] = await Promise.all([
          fetchPlayerAgent(viewedProfileId),
          fetchPlayerRepresentations(viewedProfileId),
        ]);
        setPlayerAgent(agent);
        setPlayerRepresentations(reps);
      } catch {
        setPlayerAgent(null);
        setPlayerRepresentations([]);
      } finally {
        setIsRepresentationLoading(false);
      }
      return;
    }

    setRepresentationState(null);
    setPlayerAgent(null);
    setPlayerRepresentations([]);
  }, [completeProfile, currentUserId, viewerRole]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void loadRepresentationData();
  }, [loadRepresentationData]);

  // Load follow/save state for the viewed profile.
  useEffect(() => {
    if (!canFollowOrSave || !currentUserId || !viewedProfileId) {
      setIsFollowed(false);
      setIsProfileSaved(false);
      return;
    }

    let active = true;
    void Promise.all([
      fetchProfileFollowState(currentUserId, viewedProfileId).catch(() => false),
      fetchProfileSaveState(currentUserId, viewedProfileId).catch(() => false),
    ]).then(([followed, saved]) => {
      if (!active) {
        return;
      }
      setIsFollowed(followed);
      setIsProfileSaved(saved);
    });

    return () => {
      active = false;
    };
  }, [canFollowOrSave, currentUserId, viewedProfileId]);

  async function handleToggleFollow() {
    if (!currentUserId || !viewedProfileId || isFollowPending) {
      return;
    }
    const next = !isFollowed;
    const name = completeProfile?.profile.full_name ?? "questo profilo";
    setIsFollowPending(true);
    setIsFollowed(next);
    try {
      if (next) {
        await followProfile(currentUserId, viewedProfileId);
        showToast({ message: `Segui ${name}`, tone: "success", icon: "person-add" });
      } else {
        await unfollowProfile(currentUserId, viewedProfileId);
        showToast({ message: `Non segui più ${name}`, tone: "neutral" });
      }
      queryClient.invalidateQueries({ queryKey: ["following-count"] });
      queryClient.invalidateQueries({ queryKey: ["followed"] });
    } catch (error) {
      setIsFollowed(!next);
      showToast({
        message:
          error instanceof Error ? error.message : "Operazione non riuscita.",
        tone: "neutral",
      });
    } finally {
      setIsFollowPending(false);
    }
  }

  async function handleToggleSaveProfile() {
    if (!currentUserId || !viewedProfileId || isSavePending) {
      return;
    }
    const next = !isProfileSaved;
    setIsSavePending(true);
    setIsProfileSaved(next);
    try {
      if (next) {
        await saveProfile(currentUserId, viewedProfileId);
        showToast({ message: "Profilo salvato", tone: "success", icon: "bookmark" });
      } else {
        await unsaveProfile(currentUserId, viewedProfileId);
        showToast({ message: "Elemento rimosso dai Salvati", tone: "neutral" });
      }
      queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
    } catch (error) {
      setIsProfileSaved(!next);
      showToast({
        message:
          error instanceof Error ? error.message : "Operazione non riuscita.",
        tone: "neutral",
      });
    } finally {
      setIsSavePending(false);
    }
  }

  async function handleShareProfile() {
    const name = completeProfile?.profile.full_name ?? "questo profilo";
    try {
      await Share.share({
        message: `Dai un'occhiata al profilo di ${name} su ProLink.`,
      });
    } catch {
      // user cancelled or share unavailable — no-op
    }
  }

  function handleReportProfile() {
    showToast({
      message: "Segnalazione inviata. Grazie.",
      tone: "success",
      icon: "flag",
    });
  }

  async function handleMessageProfile(targetProfile: CompleteProfessionalProfile) {
    try {
      setProfileAction({ profileId: targetProfile.profile.id, type: "message" });
      const conversationId = await openDirectConversation(targetProfile.profile.id);
      router.push({
        pathname: "/messages/[conversationId]",
        params: {
          conversationId,
          otherName: targetProfile.profile.full_name,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'apertura della conversazione.";
      Alert.alert("Chat non disponibile", message);
    } finally {
      setProfileAction(null);
    }
  }

  function handleRequestRepresentation() {
    if (!profileId || !completeProfile) return;
    const p = completeProfile.profile;
    router.push({
      pathname: "/representation/request",
      params: {
        playerId: profileId,
        name: p.full_name ?? "",
      },
    });
  }

  async function handleRespondRepresentation(accept: boolean) {
    if (!representationState) return;
    try {
      setIsRepresentationLoading(true);
      await respondRepresentation(representationState.id, accept);
      await loadRepresentationData();
      Alert.alert(
        accept ? "Rappresentanza accettata" : "Richiesta rifiutata",
        accept
          ? "Hai accettato la rappresentanza del procuratore."
          : "Hai rifiutato la richiesta di rappresentanza.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossibile rispondere alla richiesta.";
      Alert.alert("Errore", message);
    } finally {
      setIsRepresentationLoading(false);
    }
  }

  function handleOpenDirectorLinkedTarget(target: MediaLinkedTarget) {
    if (target.target_type === "club") {
      router.push(`/club/${target.target_id}` as never);
      return;
    }

    router.push(`/profile/${target.target_id}` as never);
  }

  function handleOpenFavoriteClub(clubId: string) {
    router.push(`/club/${clubId}` as never);
  }

  function handleOpenPlayerProfile(playerProfileId: string) {
    router.push(`/profile/${playerProfileId}` as never);
  }

  /** Dettaglio condiviso del contenuto: una rotta sola per ogni tipologia. */
  function handleOpenContent(ref: { contentType: string; postId: string }) {
    router.push(`/content/${ref.contentType}/${ref.postId}` as never);
  }

  if (!isSessionLoading && !session?.user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!isSessionLoading && needsOnboarding) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  if (profileId && currentUserId && profileId === currentUserId) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    /*
      REV-PROF-09: il Dirigente non ha piu' una superficie, una app bar e un
      titolo propri. La schermata del Visitor e' una sola per tutte le
      tipologie, come i Master Profile gia' approvati.
    */
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={20} />
        </Pressable>
        <AppText variant="titleSm">
          {completeProfile
            ? getProfileViewerTitle(completeProfile.profile.role as AppRole)
            : "Profilo"}
        </AppText>
        {canFollowOrSave ? (
          <View style={styles.topBarActions}>
            <Pressable
              accessibilityLabel={
                isProfileSaved ? "Rimuovi dai salvati" : "Salva profilo"
              }
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleToggleSaveProfile}
              style={({ pressed }) => [
                styles.topBarIcon,
                pressed ? styles.topBarIconPressed : null,
              ]}
            >
              <Ionicons
                color={isProfileSaved ? colors.accent : colors.textPrimary}
                name={isProfileSaved ? "bookmark" : "bookmark-outline"}
                size={22}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Azioni profilo"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setProfileActionsVisible(true)}
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
          <View style={styles.backButtonPlaceholder} />
        )}
      </View>

      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        {isLoading || isSessionLoading ? (
          /*
            Scheletro al posto dello spinner (REV-PROF-03, "Loading"): la pagina
            occupa già lo spazio che avrà, quindi l'arrivo dei dati non fa
            saltare il layout.
          */
          <ProfileSkeleton testID="profile-loading-skeleton" />
        ) : errorMessage ? (
          <View style={styles.stateBlock}>
            <AppText variant="titleSm">Profilo non disponibile</AppText>
            <ProfileSectionError
              message={errorMessage}
              onRetry={() => void loadProfile()}
              testID="profile-load-error"
            />
          </View>
        ) : completeProfile ? (
          <>
            <ProfileHeaderBlock
              completeProfile={completeProfile}
              agentHeaderDetails={agentHeaderDetails}
              coachHeaderDetails={coachHeaderDetails}
              directorHeaderDetails={directorHeaderDetails}
              headerDetails={headerDetails}
              isFollowed={isFollowed}
              isMessaging={
                profileAction?.profileId === completeProfile.profile.id &&
                profileAction.type === "message"
              }
              isSaved={isProfileSaved}
              isShortlisted={canUseShortlistStar ? isShortlisted : undefined}
              onContactPress={
                canFollowOrSave
                  ? () => {
                      trackProfileEvent("profile_message_tapped", {
                        profileType: completeProfile.profile.role,
                        viewerMode: "visitor",
                      });
                      void handleMessageProfile(completeProfile);
                    }
                  : undefined
              }
              onFollowPress={
                canFollowOrSave
                  ? () => {
                      trackProfileEvent("profile_follow_tapped", {
                        profileType: completeProfile.profile.role,
                        viewerMode: "visitor",
                      });
                      void handleToggleFollow();
                    }
                  : undefined
              }
              onMorePress={() => {
                trackProfileEvent("profile_more_menu_opened", {
                  profileType: completeProfile.profile.role,
                  viewerMode: "visitor",
                });
                setProfileActionsVisible(true);
              }}
              onSharePress={() => {
                trackProfileEvent("profile_share_tapped", {
                  profileType: completeProfile.profile.role,
                  viewerMode: "visitor",
                });
                void handleShareProfile();
              }}
              onShortlistPress={canUseShortlistStar ? handleShortlistPress : undefined}
              playerHeaderDetails={playerHeaderDetails}
              staffHeaderDetails={staffHeaderDetails}
            />
            <ProfileContentBlock
              completeProfile={completeProfile}
              fanInitialTab={fanInitialTab}
              onOpenClub={handleOpenFavoriteClub}
              isFollowed={isFollowed}
              isMessaging={
                profileAction?.profileId === completeProfile.profile.id &&
                profileAction.type === "message"
              }
              isRepresentationLoading={isRepresentationLoading}
              onFollowPress={
                canFollowOrSave
                  ? () => {
                      trackProfileEvent("profile_follow_tapped", {
                        profileType: completeProfile.profile.role,
                        viewerMode: "visitor",
                      });
                      void handleToggleFollow();
                    }
                  : undefined
              }
              onMessage={() => handleMessageProfile(completeProfile)}
              onMorePress={() => {
                trackProfileEvent("profile_more_menu_opened", {
                  profileType: completeProfile.profile.role,
                  viewerMode: "visitor",
                });
                setProfileActionsVisible(true);
              }}
              onOpenContent={handleOpenContent}
              onOpenDirectorLinkedTarget={handleOpenDirectorLinkedTarget}
              onOpenFavoriteClub={handleOpenFavoriteClub}
              onOpenPlayerProfile={handleOpenPlayerProfile}
              onRequestRepresentation={handleRequestRepresentation}
              onRespondRepresentation={handleRespondRepresentation}
              onSharePress={() => {
                trackProfileEvent("profile_share_tapped", {
                  profileType: completeProfile.profile.role,
                  viewerMode: "visitor",
                });
                void handleShareProfile();
              }}
              playerAgent={playerAgent}
              playerRepresentations={playerRepresentations}
              representationState={representationState}
              viewerProfileId={currentUserId}
              viewerRole={viewerRole}
            />
          </>
        ) : (
          <View style={styles.stateBlock}>
            <AppText variant="titleSm">Profilo non disponibile</AppText>
            <AppText color="secondary" variant="bodySm">
              Nessun contenuto da mostrare.
            </AppText>
          </View>
        )}
      </KeyboardAwareForm>
      <ActionSheet
        actions={[
          {
            icon: isProfileSaved ? "bookmark" : "bookmark-outline",
            label: isProfileSaved ? "Rimuovi dai Salvati" : "Salva profilo",
            subtitle: isProfileSaved ? undefined : "Ritrovalo nei tuoi Salvati.",
            onPress: handleToggleSaveProfile,
          },
          /*
            L'header dell'Allenatore non porta più la riga social: follower e
            connessioni restano raggiungibili da qui, che è il menu delle azioni
            autorizzate sul profilo.
          */
          ...(viewedProfileId
            ? [
                {
                  icon: "people-outline" as const,
                  label: "Follower e connessioni",
                  onPress: () =>
                    router.push(
                      `/profile/connections?profileId=${viewedProfileId}&mode=followers` as never,
                    ),
                },
              ]
            : []),
          {
            icon: "share-outline",
            label: "Condividi profilo",
            onPress: handleShareProfile,
          },
          {
            destructive: true,
            icon: "flag-outline",
            label: "Segnala profilo",
            onPress: handleReportProfile,
          },
        ]}
        onClose={() => setProfileActionsVisible(false)}
        title="Azioni profilo"
        visible={profileActionsVisible}
      />
      {shortlistPermissions && viewedProfileId ? (
        <AddToShortlistFlow
          clubId={shortlistPermissions.club_id}
          initialMode={shortlistFlow.initialMode}
          onClose={() => setShortlistFlow((prev) => ({ ...prev, open: false }))}
          open={shortlistFlow.open}
          permissions={shortlistPermissions}
          profile={{
            avatarUrl: completeProfile?.profile.avatar_url,
            fullName: completeProfile?.profile.full_name ?? "Profilo",
            id: viewedProfileId,
            subtitle: shortlistProfileSubtitle,
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ProfileHeaderBlock({
  completeProfile,
  agentHeaderDetails,
  coachHeaderDetails,
  directorHeaderDetails,
  headerDetails,
  isFollowed,
  isMessaging,
  isSaved,
  isShortlisted,
  onContactPress,
  onFollowPress,
  onMorePress,
  onSavePress,
  onSharePress,
  onShortlistPress,
  playerHeaderDetails,
  staffHeaderDetails,
}: {
  completeProfile: CompleteProfessionalProfile;
  agentHeaderDetails: ReturnType<typeof buildAgentProfileHeaderDetails>;
  coachHeaderDetails: ReturnType<typeof buildCoachProfileHeaderDetails>;
  directorHeaderDetails: ReturnType<typeof buildDirectorProfileHeaderDetails>;
  headerDetails: ReturnType<typeof buildHeaderDetails> | null;
  isFollowed: boolean;
  isMessaging?: boolean;
  isSaved: boolean;
  isShortlisted?: boolean;
  onContactPress?: () => void;
  onFollowPress?: () => void;
  onMorePress?: () => void;
  onSavePress?: () => void;
  onSharePress?: () => void;
  onShortlistPress?: () => void;
  playerHeaderDetails: ReturnType<typeof buildPlayerProfileHeaderDetails>;
  staffHeaderDetails: ReturnType<typeof buildStaffProfileHeaderDetails>;
}) {
  const router = useRouter();
  const role = completeProfile.profile.role as AppRole;

  if (role === "player" && playerHeaderDetails) {
    return (
      <PlayerProfileHeader
        availabilityLabel={playerHeaderDetails.availabilityLabel}
        avatarUrl={completeProfile.profile.avatar_url}
        clubLabel={playerHeaderDetails.clubLabel}
        coverImageUrl={completeProfile.profile.cover_url}
        fullName={playerHeaderDetails.fullName}
        locationLabel={playerHeaderDetails.locationLabel}
        mode="visitor"
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isSaved={isSaved}
        isShortlisted={isShortlisted}
        onContactPress={onContactPress}
        onFollowPress={onFollowPress}
        onSavePress={onSavePress}
        onShortlistPress={onShortlistPress}
        onSharePress={onSharePress}
        primaryRole={playerHeaderDetails.primaryRole}
        quickFacts={playerHeaderDetails.quickFacts}
        secondaryRole={playerHeaderDetails.secondaryRole}
      />
    );
  }

  if (role === "coach" && coachHeaderDetails) {
    return (
      <CoachProfileHeader
        availabilityLabel={coachHeaderDetails.availabilityLabel}
        avatarUrl={completeProfile.profile.avatar_url}
        clubLabel={coachHeaderDetails.clubLabel}
        coverImageUrl={completeProfile.profile.cover_url}
        fullName={coachHeaderDetails.fullName}
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isVerified={coachHeaderDetails.isVerified}
        locationLabel={coachHeaderDetails.locationLabel}
        mode="visitor"
        onFollowPress={onFollowPress}
        onMessagePress={onContactPress}
        onMorePress={onMorePress}
        onSharePress={onSharePress}
        primaryRole={coachHeaderDetails.primaryRole}
        quickFacts={coachHeaderDetails.quickFacts}
      />
    );
  }

  if (role === "staff" && staffHeaderDetails) {
    return (
      <StaffProfileHeader
        availabilityLabel={staffHeaderDetails.availabilityLabel}
        avatarUrl={completeProfile.profile.avatar_url}
        clubLabel={staffHeaderDetails.clubLabel}
        coverImageUrl={completeProfile.profile.cover_url}
        fullName={staffHeaderDetails.fullName}
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isVerified={staffHeaderDetails.isVerified}
        locationLabel={staffHeaderDetails.locationLabel}
        mode="visitor"
        onFollowPress={onFollowPress}
        onMessagePress={onContactPress}
        onMorePress={onMorePress}
        onSharePress={onSharePress}
        primaryRole={staffHeaderDetails.primaryRole}
        quickFacts={staffHeaderDetails.quickFacts}
      />
    );
  }

  if (role === "agent" && agentHeaderDetails) {
    return (
      <AgentProfileHeader
        availabilityLabel={agentHeaderDetails.availabilityLabel}
        avatarUrl={completeProfile.profile.avatar_url}
        badges={agentHeaderDetails.badges}
        clubLabel={agentHeaderDetails.clubLabel}
        coverImageUrl={completeProfile.profile.cover_url}
        fullName={agentHeaderDetails.fullName}
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isVerified={agentHeaderDetails.isVerified}
        locationLabel={agentHeaderDetails.locationLabel}
        mode="visitor"
        onFollowPress={onFollowPress}
        onMessagePress={onContactPress}
        onMorePress={onMorePress}
        onSharePress={onSharePress}
        primaryRole={agentHeaderDetails.primaryRole}
        quickFacts={agentHeaderDetails.quickFacts}
      />
    );
  }

  if (role === "director" && directorHeaderDetails) {
    return (
      <DirectorProfileHeader
        availabilityLabel={directorHeaderDetails.availabilityLabel}
        avatarUrl={completeProfile.profile.avatar_url}
        clubLabel={directorHeaderDetails.clubLabel}
        coverImageUrl={completeProfile.profile.cover_url}
        fullName={directorHeaderDetails.fullName}
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isVerified={directorHeaderDetails.isVerified}
        locationLabel={directorHeaderDetails.locationLabel}
        mode="visitor"
        onFollowPress={onFollowPress}
        onMessagePress={onContactPress}
        onMorePress={onMorePress}
        onSharePress={onSharePress}
        primaryRole={directorHeaderDetails.primaryRole}
        quickFacts={directorHeaderDetails.quickFacts}
      />
    );
  }

  if (role === "fan") {
    return null;
  }

  if (role === "media") {
    return null;
  }

  if (!headerDetails) {
    return null;
  }

  return (
    <ProfileHeader
      avatarUrl={completeProfile.profile.avatar_url}
      badges={headerDetails.badges}
      clubLogoUrl={completeProfile.club?.logo_url}
      clubMode={role === "club_admin"}
      fullName={headerDetails.fullName}
      primaryMeta={headerDetails.primaryMeta}
      secondaryMeta={headerDetails.secondaryMeta}
    />
  );
}

function ProfileContentBlock({
  completeProfile,
  fanInitialTab,
  isFollowed = false,
  isMessaging = false,
  isRepresentationLoading = false,
  onFollowPress,
  onMessage,
  onMorePress,
  onOpenClub,
  onOpenContent,
  onOpenDirectorLinkedTarget,
  onOpenFavoriteClub,
  onOpenPlayerProfile,
  onRequestRepresentation,
  onRespondRepresentation,
  onSharePress,
  playerAgent,
  playerRepresentations,
  representationState,
  viewerProfileId,
  viewerRole,
}: {
  completeProfile: CompleteProfessionalProfile;
  /** REV-PROF-19: deep link a una tab del Master Profile Tifoso. */
  fanInitialTab?: FanProfileTab;
  isFollowed?: boolean;
  isMessaging?: boolean;
  isRepresentationLoading?: boolean;
  onFollowPress?: () => void;
  onMessage?: () => void;
  onMorePress?: () => void;
  onOpenClub?: (clubId: string) => void;
  onOpenContent?: (ref: { contentType: string; postId: string }) => void;
  onOpenDirectorLinkedTarget?: (target: MediaLinkedTarget) => void;
  onOpenFavoriteClub?: (clubId: string) => void;
  onOpenPlayerProfile?: (profileId: string) => void;
  onRequestRepresentation?: () => void;
  onRespondRepresentation?: (accept: boolean) => void;
  onSharePress?: () => void;
  playerAgent?: { agent_full_name: string | null; agent_profile_id: string } | null;
  playerRepresentations?: Awaited<ReturnType<typeof fetchPlayerRepresentations>>;
  representationState?: AgentRepresentation | null;
  viewerProfileId?: string | null;
  viewerRole?: AppRole | null;
}) {
  const router = useRouter();
  const role = completeProfile.profile.role as AppRole;

  if (role === "player") {
    // Determine whether viewer is an agent (can request representation) or
    // the player themselves receiving an incoming request.
    const isViewerAgent = viewerRole === "agent";
    const isViewerThisPlayer = viewerRole === "player";

    // A pending request where the agent is the initiator = incoming for the player
    const hasIncomingRequest =
      isViewerThisPlayer &&
      representationState?.status === "pending" &&
      representationState?.requested_by === representationState?.agent_profile_id;

    return (
      <View>
        {/* Agent → Player representation actions */}
        {isViewerAgent ? (
          <View style={styles.representationBar}>
            {representationState?.status === "accepted" ? (
              <View style={styles.representationStatus}>
                <Ionicons color={colors.success} name="checkmark-circle" size={16} />
                <AppText color="secondary" variant="bodySm">
                  Rappresentanza attiva
                </AppText>
              </View>
            ) : representationState?.status === "pending" ? (
              <View style={styles.representationStatus}>
                <Ionicons color={colors.textSecondary} name="time-outline" size={16} />
                <AppText color="secondary" variant="bodySm">
                  Richiesta inviata
                </AppText>
              </View>
            ) : (
              <Button
                disabled={isRepresentationLoading}
                label="Richiedi rappresentanza"
                loading={isRepresentationLoading}
                onPress={onRequestRepresentation}
                size="sm"
                variant="primary"
              />
            )}
          </View>
        ) : null}

        {/* Player receiving incoming representation request */}
        {hasIncomingRequest ? (
          <View style={styles.representationBar}>
            <AppText style={styles.representationIncomingLabel} variant="bodySm">
              Un procuratore ha richiesto di rappresentarti
            </AppText>
            <View style={styles.representationActions}>
              <Button
                disabled={isRepresentationLoading}
                label="Accetta"
                loading={isRepresentationLoading}
                onPress={() => onRespondRepresentation?.(true)}
                size="sm"
                variant="primary"
              />
              <Button
                disabled={isRepresentationLoading}
                label="Rifiuta"
                onPress={() => onRespondRepresentation?.(false)}
                size="sm"
                variant="danger"
              />
            </View>
          </View>
        ) : null}

        {/* Rappresentanza section */}
        {(playerRepresentations?.length ?? 0) > 0 ? (
          <View style={styles.representationSection}>
            <RepresentationSection
              isOwner={false}
              representations={playerRepresentations ?? []}
            />
          </View>
        ) : playerAgent ? (
          <Pressable
            accessibilityLabel={`Apri profilo procuratore ${playerAgent.agent_full_name ?? ""}`}
            accessibilityRole="button"
            onPress={() => onOpenPlayerProfile?.(playerAgent.agent_profile_id)}
            style={({ pressed }) => [
              styles.agentRow,
              pressed ? styles.agentRowPressed : null,
            ]}
          >
            <Ionicons color={colors.textSecondary} name="person-outline" size={15} />
            <AppText color="secondary" variant="bodySm">
              {"Procuratore: "}
              <AppText color="accent" variant="bodySm">
                {playerAgent.agent_full_name ?? "Procuratore"}
              </AppText>
            </AppText>
            <Ionicons color={colors.textSecondary} name="chevron-forward" size={14} />
          </Pressable>
        ) : null}

        <ProfileTabView
          completeProfile={completeProfile}
          isOwner={false}
          onManageMedia={noop}
        />
      </View>
    );
  }

  if (role === "coach") {
    return (
      <CoachProfileTabView
        completeProfile={completeProfile}
        isOwner={false}
        onManageMedia={noop}
        onOpenClub={onOpenClub}
      />
    );
  }

  if (role === "staff") {
    return (
      <StaffProfileTabView
        completeProfile={completeProfile}
        isOwner={false}
        onManageMedia={noop}
        onOpenClub={onOpenClub}
      />
    );
  }

  if (role === "agent") {
    return (
      /*
        Stesso corpo dell'Owner. Segui, Messaggio, Condividi e il menu
        contestuale vivono nell'header condiviso, non qui dentro: al Visitor
        non arriva nessun handler di modifica, quindi nessun controllo Owner
        può essere renderizzato.
      */
      <AgentProfileTabView
        completeProfile={completeProfile}
        isOwner={false}
        onOpenAllAssistiti={() =>
          router.push(
            `/representation/portfolio/${completeProfile.profile.id}` as never,
          )
        }
        onOpenAssistito={onOpenPlayerProfile}
      />
    );
  }

  if (role === "director") {
    return (
      /*
        Stesso corpo dell'Owner. Segui, Messaggio, Condividi e il menu
        contestuale vivono nell'header condiviso, non qui dentro: al Visitor
        non arriva nessun handler di modifica, quindi nessun controllo Owner
        può essere renderizzato.
      */
      <DirectorProfileTabView
        completeProfile={completeProfile}
        isOwner={false}
        onOpenClub={onOpenClub}
        onOpenLinkedTarget={onOpenDirectorLinkedTarget}
      />
    );
  }

  if (role === "fan") {
    /*
      REV-PROF-19: il Master Profile Tifoso porta il proprio header condiviso
      e le tre tab. Segui, Messaggio, Condividi e il menu azioni restano
      quelli della schermata, non una seconda implementazione.
    */
    return (
      <FanProfileView
        completeProfile={completeProfile}
        initialTab={fanInitialTab}
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        mode="visitor"
        onContactPress={onMessage}
        onFollowPress={onFollowPress}
        onMorePress={onMorePress}
        onOpenContent={onOpenContent}
        onOpenFavoriteClub={onOpenFavoriteClub}
        onSharePress={onSharePress}
        viewerProfileId={viewerProfileId}
      />
    );
  }

  if (role === "media") {
    return (
      <MediaProfileView
        completeProfile={completeProfile}
        isMessaging={isMessaging}
        mode="visitor"
        onContactPress={onMessage}
        onOpenClub={onOpenFavoriteClub}
        onOpenProfile={onOpenPlayerProfile}
        viewerProfileId={viewerProfileId}
      />
    );
  }

  return (
    <ProfileReadonlyView
      completeProfile={completeProfile}
      editable={false}
      role={role}
    />
  );
}

/** Tab valida o niente: un valore sconosciuto non apre una tab inesistente. */
function parseFanProfileTab(value: string | undefined): FanProfileTab | undefined {
  return value === "tribuna" || value === "media" || value === "info"
    ? value
    : undefined;
}

function getProfileViewerTitle(role: AppRole) {
  switch (role) {
    case "agent":
      return "Profilo procuratore";
    case "coach":
      return "Profilo allenatore";
    case "staff":
      return "Profilo staff";
    case "club_admin":
      return "Profilo club";
    case "director":
      return "Profilo dirigente";
    // REV-PROF-19: la denominazione pubblica è "Tifoso", ovunque.
    case "fan":
      return "Profilo tifoso";
    case "media":
      return "Profilo media";
    case "player":
      return "Profilo giocatore";
    default:
      return "Profilo";
  }
}

const styles = StyleSheet.create({
  representationSection: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  agentRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  agentRowPressed: {
    opacity: 0.75,
  },
  backButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  backButtonPlaceholder: {
    width: 32,
  },
  topBarActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  topBarIcon: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 28,
  },
  topBarIconPressed: {
    opacity: 0.6,
  },
  representationActions: {
    flexDirection: "row",
    gap: spacing[10],
    marginTop: spacing[10],
  },
  representationBar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[14],
  },
  representationIncomingLabel: {
    marginBottom: spacing[4],
  },
  representationStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[32],
  },
  stateBlock: {
    alignItems: "center",
    gap: spacing[12],
    justifyContent: "center",
    minHeight: 240,
    paddingHorizontal: spacing[24],
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
});
