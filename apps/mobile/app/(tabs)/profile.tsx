import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, StyleSheet } from "react-native";

import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { useSession } from "../../src/features/auth/use-session";
import type { AppRole } from "../../src/features/onboarding/create-initial-profile";
import { EditBioModal } from "../../src/features/profiles/edit-modals/EditBioModal";
import { EditClubInfoModal } from "../../src/features/profiles/edit-modals/EditClubInfoModal";
import { EditClubSeasonsModal } from "../../src/features/profiles/edit-modals/EditClubSeasonsModal";
import { EditCoachInfoModal } from "../../src/features/profiles/edit-modals/EditCoachInfoModal";
import { EditContactModal } from "../../src/features/profiles/edit-modals/EditContactModal";
import { EditPersonalInfoModal } from "../../src/features/profiles/edit-modals/EditPersonalInfoModal";
import { EditPlayerExperiencesModal } from "../../src/features/profiles/edit-modals/EditPlayerExperiencesModal";
import { EditPlayerSportsModal } from "../../src/features/profiles/edit-modals/EditPlayerSportsModal";
import { EditStaffInfoModal } from "../../src/features/profiles/edit-modals/EditStaffInfoModal";
import {
  buildFullUpdatePayload,
  buildHeaderDetails,
  buildInitialState,
  buildPlayerProfileHeaderDetails,
} from "../../src/features/profiles/profile-edit-helpers";
import {
  ProfileReadonlyView,
  type EditSection,
} from "../../src/features/profiles/ProfileReadonlyView";
import {
  PlayerProfileHeader,
  ProfileHeader,
} from "../../src/features/profiles/profile-screen-components";
import {
  getCompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "../../src/features/profiles/profile-service";
import type { GroupedExperience } from "../../src/features/profiles/career/career-grouping";
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
            onEditProfilePress={() => handleEdit("personalInfo")}
            preferredFootLabel={playerHeaderDetails.preferredFootLabel}
            primaryRole={playerHeaderDetails.primaryRole}
            regionBadges={playerHeaderDetails.regionBadges}
            secondaryRole={playerHeaderDetails.secondaryRole}
            statusBadge={playerHeaderDetails.statusBadge}
            weightLabel={playerHeaderDetails.weightLabel}
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
            </>
          ) : null}
          {role === "coach" ? (
            <EditCoachInfoModal
              completeProfile={completeProfile}
              onClose={handleCloseModal}
              onSaved={handleSaved}
              userId={userId}
              visible={activeModal === "coachInfo"}
            />
          ) : null}
          {role === "staff" ? (
            <EditStaffInfoModal
              completeProfile={completeProfile}
              onClose={handleCloseModal}
              onSaved={handleSaved}
              userId={userId}
              visible={activeModal === "staffInfo"}
            />
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
