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
  const edit = (section: EditSection) => (isOwner ? () => onEdit(section) : undefined);

  return (
    <View style={styles.container}>
      <SectionCard onEdit={edit("coachInfo")} title="Disponibilità" variant="flat">
        <InfoRow
          label="Nuove panchine"
          value={coachProfile?.open_to_new_role ? "Disponibile" : "Non disponibile"}
          valueColor={coachProfile?.open_to_new_role ? "success" : "default"}
        />
        <InfoRow
          label="Ambito"
          value={coachProfile?.availability_type ?? "Non specificato"}
          isLast={zoneLabels.length === 0}
        />
        {zoneLabels.length > 0 ? <InfoTagsRow label="Zone" tags={zoneLabels} /> : null}
      </SectionCard>

      <SectionCard onEdit={edit("coachInfo")} title="Filosofia di gioco" variant="flat">
        {coachProfile?.game_philosophy ? (
          <AppText variant="bodySm">{coachProfile.game_philosophy}</AppText>
        ) : (
          <AppText color="secondary" variant="bodySm">
            Nessuna filosofia di gioco inserita.
          </AppText>
        )}
      </SectionCard>

      <SectionCard onEdit={edit("coachInfo")} title="Licenze" variant="flat">
        {coachProfile?.licenses?.length ? (
          <InfoTagsRow tags={coachProfile.licenses} />
        ) : (
          <AppText color="secondary" variant="bodySm">
            Nessuna licenza inserita.
          </AppText>
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
