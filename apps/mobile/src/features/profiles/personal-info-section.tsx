import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SelectField } from "../../components/ui/select-field";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Input } from "../../ui";
import {
  type ItalianCityOption,
  type SelectOption,
  getOptionLabel,
  normalizeBirthDateInput,
} from "./profile-form-utils";
import { ProfileField, ProfileSectionCard } from "./profile-screen-components";

type BirthDateInputProps = {
  editable?: boolean;
  helperText?: string;
  label: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  value: string;
};

type CityAutocompleteInputProps = {
  editable?: boolean;
  helperText?: string;
  label: string;
  onChangeText?: (value: string) => void;
  onSelectSuggestion?: (suggestion: ItalianCityOption) => void;
  placeholder?: string;
  suggestions: ItalianCityOption[];
  value: string;
};

type PersonalInfoSectionProps = {
  birthDate: string;
  birthDateHelperText?: string;
  city: string;
  cityHelperText?: string;
  citySuggestions: ItalianCityOption[];
  editable?: boolean;
  fullName: string;
  nationality: string;
  nationalityOptions: SelectOption[];
  onBirthDateChange?: (value: string) => void;
  onCityChange?: (value: string) => void;
  onCitySuggestionPress?: (suggestion: ItalianCityOption) => void;
  onFullNameChange?: (value: string) => void;
  onNationalityChange?: (value: string) => void;
  onRegionChange?: (value: string) => void;
  region: string;
  regionOptions: SelectOption[];
};

export function BirthDateInput({
  editable = false,
  helperText,
  label,
  onChange,
  placeholder = "Da completare",
  value,
}: BirthDateInputProps) {
  return (
    <ProfileField
      editable={editable}
      helperText={helperText ?? (editable ? "Formato GG/MM/AAAA" : undefined)}
      label={label}
      renderInput={
        editable
          ? () => (
              <Input
                keyboardType="number-pad"
                maxLength={10}
                onChangeText={(nextValue) => onChange?.(normalizeBirthDateInput(nextValue))}
                placeholder={placeholder}
                value={value}
              />
            )
          : undefined
      }
      value={value}
    />
  );
}

export function CityAutocompleteInput({
  editable = false,
  helperText,
  label,
  onChangeText,
  onSelectSuggestion,
  placeholder = "Da completare",
  suggestions,
  value,
}: CityAutocompleteInputProps) {
  const shouldShowSuggestions = editable && value.trim().length >= 2 && suggestions.length > 0;
  const fallbackHelperText =
    value.trim().length >= 2 && suggestions.length === 0
      ? "Nessuna città trovata nel dataset ISTAT."
      : "Scrivi almeno 2 caratteri per visualizzare i suggerimenti.";

  return (
    <ProfileField
      editable={editable}
      helperText={helperText ?? (editable ? fallbackHelperText : undefined)}
      label={label}
      renderInput={
        editable
          ? () => (
              <View style={styles.autocompleteField}>
                <Input
                  autoCapitalize="words"
                  onChangeText={onChangeText}
                  placeholder={placeholder}
                  value={value}
                />
                {shouldShowSuggestions ? (
                  <View style={styles.suggestionsSurface} testID="city-autocomplete-suggestions">
                    <ScrollView
                      contentContainerStyle={styles.suggestionsContent}
                      nestedScrollEnabled
                    >
                      {suggestions.map((suggestion) => (
                        <Pressable
                          accessibilityRole="button"
                          key={`${suggestion.name}-${suggestion.region}`}
                          onPress={() => onSelectSuggestion?.(suggestion)}
                          style={({ pressed }) => [
                            styles.suggestionButton,
                            pressed ? styles.suggestionButtonPressed : null,
                          ]}
                          testID={`city-autocomplete-suggestion-${suggestion.name}-${suggestion.region}`}
                        >
                          <Text style={styles.suggestionName}>{suggestion.name}</Text>
                          <Text style={styles.suggestionMeta}>{suggestion.region}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            )
          : undefined
      }
      value={value}
    />
  );
}

export function PersonalInfoSection({
  birthDate,
  birthDateHelperText,
  city,
  cityHelperText,
  citySuggestions,
  editable = false,
  fullName,
  nationality,
  nationalityOptions,
  onBirthDateChange,
  onCityChange,
  onCitySuggestionPress,
  onFullNameChange,
  onNationalityChange,
  onRegionChange,
  region,
  regionOptions,
}: PersonalInfoSectionProps) {
  return (
    <ProfileSectionCard
      description="Dati anagrafici, località e informazioni pubbliche di base."
      title="Informazioni personali"
    >
      <ProfileField
        editable={editable}
        helperText={editable ? "Obbligatorio · max 60 caratteri" : undefined}
        label="Nome e cognome"
        onChangeText={editable ? onFullNameChange : undefined}
        placeholder="Da completare"
        value={fullName}
      />
      <BirthDateInput
        editable={editable}
        helperText={birthDateHelperText}
        label="Data di nascita"
        onChange={onBirthDateChange}
        value={birthDate}
      />
      {editable ? (
        <SelectField
          allowClear
          clearLabel="Rimuovi la nazionalità"
          label="Nazionalità"
          onChange={(value) => onNationalityChange?.(value)}
          options={nationalityOptions}
          placeholder="Da completare"
          value={nationality}
        />
      ) : (
        <ProfileField
          label="Nazionalità"
          value={nationality ? getOptionLabel(nationalityOptions, nationality) : ""}
        />
      )}
      <CityAutocompleteInput
        editable={editable}
        helperText={cityHelperText}
        label="Città"
        onChangeText={onCityChange}
        onSelectSuggestion={onCitySuggestionPress}
        suggestions={citySuggestions}
        value={city}
      />
      {editable ? (
        <SelectField
          allowClear
          clearLabel="Rimuovi la regione"
          label="Regione"
          onChange={(value) => onRegionChange?.(value)}
          options={regionOptions}
          placeholder="Da completare"
          value={region}
        />
      ) : (
        <ProfileField label="Regione" value={region} />
      )}
    </ProfileSectionCard>
  );
}

const styles = StyleSheet.create({
  autocompleteField: {
    gap: spacing[10],
  },
  suggestionButton: {
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    gap: spacing[4],
  },
  suggestionButtonPressed: {
    opacity: 0.8,
  },
  suggestionMeta: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  suggestionName: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  suggestionsContent: {
    gap: spacing[8],
  },
  suggestionsSurface: {
    maxHeight: 220,
    borderRadius: radius[20],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing[10],
  },
});
