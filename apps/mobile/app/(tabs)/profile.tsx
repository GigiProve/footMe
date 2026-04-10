import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, StyleSheet } from "react-native";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { useSession } from "../../src/features/auth/use-session";
import type { AppRole } from "../../src/features/onboarding/create-initial-profile";
import { EditBioModal } from "../../src/features/profiles/edit-modals/EditBioModal";
import { EditClubInfoModal } from "../../src/features/profiles/edit-modals/EditClubInfoModal";
import { EditClubSeasonsModal } from "../../src/features/profiles/edit-modals/EditClubSeasonsModal";
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
import type { StaffGroupedExperience } from "../../src/features/profiles/career/staff-career-grouping";
import {
  buildFullUpdatePayload,
  buildHeaderDetails,
  buildInitialState,
  buildCoachProfileHeaderDetails,
  buildPlayerProfileHeaderDetails,
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
} from "../../src/features/profiles/profile-screen-components";
import {
  getCompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "../../src/features/profiles/profile-service";
import type { GroupedExperience } from "../../src/features/profiles/career/career-grouping";
import type { CoachGroupedExperience } from "../../src/features/profiles/career/coach-career-grouping";
import { CoachProfileTabView } from "../../src/features/profiles/career/CoachProfileTabView";
import { ProfileTabView } from "../../src/features/profiles/career/ProfileTabView";
import { colors } from "../../src/theme/tokens";
import { AppText } from "../../src/ui";

export default function ProfileScreen() {
  const { profile, refreshProfile, session } = useSession();
  const userId = session?.user.id ?? null;
  const [completeProfile, setCompleteProfile] =
    useState<CompleteProfessionalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<EditSection | null>(null);

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
    } catch (error) {
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

  if (!userId || !profile) {
    return null;
  }

  const role = profile.role as AppRole;

  function handleEdit(section: EditSection) {
    setActiveModal(section);
  }

  function handleCloseModal() {
    setActiveModal(null);
  }

  async function handleSaved() {
    setActiveModal(null);
    await Promise.all([loadProfile(), refreshProfile()]);
    Alert.alert(
      "Profilo aggiornato",
      "Le informazioni professionali sono state salvate.",
    );
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

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAwareForm
        contentContainerStyle={styles.scrollContent}
      >
        {completeProfile && role === "player" && playerHeaderDetails ? (
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
        ) : completeProfile ? (
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
            </>
          ) : null}
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    backgroundColor: colors.surface,
    paddingBottom: 0,
  },
});
