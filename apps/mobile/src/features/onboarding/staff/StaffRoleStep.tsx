import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Input } from "../../../ui";
import {
  OnboardingCheckboxRow,
  OnboardingInfoCard,
  OnboardingSectionCard,
} from "../onboarding-ui";
import {
  STAFF_ROLE_OPTIONS,
  type StaffRole,
} from "../onboarding-types";

type StaffRoleStepProps = {
  certifications: string;
  experienceSummary: string;
  primaryRole: string;
  selectedRoles: StaffRole[];
  validationErrors: Partial<Record<string, string>>;
  onUpdate: (
    patch: Partial<{
      certifications: string;
      experienceSummary: string;
      staffPrimaryRole: string;
      staffRoles: StaffRole[];
    }>,
  ) => void;
};

export function StaffRoleStep({
  certifications,
  experienceSummary,
  primaryRole,
  selectedRoles,
  validationErrors,
  onUpdate,
}: StaffRoleStepProps) {
  const hasMultipleRoles = selectedRoles.length > 1;

  function toggleRole(role: StaffRole) {
    const isSelected = selectedRoles.includes(role);
    const nextRoles = isSelected
      ? selectedRoles.filter((entry) => entry !== role)
      : [...selectedRoles, role];

    const nextPrimaryRole =
      nextRoles.length === 1
        ? nextRoles[0]
        : nextRoles.includes(primaryRole as StaffRole)
          ? primaryRole
          : "";

    onUpdate({
      staffPrimaryRole: nextPrimaryRole,
      staffRoles: nextRoles,
    });
  }

  return (
    <View style={styles.container}>
      <OnboardingSectionCard
        title="Seleziona i tuoi ruoli"
        subtitle="Puoi indicare più ruoli nello staff tecnico. Se ne scegli più di uno, devi indicare quello principale."
      >
        <View style={styles.rolesList}>
          {STAFF_ROLE_OPTIONS.map((option) => (
            <OnboardingCheckboxRow
              active={selectedRoles.includes(option.value)}
              key={option.value}
              label={option.label}
              onPress={() => toggleRole(option.value)}
            />
          ))}
        </View>

        {validationErrors.staffRoles ? (
          <AppText variant="caption" color="danger">
            {validationErrors.staffRoles}
          </AppText>
        ) : null}

        {hasMultipleRoles ? (
          <View style={styles.primarySection}>
            <View style={styles.primaryHeader}>
              <AppText variant="headingSm">Ruolo principale</AppText>
              <AppText variant="bodySm" color="secondary">
                Seleziona il ruolo da usare come predefinito nelle esperienze.
              </AppText>
            </View>

            <View style={styles.primaryList}>
              {selectedRoles.map((role) => {
                const active = primaryRole === role;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    key={role}
                    onPress={() => onUpdate({ staffPrimaryRole: role })}
                    style={[
                      styles.primaryCard,
                      active ? styles.primaryCardActive : null,
                    ]}
                  >
                    <View style={styles.primaryCopy}>
                      <AppText
                        variant="titleSm"
                        style={active ? styles.primaryTextActive : undefined}
                      >
                        {role}
                      </AppText>
                      <AppText variant="bodySm" color="secondary">
                        Ruolo principale del profilo
                      </AppText>
                    </View>
                    <View
                      style={[
                        styles.radio,
                        active ? styles.radioActive : null,
                      ]}
                    >
                      {active ? (
                        <Ionicons
                          color={colors.inkInvert}
                          name="checkmark"
                          size={16}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {validationErrors.staffPrimaryRole ? (
              <AppText variant="caption" color="danger">
                {validationErrors.staffPrimaryRole}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {!hasMultipleRoles && selectedRoles.length === 1 ? (
          <OnboardingInfoCard
            message={`Ruolo principale impostato automaticamente: ${selectedRoles[0]}.`}
          />
        ) : null}
      </OnboardingSectionCard>

      <OnboardingSectionCard
        title="Completa il profilo"
        subtitle="Aggiungi i dettagli essenziali per rendere il profilo staff più chiaro e completo."
      >
        <Input
          label="Certificazioni"
          onChangeText={(value) => onUpdate({ certifications: value })}
          placeholder="Es. UEFA Fitness, FIGC Match Analysis"
          value={certifications}
        />

        <Input
          label="Esperienza"
          multiline
          onChangeText={(value) => onUpdate({ experienceSummary: value })}
          placeholder="Ruoli, contesti e staff in cui hai lavorato"
          value={experienceSummary}
        />
      </OnboardingSectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  primaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
    backgroundColor: colors.surface,
    gap: spacing[12],
  },
  primaryCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  primaryCopy: {
    flex: 1,
    gap: spacing[4],
  },
  primaryHeader: {
    gap: spacing[4],
  },
  primaryList: {
    gap: spacing[10],
  },
  primarySection: {
    gap: spacing[12],
  },
  primaryTextActive: {
    color: colors.accentStrong,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  rolesList: {
    gap: spacing[12],
  },
});
