import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { ContactSection } from "../contact-section";
import { formatLocation } from "../profile-display-helpers";
import type { CompleteProfessionalProfile } from "../profile-service";
import { formatSpecialization } from "../profile-edit-helpers";
import type { EditSection } from "../ProfileReadonlyView";

type StaffInfoTabProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: (section: EditSection) => void;
};

function SectionLabel({ children }: { children: string }) {
  return (
    <AppText style={styles.sectionLabel}>
      {children.toUpperCase()}
    </AppText>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) {
    return null;
  }

  return (
    <View style={styles.infoRow}>
      <AppText color="secondary" style={styles.infoLabel} variant="bodySm">
        {label}
      </AppText>
      <AppText style={styles.infoValue} variant="bodySm">
        {value}
      </AppText>
    </View>
  );
}

export function StaffInfoTab({
  completeProfile,
  isOwner,
  onEdit,
}: StaffInfoTabProps) {
  const staffProfile = completeProfile.staffProfile;

  const locationLabel = formatLocation(
    completeProfile.profile.city,
    completeProfile.profile.region,
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. STATUS & DISPONIBILITA' */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <SectionLabel>Stato</SectionLabel>
          {isOwner ? (
            <Pressable
              accessibilityLabel="Modifica info staff"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onEdit("staffInfo")}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.availItem}>
          {staffProfile?.open_to_work ? (
            <View style={styles.statusDot} />
          ) : (
            <View style={[styles.statusDot, styles.statusDotInactive]} />
          )}
          <AppText style={styles.availText}>
            {staffProfile?.open_to_work ? "Disponibile" : "Profilo attivo"}
          </AppText>
        </View>

        {locationLabel ? (
          <View style={styles.availItem}>
            <Ionicons color={colors.textSecondary} name="location-outline" size={18} />
            <AppText variant="bodySm" style={styles.availText}>
              {locationLabel}
            </AppText>
          </View>
        ) : null}

        {staffProfile?.availability_type ? (
          <View style={styles.availItem}>
            <Ionicons color={colors.textSecondary} name="time-outline" size={18} />
            <AppText variant="bodySm" style={styles.availText}>
              {staffProfile.availability_type}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* 2. PROFILO PROFESSIONALE */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <SectionLabel>Profilo professionale</SectionLabel>
          {isOwner ? (
            <Pressable
              accessibilityLabel="Modifica profilo professionale"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onEdit("staffInfo")}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
          ) : null}
        </View>

        <InfoRow
          label="Specializzazione"
          value={formatSpecialization(staffProfile?.specialization ?? null)}
        />
        <InfoRow
          label="Ruoli"
          value={(staffProfile?.staff_roles ?? []).join(", ")}
        />
        <InfoRow
          label="Categorie preferite"
          value={(staffProfile?.preferred_categories ?? []).join(", ")}
        />
        <InfoRow
          label="Regioni di interesse"
          value={(staffProfile?.preferred_regions ?? []).join(", ")}
        />
        {(staffProfile?.preferred_provinces ?? []).length > 0 ? (
          <InfoRow
            label="Province di interesse"
            value={(staffProfile?.preferred_provinces ?? []).join(", ")}
          />
        ) : null}
        {(staffProfile?.certifications ?? []).length > 0 ? (
          <InfoRow
            label="Certificazioni"
            value={(staffProfile?.certifications ?? []).join(", ")}
          />
        ) : null}
      </View>

      {/* 3. RIEPILOGO */}
      {staffProfile?.experience_summary ? (
        <View style={styles.section}>
          <SectionLabel>Riepilogo</SectionLabel>
          <AppText color="secondary" variant="bodySm">
            {staffProfile.experience_summary}
          </AppText>
        </View>
      ) : null}

      {/* 4. CONTATTI */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <SectionLabel>Contatti</SectionLabel>
          {isOwner ? (
            <Pressable
              accessibilityLabel="Modifica contatti"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onEdit("contact")}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
          ) : null}
        </View>
        <ContactSection contacts={completeProfile.userContacts} variant="flat" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  availItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[10],
  },
  availText: {
    color: colors.textPrimary,
    flex: 1,
    fontWeight: "500",
  },
  container: {
    gap: spacing[36],
    paddingBottom: spacing[48],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  infoLabel: {
    flex: 1,
    minWidth: 100,
  },
  infoRow: {
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[4],
  },
  infoValue: {
    flex: 2,
  },
  section: {
    position: "relative",
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[16],
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statusDot: {
    backgroundColor: colors.success,
    borderRadius: radius[16],
    height: 8,
    width: 8,
  },
  statusDotInactive: {
    backgroundColor: colors.textSecondary,
  },
});
