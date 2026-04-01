import { StyleSheet, View } from "react-native";

import { DatePickerField } from "../../../components/ui/date-picker-field";
import { NationalityAutocompleteInput } from "../../../components/ui/nationality-autocomplete-input";
import { PhoneInputWithCountryCode } from "../../../components/ui/phone-input-with-country-code";
import { ResidenceCityInput } from "../../../components/ui/residence-city-input";
import type { ItalianCityOption } from "../../profiles/profile-form-utils";
import { spacing } from "../../../theme/tokens";
import { AppText, Button, Input } from "../../../ui";
import { OnboardingEyebrow, OnboardingSectionCard } from "../onboarding-ui";

type AgentBasicInfoStepProps = {
  birthDate: string;
  firstName: string;
  lastName: string;
  nationality: string;
  phoneCountryCode: string;
  phoneNumber: string;
  residence: string;
  residenceRegion: string;
  validationErrors: Partial<Record<string, string>>;
  onContinue: () => void;
  onFormattedNameBlur: (field: "firstName" | "lastName") => void;
  onResidenceChange: (value: string) => void;
  onResidenceSelect: (value: ItalianCityOption) => void;
  onUpdate: (
    patch: Partial<{
      birthDate: string;
      firstName: string;
      lastName: string;
      nationality: string;
      phoneCountryCode: string;
      phoneNumber: string;
    }>,
    fieldsToClear?: string[],
  ) => void;
};

export function AgentBasicInfoStep({
  birthDate,
  firstName,
  lastName,
  nationality,
  phoneCountryCode,
  phoneNumber,
  residence,
  residenceRegion,
  validationErrors,
  onContinue,
  onFormattedNameBlur,
  onResidenceChange,
  onResidenceSelect,
  onUpdate,
}: AgentBasicInfoStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <OnboardingEyebrow>Profilo procuratore</OnboardingEyebrow>
        <AppText variant="displaySm">I tuoi dati</AppText>
        <AppText variant="bodySm" color="secondary">
          Inserisci le informazioni principali con lo stesso ritmo visivo del
          mockup Banani.
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
          label="Nazionalita' *"
          onChange={(value) => onUpdate({ nationality: value }, ["nationality"])}
          value={nationality}
        />

        <ResidenceCityInput
          errorMessage={validationErrors.residence}
          helperText={
            residenceRegion
              ? `Citta' selezionata: ${residence} · ${residenceRegion}`
              : undefined
          }
          label="Citta' *"
          onChangeText={onResidenceChange}
          onSelectCity={onResidenceSelect}
          placeholder="Es. Roma"
          value={residence}
        />

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
  row: {
    flexDirection: "row",
    gap: spacing[12],
  },
});
