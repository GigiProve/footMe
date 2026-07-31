import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { AgentProfileHeader } from "./AgentProfileHeader";
import {
  buildAgentProfileHeaderDetails,
  buildCoachProfileHeaderDetails,
  buildHeaderDetails,
  buildPlayerProfileHeaderDetails,
  buildStaffProfileHeaderDetails,
} from "./profile-edit-helpers";
import { ProfileReadonlyView } from "./ProfileReadonlyView";
import {
  CoachProfileHeader,
  PlayerProfileHeader,
  ProfileHeader,
  StaffProfileHeader,
} from "./profile-screen-components";
import {
  getCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "./profile-service";
import { CoachProfileTabView } from "./career/CoachProfileTabView";
import { ProfileTabView } from "./career/ProfileTabView";
import { StaffProfileTabView } from "./career/StaffProfileTabView";
import { AgentProfileTabView } from "./career/AgentProfileTabView";
import { DirectorProfileTabView } from "./career/DirectorProfileTabView";
import type { DirectorMediaLinkedTarget } from "./director-media";
import { FanProfileView } from "./FanProfileView";
import { MediaProfileView } from "./MediaProfileView";
import { requestConnection } from "../networking/networking-service";
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
import { fetchProfileSocialSummary } from "./profile-social-service";
import { AddToShortlistFlow } from "../shortlist/components/AddToShortlistFlow";
import { useShortlistPermissions } from "../shortlist/use-shortlist-permissions";
import { fetchProfileShortlistMemberships } from "../shortlist/shortlist-service";
import { colors, spacing } from "../../theme/tokens";
import { ActionSheet, AppText, Button, useToast } from "../../ui";

const noop = () => undefined;

export function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { isLoading: isSessionLoading, needsOnboarding, profile: viewerProfile, session } = useSession();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [completeProfile, setCompleteProfile] =
    useState<CompleteProfessionalProfile | null>(null);
  const [profileAction, setProfileAction] = useState<{
    profileId: string;
    type: "connect" | "message";
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

  const { data: coachSocialSummary } = useQuery({
    enabled: !!viewedProfileId && completeProfile?.profile.role === "coach",
    queryFn: () => fetchProfileSocialSummary(viewedProfileId as string),
    queryKey: ["profile-social-summary", viewedProfileId],
  });

  const shortlistProfileSubtitle =
    playerHeaderDetails?.primaryRole ??
    coachHeaderDetails?.primaryRole ??
    staffHeaderDetails?.primaryRole ??
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
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile caricare questo profilo.";
      setCompleteProfile(null);
      setErrorMessage(message);
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

  async function handleConnectToProfile(targetProfile: CompleteProfessionalProfile) {
    try {
      setProfileAction({ profileId: targetProfile.profile.id, type: "connect" });
      await requestConnection(targetProfile.profile.id);
      Alert.alert("Richiesta inviata", "La richiesta di collegamento e' stata inviata.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante l'invio della richiesta.";
      Alert.alert("Connessione non inviata", message);
    } finally {
      setProfileAction(null);
    }
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
          ? "Hai accettato la rappresentanza dell'agente."
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

  function handleOpenDirectorLinkedTarget(target: DirectorMediaLinkedTarget) {
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

  if (!isSessionLoading && !session?.user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!isSessionLoading && needsOnboarding) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  if (profileId && currentUserId && profileId === currentUserId) {
    return <Redirect href="/(tabs)/profile" />;
  }

  const isDirectorProfile = completeProfile?.profile.role === "director";

  return (
    <SafeAreaView style={[styles.screen, isDirectorProfile ? styles.directorScreen : null]}>
      <View style={[styles.topBar, isDirectorProfile ? styles.directorTopBar : null]}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            color={isDirectorProfile ? "#061223" : colors.textPrimary}
            name="chevron-back"
            size={20}
          />
        </Pressable>
        <AppText style={isDirectorProfile ? styles.directorTopBarTitle : null} variant="titleSm">
          {completeProfile
            ? isDirectorProfile
              ? completeProfile.profile.full_name
              : getProfileViewerTitle(completeProfile.profile.role as AppRole)
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
                color={
                  isProfileSaved
                    ? colors.accent
                    : isDirectorProfile
                      ? "#061223"
                      : colors.textPrimary
                }
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
                color={isDirectorProfile ? "#061223" : colors.textPrimary}
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
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.accent} />
            <AppText color="secondary" variant="bodySm">
              Caricamento profilo in corso...
            </AppText>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateBlock}>
            <AppText variant="titleSm">Profilo non disponibile</AppText>
            <AppText color="secondary" variant="bodySm">
              {errorMessage}
            </AppText>
          </View>
        ) : completeProfile ? (
          <>
            <ProfileHeaderBlock
              completeProfile={completeProfile}
              agentHeaderDetails={agentHeaderDetails}
              coachHeaderDetails={coachHeaderDetails}
              coachSocialSummary={coachSocialSummary}
              headerDetails={headerDetails}
              isFollowed={isFollowed}
              isMessaging={
                profileAction?.profileId === completeProfile.profile.id &&
                profileAction.type === "message"
              }
              isSaved={isProfileSaved}
              isShortlisted={canUseShortlistStar ? isShortlisted : undefined}
              onContactPress={
                canFollowOrSave ? () => handleMessageProfile(completeProfile) : undefined
              }
              onFollowersPress={() =>
                router.push(
                  `/profile/connections?profileId=${completeProfile.profile.id}&mode=followers` as never,
                )
              }
              onFollowPress={canFollowOrSave ? handleToggleFollow : undefined}
              onMutualPress={() =>
                router.push(
                  `/profile/connections?profileId=${completeProfile.profile.id}&mode=mutual` as never,
                )
              }
              onShortlistPress={canUseShortlistStar ? handleShortlistPress : undefined}
              playerHeaderDetails={playerHeaderDetails}
              staffHeaderDetails={staffHeaderDetails}
            />
            <ProfileContentBlock
              completeProfile={completeProfile}
              isConnecting={
                profileAction?.profileId === completeProfile.profile.id &&
                profileAction.type === "connect"
              }
              isFollowed={isFollowed}
              isMessaging={
                profileAction?.profileId === completeProfile.profile.id &&
                profileAction.type === "message"
              }
              isProfileSaved={isProfileSaved}
              isRepresentationLoading={isRepresentationLoading}
              onConnect={() => handleConnectToProfile(completeProfile)}
              onFollowPress={canFollowOrSave ? handleToggleFollow : undefined}
              onMessage={() => handleMessageProfile(completeProfile)}
              onOpenDirectorLinkedTarget={handleOpenDirectorLinkedTarget}
              onOpenFavoriteClub={handleOpenFavoriteClub}
              onOpenPlayerProfile={handleOpenPlayerProfile}
              onRequestRepresentation={handleRequestRepresentation}
              onRespondRepresentation={handleRespondRepresentation}
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
  coachSocialSummary,
  headerDetails,
  isFollowed,
  isMessaging,
  isSaved,
  isShortlisted,
  onContactPress,
  onFollowersPress,
  onFollowPress,
  onMutualPress,
  onSavePress,
  onShortlistPress,
  playerHeaderDetails,
  staffHeaderDetails,
}: {
  completeProfile: CompleteProfessionalProfile;
  agentHeaderDetails: ReturnType<typeof buildAgentProfileHeaderDetails>;
  coachHeaderDetails: ReturnType<typeof buildCoachProfileHeaderDetails>;
  coachSocialSummary?: Awaited<ReturnType<typeof fetchProfileSocialSummary>>;
  headerDetails: ReturnType<typeof buildHeaderDetails> | null;
  isFollowed: boolean;
  isMessaging?: boolean;
  isSaved: boolean;
  isShortlisted?: boolean;
  onContactPress?: () => void;
  onFollowersPress?: () => void;
  onFollowPress?: () => void;
  onMutualPress?: () => void;
  onSavePress?: () => void;
  onShortlistPress?: () => void;
  playerHeaderDetails: ReturnType<typeof buildPlayerProfileHeaderDetails>;
  staffHeaderDetails: ReturnType<typeof buildStaffProfileHeaderDetails>;
}) {
  const role = completeProfile.profile.role as AppRole;

  if (role === "player" && playerHeaderDetails) {
    return (
      <PlayerProfileHeader
        ageLabel={playerHeaderDetails.ageLabel}
        availabilityBadges={playerHeaderDetails.availabilityBadges}
        avatarUrl={completeProfile.profile.avatar_url}
        bio={playerHeaderDetails.bio}
        categoryBadges={completeProfile.playerProfile?.preferred_categories ?? []}
        clubLabel={playerHeaderDetails.clubLabel}
        fullName={playerHeaderDetails.fullName}
        heightLabel={playerHeaderDetails.heightLabel}
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
        preferredFootLabel={playerHeaderDetails.preferredFootLabel}
        primaryRole={playerHeaderDetails.primaryRole}
        regionBadges={playerHeaderDetails.regionBadges}
        secondaryRole={playerHeaderDetails.secondaryRole}
        statusBadge={playerHeaderDetails.statusBadge}
        weightLabel={playerHeaderDetails.weightLabel}
      />
    );
  }

  if (role === "coach" && coachHeaderDetails) {
    return (
      <CoachProfileHeader
        assignmentLabel={coachHeaderDetails.assignmentLabel}
        availabilityBadges={coachHeaderDetails.availabilityBadges}
        avatarUrl={completeProfile.profile.avatar_url}
        bio={coachHeaderDetails.bio}
        categoryLocationLabel={coachHeaderDetails.categoryLocationLabel}
        coverImageUrl={completeProfile.profile.cover_url}
        fullName={coachHeaderDetails.fullName}
        licenseBadges={coachHeaderDetails.licenseBadges}
        licenseYearsLabel={coachHeaderDetails.licenseYearsLabel}
        mode="visitor"
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isSaved={isSaved}
        isShortlisted={isShortlisted}
        onContactPress={onContactPress}
        onFollowersPress={onFollowersPress}
        onFollowPress={onFollowPress}
        onMutualPress={onMutualPress}
        onSavePress={onSavePress}
        onShortlistPress={onShortlistPress}
        primaryRole={coachHeaderDetails.primaryRole}
        roleTypeLabel={coachHeaderDetails.roleTypeLabel}
        socialSummary={coachSocialSummary}
        statusBadge={coachHeaderDetails.statusBadge}
      />
    );
  }

  if (role === "staff" && staffHeaderDetails) {
    return (
      <StaffProfileHeader
        availabilityBadges={staffHeaderDetails.availabilityBadges}
        avatarUrl={completeProfile.profile.avatar_url}
        bio={staffHeaderDetails.bio}
        fullName={staffHeaderDetails.fullName}
        locationLabel={staffHeaderDetails.locationLabel}
        mode="visitor"
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isSaved={isSaved}
        isShortlisted={isShortlisted}
        onContactPress={onContactPress}
        onFollowPress={onFollowPress}
        onSavePress={onSavePress}
        onShortlistPress={onShortlistPress}
        primaryRole={staffHeaderDetails.primaryRole}
        statusBadge={staffHeaderDetails.statusBadge}
      />
    );
  }

  if (role === "agent" && agentHeaderDetails) {
    return (
      <AgentProfileHeader
        agencyLabel={agentHeaderDetails.agencyLabel}
        avatarUrl={completeProfile.profile.avatar_url}
        bio={agentHeaderDetails.bio}
        fullName={agentHeaderDetails.fullName}
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isSaved={isSaved}
        isShortlisted={isShortlisted}
        locationLabel={agentHeaderDetails.locationLabel}
        onContactPress={onContactPress}
        onFollowPress={onFollowPress}
        onSavePress={onSavePress}
        onShortlistPress={onShortlistPress}
        primaryRole={agentHeaderDetails.primaryRole}
        statusBadge={agentHeaderDetails.statusBadge}
      />
    );
  }

  if (role === "director") {
    return null;
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
  isConnecting = false,
  isFollowed = false,
  isMessaging = false,
  isProfileSaved = false,
  isRepresentationLoading = false,
  onConnect,
  onFollowPress,
  onMessage,
  onSavePress,
  onOpenDirectorLinkedTarget,
  onOpenFavoriteClub,
  onOpenPlayerProfile,
  onRequestRepresentation,
  onRespondRepresentation,
  playerAgent,
  playerRepresentations,
  representationState,
  viewerProfileId,
  viewerRole,
}: {
  completeProfile: CompleteProfessionalProfile;
  isConnecting?: boolean;
  isFollowed?: boolean;
  isMessaging?: boolean;
  isProfileSaved?: boolean;
  isRepresentationLoading?: boolean;
  onConnect?: () => void;
  onFollowPress?: () => void;
  onMessage?: () => void;
  onSavePress?: () => void;
  onOpenDirectorLinkedTarget?: (target: DirectorMediaLinkedTarget) => void;
  onOpenFavoriteClub?: (clubId: string) => void;
  onOpenPlayerProfile?: (profileId: string) => void;
  onRequestRepresentation?: () => void;
  onRespondRepresentation?: (accept: boolean) => void;
  playerAgent?: { agent_full_name: string | null; agent_profile_id: string } | null;
  playerRepresentations?: Awaited<ReturnType<typeof fetchPlayerRepresentations>>;
  representationState?: AgentRepresentation | null;
  viewerProfileId?: string | null;
  viewerRole?: AppRole | null;
}) {
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
              Un agente ha richiesto di rappresentarti
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
            accessibilityLabel={`Apri profilo agente ${playerAgent.agent_full_name ?? ""}`}
            accessibilityRole="button"
            onPress={() => onOpenPlayerProfile?.(playerAgent.agent_profile_id)}
            style={({ pressed }) => [
              styles.agentRow,
              pressed ? styles.agentRowPressed : null,
            ]}
          >
            <Ionicons color={colors.textSecondary} name="person-outline" size={15} />
            <AppText color="secondary" variant="bodySm">
              {"Agente: "}
              <AppText color="accent" variant="bodySm">
                {playerAgent.agent_full_name ?? "Agente"}
              </AppText>
            </AppText>
            <Ionicons color={colors.textSecondary} name="chevron-forward" size={14} />
          </Pressable>
        ) : null}

        <ProfileTabView
          completeProfile={completeProfile}
          isOwner={false}
          onAddExperience={noop}
          onDeleteExperience={noop}
          onEdit={noop}
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
        onAddExperience={noop}
        onDeleteExperience={noop}
        onEdit={noop}
        onEditExperience={noop}
        onManageMedia={noop}
      />
    );
  }

  if (role === "staff") {
    return (
      <StaffProfileTabView
        completeProfile={completeProfile}
        isOwner={false}
        onAddExperience={noop}
        onDeleteExperience={noop}
        onDeletePlayerExperience={noop}
        onEdit={noop}
        onEditExperience={noop}
        onManageMedia={noop}
      />
    );
  }

  if (role === "agent") {
    return (
      <AgentProfileTabView
        completeProfile={completeProfile}
        isOwner={false}
        onDeleteMedia={noop}
        onEdit={noop}
        onEditMedia={noop}
        onManageMedia={noop}
      />
    );
  }

  if (role === "director") {
    return (
      <DirectorProfileTabView
        completeProfile={completeProfile}
        isConnecting={isConnecting}
        isFollowed={isFollowed}
        isMessaging={isMessaging}
        isOwner={false}
        isSaved={isProfileSaved}
        onConnect={onConnect}
        onFollowPress={onFollowPress}
        onMessage={onMessage}
        onOpenLinkedTarget={onOpenDirectorLinkedTarget}
        onSavePress={onSavePress}
      />
    );
  }

  if (role === "fan") {
    return (
      <FanProfileView
        completeProfile={completeProfile}
        isMessaging={isMessaging}
        mode="visitor"
        onContactPress={onMessage}
        onOpenFavoriteClub={onOpenFavoriteClub}
        onOpenPlayerProfile={onOpenPlayerProfile}
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

function getProfileViewerTitle(role: AppRole) {
  switch (role) {
    case "agent":
      return "Profilo agente";
    case "coach":
      return "Profilo allenatore";
    case "staff":
      return "Profilo staff";
    case "club_admin":
      return "Profilo club";
    case "director":
      return "Profilo dirigente";
    case "fan":
      return "Profilo appassionato";
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
  directorScreen: {
    backgroundColor: "#F7FAFD",
  },
  directorTopBar: {
    backgroundColor: "#F7FAFD",
    borderBottomColor: "#00000014",
  },
  directorTopBarTitle: {
    color: "#061223",
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
