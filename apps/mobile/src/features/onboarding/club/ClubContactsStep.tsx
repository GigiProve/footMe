import type { ItalianCityOption } from "../../profiles/profile-form-utils";
import type { OnboardingValidationErrors } from "../onboarding-form";
import {
  CityAutocompleteField,
  OnboardingPage,
  OnboardingSection,
  OnboardingTextField,
  PhoneField,
} from "../ui";

type ClubContactsStepProps = {
  address: string;
  city: string;
  currentStep: number;
  email: string;
  isBusy: boolean;
  onBack: () => void;
  onCityChange: (value: string) => void;
  onCitySelect: (value: ItalianCityOption) => void;
  onContinue: () => void;
  onFieldChange: (
    field:
      | "clubHeadquartersAddress"
      | "clubEmail"
      | "clubPhone"
      | "clubPhoneCountryCode",
    value: string,
  ) => void;
  phoneCountryCode: string;
  phoneNumber: string;
  region: string;
  stepLabel: string;
  totalSteps: number;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Sede e contatti (REV-ONB-05 §AB–§AF).
 *
 * Sono i riferimenti ufficiali della società: restano distinti da quelli del
 * referente, che è una persona e non un recapito pubblico (§G, §AE).
 */
export function ClubContactsStep({
  address,
  city,
  currentStep,
  email,
  isBusy,
  onBack,
  onCityChange,
  onCitySelect,
  onContinue,
  onFieldChange,
  phoneCountryCode,
  phoneNumber,
  region,
  stepLabel,
  totalSteps,
  validationErrors,
}: ClubContactsStepProps) {
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
      subtitle="Aggiungi i riferimenti ufficiali della società."
      testID="club-contacts-step"
      title="Sede e contatti"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <CityAutocompleteField
          errorMessage={validationErrors.clubCity}
          label="Città"
          onChangeText={onCityChange}
          onSelectCity={onCitySelect}
          placeholder="Cerca la tua città"
          selectedRegion={region}
          testID="club-city-field"
          value={city}
        />

        <OnboardingTextField
          autoCapitalize="words"
          label="Indirizzo sede"
          onChangeText={(value) =>
            onFieldChange("clubHeadquartersAddress", value)
          }
          optional
          placeholder="Es. Via Roma, 10"
          value={address}
        />

        <OnboardingTextField
          autoCapitalize="none"
          autoCorrect={false}
          errorMessage={validationErrors.clubEmail}
          keyboardType="email-address"
          label="Email ufficiale"
          onChangeText={(value) => onFieldChange("clubEmail", value)}
          optional
          placeholder="info@societa.it"
          value={email}
        />

        <PhoneField
          countryCode={phoneCountryCode}
          errorMessage={validationErrors.clubPhone}
          label="Telefono società"
          onChangeCountryCode={(value) =>
            onFieldChange("clubPhoneCountryCode", value)
          }
          onChangePhoneNumber={(value) => onFieldChange("clubPhone", value)}
          optional
          phoneNumber={phoneNumber}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
