import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, SectionCard } from "../../../ui";
import { ContactSection } from "../contact-section";
import { InfoRow } from "../components/InfoRow";
import { InfoTagsRow } from "../components/InfoTagsRow";
import { getOptionLabel, REGION_OPTIONS } from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";

type CoachInfoTabProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: (section: EditSection) => void;
};

function formatAvailabilityType(value: string | null | undefined) {
  if (value === "REGIONS") return "Regioni";
  if (value === "PROVINCES") return "Province";
  if (value === "ITALY") return "Tutta Italia";
  return "Non specificato";
}

function EmptyState({ message }: { message: string }) {
  return (
    <AppText color="secondary" variant="bodySm">
      {message}
    </AppText>
  );
}

export function CoachInfoTab({
  completeProfile,
  isOwner,
  onEdit,
}: CoachInfoTabProps) {
  const coachProfile = completeProfile.coachProfile;
  const regionLabels = (coachProfile?.preferred_regions ?? []).map((code) =>
    getOptionLabel(REGION_OPTIONS, code),
  );
  const zoneLabels =
    coachProfile?.availability_type === "REGIONS"
      ? regionLabels
      : coachProfile?.availability_type === "PROVINCES"
        ? (coachProfile?.preferred_provinces ?? [])
        : coachProfile?.open_to_new_role
          ? ["Tutta Italia"]
          : [];
  const editProfile = isOwner ? () => onEdit("editCoachProfile") : undefined;

  return (
    <View style={styles.container}>
      <SectionCard
        description="Disponibilità per nuove panchine e aree di interesse."
        onEdit={editProfile}
        title="Disponibilità"
        variant="flat"
      >
        <InfoRow
          label="Nuove panchine"
          value={coachProfile?.open_to_new_role ? "Disponibile" : "Non disponibile"}
          valueColor={coachProfile?.open_to_new_role ? "success" : "default"}
        />
        <InfoRow
          isLast={zoneLabels.length === 0}
          label="Ambito"
          value={formatAvailabilityType(coachProfile?.availability_type)}
        />
        {zoneLabels.length > 0 ? <InfoTagsRow label="Zone" tags={zoneLabels} /> : null}
      </SectionCard>

      <SectionCard
        description="Licenze e categorie già impostate nel profilo allenatore."
        onEdit={editProfile}
        title="Qualifica"
        variant="flat"
      >
        {coachProfile?.licenses?.length ? (
          <InfoTagsRow label="Licenze" tags={coachProfile.licenses} />
        ) : (
          <EmptyState message="Nessuna licenza inserita." />
        )}
        {coachProfile?.coached_categories?.length ? (
          <InfoTagsRow
            label="Categorie allenate"
            tags={coachProfile.coached_categories}
          />
        ) : (
          <EmptyState message="Nessuna categoria allenata inserita." />
        )}
      </SectionCard>

      <SectionCard
        description="Storico sintetico delle squadre già salvate nel profilo."
        onEdit={editProfile}
        title="Squadre allenate"
        variant="flat"
      >
        {coachProfile?.coached_clubs?.length ? (
          <InfoTagsRow tags={coachProfile.coached_clubs} />
        ) : (
          <EmptyState message="Nessuna squadra allenata inserita." />
        )}
      </SectionCard>

      <SectionCard
        description="Presentazione tecnica e metodologia di lavoro."
        onEdit={editProfile}
        title="Filosofia di gioco"
        variant="flat"
      >
        {coachProfile?.game_philosophy ? (
          <AppText variant="bodySm">{coachProfile.game_philosophy}</AppText>
        ) : (
          <EmptyState message="Nessuna filosofia di gioco inserita." />
        )}
      </SectionCard>

      <View>
        <ContactSection contacts={completeProfile.userContacts} variant="flat" />
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
});
