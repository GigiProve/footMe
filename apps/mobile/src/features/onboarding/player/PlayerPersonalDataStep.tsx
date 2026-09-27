import { NationalityAutocompleteInput } from "../../../components/ui/nationality-autocomplete-input";
import { PhoneInputWithCountryCode } from "../../../components/ui/phone-input-with-country-code";
import { ResidenceCityInput } from "../../../components/ui/residence-city-input";
import type { ProfileGender } from "../onboarding-types";
import type { LegalStatus, OnboardingValidationErrors } from "../onboarding-form";
import {
  DateSelector,
  FieldShell,
  OnboardingPage,
  OnboardingSection,
  OnboardingTextField,
  SegmentedSelector,
  SelectionRow,
  ToggleRow,
} from "../ui";

/** §H: solo Uomo e Donna, nessun simbolo, nessuna icona di genere. */
const GENDER_OPTIONS: { label: string; value: ProfileGender }[] = [
  { label: "Uomo", value: "male" },
  { label: "Donna", value: "female" },
];

/** Chiesto solo a chi ha nazionalità extra UE, come da validazione del passo. */
const LEGAL_STATUS_OPTIONS: { label: string; value: LegalStatus }[] = [
  { label: "Ho il permesso di soggiorno", value: "has_permit" },
  { label: "Non ho il permesso di soggiorno", value: "no_permit" },
  { label: "In fase di richiesta", value: "pending_permit" },
];

type CitySelection = { name: string; region: string };

type PlayerPersonalDataStepProps = {
  birthDate: string;
  currentLocationCity: string;
  currentLocationCountry: string;
  currentStep: number;
  domicile: string;
  domicileRegion: string;
  firstName: string;
  gender: string;
  isBusy: boolean;
  lastName: string;
  legalStatus: string;
  nationality: string;
  nationalityCategory: "italy" | "eu" | "non_eu" | "unknown";
  onBack: () => void;
  onBirthDateChange: (value: string) => void;
  onContinue: () => void;
  onCurrentLocationCityChange: (value: string) => void;
  onCurrentLocationCountryChange: (value: string) => void;
  onDomicileChange: (value: string) => void;
  onDomicileSelect: (value: CitySelection) => void;
  onDomicileToggle: (value: boolean) => void;
  onFieldChange: (field: "firstName" | "lastName", value: string) => void;
  onFormattedNameBlur: (field: "firstName" | "lastName") => void;
  onGenderChange: (value: ProfileGender) => void;
  onLegalStatusChange: (value: LegalStatus) => void;
  onNationalityChange: (value: string) => void;
  onPhoneCountryCodeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  onResidenceChange: (value: string) => void;
  onResidenceCountryChange: (value: string) => void;
  onResidenceSelect: (value: CitySelection) => void;
  phoneCountryCode: string;
  phoneNumber: string;
  residence: string;
  residenceCountry: string;
  residenceRegion: string;
  stepLabel: string;
  totalSteps: number;
  useResidenceForDomicile: boolean;
  validationErrors: OnboardingValidationErrors;
};

/**
 * Step "I tuoi dati personali" del Calciatore (REV-ONB-02 §G–§J).
 *
 * Gli stessi dati già previsti dal modello Calciatore, resi con i componenti
 * del Master: nessun campo nuovo, nessuna icona decorativa.
 */
export function PlayerPersonalDataStep({
  birthDate,
  currentLocationCity,
  currentLocationCountry,
  currentStep,
  domicile,
  domicileRegion,
  firstName,
  gender,
  isBusy,
  lastName,
  legalStatus,
  nationality,
  nationalityCategory,
  onBack,
  onBirthDateChange,
  onContinue,
  onCurrentLocationCityChange,
  onCurrentLocationCountryChange,
  onDomicileChange,
  onDomicileSelect,
  onDomicileToggle,
  onFieldChange,
  onFormattedNameBlur,
  onGenderChange,
  onLegalStatusChange,
  onNationalityChange,
  onPhoneCountryCodeChange,
  onPhoneNumberChange,
  onResidenceChange,
  onResidenceCountryChange,
  onResidenceSelect,
  phoneCountryCode,
  phoneNumber,
  residence,
  residenceCountry,
  residenceRegion,
  stepLabel,
  totalSteps,
  useResidenceForDomicile,
  validationErrors,
}: PlayerPersonalDataStepProps) {
  const isItalian = nationalityCategory === "italy";
  /**
   * §I: a chi non è italiano si chiedono residenza, luogo attuale e — fuori
   * dall'UE — lo stato legale. Sono gli stessi campi che la validazione del
   * passo pretende: se non si mostrano, "Continua" non avanza mai.
   */
  const needsLegalStatus =
    nationalityCategory === "non_eu" && Boolean(nationality.trim());
  /** §I: nessuna data di nascita nel futuro. */
  const lastSelectableYear = new Date().getFullYear();

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "personal-data-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Servono per creare il tuo profilo e farti trovare dalle società."
      testID="player-personal-data-step"
      title="I tuoi dati personali"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <OnboardingTextField
          autoCapitalize="words"
          autoCorrect={false}
          errorMessage={validationErrors.firstName}
          label="Nome"
          onBlur={() => onFormattedNameBlur("firstName")}
          onChangeText={(value) => onFieldChange("firstName", value)}
          placeholder="Es. Alessandro"
          value={firstName}
        />

        <OnboardingTextField
          autoCapitalize="words"
          autoCorrect={false}
          errorMessage={validationErrors.lastName}
          label="Cognome"
          onBlur={() => onFormattedNameBlur("lastName")}
          onChangeText={(value) => onFieldChange("lastName", value)}
          placeholder="Es. Rossi"
          value={lastName}
        />

        <SegmentedSelector
          errorMessage={validationErrors.gender}
          label="Sesso"
          onChange={onGenderChange}
          options={GENDER_OPTIONS}
          testID="gender-selector"
          value={gender as ProfileGender | ""}
        />

        <DateSelector
          errorMessage={validationErrors.birthDate}
          label="Data di nascita"
          lastYear={lastSelectableYear}
          mode="date"
          onChange={onBirthDateChange}
          placeholder="Seleziona la data"
          sheetTitle="Data di nascita"
          testID="birth-date-selector"
          value={birthDate}
        />

        <NationalityAutocompleteInput
          errorMessage={validationErrors.nationality}
          label="Nazionalità *"
          onChange={onNationalityChange}
          value={nationality}
        />
      </OnboardingSection>

      <OnboardingSection title="Dove vivi">
        {isItalian ? (
          <>
            <ResidenceCityInput
              errorMessage={validationErrors.residence}
              helperText={
                residenceRegion
                  ? `Città selezionata: ${residence} · ${residenceRegion}`
                  : undefined
              }
              onChangeText={onResidenceChange}
              onSelectCity={onResidenceSelect}
              value={residence}
            />

            <ToggleRow
              label="Il domicilio è diverso dalla residenza"
              onValueChange={onDomicileToggle}
              value={!useResidenceForDomicile}
            >
              <ResidenceCityInput
                errorMessage={validationErrors.domicile}
                helperText={
                  domicileRegion
                    ? `Città selezionata: ${domicile} · ${domicileRegion}`
                    : undefined
                }
                label="Domicilio"
                onChangeText={onDomicileChange}
                onSelectCity={onDomicileSelect}
                placeholder="Cerca la città di domicilio"
                value={domicile}
              />
            </ToggleRow>
          </>
        ) : (
          <>
            <NationalityAutocompleteInput
              errorMessage={validationErrors.residenceCountry}
              label="Paese di residenza *"
              onChange={onResidenceCountryChange}
              value={residenceCountry}
            />

            <NationalityAutocompleteInput
              errorMessage={validationErrors.currentLocationCountry}
              label="Paese in cui ti trovi ora *"
              onChange={onCurrentLocationCountryChange}
              value={currentLocationCountry}
            />

            <OnboardingTextField
              autoCapitalize="words"
              autoCorrect={false}
              errorMessage={validationErrors.currentLocationCity}
              label="Città in cui ti trovi ora *"
              onChangeText={onCurrentLocationCityChange}
              placeholder="Es. Madrid"
              value={currentLocationCity}
            />
          </>
        )}
      </OnboardingSection>

      {needsLegalStatus ? (
        <OnboardingSection title="Stato legale">
          <FieldShell
            errorMessage={validationErrors.legalStatus}
            helperText="La tua situazione rispetto al permesso di soggiorno in Italia."
          >
            {LEGAL_STATUS_OPTIONS.map((option) => (
              <SelectionRow
                control="radio"
                key={option.value}
                label={option.label}
                onPress={() => onLegalStatusChange(option.value)}
                selected={legalStatus === option.value}
                testID={`legal-status-${option.value}`}
              />
            ))}
          </FieldShell>
        </OnboardingSection>
      ) : null}

      <OnboardingSection title="Contatto">
        {/* §J: prefisso internazionale e numero restano due controlli distinti. */}
        <PhoneInputWithCountryCode
          countryCode={phoneCountryCode}
          errorMessage={validationErrors.phoneNumber}
          label="Telefono"
          onChangeCountryCode={onPhoneCountryCodeChange}
          onChangePhoneNumber={onPhoneNumberChange}
          phoneNumber={phoneNumber}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}
