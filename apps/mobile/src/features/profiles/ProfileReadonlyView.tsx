import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AvailabilityRegionsSelector } from "../../components/ui/availability-regions-selector";
import { InterestCategoriesSelector } from "../../components/ui/interest-categories-selector";
import {
  MediaPreview,
  MediaGalleryPreview,
} from "../../components/ui/media-preview";
import { colors, radius } from "../../theme/tokens";
import { SectionCard } from "../../ui";
import { PublicBioBlock } from "./bio-section";
import {
  ClubSeasonsSection,
  recordToForm,
} from "./club-season-section";
import { ContactSection } from "./contact-section";
import {
  PlayerCharacteristicsSection,
  PlayerExperiencesSection,
} from "./player-sports-section";
import {
  DEFAULT_PLAYER_PRIMARY_POSITION,
  sortPlayerExperiencesBySeason,
  toPlayerExperienceForm,
} from "./player-sports";
import {
  formatBirthDateInputValue,
  formatOptionalSummary,
  getOptionLabel,
  LANGUAGE_OPTIONS,
  NATIONALITY_OPTIONS,
  REGION_OPTIONS,
} from "./profile-form-utils";
import { buildSummarySections } from "./profile-edit-helpers";
import { ProfileField as Field } from "./profile-screen-components";
import { searchTeams, type CompleteProfessionalProfile } from "./profile-service";
import type { AppRole } from "../onboarding/create-initial-profile";

type EditSection =
  | "editPlayerProfile"
  | "personalInfo"
  | "bio"
  | "contact"
  | "playerMedia"
  | "playerSports"
  | "playerExperiences"
  | "playerSituation"
  | "playerPalmares"
  | "coachInfo"
  | "coachExperiences"
  | "staffInfo"
  | "clubInfo"
  | "clubSeasons";

type ProfileReadonlyViewProps = {
  completeProfile: CompleteProfessionalProfile;
  onEdit: (section: EditSection) => void;
  role: AppRole;
};

export type { EditSection };

export function ProfileReadonlyView({
  completeProfile,
  onEdit,
  role,
}: ProfileReadonlyViewProps) {
  const summarySections = useMemo(
    () => buildSummarySections(completeProfile),
    [completeProfile],
  );

  const playerExperienceCards = useMemo(
    () =>
      sortPlayerExperiencesBySeason(
        (completeProfile.playerCareerEntries ?? []).map((entry) =>
          toPlayerExperienceForm(entry),
        ),
      ),
    [completeProfile.playerCareerEntries],
  );

  const clubSeasonForms = useMemo(
    () => completeProfile.clubSeasonEntries.map(recordToForm),
    [completeProfile.clubSeasonEntries],
  );

  return (
    <>
      {/* Personal Info (non club_admin) */}
      {role !== "club_admin" ? (
        <SectionCard
          onEdit={() => onEdit("personalInfo")}
          title="Informazioni personali"
          variant="flat"
        >
          <Field
            label="Nome e cognome"
            value={completeProfile.profile.full_name}
            variant="plain"
          />
          <Field
            label="Data di nascita"
            value={formatBirthDateInputValue(completeProfile.profile.birth_date)}
            variant="plain"
          />
          <Field
            label="Nazionalità"
            value={
              completeProfile.profile.nationality
                ? getOptionLabel(
                    NATIONALITY_OPTIONS,
                    completeProfile.profile.nationality,
                  )
                : ""
            }
            variant="plain"
          />
          <Field
            label="Città"
            value={formatOptionalSummary(completeProfile.profile.city)}
            variant="plain"
          />
          <Field
            label="Regione"
            value={
              completeProfile.profile.region
                ? getOptionLabel(REGION_OPTIONS, completeProfile.profile.region)
                : ""
            }
            variant="plain"
          />
          {completeProfile.profile.languages.length > 0 ? (
            <Field
              label="Lingue parlate"
              value={completeProfile.profile.languages
                .map((code) => getOptionLabel(LANGUAGE_OPTIONS, code))
                .join(", ")}
              variant="plain"
            />
          ) : null}
        </SectionCard>
      ) : null}

      {/* Club Seasons (club_admin) */}
      {role === "club_admin" ? (
        <SectionCard
          description="Storico delle categorie in cui il club ha militato."
          onEdit={() => onEdit("clubSeasons")}
          title="Storico stagioni"
          variant="flat"
        >
          <ClubSeasonsSection seasons={clubSeasonForms} />
        </SectionCard>
      ) : null}

      {/* Player Experiences */}
      {role === "player" ? (
        <SectionCard
          description="Squadra, categoria, stagione e numeri chiave del percorso calcistico."
          onEdit={() => onEdit("playerExperiences")}
          title="Esperienze calcistiche"
          variant="flat"
        >
          <PlayerExperiencesSection
            emptyStateLabel="Nessuna esperienza calcistica salvata."
            experiences={playerExperienceCards}
            searchTeams={searchTeams}
            showHeader={false}
          />
        </SectionCard>
      ) : null}

      {/* Bio / Presentation */}
      <SectionCard
        description="Disponibilità e descrizione pubblica del profilo"
        onEdit={() => onEdit("bio")}
        title="Presentazione"
        variant="flat"
      >
        <PublicBioBlock bio={completeProfile.profile.bio} variant="plain" />
      </SectionCard>

      {/* Role-specific summary sections */}
      {summarySections.map((section) => {
        const editTarget = getEditTarget(role);

        return (
          <SectionCard
            description={section.subtitle}
            key={section.title}
            onEdit={editTarget ? () => onEdit(editTarget) : undefined}
            title={section.title}
            variant="flat"
          >
            {section.items.map((item) =>
              item.label === "Categorie preferite" ? (
                <Field
                  key={item.label}
                  label={item.label}
                  renderInput={() => (
                    <InterestCategoriesSelector
                      editable={false}
                      hideLabel
                      onChange={() => {}}
                      value={
                        completeProfile.playerProfile?.preferred_categories ?? []
                      }
                    />
                  )}
                  value={item.value}
                  variant="plain"
                />
              ) : item.label === "Regioni di interesse" ? (
                <Field
                  key={item.label}
                  label={item.label}
                  renderInput={() => (
                    <AvailabilityRegionsSelector
                      editable={false}
                      hideLabel
                      onChange={() => {}}
                      value={
                        completeProfile.playerProfile?.transfer_regions ?? []
                      }
                    />
                  )}
                  value={item.value}
                  variant="plain"
                />
              ) : (
                <Field
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  variant="plain"
                />
              ),
            )}
          </SectionCard>
        );
      })}

      {/* Player Characteristics */}
      {role === "player" ? (
        <SectionCard
          description="Ruolo e piede preferito leggibili rapidamente anche in consultazione."
          onEdit={() => onEdit("playerSports")}
          title="Profilo sportivo"
          variant="flat"
        >
          <PlayerCharacteristicsSection
            preferredFoot={
              completeProfile.playerProfile?.preferred_foot ?? ""
            }
            primaryPosition={
              completeProfile.playerProfile?.primary_position ??
              DEFAULT_PLAYER_PRIMARY_POSITION
            }
            secondaryPositions={
              completeProfile.playerProfile?.secondary_positions ?? []
            }
          />
        </SectionCard>
      ) : null}

      {/* Media sections */}
      {role === "player" ? (
        <SectionCard
          onEdit={() => onEdit("playerSports")}
          title="Media"
          variant="flat"
        >
          <MediaPreview
            emptyLabel="Nessun video highlights caricato"
            label="Video highlights"
            mediaType="video"
            url={completeProfile.playerProfile?.highlight_video_url}
          />
        </SectionCard>
      ) : null}

      {role === "coach" ? (
        <SectionCard
          onEdit={() => onEdit("coachInfo")}
          title="Media"
          variant="flat"
        >
          <MediaPreview
            emptyLabel="Nessun video tecnico caricato"
            label="Video tecnico"
            mediaType="video"
            url={completeProfile.coachProfile?.technical_video_url}
          />
        </SectionCard>
      ) : null}

      {role === "club_admin" ? (
        <SectionCard
          onEdit={() => onEdit("clubInfo")}
          title="Media"
          variant="flat"
        >
          <MediaPreview
            emptyLabel="Nessun logo caricato"
            label="Logo società"
            url={completeProfile.club?.logo_url}
          />
          <MediaGalleryPreview
            label="Gallery media"
            urls={completeProfile.club?.gallery_urls ?? []}
          />
        </SectionCard>
      ) : null}

      {/* Contacts — ContactSection already wraps in ProfileSectionCard, render standalone */}
      <ContactSectionWithEdit
        completeProfile={completeProfile}
        onEdit={() => onEdit("contact")}
      />
    </>
  );
}

/**
 * ContactSection already wraps in ProfileSectionCard.
 * We overlay an edit pencil in the top-right corner.
 */
function ContactSectionWithEdit({
  completeProfile,
  onEdit,
}: {
  completeProfile: CompleteProfessionalProfile;
  onEdit: () => void;
}) {
  return (
    <View>
      <ContactSection contacts={completeProfile.userContacts} variant="flat" />
      <Pressable
        accessibilityLabel="Modifica contatti"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onEdit}
        style={readonlyStyles.editButton}
      >
        <Ionicons color={colors.textSecondary} name="pencil" size={16} />
      </Pressable>
    </View>
  );
}

const readonlyStyles = StyleSheet.create({
  editButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    right: 18,
    top: 18,
    width: 32,
  },
});

function getEditTarget(role: AppRole): EditSection | null {
  switch (role) {
    case "player":
      return "playerSports";
    case "coach":
      return "coachInfo";
    case "staff":
      return "staffInfo";
    case "club_admin":
      return "clubInfo";
    default:
      return null;
  }
}
