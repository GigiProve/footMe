import { Pressable, StyleSheet, View } from "react-native";

import { DatePickerField } from "../../../components/ui/date-picker-field";
import { NationalityAutocompleteInput } from "../../../components/ui/nationality-autocomplete-input";
import { PhoneInputWithCountryCode } from "../../../components/ui/phone-input-with-country-code";
import { ResidenceCityInput } from "../../../components/ui/residence-city-input";
import {
  getNationalityCategory,
  type ItalianCityOption,
} from "../../profiles/profile-form-utils";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input } from "../../../ui";
import type { LegalStatus } from "../onboarding-form";
import { OnboardingEyebrow, OnboardingSectionCard } from "../onboarding-ui";

type AgentBasicInfoStepProps = {
  birthDate: string;
  currentLocationCity: string;
  currentLocationCountry: string;
  firstName: string;
  lastName: string;
  legalStatus: LegalStatus;
  nationality: string;
  phoneCountryCode: string;
  phoneNumber: string;
  residence: string;
  residenceCountry: string;
  residenceRegion: string;
  validationErrors: Partial<Record<string, string>>;
  onContinue: () => void;
  onFormattedNameBlur: (field: "firstName" | "lastName") => void;
  onNationalityChange: (value: string) => void;
  onResidenceChange: (value: string) => void;
  onResidenceSelect: (value: ItalianCityOption) => void;
  onUpdate: (
    patch: Partial<{
      birthDate: string;
      currentLocationCity: string;
      currentLocationCountry: string;
      firstName: string;
      lastName: string;
      legalStatus: LegalStatus;
      phoneCountryCode: string;
      phoneNumber: string;
      residenceCountry: string;
    }>,
    fieldsToClear?: string[],
  ) => void;
};

const LEGAL_STATUS_OPTIONS: { label: string; value: LegalStatus }[] = [
  { label: "Ho il permesso di soggiorno", value: "has_permit" },
  { label: "Non ho il permesso di soggiorno", value: "no_permit" },
  { label: "In fase di richiesta", value: "pending_permit" },
];

export function AgentBasicInfoStep({
  birthDate,
  currentLocationCity,
  currentLocationCountry,
  firstName,
  lastName,
  legalStatus,
  nationality,
  phoneCountryCode,
  phoneNumber,
  residence,
  residenceCountry,
  residenceRegion,
  validationErrors,
  onContinue,
  onFormattedNameBlur,
  onNationalityChange,
  onResidenceChange,
  onResidenceSelect,
  onUpdate,
}: AgentBasicInfoStepProps) {
  const nationalityCategory = getNationalityCategory(nationality);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <OnboardingEyebrow>Profilo procuratore</OnboardingEyebrow>
        <AppText variant="displaySm">I tuoi dati</AppText>
        <AppText variant="bodySm" color="secondary">
          Inserisci le informazioni principali per completare il tuo profilo.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Input
              autoCapitalize="words"
              autoCorrect={false}
              error={Boolean(validationErrors.firstName)}
              helperText={validationErrors.firstName}
              label="Nome *"
              onBlur={() => onFormattedNameBlur("firstName")}
              onChangeText={(value) => onUpdate({ firstName: value })}
              placeholder="Es. Matteo"
              value={firstName}
            />
          </View>
          <View style={styles.flex}>
            <Input
              autoCapitalize="words"
              autoCorrect={false}
              error={Boolean(validationErrors.lastName)}
              helperText={validationErrors.lastName}
              label="Cognome *"
              onBlur={() => onFormattedNameBlur("lastName")}
              onChangeText={(value) => onUpdate({ lastName: value })}
              placeholder="Es. Bianchi"
              value={lastName}
            />
          </View>
        </View>

        <DatePickerField
          label="Data di nascita *"
          onChange={(value) => onUpdate({ birthDate: value }, ["birthDate"])}
          value={birthDate}
        />
        {validationErrors.birthDate ? (
          <AppText variant="bodySm" color="danger">
            {validationErrors.birthDate}
          </AppText>
        ) : null}

        <NationalityAutocompleteInput
          errorMessage={validationErrors.nationality}
          label="Nazionalità *"
          onChange={onNationalityChange}
          value={nationality}
        />

        {/* Italian users: Italian city autocomplete */}
        {nationalityCategory === "italy" ? (
          <ResidenceCityInput
            errorMessage={validationErrors.residence}
            helperText={
              residenceRegion
                ? `Città selezionata: ${residence} · ${residenceRegion}`
                : undefined
            }
            label="Città *"
            onChangeText={onResidenceChange}
            onSelectCity={onResidenceSelect}
            placeholder="Es. Roma"
            value={residence}
          />
        ) : null}

        {/* EU and non-EU users: international residence + current location */}
        {nationalityCategory === "eu" || nationalityCategory === "non_eu" ? (
          <>
            <View style={styles.sectionDivider}>
              <AppText variant="titleSm">Residenza</AppText>
              <AppText variant="bodySm" color="secondary">
                Il paese dove sei ufficialmente residente.
              </AppText>
            </View>

            <NationalityAutocompleteInput
              errorMessage={validationErrors.residenceCountry}
              label="Paese di residenza *"
              onChange={(value) =>
                onUpdate({ residenceCountry: value }, ["residenceCountry"])
              }
              value={residenceCountry}
            />

            <View style={styles.sectionDivider}>
              <AppText variant="titleSm">Dove ti trovi attualmente</AppText>
              <AppText variant="bodySm" color="secondary">
                Il paese e la città in cui vivi in questo momento.
              </AppText>
            </View>

            <NationalityAutocompleteInput
              errorMessage={validationErrors.currentLocationCountry}
              label="Paese attuale *"
              onChange={(value) =>
                onUpdate({ currentLocationCountry: value }, ["currentLocationCountry"])
              }
              value={currentLocationCountry}
            />

            <Input
              autoCapitalize="words"
              autoCorrect={false}
              label="Città attuale *"
              onChangeText={(value) =>
                onUpdate({ currentLocationCity: value }, ["currentLocationCity"])
              }
              placeholder="Es. Milano"
              style={validationErrors.currentLocationCity ? styles.inputError : undefined}
              value={currentLocationCity}
            />
            {validationErrors.currentLocationCity ? (
              <AppText variant="bodySm" color="danger">
                {validationErrors.currentLocationCity}
              </AppText>
            ) : null}
          </>
        ) : null}

        {/* Non-EU only: legal status */}
        {nationalityCategory === "non_eu" && nationality ? (
          <>
            <View style={styles.sectionDivider}>
              <AppText variant="titleSm">Stato legale *</AppText>
              <AppText variant="bodySm" color="secondary">
                La tua situazione relativa al permesso di soggiorno in Italia.
              </AppText>
            </View>

            <View style={styles.legalStatusOptions}>
              {LEGAL_STATUS_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    onUpdate({ legalStatus: option.value }, ["legalStatus"])
                  }
                  style={[
                    styles.legalStatusOption,
                    legalStatus === option.value && styles.legalStatusOptionActive,
                  ]}
                >
                  <AppText
                    variant="bodySm"
                    color={legalStatus === option.value ? "accentStrong" : "primary"}
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
            {validationErrors.legalStatus ? (
              <AppText variant="bodySm" color="danger">
                {validationErrors.legalStatus}
              </AppText>
            ) : null}
          </>
        ) : null}

        <PhoneInputWithCountryCode
          countryCode={phoneCountryCode}
          errorMessage={validationErrors.phoneNumber}
          label="Telefono *"
          onChangeCountryCode={(value) =>
            onUpdate({ phoneCountryCode: value }, ["phoneNumber"])
          }
          onChangePhoneNumber={(value) =>
            onUpdate({ phoneNumber: value }, ["phoneNumber"])
          }
          phoneNumber={phoneNumber}
        />
      </OnboardingSectionCard>

      <Button fullWidth label="Continua" onPress={onContinue} variant="primary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  flex: {
    flex: 1,
  },
  header: {
    gap: spacing[8],
  },
  inputError: {
    borderColor: colors.danger,
  },
  legalStatusOption: {
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  legalStatusOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.heroSoft,
  },
  legalStatusOptions: {
    gap: spacing[8],
  },
  row: {
    flexDirection: "row",
    gap: spacing[12],
  },
  sectionDivider: {
    gap: spacing[4],
    paddingTop: spacing[4],
  },
});
