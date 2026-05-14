import { StyleSheet, View } from "react-native";

import { NationalityAutocompleteInput } from "../../../components/ui/nationality-autocomplete-input";
import { ResidenceCityInput } from "../../../components/ui/residence-city-input";
import { SelectField } from "../../../components/ui/select-field";
import type { ProfileGender } from "../../onboarding/create-initial-profile";
import { getNationalityCategory, getRegionFromCity, type ItalianCityOption, type SelectOption } from "../profile-form-utils";
import { PersonalInfoSection } from "../personal-info-section";
import { spacing } from "../../../theme/tokens";
import { AppText, Input, Toggle } from "../../../ui";

const GENDER_OPTIONS: { label: string; value: ProfileGender }[] = [
  { label: "Uomo", value: "male" },
  { label: "Donna", value: "female" },
  { label: "Non binary", value: "non_binary" },
  { label: "Preferisco non dirlo", value: "prefer_not_to_say" },
];

const LEGAL_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "Ho il permesso di soggiorno", value: "has_permit" },
  { label: "Non ho il permesso di soggiorno", value: "no_permit" },
  { label: "In fase di richiesta", value: "pending_permit" },
];

type Props = {
  birthDate: string;
  birthDateHelperText?: string;
  city: string;
  cityHelperText?: string;
  citySuggestions: ItalianCityOption[];
  currentLocationCity: string;
  currentLocationCountry: string;
  domicile: string;
  fullName: string;
  gender: ProfileGender | "";
  includeGender?: boolean;
  languages: string[];
  legalStatus: string;
  nationality: string;
  nationalityOptions: SelectOption[];
  onBirthDateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCitySuggestionPress: (suggestion: ItalianCityOption) => void;
  onCurrentLocationCityChange: (value: string) => void;
  onCurrentLocationCountryChange: (value: string) => void;
  onDomicileChange: (value: string) => void;
  onDomicileSelect: (suggestion: ItalianCityOption) => void;
  onFullNameChange: (value: string) => void;
  onGenderChange: (value: ProfileGender | "") => void;
  onLanguagesChange: (languages: string[]) => void;
  onLegalStatusChange: (value: string) => void;
  onNationalityChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onResidenceChange: (value: string) => void;
  onResidenceCountryChange: (value: string) => void;
  onResidenceSelect: (suggestion: ItalianCityOption) => void;
  onUseResidenceForDomicileChange: (value: boolean) => void;
  region: string;
  regionOptions: SelectOption[];
  residence: string;
  residenceCountry: string;
  showItalianDomicile?: boolean;
  useResidenceForDomicile: boolean;
};

export function OnboardingBaseFieldsSection({
  birthDate,
  birthDateHelperText,
  city,
  cityHelperText,
  citySuggestions,
  currentLocationCity,
  currentLocationCountry,
  domicile,
  fullName,
  gender,
  includeGender = true,
  languages,
  legalStatus,
  nationality,
  nationalityOptions,
  onBirthDateChange,
  onCityChange,
  onCitySuggestionPress,
  onCurrentLocationCityChange,
  onCurrentLocationCountryChange,
  onDomicileChange,
  onDomicileSelect,
  onFullNameChange,
  onGenderChange,
  onLanguagesChange,
  onLegalStatusChange,
  onNationalityChange,
  onRegionChange,
  onResidenceChange,
  onResidenceCountryChange,
  onResidenceSelect,
  onUseResidenceForDomicileChange,
  region,
  regionOptions,
  residence,
  residenceCountry,
  showItalianDomicile = true,
  useResidenceForDomicile,
}: Props) {
  const nationalityCategory = getNationalityCategory(nationality);
  const residenceRegion = getRegionFromCity(residence);
  const domicileRegion = getRegionFromCity(domicile);

  return (
    <View style={styles.container}>
      <PersonalInfoSection
        birthDate={birthDate}
        birthDateHelperText={birthDateHelperText}
        city={city}
        cityHelperText={cityHelperText}
        citySuggestions={citySuggestions}
        editable
        fullName={fullName}
        languages={languages}
        nationality={nationality}
        nationalityOptions={nationalityOptions}
        onBirthDateChange={onBirthDateChange}
        onCityChange={onCityChange}
        onCitySuggestionPress={onCitySuggestionPress}
        onFullNameChange={onFullNameChange}
        onLanguagesChange={onLanguagesChange}
        onNationalityChange={onNationalityChange}
        onRegionChange={onRegionChange}
        region={region}
        regionOptions={regionOptions}
      />

      {includeGender ? (
        <SelectField
          allowClear
          clearLabel="Rimuovi sesso"
          label="Sesso"
          onChange={(value) => onGenderChange(value as ProfileGender | "")}
          options={GENDER_OPTIONS}
          placeholder="Seleziona sesso"
          value={gender}
        />
      ) : null}

      {nationalityCategory === "italy" ? (
        <View style={styles.block}>
          <AppText variant="titleSm">Residenza e domicilio</AppText>
          <ResidenceCityInput
            helperText={
              residenceRegion
                ? `Città selezionata: ${residence} · ${residenceRegion}`
                : undefined
            }
            label="Residenza"
            onChangeText={onResidenceChange}
            onSelectCity={onResidenceSelect}
            placeholder="Es. Roma"
            value={residence}
          />
          {showItalianDomicile ? (
            <>
              <Toggle
                label="Domicilio diverso dalla residenza"
                onValueChange={(value) => onUseResidenceForDomicileChange(!value)}
                value={!useResidenceForDomicile}
              />
              {!useResidenceForDomicile ? (
                <ResidenceCityInput
                  helperText={
                    domicileRegion
                      ? `Città selezionata: ${domicile} · ${domicileRegion}`
                      : undefined
                  }
                  label="Domicilio"
                  onChangeText={onDomicileChange}
                  onSelectCity={onDomicileSelect}
                  placeholder="Es. Milano"
                  value={domicile}
                />
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {nationalityCategory !== "italy" ? (
        <View style={styles.block}>
          <AppText variant="titleSm">Residenza internazionale</AppText>
          <NationalityAutocompleteInput
            label="Paese di residenza"
            onChange={onResidenceCountryChange}
            value={residenceCountry}
          />
          <NationalityAutocompleteInput
            label="Paese attuale"
            onChange={onCurrentLocationCountryChange}
            value={currentLocationCountry}
          />
          <Input
            autoCapitalize="words"
            autoCorrect={false}
            label="Città attuale"
            onChangeText={onCurrentLocationCityChange}
            placeholder="Es. Bruxelles"
            value={currentLocationCity}
          />
          {nationalityCategory === "non_eu" ? (
            <SelectField
              allowClear
              clearLabel="Rimuovi stato legale"
              label="Stato legale"
              onChange={onLegalStatusChange}
              options={LEGAL_STATUS_OPTIONS}
              placeholder="Seleziona stato legale"
              value={legalStatus}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[12],
  },
  container: {
    gap: spacing[16],
  },
});
