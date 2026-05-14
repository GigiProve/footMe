import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  SafeAreaView,
  StyleSheet,
  type AlertButton,
} from "react-native";
import { useRouter } from "expo-router";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { useSession } from "../../src/features/auth/use-session";
import {
  fetchPublicClubHeaderStats,
  fetchPublicClubRoster,
  fetchPublicClubSquadraOverview,
  type ClubHeaderStats,
  type PublicClubMember,
  type PublicClubProfile,
  type PublicClubSquadraOverview,
} from "../../src/features/clubs/club-service";
import {
  PublicClubProfileView,
} from "../../src/features/clubs/components/PublicClubProfileView";
import type { ClubHeaderTab } from "../../src/features/clubs/components/PublicClubHeader";
import {
  fetchClubTeamProfiles,
  fetchClubTeams,
  type ClubTeam,
  type ClubTeamProfileDetails,
} from "../../src/features/clubs/team-service";
import type { AppRole } from "../../src/features/onboarding/create-initial-profile";
import { EditBioModal } from "../../src/features/profiles/edit-modals/EditBioModal";
import { EditAgentProfileModal } from "../../src/features/profiles/edit-modals/EditAgentProfileModal";
import { EditAgentMediaModal } from "../../src/features/profiles/edit-modals/EditAgentMediaModal";
import { EditClubInfoModal } from "../../src/features/profiles/edit-modals/EditClubInfoModal";
import { EditClubSeasonsModal } from "../../src/features/profiles/edit-modals/EditClubSeasonsModal";
import { EditClubSportProfileModal } from "../../src/features/profiles/edit-modals/EditClubSportProfileModal";
import { EditClubAffiliationsModal } from "../../src/features/profiles/edit-modals/EditClubAffiliationsModal";
import { EditTeamsModal } from "../../src/features/profiles/edit-modals/EditTeamsModal";
import { EditCoachAchievementsModal } from "../../src/features/profiles/edit-modals/EditCoachAchievementsModal";
import { EditCoachInfoModal } from "../../src/features/profiles/edit-modals/EditCoachInfoModal";
import { EditCoachProfileModal } from "../../src/features/profiles/edit-modals/EditCoachProfileModal";
import { EditCoachMediaModal } from "../../src/features/profiles/edit-modals/EditCoachMediaModal";
import { EditCoachExperiencesModal } from "../../src/features/profiles/edit-modals/EditCoachExperiencesModal";
import { EditContactModal } from "../../src/features/profiles/edit-modals/EditContactModal";
import { EditPersonalInfoModal } from "../../src/features/profiles/edit-modals/EditPersonalInfoModal";
import { EditPlayerExperiencesModal } from "../../src/features/profiles/edit-modals/EditPlayerExperiencesModal";
import { EditPlayerMediaModal } from "../../src/features/profiles/edit-modals/EditPlayerMediaModal";
import { EditPlayerPalmaresModal } from "../../src/features/profiles/edit-modals/EditPlayerPalmaresModal";
import { EditPlayerProfileModal } from "../../src/features/profiles/edit-modals/EditPlayerProfileModal";
import { EditPlayerSituationModal } from "../../src/features/profiles/edit-modals/EditPlayerSituationModal";
import { EditPlayerSportsModal } from "../../src/features/profiles/edit-modals/EditPlayerSportsModal";
import { EditStaffExperiencesModal } from "../../src/features/profiles/edit-modals/EditStaffExperiencesModal";
import { EditStaffInfoModal } from "../../src/features/profiles/edit-modals/EditStaffInfoModal";
import { EditStaffMediaModal } from "../../src/features/profiles/edit-modals/EditStaffMediaModal";
import { StaffProfileTabView } from "../../src/features/profiles/career/StaffProfileTabView";
import { AgentProfileTabView } from "../../src/features/profiles/career/AgentProfileTabView";
import type { StaffGroupedExperience } from "../../src/features/profiles/career/staff-career-grouping";
import {
  buildFullUpdatePayload,
  buildAgentProfileHeaderDetails,
  buildHeaderDetails,
  buildInitialState,
  buildCoachProfileHeaderDetails,
  buildPlayerProfileHeaderDetails,
  buildStaffProfileHeaderDetails,
} from "../../src/features/profiles/profile-edit-helpers";
import { validateBirthDateInput } from "../../src/features/profiles/profile-form-utils";
import {
  ProfileReadonlyView,
  type EditSection,
} from "../../src/features/profiles/ProfileReadonlyView";
import {
  CoachProfileHeader,
  PlayerProfileHeader,
  ProfileHeader,
  StaffProfileHeader,
} from "../../src/features/profiles/profile-screen-components";
import { AgentProfileHeader } from "../../src/features/profiles/AgentProfileHeader";
import {
  getCompleteProfessionalProfile,
  saveAgentProfileMedia,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "../../src/features/profiles/profile-service";
import { removeMediaFromStorage } from "../../src/features/profiles/media-upload-service";
import type { GroupedExperience } from "../../src/features/profiles/career/career-grouping";
import type { CoachGroupedExperience } from "../../src/features/profiles/career/coach-career-grouping";
import { CoachProfileTabView } from "../../src/features/profiles/career/CoachProfileTabView";
import { ProfileTabView } from "../../src/features/profiles/career/ProfileTabView";
import { colors } from "../../src/theme/tokens";
import { AppText } from "../../src/ui";

const emptyClubHeaderStats: ClubHeaderStats = {
  activeTeamsCount: 0,
  playersCount: 0,
  staffCount: 0,
};

const emptyClubOverview: PublicClubSquadraOverview = {
  affiliations: [],
  parentAffiliation: null,
  positionPreview: [],
  positionsTotal: 0,
  seasonSummaries: [],
};

export default function ProfileScreen() {
  const { profile, refreshProfile, session } = useSession();
  const router = useRouter();
  const userId = session?.user.id ?? null;
  const [completeProfile, setCompleteProfile] =
    useState<CompleteProfessionalProfile | null>(null);
  const [clubTeams, setClubTeams] = useState<ClubTeam[]>([]);
  const [clubTeamProfiles, setClubTeamProfiles] = useState<
    Record<string, ClubTeamProfileDetails>
  >({});
  const [clubHeaderStats, setClubHeaderStats] =
    useState<ClubHeaderStats>(emptyClubHeaderStats);
  const [clubOverview, setClubOverview] =
    useState<PublicClubSquadraOverview>(emptyClubOverview);
  const [clubMembers, setClubMembers] = useState<PublicClubMember[]>([]);
  const [activeClubTab, setActiveClubTab] = useState<ClubHeaderTab>("team");
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<EditSection | null>(null);
  const [agentMediaEditingItemId, setAgentMediaEditingItemId] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setCompleteProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await getCompleteProfessionalProfile(userId);
      setCompleteProfile(data);

      if (data.club?.id) {
        const [teams, stats, overview, members] = await Promise.all([
          fetchClubTeams(data.club.id),
          fetchPublicClubHeaderStats(data.club.id).catch(
            () => emptyClubHeaderStats,
          ),
          fetchPublicClubSquadraOverview(data.club.id).catch(
            () => emptyClubOverview,
          ),
          fetchPublicClubRoster(data.club.id).catch(() => []),
        ]);
        const teamProfiles = await fetchClubTeamProfiles(
          teams.map((team) => team.id),
        ).catch(() => ({}));

        setClubTeams(teams);
        setClubTeamProfiles(teamProfiles);
        setClubHeaderStats(stats);
        setClubOverview(overview);
        setClubMembers(members);
      } else {
        setClubTeams([]);
        setClubTeamProfiles({});
        setClubHeaderStats(emptyClubHeaderStats);
        setClubOverview(emptyClubOverview);
        setClubMembers([]);
      }
    } catch (error) {
      setClubTeams([]);
      setClubTeamProfiles({});
      setClubHeaderStats(emptyClubHeaderStats);
      setClubOverview(emptyClubOverview);
      setClubMembers([]);
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il caricamento del profilo.";
      Alert.alert("Profilo non disponibile", message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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

  if (!userId || !profile) {
    return null;
  }

  const role = profile.role as AppRole;

  function handleEdit(section: EditSection) {
    setActiveModal(section);
  }

  function handleCloseModal() {
    setActiveModal(null);
    setAgentMediaEditingItemId(null);
  }

  async function handleSaved() {
    setActiveModal(null);
    setAgentMediaEditingItemId(null);
    await Promise.all([loadProfile(), refreshProfile()]);
    Alert.alert(
      "Profilo aggiornato",
      "Le informazioni professionali sono state salvate.",
    );
  }

  function handleClubContactPress() {
    if (!completeProfile?.club) {
      return;
    }

    const club = completeProfile.club;
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

  function handleManageAgentMedia(itemId: string | null = null) {
    setAgentMediaEditingItemId(itemId);
    setActiveModal("agentMedia");
  }

  function handleOpenClubPositions() {
    if (!completeProfile?.club) {
      return;
    }

    router.push(`/club/${completeProfile.club.id}/positions` as never);
  }

  function handleOpenClubTeam(teamId: string) {
    router.push(`/club/team/${teamId}` as never);
  }

  function handleOpenAffiliateClub(clubId: string) {
    router.push(`/club/${clubId}` as never);
  }

  function handleOpenProfile(profileId: string) {
    router.push(`/profile/${profileId}` as never);
  }

  async function handleDeleteExperience(group: GroupedExperience) {
    if (!completeProfile) return;

    Alert.alert(
      "Elimina esperienza",
      `Eliminare tutte le stagioni con ${group.clubName}?`,
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            try {
              const baseState = buildInitialState(completeProfile);
              const filteredEntries = baseState.careerEntries.filter((e) => {
                if (group.clubId && e.clubId) return e.clubId !== group.clubId;
                return e.clubName !== group.clubName;
              });
              const mergedState = { ...baseState, careerEntries: filteredEntries };
              const payload = buildFullUpdatePayload(completeProfile, mergedState);
              await updateCompleteProfessionalProfile(payload);
              await loadProfile();
              Alert.alert("Esperienza eliminata", "Le stagioni sono state rimosse.");
            } catch {
              Alert.alert("Errore", "Impossibile eliminare l'esperienza.");
            }
          },
          style: "destructive",
          text: "Elimina",
        },
      ],
    );
  }

  async function handleDeleteStaffExperience(
    group: StaffGroupedExperience,
    section: "technical" | "coach",
  ) {
    if (!completeProfile) return;

    Alert.alert(
      "Elimina esperienza",
      `Eliminare l'esperienza con ${group.teamName}?`,
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            try {
              const baseState = buildInitialState(completeProfile);
              const payload = buildFullUpdatePayload(completeProfile, baseState);
              if (section === "technical") {
                payload.staffCareerEntries =
                  completeProfile.staffCareerEntries.filter(
                    (e) => e.id !== group.entryId,
                  );
              } else {
                payload.staffCoachCareerEntries =
                  completeProfile.staffCoachCareerEntries.filter(
                    (e) => e.id !== group.entryId,
                  );
              }
              await updateCompleteProfessionalProfile(payload);
              await loadProfile();
              Alert.alert("Esperienza eliminata", "La voce è stata rimossa.");
            } catch {
              Alert.alert("Errore", "Impossibile eliminare l'esperienza.");
            }
          },
          style: "destructive",
          text: "Elimina",
        },
      ],
    );
  }

  async function handleDeleteCoachExperience(group: CoachGroupedExperience) {
    if (!completeProfile) return;

    Alert.alert(
      "Elimina esperienza",
      `Eliminare l'esperienza con ${group.teamName}?`,
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            try {
              const baseState = buildInitialState(completeProfile);
              const payload = buildFullUpdatePayload(completeProfile, baseState);
              payload.profile.birth_date =
                validateBirthDateInput(baseState.birthDate).isoValue;
              payload.coachCareerEntries = completeProfile.coachCareerEntries.filter(
                (entry) => entry.id !== group.entryId,
              );
              await updateCompleteProfessionalProfile(payload);
              await loadProfile();
              Alert.alert("Esperienza eliminata", "La voce e' stata rimossa.");
            } catch {
              Alert.alert("Errore", "Impossibile eliminare l'esperienza.");
            }
          },
          style: "destructive",
          text: "Elimina",
        },
      ],
    );
  }

  function handleDeleteAgentMedia(itemId: string) {
    if (!completeProfile?.agentProfile) {
      return;
    }

    if (!userId) {
      return;
    }

    const itemToDelete =
      completeProfile.agentProfile.media_items.find((item) => item.id === itemId) ?? null;

    if (!itemToDelete) {
      return;
    }

    Alert.alert(
      "Elimina contenuto",
      "Rimuovere questo contenuto dal portfolio media?",
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            try {
              const nextItems = completeProfile.agentProfile?.media_items.filter(
                (item) => item.id !== itemId,
              ) ?? [];

              await saveAgentProfileMedia({
                agentProfile: completeProfile.agentProfile!,
                mediaItems: nextItems,
                profileId: userId,
              });

              await Promise.allSettled([removeMediaFromStorage(itemToDelete.url)]);
              await loadProfile();
              Alert.alert("Contenuto eliminato", "Il portfolio media è stato aggiornato.");
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Impossibile eliminare il contenuto.";
              Alert.alert("Errore", message);
            }
          },
          style: "destructive",
          text: "Elimina",
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAwareForm
        contentContainerStyle={styles.scrollContent}
      >
        {completeProfile && role === "club_admin" && completeProfile.club ? (
          <PublicClubProfileView
            activeTab={activeClubTab}
            club={toPublicClubProfile(completeProfile.club)}
            isFollowed={false}
            isFollowing={false}
            isOwner
            members={clubMembers}
            onContactPress={handleClubContactPress}
            onEditAffiliations={() => handleEdit("clubAffiliations")}
            onEditSeasons={() => handleEdit("clubSeasons")}
            onEditSportProfile={() => handleEdit("clubSportProfile")}
            onEditTeams={() => handleEdit("clubTeams")}
            onOpenAffiliate={handleOpenAffiliateClub}
            onOpenPositions={handleOpenClubPositions}
            onOpenProfile={handleOpenProfile}
            onOpenTeam={handleOpenClubTeam}
            onTabChange={setActiveClubTab}
            onToggleFollow={() => handleEdit("clubInfo")}
            overview={clubOverview}
            stats={clubHeaderStats}
            teamProfiles={clubTeamProfiles}
            teams={clubTeams}
            viewerProfileId={userId}
          />
        ) : completeProfile && role === "player" && playerHeaderDetails ? (
          <PlayerProfileHeader
            ageLabel={playerHeaderDetails.ageLabel}
            availabilityBadges={playerHeaderDetails.availabilityBadges}
            avatarUrl={completeProfile.profile.avatar_url}
            bio={playerHeaderDetails.bio}
            categoryBadges={
              completeProfile.playerProfile?.preferred_categories ?? []
            }
            clubLabel={playerHeaderDetails.clubLabel}
            fullName={playerHeaderDetails.fullName}
            heightLabel={playerHeaderDetails.heightLabel}
            locationLabel={playerHeaderDetails.locationLabel}
            mode="owner"
            onAddContentPress={() => handleEdit("playerSports")}
            onEditProfilePress={() => handleEdit("editPlayerProfile")}
            preferredFootLabel={playerHeaderDetails.preferredFootLabel}
            primaryRole={playerHeaderDetails.primaryRole}
            regionBadges={playerHeaderDetails.regionBadges}
            secondaryRole={playerHeaderDetails.secondaryRole}
            statusBadge={playerHeaderDetails.statusBadge}
            weightLabel={playerHeaderDetails.weightLabel}
          />
        ) : completeProfile && role === "coach" && coachHeaderDetails ? (
          <CoachProfileHeader
            availabilityBadges={coachHeaderDetails.availabilityBadges}
            avatarUrl={completeProfile.profile.avatar_url}
            bio={coachHeaderDetails.bio}
            categoryLabel={coachHeaderDetails.categoryLabel}
            fullName={coachHeaderDetails.fullName}
            licenseBadges={coachHeaderDetails.licenseBadges}
            locationLabel={coachHeaderDetails.locationLabel}
            mode="owner"
            onEditProfilePress={() => handleEdit("editCoachProfile")}
            primaryRole={coachHeaderDetails.primaryRole}
            statusBadge={coachHeaderDetails.statusBadge}
            teamLabel={coachHeaderDetails.teamLabel}
          />
        ) : completeProfile && role === "staff" && staffHeaderDetails ? (
          <StaffProfileHeader
            availabilityBadges={staffHeaderDetails.availabilityBadges}
            avatarUrl={completeProfile.profile.avatar_url}
            bio={staffHeaderDetails.bio}
            fullName={staffHeaderDetails.fullName}
            locationLabel={staffHeaderDetails.locationLabel}
            mode="owner"
            onEditProfilePress={() => handleEdit("staffInfo")}
            primaryRole={staffHeaderDetails.primaryRole}
            statusBadge={staffHeaderDetails.statusBadge}
          />
        ) : completeProfile && role === "agent" && agentHeaderDetails ? (
          <AgentProfileHeader
            agencyLabel={agentHeaderDetails.agencyLabel}
            avatarUrl={completeProfile.profile.avatar_url}
            bio={agentHeaderDetails.bio}
            fullName={agentHeaderDetails.fullName}
            locationLabel={agentHeaderDetails.locationLabel}
            onEditAvatarPress={() => handleEdit("bio")}
            onEditProfilePress={() => handleEdit("agentProfile")}
            primaryRole={agentHeaderDetails.primaryRole}
            statusBadge={agentHeaderDetails.statusBadge}
          />
        ) : completeProfile && headerDetails ? (
          <ProfileHeader
            avatarUrl={completeProfile.profile.avatar_url}
            badges={headerDetails.badges}
            clubLogoUrl={completeProfile.club?.logo_url}
            clubMode={role === "club_admin"}
            fullName={headerDetails.fullName}
            onEditPress={() => handleEdit("bio")}
            primaryMeta={headerDetails.primaryMeta}
            secondaryMeta={headerDetails.secondaryMeta}
          />
        ) : null}

        {isLoading ? (
          <AppText variant="bodySm" color="secondary">
            Sto recuperando i dati professionali del tuo account...
          </AppText>
        ) : completeProfile && role === "player" ? (
          <ProfileTabView
            completeProfile={completeProfile}
            isOwner={true}
            onAddExperience={() => handleEdit("playerExperiences")}
            onDeleteExperience={handleDeleteExperience}
            onEdit={handleEdit}
            onManageMedia={() => handleEdit("playerMedia")}
          />
        ) : completeProfile && role === "coach" ? (
          <CoachProfileTabView
            completeProfile={completeProfile}
            isOwner={true}
            onAddExperience={() => handleEdit("coachExperiences")}
            onDeleteExperience={handleDeleteCoachExperience}
            onEdit={handleEdit}
            onEditExperience={() => handleEdit("coachExperiences")}
            onManageMedia={() => handleEdit("coachMedia")}
          />
        ) : completeProfile && role === "staff" ? (
          <StaffProfileTabView
            completeProfile={completeProfile}
            isOwner={true}
            onAddExperience={() => handleEdit("staffExperiences")}
            onDeleteExperience={handleDeleteStaffExperience}
            onDeletePlayerExperience={handleDeleteExperience}
            onEdit={handleEdit}
            onEditExperience={() => handleEdit("staffExperiences")}
            onManageMedia={() => handleEdit("staffMedia")}
          />
        ) : completeProfile && role === "agent" ? (
          <AgentProfileTabView
            completeProfile={completeProfile}
            isOwner={true}
            onDeleteMedia={handleDeleteAgentMedia}
            onEdit={handleEdit}
            onEditMedia={(itemId) => handleManageAgentMedia(itemId)}
            onManageMedia={() => handleManageAgentMedia()}
          />
        ) : completeProfile && role === "club_admin" ? null : completeProfile ? (
          <ProfileReadonlyView
            completeProfile={completeProfile}
            onEdit={handleEdit}
            role={role}
          />
        ) : null}
      </KeyboardAwareForm>

      {/* Per-section edit modals */}
      {completeProfile && userId ? (
        <>
          <EditPersonalInfoModal
            completeProfile={completeProfile}
            onClose={handleCloseModal}
            onSaved={handleSaved}
            userId={userId}
            visible={activeModal === "personalInfo"}
          />
          <EditBioModal
            completeProfile={completeProfile}
            onClose={handleCloseModal}
            onSaved={handleSaved}
            userId={userId}
            visible={activeModal === "bio"}
          />
          <EditContactModal
            completeProfile={completeProfile}
            onClose={handleCloseModal}
            onSaved={handleSaved}
            userId={userId}
            visible={activeModal === "contact"}
          />
          {role === "player" ? (
            <>
              <EditPlayerSportsModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "playerSports"}
              />
              <EditPlayerExperiencesModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                visible={activeModal === "playerExperiences"}
              />
              <EditPlayerMediaModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "playerMedia"}
              />
              <EditPlayerSituationModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "playerSituation"}
              />
              <EditPlayerPalmaresModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "playerPalmares"}
              />
              <EditPlayerProfileModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "editPlayerProfile"}
              />
            </>
          ) : null}
          {role === "coach" ? (
            <>
              <EditCoachProfileModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "editCoachProfile"}
              />
              <EditCoachInfoModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "coachInfo"}
              />
              <EditCoachMediaModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "coachMedia"}
              />
              <EditCoachExperiencesModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                visible={activeModal === "coachExperiences"}
              />
              <EditCoachAchievementsModal
                achievements={completeProfile.coachProfile?.achievements ?? []}
                coachProfileId={completeProfile.coachProfile?.profile_id ?? ""}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                visible={activeModal === "coachAchievements"}
              />
            </>
          ) : null}
          {role === "staff" ? (
            <>
              <EditStaffInfoModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "staffInfo"}
              />
              <EditStaffExperiencesModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                visible={activeModal === "staffExperiences"}
              />
              <EditStaffMediaModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "staffMedia"}
              />
            </>
          ) : null}
          {role === "agent" ? (
            <>
              <EditAgentMediaModal
                completeProfile={completeProfile}
                editingItemId={agentMediaEditingItemId}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "agentMedia"}
              />
              <EditAgentProfileModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "agentProfile"}
              />
            </>
          ) : null}
          {role === "club_admin" ? (
            <>
              <EditClubInfoModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "clubInfo"}
              />
              <EditClubSeasonsModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "clubSeasons"}
              />
              <EditClubSportProfileModal
                completeProfile={completeProfile}
                onClose={handleCloseModal}
                onSaved={handleSaved}
                userId={userId}
                visible={activeModal === "clubSportProfile"}
              />
              {completeProfile.club ? (
                <>
                  <EditTeamsModal
                    clubId={completeProfile.club.id}
                    clubName={completeProfile.club.name}
                    onClose={handleCloseModal}
                    onSaved={handleSaved}
                    teams={clubTeams}
                    visible={activeModal === "clubTeams"}
                  />
                  <EditClubAffiliationsModal
                    clubId={completeProfile.club.id}
                    initialAffiliations={clubOverview.affiliations}
                    onClose={handleCloseModal}
                    onSaved={handleSaved}
                    visible={activeModal === "clubAffiliations"}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </SafeAreaView>
  );
}

function toPublicClubProfile(
  club: NonNullable<CompleteProfessionalProfile["club"]>,
): PublicClubProfile {
  return {
    category: club.category,
    city: club.city,
    club_colors: club.club_colors,
    club_email: club.club_email,
    club_phone: club.club_phone,
    country: club.country,
    description: club.description,
    field_address: club.field_address,
    founding_year: club.founding_year,
    gallery_urls: club.gallery_urls,
    headquarters_address: club.headquarters_address,
    id: club.id,
    key_results: club.key_results,
    league: club.league,
    logo_url: club.logo_url,
    name: club.name,
    owner_full_name: null,
    region: club.region,
    sports_focus: club.sports_focus,
    stadium: club.stadium,
    top_level_reached: club.top_level_reached,
    verification_status: club.verification_status,
    website_url: club.website_url,
  };
}

function normalizeExternalUrl(url: string) {
  const trimmedUrl = url.trim();

  if (/^https?:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    backgroundColor: colors.background,
    paddingBottom: 0,
  },
});
