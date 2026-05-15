import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
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
import {
  requestConnection,
  startDirectConversation,
} from "../networking/networking-service";
import { colors, spacing } from "../../theme/tokens";
import { AppText } from "../../ui";

const noop = () => undefined;

export function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { isLoading: isSessionLoading, needsOnboarding, session } = useSession();
  const [completeProfile, setCompleteProfile] =
    useState<CompleteProfessionalProfile | null>(null);
  const [profileAction, setProfileAction] = useState<{
    profileId: string;
    type: "connect" | "message";
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const currentUserId = session?.user.id ?? null;

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

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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
      const conversationId = await startDirectConversation(targetProfile.profile.id);
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
        <View style={styles.backButtonPlaceholder} />
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
              headerDetails={headerDetails}
              playerHeaderDetails={playerHeaderDetails}
              staffHeaderDetails={staffHeaderDetails}
            />
            <ProfileContentBlock
              completeProfile={completeProfile}
              isConnecting={
                profileAction?.profileId === completeProfile.profile.id &&
                profileAction.type === "connect"
              }
              isMessaging={
                profileAction?.profileId === completeProfile.profile.id &&
                profileAction.type === "message"
              }
              onConnect={() => handleConnectToProfile(completeProfile)}
              onMessage={() => handleMessageProfile(completeProfile)}
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
    </SafeAreaView>
  );
}

function ProfileHeaderBlock({
  completeProfile,
  agentHeaderDetails,
  coachHeaderDetails,
  headerDetails,
  playerHeaderDetails,
  staffHeaderDetails,
}: {
  completeProfile: CompleteProfessionalProfile;
  agentHeaderDetails: ReturnType<typeof buildAgentProfileHeaderDetails>;
  coachHeaderDetails: ReturnType<typeof buildCoachProfileHeaderDetails>;
  headerDetails: ReturnType<typeof buildHeaderDetails> | null;
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
        availabilityBadges={coachHeaderDetails.availabilityBadges}
        avatarUrl={completeProfile.profile.avatar_url}
        bio={coachHeaderDetails.bio}
        categoryLabel={coachHeaderDetails.categoryLabel}
        fullName={coachHeaderDetails.fullName}
        licenseBadges={coachHeaderDetails.licenseBadges}
        locationLabel={coachHeaderDetails.locationLabel}
        mode="visitor"
        primaryRole={coachHeaderDetails.primaryRole}
        statusBadge={coachHeaderDetails.statusBadge}
        teamLabel={coachHeaderDetails.teamLabel}
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
        locationLabel={agentHeaderDetails.locationLabel}
        primaryRole={agentHeaderDetails.primaryRole}
        statusBadge={agentHeaderDetails.statusBadge}
      />
    );
  }

  if (role === "director") {
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
  isMessaging = false,
  onConnect,
  onMessage,
}: {
  completeProfile: CompleteProfessionalProfile;
  isConnecting?: boolean;
  isMessaging?: boolean;
  onConnect?: () => void;
  onMessage?: () => void;
}) {
  const role = completeProfile.profile.role as AppRole;

  if (role === "player") {
    return (
      <ProfileTabView
        completeProfile={completeProfile}
        isOwner={false}
        onAddExperience={noop}
        onDeleteExperience={noop}
        onEdit={noop}
        onManageMedia={noop}
      />
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
        isMessaging={isMessaging}
        isOwner={false}
        onConnect={onConnect}
        onMessage={onMessage}
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
    case "player":
      return "Profilo giocatore";
    default:
      return "Profilo";
  }
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  backButtonPlaceholder: {
    width: 32,
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
