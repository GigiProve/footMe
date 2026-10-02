/**
 * Tab Dettagli del Master Profile Procuratore (REV-PROF-13, Screen 4).
 *
 * Sostituisce la vecchia tab Info e accoglie quello che stava in Opportunità.
 * Sette macroaree nell'ordine della task: Opportunità, Profilo professionale,
 * Attività principali, Situazione attuale, Bio professionale, Esperienze
 * precedenti e Contatti pubblici.
 *
 * Valgono le regole dei Master Profile già approvati: una macroarea senza dati
 * non compare a nessuno dei due viewer, niente è duplicato, nessun toggle è
 * modificabile da qui — il Master Profile è una vista di consultazione.
 * Agenzia e ruolo non hanno una copia propria: arrivano dall'incarico in corso
 * della carriera, lo stesso che riempie l'header.
 */
import { View } from "react-native";

import { AppText, Button } from "../../../ui";
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
  AGENT_PROFESSIONAL_MODE_OPTIONS,
  buildAgentLicenseLabel,
} from "../../onboarding/agent/agent-taxonomy";
import {
  buildAvailabilityZonesLabel,
  buildOperatingAreaLabel,
  summarizeList,
} from "../profile-display-helpers";
import type { CompleteProfessionalProfile } from "../profile-service";
import {
  formatAgentOrganizationLabel,
  type AgentCareerPath,
  type AgentProfileCareer,
} from "./agent-career-model";

/**
 * Icone delle attività principali: una sola famiglia lineare e neutra, mai un
 * colore per attività. Un'attività fuori catalogo resta una riga con l'icona
 * generica, invece di sparire.
 */
const ACTIVITY_ICONS: Record<
  string,
  React.ComponentProps<typeof ProfileIconChips>["chips"][number]["icon"]
> = {
  "Gestione svincolati": "swap-horizontal-outline",
  "Inserimento in prima squadra": "trophy-outline",
  "Mercato dilettanti": "football-outline",
  "Mercato internazionale": "globe-outline",
  "Ricerca opportunità in categorie superiori": "trending-up-outline",
  "Valorizzazione giovani": "person-outline",
};

type AgentDetailsTabProps = {
  career: AgentProfileCareer;
  completeProfile: CompleteProfessionalProfile;
  isOwner?: boolean;
  onContactPress?: (contact: PublicContact) => void;
  /** Apre il modulo canonico di modifica. Assente al Visitor. */
  onEditProfile?: () => void;
  /** Porta alla tab Carriera sul percorso scelto, nello stesso profilo. */
  onOpenCareerPath?: (path: AgentCareerPath) => void;
};

export function AgentDetailsTab({
  career,
  completeProfile,
  isOwner = false,
  onContactPress,
  onEditProfile,
  onOpenCareerPath,
}: AgentDetailsTabProps) {
  const { agentProfile, profile, userContacts } = completeProfile;

  // ---- Opportunità -------------------------------------------------------
  const isOpenToPlayers = agentProfile?.open_to_players ?? false;
  const isOpenToClubs = agentProfile?.open_to_clubs ?? false;
  /*
    L'area operativa è un dato dichiarato dall'onboarding (REV-ONB-06 §AA).
    Finché un profilo non l'ha scelta resta la derivazione storica da regione e
    località: cambiare schermata non deve far sparire una riga che c'era.
  */
  const operatingAreaLabel =
    (agentProfile?.operating_area_type
      ? buildAvailabilityZonesLabel(
          agentProfile.operating_area_type,
          agentProfile.operating_regions ?? [],
          agentProfile.operating_provinces ?? [],
        )
      : null) ??
    buildOperatingAreaLabel(
      profile.region,
      profile.city ?? profile.residence ?? profile.current_location_city,
    );
  const hasOpportunities = isOpenToPlayers || isOpenToClubs || Boolean(operatingAreaLabel);

  // ---- Profilo professionale ---------------------------------------------
  const { currentExperience } = career;
  const professionalModeLabel =
    AGENT_PROFESSIONAL_MODE_OPTIONS.find(
      (option) => option.value === agentProfile?.professional_mode,
    )?.label ?? null;
  const licenseLabel = buildAgentLicenseLabel({
    federation: agentProfile?.federation,
    isLicensed: agentProfile?.is_federation_licensed,
  });

  /*
    Agenzia e ruolo derivano dall'incarico in corso: nessuna copia
    indipendente, nessun campo che possa raccontare un'agenzia diversa da
    quella mostrata in Carriera. Senza incarico attuale le due righe spariscono
    invece di mostrare un dato vecchio.
  */
  const professionalFacts = [
    {
      key: "mode",
      label: "Modalità",
      value: professionalModeLabel,
    },
    {
      key: "agency",
      label: "Agenzia",
      value: currentExperience
        ? formatAgentOrganizationLabel(currentExperience)
        : null,
    },
    { key: "role", label: "Ruolo", value: currentExperience?.role ?? null },
    { key: "license", label: "Licenza", value: licenseLabel },
    { key: "markets", label: "Mercati", value: summarizeList(career.marketLabels) },
    {
      key: "languages",
      label: "Lingue",
      value: summarizeList(profile.languages ?? []),
    },
  ].filter((fact): fact is { key: string; label: string; value: string } =>
    Boolean(fact.value),
  );

  // ---- Attività principali -----------------------------------------------
  const activityChips = (agentProfile?.operational_focuses ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .map((activity) => ({
      icon: ACTIVITY_ICONS[activity] ?? ("ellipse-outline" as const),
      key: activity,
      label: activity,
    }));

  // ---- Bio professionale -------------------------------------------------
  const bio = profile.bio?.trim() ?? "";

  // ---- Esperienze precedenti ---------------------------------------------
  /*
    Non una seconda lista: un contatore che riporta alla Carriera, dove le
    esperienze vivono già. Le carriere di altri ruoli restano separate per
    tipo, mai mescolate in un'unica timeline.
  */
  const previousCount = career.previousExperiences.length;
  const additionalPaths = [
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
    <View testID="agent-details-tab">
      {hasOpportunities ? (
        <ProfileSectionBlock
          testID="agent-details-opportunities"
          title="Opportunità"
        >
          {/* Lo stato non è affidato al colore: icona più testo. */}
          {isOpenToPlayers ? (
            <ProfileDetailRow
              icon="person-add-outline"
              label="Aperto a richieste di rappresentanza"
            />
          ) : null}
          {isOpenToClubs ? (
            <ProfileDetailRow
              icon="briefcase-outline"
              label="Disponibile a collaborare con club"
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
          testID="agent-details-professional"
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

      {activityChips.length > 0 ? (
        <ProfileSectionBlock
          testID="agent-details-activities"
          title="Attività principali"
        >
          <ProfileIconChips chips={activityChips} testID="agent-activity-chips" />
        </ProfileSectionBlock>
      ) : null}

      {currentExperience ? (
        <ProfileSectionBlock
          testID="agent-details-situation"
          title="Situazione attuale"
        >
          {/*
            Stessa esperienza dell'header: il tap riporta in Carriera, non a
            una schermata parallela.
          */}
          <ProfileDetailRow
            icon="business-outline"
            label={formatAgentOrganizationLabel(currentExperience)}
            onPress={onOpenCareerPath ? () => onOpenCareerPath("agent") : undefined}
            value={[currentExperience.role, currentExperience.periodLabel]
              .filter(Boolean)
              .join(" · ")}
          />
        </ProfileSectionBlock>
      ) : null}

      {bio ? (
        <ProfileSectionBlock testID="agent-details-bio" title="Bio professionale">
          <AppText color="primary" variant="bodySm">
            {bio}
          </AppText>
        </ProfileSectionBlock>
      ) : isOwner && onEditProfile ? (
        /* Invito discreto, non un empty state: al Visitor la sezione non esiste. */
        <ProfileSectionBlock testID="agent-details-bio" title="Bio professionale">
          <AppText color="secondary" variant="bodySm">
            Racconta il tuo percorso professionale in poche righe.
          </AppText>
          <Button
            label="Aggiungi bio"
            onPress={onEditProfile}
            size="sm"
            testID="agent-details-add-bio"
            variant="secondary"
          />
        </ProfileSectionBlock>
      ) : null}

      {previousCount > 0 || additionalPaths.length > 0 ? (
        <ProfileSectionBlock
          testID="agent-details-previous"
          title="Esperienze precedenti"
        >
          {previousCount > 0 ? (
            <ProfileFactRow
              isLast={additionalPaths.length === 0}
              label="Da procuratore"
              onPress={
                onOpenCareerPath ? () => onOpenCareerPath("agent") : undefined
              }
              testID="agent-details-previous-agent"
              value={
                previousCount === 1 ? "1 esperienza" : `${previousCount} esperienze`
              }
            />
          ) : null}
          {additionalPaths.map((path, index) => (
            <ProfileFactRow
              isLast={index === additionalPaths.length - 1}
              key={path.key}
              label={path.label}
              onPress={
                onOpenCareerPath ? () => onOpenCareerPath(path.key) : undefined
              }
              testID={`agent-details-path-${path.key}`}
              value={path.count === 1 ? "1 esperienza" : `${path.count} esperienze`}
            />
          ))}
        </ProfileSectionBlock>
      ) : null}

      {publicContacts.length > 0 || showsPrivateContactsHint ? (
        <ProfileSectionBlock
          testID="agent-details-contacts"
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
