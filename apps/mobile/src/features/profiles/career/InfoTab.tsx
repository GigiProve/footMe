import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, SectionCard } from "../../../ui";
import { ContactSection } from "../contact-section";
import { DEFAULT_PLAYER_PRIMARY_POSITION } from "../player-sports";
import { getOptionLabel, REGION_OPTIONS } from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import { InfoRow } from "../components/InfoRow";
import { InfoTagsRow } from "../components/InfoTagsRow";
import { PalmaresItem } from "../components/PalmaresItem";
import { ReadonlyPositionPitch } from "../components/ReadonlyPositionPitch";

type InfoTabProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: (section: EditSection) => void;
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatContractStatus(status: string | null): string {
  if (status === "tesserato") return "Tesserato";
  if (status === "svincolato") return "Svincolato";
  return "Non specificato";
}

function formatCurrentCondition(condition: string | null): string {
  if (condition === "in_attivita") return "In attività";
  if (condition === "infortunato") return "Infortunato";
  if (condition === "riabilitazione") return "In riabilitazione";
  return "Non specificato";
}

function formatContractExpiry(expiry: string | null): string {
  if (!expiry) return "N/D";
  const months = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  const parts = expiry.split("-");
  if (parts.length !== 3) return expiry;
  const [y, m, d] = parts;
  const monthIndex = parseInt(m, 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return expiry;
  return `${d} ${months[monthIndex]} ${y}`;
}

function formatPreferredFoot(foot: string | null | undefined): string {
  if (foot === "right") return "Destro";
  if (foot === "left") return "Sinistro";
  if (foot === "both") return "Entrambi";
  return "N/D";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InfoTab({ completeProfile, isOwner, onEdit }: InfoTabProps) {
  const { playerProfile, profile, playerPalmares, playerCareerEntries, userContacts } = completeProfile;

  const primaryPosition = playerProfile?.primary_position ?? DEFAULT_PLAYER_PRIMARY_POSITION;
  const secondaryPositions = playerProfile?.secondary_positions ?? [];
  const transferRegions = playerProfile?.transfer_regions ?? [];
  const transferProvinces = playerProfile?.transfer_provinces ?? [];
  const preferredCategories = playerProfile?.preferred_categories ?? [];
  const playerObjectives = playerProfile?.player_objectives ?? [];
  const availabilityType = playerProfile?.availability_type ?? "ITALY";

  // Map region codes to display labels
  const regionLabels = transferRegions.map((code) =>
    getOptionLabel(REGION_OPTIONS, code),
  );

  // For "PROVINCES" availability, show provinces as tags (no highlight)
  const zoneLabels =
    availabilityType === "REGIONS"
      ? regionLabels
      : availabilityType === "PROVINCES"
        ? transferProvinces
        : [];

  // Current club from latest career entry
  const latestEntry = playerCareerEntries[0];
  const currentClub = latestEntry?.club_name ?? "--";

  const edit = (section: EditSection) => isOwner ? () => onEdit(section) : undefined;

  return (
    <View style={styles.container}>
      {/* 1. Disponibilità */}
      <SectionCard
        title="Disponibilità"
        variant="flat"
        onEdit={edit("playerSports")}
      >
        <InfoRow
          label="Trasferimento"
          value={profile.is_open_to_transfer ? "Disponibile" : "Non disponibile"}
          valueColor={profile.is_open_to_transfer ? "success" : "default"}
        />
        {zoneLabels.length > 0 ? (
          <InfoTagsRow
            tags={zoneLabels}
            highlightedTags={availabilityType === "REGIONS" ? zoneLabels : []}
            label="Zone disponibili"
          />
        ) : availabilityType === "ITALY" && profile.is_open_to_transfer ? (
          <InfoTagsRow tags={["Tutta Italia"]} highlightedTags={["Tutta Italia"]} label="Zone disponibili" />
        ) : null}
        {preferredCategories.length > 0 ? (
          <InfoRow
            label="Categorie preferite"
            value={preferredCategories.join(", ")}
            isLast
          />
        ) : null}
      </SectionCard>

      {/* 2. Posizione in campo */}
      <SectionCard
        title="Posizione in campo"
        variant="flat"
        onEdit={edit("playerSports")}
      >
        <ReadonlyPositionPitch
          primaryPosition={primaryPosition}
          secondaryPositions={secondaryPositions}
        />
        <InfoRow
          label="Piede preferito"
          value={formatPreferredFoot(playerProfile?.preferred_foot)}
          isLast
        />
      </SectionCard>

      {/* 3. Situazione */}
      <SectionCard
        title="Situazione"
        variant="flat"
        onEdit={edit("playerSituation")}
      >
        <InfoRow
          label="Stato"
          value={formatContractStatus(playerProfile?.contract_status ?? null)}
        />
        <InfoRow
          label="Squadra attuale"
          value={currentClub}
        />
        {playerProfile?.contract_expiry ? (
          <InfoRow
            label="Scadenza contratto"
            value={formatContractExpiry(playerProfile.contract_expiry)}
            isLast
          />
        ) : null}
      </SectionCard>

      {/* 4. Obiettivi */}
      <SectionCard
        title="Obiettivi"
        variant="flat"
        onEdit={edit("playerSituation")}
      >
        {playerObjectives.length > 0 ? (
          <InfoTagsRow tags={playerObjectives} />
        ) : (
          <AppText variant="bodySm" color="secondary">
            Nessun obiettivo inserito.
          </AppText>
        )}
      </SectionCard>

      {/* 5. Palmarès */}
      <SectionCard
        title="Palmarès"
        variant="flat"
        onEdit={edit("playerPalmares")}
      >
        {playerPalmares.length > 0 ? (
          <View style={styles.palmaresList}>
            {playerPalmares.map((item) => (
              <PalmaresItem
                key={item.id}
                competitionName={item.competition_name}
                seasonLabel={item.season_label}
                clubName={item.club_name}
                type={item.palmares_type as "trophy" | "medal" | "top_scorer"}
              />
            ))}
          </View>
        ) : (
          <AppText variant="bodySm" color="secondary">
            Nessun riconoscimento inserito.
          </AppText>
        )}
      </SectionCard>

      {/* 6. Stato attuale */}
      <SectionCard
        title="Stato attuale"
        variant="flat"
        onEdit={edit("playerSituation")}
      >
        <InfoRow
          label="Condizione"
          value={formatCurrentCondition(playerProfile?.current_condition ?? null)}
          isLast
        />
      </SectionCard>

      {/* 7. Prove */}
      <SectionCard
        title="Prove"
        variant="flat"
        onEdit={edit("playerSituation")}
      >
        <InfoRow
          label="Disponibile per provini"
          value={playerProfile?.open_to_trials ? "Sì" : "No"}
          isLast
        />
      </SectionCard>

      {/* 8. Contatti */}
      <View>
        <ContactSection contacts={userContacts} variant="flat" />
        {isOwner ? (
          <Pressable
            accessibilityLabel="Modifica contatti"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onEdit("contact")}
            style={styles.editContactButton}
          >
            <Ionicons color={colors.textSecondary} name="pencil" size={16} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing[24],
  },
  editContactButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    bottom: spacing[16],
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: spacing[16],
    width: 36,
  },
  palmaresList: {
    gap: spacing[12],
  },
});
