import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import {
  OnboardingCheckboxRow,
  OnboardingInfoCard,
  OnboardingSectionCard,
} from "../onboarding-ui";
import {
  DIRECTOR_ROLE_OPTIONS,
  type DirectorRole,
} from "../onboarding-types";

type DirectorRolesStepProps = {
  selectedRoles: string[];
  primaryRole: string;
  validationErrors: Partial<Record<string, string>>;
  onUpdate: (patch: { directorRoles?: string[]; directorPrimaryRole?: string }) => void;
};

export function DirectorRolesStep({
  selectedRoles,
  primaryRole,
  validationErrors,
  onUpdate,
}: DirectorRolesStepProps) {
  const hasMultipleRoles = selectedRoles.length > 1;

  function toggleRole(role: DirectorRole) {
    const isSelected = selectedRoles.includes(role);
    const nextRoles = isSelected
      ? selectedRoles.filter((entry) => entry !== role)
      : [...selectedRoles, role];

    const nextPrimaryRole =
      nextRoles.length === 1
        ? nextRoles[0]
        : nextRoles.includes(primaryRole)
          ? primaryRole
          : "";

    onUpdate({
      directorPrimaryRole: nextPrimaryRole,
      directorRoles: nextRoles,
    });
  }

  return (
    <View style={styles.container}>
      <OnboardingSectionCard
        title="Il tuo ruolo nel calcio"
        subtitle="Seleziona uno o più ruoli che ti rappresentano nella gestione calcistica."
      >
        <View style={styles.rolesList}>
          {DIRECTOR_ROLE_OPTIONS.map((option) => (
            <OnboardingCheckboxRow
              active={selectedRoles.includes(option.value)}
              key={option.value}
              label={option.label}
              onPress={() => toggleRole(option.value)}
            />
          ))}
        </View>

        {validationErrors.directorRoles ? (
          <AppText variant="caption" color="danger">
            {validationErrors.directorRoles}
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
                    onPress={() => onUpdate({ directorPrimaryRole: role })}
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

            {validationErrors.directorPrimaryRole ? (
              <AppText variant="caption" color="danger">
                {validationErrors.directorPrimaryRole}
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
