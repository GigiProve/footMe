import { StyleSheet, View } from "react-native";

import { InlineError, OnboardingPage, OnboardingSection, SelectionRow } from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import { STAFF_ROLE_OPTIONS, type StaffRole } from "../onboarding-types";

type StaffRolesStepProps = {
  currentStep: number;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onPrimaryRoleChange: (value: string) => void;
  onRolesChange: (roles: StaffRole[], primaryRole: string) => void;
  primaryRole: string;
  primaryRoleError?: string;
  rolesError?: string;
  selectedRoles: StaffRole[];
  stepLabel: string;
  totalSteps: number;
};

/**
 * Passo "I tuoi ruoli" dello Staff tecnico (REV-ONB-04 §E–§G).
 *
 * Righe leggere in multi-selezione, non blocchi blu e non una icona diversa
 * per ogni ruolo (§E). Il ruolo principale compare solo quando serve davvero,
 * cioè da due ruoli in su: con un ruolo solo è già deciso (§F).
 */
export function StaffRolesStep({
  currentStep,
  isBusy,
  onBack,
  onContinue,
  onPrimaryRoleChange,
  onRolesChange,
  primaryRole,
  primaryRoleError,
  rolesError,
  selectedRoles,
  stepLabel,
  totalSteps,
}: StaffRolesStepProps) {
  const hasMultipleRoles = selectedRoles.length > 1;

  function handleToggleRole(role: StaffRole) {
    const isSelected = selectedRoles.includes(role);
    const nextRoles = isSelected
      ? selectedRoles.filter((entry) => entry !== role)
      : [...selectedRoles, role];

    /**
     * §AZ: il ruolo principale deve sempre appartenere ai ruoli selezionati.
     * Con un solo ruolo è automatico; togliendo il ruolo che era principale
     * il riferimento va azzerato, non lasciato appeso.
     */
    const nextPrimaryRole =
      nextRoles.length === 1
        ? nextRoles[0]
        : nextRoles.includes(primaryRole as StaffRole)
          ? primaryRole
          : "";

    onRolesChange(nextRoles, nextPrimaryRole);
  }

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "staff-roles-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Seleziona i ruoli che hai ricoperto nello staff tecnico."
      testID="staff-roles-step"
      title="I tuoi ruoli"
      totalSteps={totalSteps}
    >
      <OnboardingSection description="Puoi selezionarne più di uno." title="Seleziona i tuoi ruoli">
        <View style={styles.list}>
          {STAFF_ROLE_OPTIONS.map((option) => (
            <SelectionRow
              control="checkbox"
              key={option.value}
              label={option.label}
              onPress={() => handleToggleRole(option.value)}
              selected={selectedRoles.includes(option.value)}
              testID={`staff-role-${option.value}`}
            />
          ))}
        </View>

        {rolesError ? <InlineError message={rolesError} /> : null}
      </OnboardingSection>

      {hasMultipleRoles ? (
        <OnboardingSection
          description="Seleziona il ruolo da usare come predefinito nel tuo account."
          title="Ruolo principale"
        >
          <View style={styles.list}>
            {selectedRoles.map((role) => (
              <SelectionRow
                control="radio"
                key={role}
                label={role}
                onPress={() => onPrimaryRoleChange(role)}
                selected={primaryRole === role}
                testID={`staff-primary-role-${role}`}
              />
            ))}
          </View>

          {primaryRoleError ? <InlineError message={primaryRoleError} /> : null}
        </OnboardingSection>
      ) : null}
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: onboardingSpacing.s + 4,
  },
});
