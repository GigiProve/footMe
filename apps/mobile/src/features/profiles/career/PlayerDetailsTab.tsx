/**
 * Tab Dettagli del Master Profile Calciatore (REV-PROF-01 §25–§31).
 *
 * Cinque macroaree: Opportunità, Profilo tecnico, Situazione attuale, Palmarès
 * e Contatti pubblici. Una macroarea senza dati non viene mostrata, a nessuno
 * dei due viewer: il profilo non è una checklist di completamento e la
 * compilazione resta dentro Modifica profilo.
 */
import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import {
  buildPublicContacts,
  PublicContactsList,
  type PublicContact,
} from "../master/PublicContactsList";
import {
  ProfileDetailRow,
  ProfileSectionBlock,
} from "../master/ProfileSectionBlock";
import {
  getPlayerPositionLabel,
  getPreferredFootLabel,
  type PlayerPosition,
} from "../player-sports";
import { getOptionLabel, REGION_OPTIONS } from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { PlayerCareerView } from "./player-career-model";
import { PlayerTechnicalPitch } from "./PlayerTechnicalPitch";

type PlayerDetailsTabProps = {
  careerView: PlayerCareerView;
  completeProfile: CompleteProfessionalProfile;
  onContactPress?: (contact: PublicContact) => void;
};

/** "Sotto contratto" / "Svincolato" vengono dal dato, non dall'esperienza. */
function formatContractStatus(status: string | null | undefined): string | null {
  if (status === "tesserato") return "Sotto contratto";
  if (status === "svincolato") return "Svincolato";
  return null;
}

/**
 * Zone disponibili (§26). Con la modalità "tutta Italia" si mostra soltanto
 * "Ovunque in Italia": elencare anche regioni o province sarebbe una
 * contraddizione.
 */
function buildZonesLabel(
  availabilityType: string,
  regions: readonly string[],
  provinces: readonly string[],
): string | null {
  if (availabilityType === "ITALY" || availabilityType === "ALL_ITALY") {
    return "Ovunque in Italia";
  }

  if (availabilityType === "REGIONS") {
    const labels = regions.map((code) => getOptionLabel(REGION_OPTIONS, code));

    return labels.length > 0 ? labels.join(", ") : null;
  }

  if (availabilityType === "PROVINCES") {
    return provinces.length > 0 ? provinces.join(", ") : null;
  }

  return null;
}

export function PlayerDetailsTab({
  careerView,
  completeProfile,
  onContactPress,
}: PlayerDetailsTabProps) {
  const { playerPalmares, playerProfile, profile, userContacts } = completeProfile;

  const isOpenToTransfer =
    profile.is_open_to_transfer || playerProfile?.willing_to_change_club;
  const zonesLabel = isOpenToTransfer
    ? buildZonesLabel(
        playerProfile?.availability_type ?? "ITALY",
        playerProfile?.transfer_regions ?? [],
        playerProfile?.transfer_provinces ?? [],
      )
    : null;
  const preferredCategories = playerProfile?.preferred_categories ?? [];
  const hasOpportunities =
    Boolean(isOpenToTransfer) ||
    Boolean(zonesLabel) ||
    preferredCategories.length > 0 ||
    Boolean(playerProfile?.open_to_trials);

  const primaryPosition: PlayerPosition | null =
    playerProfile?.primary_position ?? null;
  const secondaryPosition: PlayerPosition | null =
    playerProfile?.secondary_positions?.find(
      (position) => position !== primaryPosition,
    ) ?? null;
  const preferredFootLabel = playerProfile?.preferred_foot
    ? getPreferredFootLabel(playerProfile.preferred_foot)
    : null;
  const hasTechnicalProfile =
    Boolean(primaryPosition) || Boolean(preferredFootLabel);

  // Situazione attuale: l'esperienza che copre la stagione in corso, non
  // l'ultima riga salvata (§28). Se non ce n'è una, la sezione tace.
  const currentExperience = careerView.experiences.find(
    (experience) => experience.isCurrent,
  );
  const currentCategory = currentExperience?.seasons[0]?.category ?? "";
  const contractStatus = formatContractStatus(playerProfile?.contract_status);
  const hasCurrentSituation = Boolean(currentExperience) || Boolean(contractStatus);

  const publicContacts = buildPublicContacts(userContacts);

  return (
    <View testID="player-details-tab">
      {hasOpportunities ? (
        <ProfileSectionBlock testID="details-opportunities" title="Opportunità">
          {isOpenToTransfer ? (
            <ProfileDetailRow icon="swap-horizontal-outline" label="Disponibile al trasferimento" />
          ) : null}
          {zonesLabel ? (
            <ProfileDetailRow
              icon="map-outline"
              label="Zone disponibili"
              value={zonesLabel}
            />
          ) : null}
          {preferredCategories.length > 0 ? (
            <ProfileDetailRow
              icon="trending-up-outline"
              label="Categorie d'interesse"
              value={preferredCategories.join(", ")}
            />
          ) : null}
          {playerProfile?.open_to_trials ? (
            <ProfileDetailRow icon="flag-outline" label="Disponibile per provini" />
          ) : null}
        </ProfileSectionBlock>
      ) : null}

      {hasTechnicalProfile ? (
        <ProfileSectionBlock testID="details-technical" title="Profilo tecnico">
          <View style={styles.technicalRow}>
            <PlayerTechnicalPitch
              primaryPosition={primaryPosition}
              secondaryPosition={secondaryPosition}
            />
            <View style={styles.technicalFacts}>
              {primaryPosition ? (
                <TechnicalFact
                  label="Ruolo principale"
                  value={getPlayerPositionLabel(primaryPosition)}
                />
              ) : null}
              {/* Ruolo secondario assente: la voce sparisce, senza lasciare
                  uno spazio vuoto al suo posto (§27). */}
              {secondaryPosition ? (
                <TechnicalFact
                  label="Ruolo secondario"
                  value={getPlayerPositionLabel(secondaryPosition)}
                />
              ) : null}
              {/* Altezza e peso non si ripetono: stanno già nelle
                  informazioni rapide (§27). */}
              {preferredFootLabel ? (
                <TechnicalFact label="Piede" value={preferredFootLabel} />
              ) : null}
            </View>
          </View>
        </ProfileSectionBlock>
      ) : null}

      {hasCurrentSituation ? (
        <ProfileSectionBlock testID="details-situation" title="Situazione attuale">
          <View
            accessible
            accessibilityLabel={[
              currentExperience?.clubName,
              currentCategory,
              contractStatus,
            ]
              .filter(Boolean)
              .join(", ")}
            style={styles.situationRow}
          >
            {currentExperience ? (
              <ClubLogo logoUrl={currentExperience.logoUrl} />
            ) : null}
            <View style={styles.situationText}>
              {currentExperience ? (
                <AppText numberOfLines={2} variant="titleSm">
                  {currentExperience.clubName}
                </AppText>
              ) : null}
              {currentCategory ? (
                <AppText color="secondary" variant="meta">
                  {currentCategory}
                </AppText>
              ) : null}
              {contractStatus ? (
                <AppText color="secondary" variant="meta">
                  {contractStatus}
                </AppText>
              ) : null}
            </View>
          </View>
        </ProfileSectionBlock>
      ) : null}

      {playerPalmares.length > 0 ? (
        <ProfileSectionBlock testID="details-palmares" title="Palmarès">
          {playerPalmares.map((item) => (
            <View
              accessible
              accessibilityLabel={[item.competition_name, item.season_label]
                .filter(Boolean)
                .join(" ")}
              key={item.id}
              style={styles.palmaresRow}
            >
              <Ionicons color={colors.accent} name="trophy-outline" size={16} />
              <AppText style={styles.palmaresText} variant="bodyLg">
                {[item.competition_name, item.season_label]
                  .filter(Boolean)
                  .join(" ")}
              </AppText>
            </View>
          ))}
        </ProfileSectionBlock>
      ) : null}

      {publicContacts.length > 0 ? (
        <ProfileSectionBlock testID="details-contacts" title="Contatti pubblici">
          <PublicContactsList
            contacts={publicContacts}
            onContactPress={onContactPress}
          />
        </ProfileSectionBlock>
      ) : null}
    </View>
  );
}

function TechnicalFact({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={styles.fact}>
      <AppText color="muted" variant="caption">
        {label}
      </AppText>
      <AppText variant="titleSm">{value}</AppText>
    </View>
  );
}

function ClubLogo({ logoUrl }: { logoUrl: string }) {
  if (logoUrl) {
    return (
      <View style={styles.clubLogo}>
        <Image source={{ uri: logoUrl }} style={styles.clubLogoImage} />
      </View>
    );
  }

  return (
    <View style={[styles.clubLogo, styles.clubLogoFallback]}>
      <Ionicons color={colors.accent} name="shield-outline" size={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  clubLogo: {
    borderRadius: radius.full,
    flexShrink: 0,
    height: 36,
    overflow: "hidden",
    width: 36,
  },
  clubLogoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
  },
  clubLogoImage: {
    height: "100%",
    width: "100%",
  },
  fact: {
    gap: spacing[4],
  },
  palmaresRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    minHeight: 32,
  },
  palmaresText: {
    flex: 1,
    minWidth: 0,
  },
  situationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[4],
  },
  situationText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  technicalFacts: {
    flex: 1,
    gap: spacing[14],
    minWidth: 0,
  },
  technicalRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    paddingVertical: spacing[4],
  },
});
