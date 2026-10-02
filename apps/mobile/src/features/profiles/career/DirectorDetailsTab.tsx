/**
 * Tab Dettagli del Master Profile Dirigente (REV-PROF-09, Screen 4).
 *
 * Sostituisce la vecchia tab Info. Sette macroaree nell'ordine del mockup:
 * Opportunità, Profilo professionale, Aree di responsabilità, Situazione
 * attuale, Bio professionale, Percorsi aggiuntivi e Contatti pubblici.
 *
 * Valgono le regole dei Master Profile già approvati: una macroarea senza dati
 * non compare a nessuno dei due viewer e niente viene duplicato. Le attività
 * non tornano nelle card a due colonne del vecchio profilo e le categorie non
 * tornano come lungo elenco di chip: sono entrambe righe o pill compatte.
 */
import { View } from "react-native";

import {
  DIRECTOR_CONTACT_AUDIENCE_OPTIONS,
  getDirectorResponsibilityIcon,
  type DirectorContactAudience,
} from "../../onboarding/director/director-taxonomy";
import { AppText, Button } from "../../../ui";
import { ProfileCurrentClubRow } from "../master/ProfileCurrentClubRow";
import { ProfileIconChips } from "../master/ProfileIconChips";
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
import {
  buildAvailabilityZonesLabel,
  buildOperatingAreaLabel,
  summarizeList,
} from "../profile-display-helpers";
import type { CompleteProfessionalProfile } from "../profile-service";
import {
  collectSecondaryDirectorRoles,
  resolveDirectorPrimaryRole,
  type DirectorCareerPath,
  type DirectorProfileCareer,
} from "./director-career-model";
import { formatExperienceCount } from "./staff-career-model";

/**
 * "Entrambi" è il valore salvato, non un'etichetta da mostrare: il mockup
 * scrive per esteso di cosa si occupa il profilo.
 */
function formatMainFocus(value: string | null | undefined): string | null {
  const focus = value?.trim();

  if (!focus) {
    return null;
  }

  return focus === "Entrambi" ? "Prima squadra e settore giovanile" : focus;
}

type DirectorDetailsTabProps = {
  career: DirectorProfileCareer;
  completeProfile: CompleteProfessionalProfile;
  isOwner?: boolean;
  onContactPress?: (contact: PublicContact) => void;
  /** Apre il modulo canonico di modifica. Assente al Visitor. */
  onEditProfile?: () => void;
  /**
   * Apre "Percorsi aggiuntivi" nella gestione carriera (REV-PROF-10). Solo
   * Owner: al Visitor non arriva nessun handler di modifica.
   */
  onManageAdditionalPaths?: () => void;
  /** Porta alla tab Carriera sul percorso scelto, nello stesso profilo. */
  onOpenCareerPath?: (path: DirectorCareerPath) => void;
  /** Assente quando la società non ha una pagina PROLINK: niente chevron. */
  onOpenClub?: (clubId: string) => void;
};

export function DirectorDetailsTab({
  career,
  completeProfile,
  isOwner = false,
  onContactPress,
  onEditProfile,
  onManageAdditionalPaths,
  onOpenCareerPath,
  onOpenClub,
}: DirectorDetailsTabProps) {
  const { directorProfile, profile, userContacts } = completeProfile;

  // ---- Opportunità -------------------------------------------------------
  /*
    Due condizioni (REV-PROF-11): l'interruttore di disponibilità e almeno un
    destinatario. Spegnere l'interruttore conserva i destinatari — si
    ritrovano riaccendendolo — quindi la macroarea si misura su entrambi,
    invece di diventare uno stato negativo che il prodotto non prevede.
  */
  const isAvailable = directorProfile?.open_to_work ?? false;
  const audiences =
    directorProfile && isAvailable
      ? DIRECTOR_CONTACT_AUDIENCE_OPTIONS.filter(
          (option) => directorProfile[CONTACT_AUDIENCE_FIELDS[option.value]],
        )
      : [];
  const audiencesLabel = summarizeList(audiences.map((option) => option.label));
  /*
    L'area operativa è ora un dato dichiarato (REV-PROF-11). Finché un profilo
    non l'ha mai scelta resta la derivazione storica da regione e località:
    cambiare schermata non deve far sparire una riga che c'era.
  */
  const operatingAreaLabel =
    (directorProfile?.availability_type
      ? buildAvailabilityZonesLabel(
          directorProfile.availability_type,
          directorProfile.preferred_regions ?? [],
          directorProfile.preferred_provinces ?? [],
        )
      : null) ??
    buildOperatingAreaLabel(
      profile.region,
      profile.city ?? profile.residence ?? profile.current_location_city,
    );

  // ---- Profilo professionale ---------------------------------------------
  const primaryRole = resolveDirectorPrimaryRole(directorProfile);
  const otherRoles = summarizeList(
    collectSecondaryDirectorRoles(directorProfile),
  );
  /*
    Le categorie si deducono dalla carriera: il campo manuale
    `experience_categories` non viene più raccolto dall'onboarding (REV-ONB-07
    §K) e tenerne un secondo elenco significherebbe mostrarne uno diverso da
    quello delle esperienze. Resta letto solo se la carriera non ne ha ancora.
  */
  const categoriesLabel =
    summarizeList(career.categories) ??
    summarizeList(directorProfile?.experience_categories ?? []);

  const professionalFacts = [
    { key: "primaryRole", label: "Ruolo principale", value: primaryRole },
    { key: "otherRoles", label: "Altri ruoli", value: otherRoles },
    {
      key: "focus",
      label: "Focus",
      value: formatMainFocus(directorProfile?.main_focus),
    },
    {
      key: "categories",
      label: "Categorie di esperienza",
      value: categoriesLabel,
    },
    {
      key: "languages",
      label: "Lingue",
      value: summarizeList(profile.languages ?? []),
    },
  ].filter((fact): fact is { key: string; label: string; value: string } =>
    Boolean(fact.value),
  );

  // ---- Aree di responsabilità --------------------------------------------
  const responsibilities = (directorProfile?.responsibilities ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  const responsibilityChips = responsibilities.map((responsibility) => ({
    icon: getDirectorResponsibilityIcon(responsibility),
    key: responsibility,
    label: responsibility,
  }));

  // ---- Situazione attuale ------------------------------------------------
  const { currentExperience } = career;
  const currentClubId = currentExperience?.clubId ?? null;
  const canOpenClub = Boolean(currentClubId && onOpenClub);

  // ---- Bio professionale -------------------------------------------------
  const bio = profile.bio?.trim() ?? "";

  // ---- Percorsi aggiuntivi -----------------------------------------------
  const additionalPaths = [
    { count: career.coachExperienceCount, key: "coach" as const, label: "Allenatore" },
    {
      count: career.staffExperienceCount,
      key: "staff" as const,
      label: "Staff tecnico",
    },
    {
      count: career.playerExperienceCount,
      key: "player" as const,
      label: "Calciatore",
    },
    { count: career.otherExperienceCount, key: "other" as const, label: "Altri ruoli" },
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
    <View testID="director-details-tab">
      {audiences.length > 0 ? (
        <ProfileSectionBlock
          testID="director-details-opportunities"
          title="Opportunità"
        >
          {/* Lo stato non è affidato al colore: icona più testo (§accessibilità). */}
          <ProfileDetailRow
            icon="radio-button-on-outline"
            label="Disponibile per nuove opportunità"
          />
          {audiencesLabel ? (
            <ProfileDetailRow
              icon="people-outline"
              label="Disponibile per"
              value={audiencesLabel}
            />
          ) : null}
          {operatingAreaLabel ? (
            <ProfileDetailRow
              icon="location-outline"
              label="Area operativa"
              value={operatingAreaLabel}
            />
          ) : null}
        </ProfileSectionBlock>
      ) : null}

      {professionalFacts.length > 0 ? (
        <ProfileSectionBlock
          testID="director-details-professional"
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

      {responsibilityChips.length > 0 ? (
        <ProfileSectionBlock
          testID="director-details-responsibilities"
          title="Aree di responsabilità"
        >
          <ProfileIconChips
            chips={responsibilityChips}
            testID="director-responsibility-chips"
          />
        </ProfileSectionBlock>
      ) : null}

      {currentExperience ? (
        <ProfileSectionBlock
          testID="director-details-situation"
          title="Situazione attuale"
        >
          <ProfileCurrentClubRow
            category={currentExperience.category}
            clubName={currentExperience.clubName}
            logoUrl={currentExperience.logoUrl}
            onPress={
              canOpenClub ? () => onOpenClub?.(currentClubId as string) : undefined
            }
            role={currentExperience.role}
            testID="director-details-current-club"
          />
        </ProfileSectionBlock>
      ) : null}

      {bio ? (
        <ProfileSectionBlock testID="director-details-bio" title="Bio professionale">
          <AppText color="primary" variant="bodySm">
            {bio}
          </AppText>
        </ProfileSectionBlock>
      ) : isOwner && onEditProfile ? (
        /* Invito discreto, non un empty state: al Visitor la sezione non esiste. */
        <ProfileSectionBlock testID="director-details-bio" title="Bio professionale">
          <AppText color="secondary" variant="bodySm">
            Racconta il tuo percorso dirigenziale in poche righe.
          </AppText>
          <Button
            label="Aggiungi bio"
            onPress={onEditProfile}
            size="sm"
            testID="director-details-add-bio"
            variant="secondary"
          />
        </ProfileSectionBlock>
      ) : null}

      {additionalPaths.length > 0 ? (
        <ProfileSectionBlock
          testID="director-details-additional-paths"
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
              testID={`director-details-path-${path.key}`}
              value={formatExperienceCount(path.count)}
            />
          ))}
          {isOwner && onManageAdditionalPaths ? (
            <Button
              label="Gestisci percorsi aggiuntivi"
              onPress={onManageAdditionalPaths}
              size="sm"
              testID="director-details-manage-paths"
              variant="secondary"
            />
          ) : null}
        </ProfileSectionBlock>
      ) : null}

      {publicContacts.length > 0 || showsPrivateContactsHint ? (
        <ProfileSectionBlock
          testID="director-details-contacts"
          title="Contatti pubblici"
        >
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

/** Colonna di `director_profiles` che porta ciascuna preferenza di contatto. */
const CONTACT_AUDIENCE_FIELDS: Record<
  DirectorContactAudience,
  "open_to_clubs" | "open_to_others" | "open_to_players" | "open_to_staff"
> = {
  clubs: "open_to_clubs",
  others: "open_to_others",
  players: "open_to_players",
  staff: "open_to_staff",
};
