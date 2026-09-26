import { StyleSheet, View } from "react-native";

import type { OnboardingValidationErrors } from "../onboarding-form";
import {
  OnboardingPage,
  OnboardingSection,
  OnboardingTextField,
  PhoneField,
  onboardingLayout,
} from "../ui";

type ClubRepresentativeStepProps = {
  currentStep: number;
  email: string;
  firstName: string;
  isBusy: boolean;
  lastName: string;
  onBack: () => void;
  onContinue: () => void;
  onFieldChange: (
    field: "firstName" | "lastName" | "repEmail" | "repPhone" | "repPhoneCountryCode",
    value: string,
  ) => void;
  onFormattedNameBlur: (field: "firstName" | "lastName") => void;
  phoneCountryCode: string;
  phoneNumber: string;
  stepLabel: string;
  totalSteps: number;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Referente del club (REV-ONB-05 §E–§G).
 *
 * Qui si registra la persona che gestirà il profilo, non la società: questi
 * recapiti restano suoi e non diventano automaticamente i contatti pubblici
 * del club, che si chiedono al passo "Sede e contatti" (§G).
 */
export function ClubRepresentativeStep({
  currentStep,
  email,
  firstName,
  isBusy,
  lastName,
  onBack,
  onContinue,
  onFieldChange,
  onFormattedNameBlur,
  phoneCountryCode,
  phoneNumber,
  stepLabel,
  totalSteps,
  validationErrors,
}: ClubRepresentativeStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryDisabled: isBusy,
        primaryLabel: "Continua",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Inserisci i dati della persona che gestirà inizialmente il profilo della società."
      testID="club-representative-step"
      title="Referente del club"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <OnboardingTextField
              autoCapitalize="words"
              autoCorrect={false}
              errorMessage={validationErrors.firstName}
              label="Nome"
              onBlur={() => onFormattedNameBlur("firstName")}
              onChangeText={(value) => onFieldChange("firstName", value)}
              placeholder="Andrea"
              textContentType="givenName"
              value={firstName}
            />
          </View>
          <View style={styles.rowItem}>
            <OnboardingTextField
              autoCapitalize="words"
              autoCorrect={false}
              errorMessage={validationErrors.lastName}
              label="Cognome"
              onBlur={() => onFormattedNameBlur("lastName")}
              onChangeText={(value) => onFieldChange("lastName", value)}
              placeholder="Bianchi"
              textContentType="familyName"
              value={lastName}
            />
          </View>
        </View>

        <OnboardingTextField
          autoCapitalize="none"
          autoCorrect={false}
          errorMessage={validationErrors.repEmail}
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => onFieldChange("repEmail", value)}
          placeholder="andrea.bianchi@societa.it"
          textContentType="emailAddress"
          value={email}
        />

        <PhoneField
          countryCode={phoneCountryCode}
          errorMessage={validationErrors.repPhone}
          label="Telefono"
          onChangeCountryCode={(value) =>
            onFieldChange("repPhoneCountryCode", value)
          }
          onChangePhoneNumber={(value) => onFieldChange("repPhone", value)}
          phoneNumber={phoneNumber}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: onboardingLayout.fieldGap - 4,
  },
  rowItem: {
    flex: 1,
  },
});
