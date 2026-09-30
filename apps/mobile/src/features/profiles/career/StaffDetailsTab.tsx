/**
 * Tab Dettagli del Master Profile Staff tecnico (REV-PROF-06, Screen 4).
 *
 * Cinque macroaree nell'ordine del mockup: Opportunità, Profilo professionale,
 * Situazione attuale, Percorsi aggiuntivi e Contatti pubblici.
 *
 * Valgono le regole dei Master Profile già approvati: una macroarea senza dati
 * non compare a nessuno dei due viewer, e niente viene duplicato. Qui non
 * entrano patentino, modulo preferito, filosofia di gioco, palmarès né
 * statistiche da calciatore: sono informazioni dell'Allenatore o del
 * Calciatore, non dello Staff tecnico.
 */
import { View } from "react-native";

import { ProfileCurrentClubRow } from "../master/ProfileCurrentClubRow";
import {
  buildPublicContacts,
  hasPrivateContacts,
  PublicContactsList,
  type PublicContact,
} from "../master/PublicContactsList";
import {
  ProfileDetailRow,
  ProfileFactRow,
  ProfileSectionBlock,
} from "../master/ProfileSectionBlock";
import { AppText } from "../../../ui";
import {
  buildAvailabilityZonesLabel,
  formatCoachAvailableFrom,
  summarizeList,
} from "../profile-display-helpers";
import type { CompleteProfessionalProfile } from "../profile-service";
import {
  collectSecondaryStaffRoles,
  formatExperienceCount,
  type StaffCareerPath,
  type StaffProfileCareer,
} from "./staff-career-model";

type StaffDetailsTabProps = {
  career: StaffProfileCareer;
  completeProfile: CompleteProfessionalProfile;
  isOwner?: boolean;
  onContactPress?: (contact: PublicContact) => void;
  /** Porta alla tab Carriera sul percorso scelto, nello stesso profilo. */
  onOpenCareerPath?: (path: StaffCareerPath) => void;
  /** Assente quando la società non ha una pagina PROLINK: niente chevron. */
  onOpenClub?: (clubId: string) => void;
};

export function StaffDetailsTab({
  career,
  completeProfile,
  isOwner = false,
  onContactPress,
  onOpenCareerPath,
  onOpenClub,
}: StaffDetailsTabProps) {
  const { staffProfile, userContacts } = completeProfile;

  // ---- Opportunità -------------------------------------------------------
  // La disponibilità spenta non è uno stato da disegnare: l'intera sezione
  // sparisce, invece di mostrare "Non disponibile" o zone ormai obsolete.
  const isOpenToWork = Boolean(staffProfile?.open_to_work);
  const zonesLabel = isOpenToWork
    ? buildAvailabilityZonesLabel(
        staffProfile?.availability_type ?? "",
        staffProfile?.preferred_regions ?? [],
        staffProfile?.preferred_provinces ?? [],
      )
    : null;
  const availableFromLabel = isOpenToWork
    ? formatCoachAvailableFrom(staffProfile?.available_from, true)
    : null;

  // ---- Profilo professionale ---------------------------------------------
  const primaryRole = staffProfile?.primary_staff_role?.trim() ?? "";
  const otherRoles = summarizeList(
    collectSecondaryStaffRoles(primaryRole, staffProfile?.staff_roles),
  );
  // Le categorie sono dedotte dalla carriera: non esiste un campo manuale che
  // possa raccontarne di diverse.
  const categoriesLabel = summarizeList(career.categories);

  const professionalFacts = [
    { key: "primaryRole", label: "Ruolo principale", value: primaryRole || null },
    { key: "otherRoles", label: "Altri ruoli", value: otherRoles },
    {
      key: "categories",
      label: "Categorie di esperienza",
      value: categoriesLabel,
    },
  ].filter((fact): fact is { key: string; label: string; value: string } =>
    Boolean(fact.value),
  );

  // ---- Situazione attuale ------------------------------------------------
  const { currentExperience } = career;
  const currentClubId = currentExperience?.clubId ?? null;
  const canOpenClub = Boolean(currentClubId && onOpenClub);

  // ---- Percorsi aggiuntivi -----------------------------------------------
  const additionalPaths = [
    {
      count: career.coachExperienceCount,
      key: "coach" as const,
      label: "Allenatore",
    },
    {
      count: career.playerExperienceCount,
      key: "player" as const,
      label: "Calciatore",
    },
  ].filter((path) => path.count > 0);

  // ---- Contatti pubblici -------------------------------------------------
  const publicContacts = buildPublicContacts(userContacts);
  /*
    Al Visitor non arriva niente di un contatto non pubblico. All'Owner, che i
    propri contatti li ha inseriti, va detto perché non compaiono: nessun
    valore viene renderizzato, solo il fatto che esistono.
  */
  const showsPrivateContactsHint = isOwner && hasPrivateContacts(userContacts);

  return (
    <View testID="staff-details-tab">
      {isOpenToWork ? (
        <ProfileSectionBlock testID="staff-details-opportunities" title="Opportunità">
          {/* Lo stato non è affidato al colore: icona più testo (§accessibilità). */}
          <ProfileDetailRow
            icon="radio-button-on-outline"
            label="Disponibile per nuove collaborazioni"
          />
          {zonesLabel ? (
            <ProfileDetailRow
              icon="map-outline"
              label="Zone disponibili"
              value={zonesLabel}
            />
          ) : null}
          {availableFromLabel ? (
            <ProfileDetailRow
              icon="time-outline"
              label="Disponibile da"
              value={availableFromLabel}
            />
          ) : null}
        </ProfileSectionBlock>
      ) : null}

      {professionalFacts.length > 0 ? (
        <ProfileSectionBlock
          testID="staff-details-professional"
          title="Profilo professionale"
        >
          {professionalFacts.map((fact, index) => (
            <ProfileFactRow
              isLast={index === professionalFacts.length - 1}
              key={fact.key}
              label={fact.label}
              value={fact.value}
            />
          ))}
        </ProfileSectionBlock>
      ) : null}

      {currentExperience ? (
        <ProfileSectionBlock testID="staff-details-situation" title="Situazione attuale">
          <ProfileCurrentClubRow
            category={currentExperience.category}
            clubName={currentExperience.clubName}
            logoUrl={currentExperience.logoUrl}
            onPress={
              canOpenClub ? () => onOpenClub?.(currentClubId as string) : undefined
            }
            role={currentExperience.role}
            testID="staff-details-current-club"
          />
        </ProfileSectionBlock>
      ) : null}

      {additionalPaths.length > 0 ? (
        <ProfileSectionBlock
          testID="staff-details-additional-paths"
          title="Percorsi aggiuntivi"
        >
          {additionalPaths.map((path, index) => (
            <ProfileFactRow
              isLast={index === additionalPaths.length - 1}
              key={path.key}
              label={path.label}
              onPress={
                onOpenCareerPath ? () => onOpenCareerPath(path.key) : undefined
              }
              testID={`staff-details-path-${path.key}`}
              value={formatExperienceCount(path.count)}
            />
          ))}
        </ProfileSectionBlock>
      ) : null}

      {publicContacts.length > 0 || showsPrivateContactsHint ? (
        <ProfileSectionBlock testID="staff-details-contacts" title="Contatti pubblici">
          <PublicContactsList
            contacts={publicContacts}
            onContactPress={onContactPress}
          />
          {showsPrivateContactsHint ? (
            <AppText color="secondary" variant="bodySm">
              I tuoi contatti sono privati. Rendili visibili da Modifica profilo.
            </AppText>
          ) : null}
        </ProfileSectionBlock>
      ) : null}
    </View>
  );
}
