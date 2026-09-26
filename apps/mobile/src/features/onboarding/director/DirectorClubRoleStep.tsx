import { StyleSheet, View } from "react-native";

import {
  InlineError,
  OnboardingPage,
  OnboardingSection,
  OnboardingTextField,
  SelectionRow,
} from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import {
  DIRECTOR_CLUB_ROLE_OPTIONS,
  DIRECTOR_OTHER_ROLE_VALUE,
} from "./director-taxonomy";

type DirectorClubRoleStepProps = {
  currentStep: number;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onOtherRoleLabelChange: (value: string) => void;
  onPrimaryRoleChange: (value: string) => void;
  onRolesChange: (roles: string[], primaryRole: string) => void;
  otherRoleError?: string;
  otherRoleLabel: string;
  primaryRole: string;
  primaryRoleError?: string;
  rolesError?: string;
  selectedRoles: string[];
  stepLabel: string;
  totalSteps: number;
};

/**
 * Passo "Il tuo ruolo nel club" (REV-ONB-07 §F–§H).
 *
 * Una sola sezione "Ruoli ricoperti": Presidente e Dirigente generico stanno
 * accanto a Direttore sportivo senza gerarchie visuali, perché nel prodotto
 * non ne esiste una (§F).
 *
 * Il ruolo principale compare solo da due ruoli in su: con un ruolo solo è
 * già deciso e chiederlo sarebbe una domanda senza valore (§G).
 */
export function DirectorClubRoleStep({
  currentStep,
  isBusy,
  onBack,
  onContinue,
  onOtherRoleLabelChange,
  onPrimaryRoleChange,
  onRolesChange,
  otherRoleError,
  otherRoleLabel,
  primaryRole,
  primaryRoleError,
  rolesError,
  selectedRoles,
  stepLabel,
  totalSteps,
}: DirectorClubRoleStepProps) {
  const hasMultipleRoles = selectedRoles.length > 1;
  const hasOtherRole = selectedRoles.includes(DIRECTOR_OTHER_ROLE_VALUE);

  function handleToggleRole(role: string) {
    const nextRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((entry) => entry !== role)
      : [...selectedRoles, role];

    /**
     * §G, §AX: il ruolo principale appartiene sempre ai ruoli selezionati.
     * Con un ruolo solo è automatico; togliendo quello che era principale il
     * riferimento va azzerato, così la scelta viene richiesta di nuovo.
     */
    const nextPrimaryRole =
      nextRoles.length === 1
        ? nextRoles[0]
        : nextRoles.includes(primaryRole)
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
        primaryTestID: "director-roles-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Seleziona tutti i ruoli che ricopri."
      testID="director-roles-step"
      title="Il tuo ruolo nel club"
      totalSteps={totalSteps}
    >
      <OnboardingSection
        description="Puoi selezionarne più di uno."
        title="Ruoli ricoperti"
      >
        <View style={styles.list}>
          {DIRECTOR_CLUB_ROLE_OPTIONS.map((option) => (
            <SelectionRow
              control="checkbox"
              key={option.value}
              label={option.label}
              onPress={() => handleToggleRole(option.value)}
              selected={selectedRoles.includes(option.value)}
              testID={`director-role-${option.value}`}
            />
          ))}
        </View>

        {rolesError ? <InlineError message={rolesError} /> : null}

        {/* §H: il campo esiste solo quando serve davvero. */}
        {hasOtherRole ? (
          <OnboardingTextField
            autoCapitalize="sentences"
            errorMessage={otherRoleError}
            label="Specifica ruolo"
            onChangeText={onOtherRoleLabelChange}
            placeholder="Es. Responsabile area tecnica"
            testID="director-other-role"
            value={otherRoleLabel}
          />
        ) : null}
      </OnboardingSection>

      {hasMultipleRoles ? (
        <OnboardingSection
          description="Verrà usato come predefinito nelle tue esperienze. Potrai cambiarlo in ognuna."
          title="Ruolo principale"
        >
          <View style={styles.list}>
            {selectedRoles.map((role) => (
              <SelectionRow
                control="radio"
                key={role}
                label={
                  role === DIRECTOR_OTHER_ROLE_VALUE && otherRoleLabel.trim()
                    ? otherRoleLabel.trim()
                    : role
                }
                onPress={() => onPrimaryRoleChange(role)}
                selected={primaryRole === role}
                testID={`director-primary-role-${role}`}
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
