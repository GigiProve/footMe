import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { SelectField } from "../../components/ui/select-field";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText, Input } from "../../ui";
import {
  type ItalianCityOption,
  type SelectOption,
  LANGUAGE_OPTIONS,
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
  languages: string[];
  nationality: string;
  nationalityOptions: SelectOption[];
  onBirthDateChange?: (value: string) => void;
  onCityChange?: (value: string) => void;
  onCitySuggestionPress?: (suggestion: ItalianCityOption) => void;
  onFullNameChange?: (value: string) => void;
  onLanguagesChange?: (languages: string[]) => void;
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
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const shouldShowSuggestions =
    editable && suggestionsOpen && value.trim().length >= 2 && suggestions.length > 0;
  const fallbackHelperText =
    value.trim().length >= 2 && suggestions.length === 0
      ? "Nessuna città trovata nel dataset ISTAT."
      : "Scrivi almeno 2 caratteri per visualizzare i suggerimenti.";

  function handleChangeText(next: string) {
    setSuggestionsOpen(true);
    onChangeText?.(next);
  }

  function handleSelect(suggestion: ItalianCityOption) {
    setSuggestionsOpen(false);
    onSelectSuggestion?.(suggestion);
  }

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
                  onChangeText={handleChangeText}
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
                          onPress={() => handleSelect(suggestion)}
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

// ---------------------------------------------------------------------------
// LanguageMultiSelect
// ---------------------------------------------------------------------------

import { Keyboard, Modal, SafeAreaView, TextInput } from "react-native";

function LanguageMultiSelect({
  languages,
  modalOpen,
  onClose,
  onOpen,
  onToggle,
}: {
  languages: string[];
  modalOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  onToggle: (code: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filteredOptions = search.trim()
    ? LANGUAGE_OPTIONS.filter((o) =>
        o.label.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : LANGUAGE_OPTIONS;

  function handleOpen() {
    Keyboard.dismiss();
    setSearch("");
    onOpen();
  }

  function handleClose() {
    setSearch("");
    onClose();
  }

  const displayLabel =
    languages.length > 0
      ? languages
          .map((c) => LANGUAGE_OPTIONS.find((o) => o.value === c)?.label ?? c)
          .join(", ")
      : undefined;

  return (
    <View style={styles.languageField}>
      <AppText variant="titleSm">Lingue parlate</AppText>
      <Pressable
        accessibilityRole="button"
        onPress={handleOpen}
        style={[
          styles.languageTrigger,
          displayLabel ? styles.languageTriggerFilled : null,
        ]}
      >
        <AppText
          variant="bodySm"
          color={displayLabel ? "primary" : "muted"}
          style={displayLabel ? styles.languageTriggerTextBold : undefined}
        >
          {displayLabel ?? "Seleziona le lingue parlate"}
        </AppText>
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={handleClose}
        visible={modalOpen}
      >
        <SafeAreaView style={styles.langModalRoot}>
          <View style={styles.langModalHeader}>
            <AppText variant="headingSm" style={styles.langModalTitle}>
              Lingue parlate
            </AppText>
            <Pressable accessibilityRole="button" onPress={handleClose}>
              <AppText variant="titleSm" color="accent">
                Chiudi
              </AppText>
            </Pressable>
          </View>

          <TextInput
            autoFocus
            onChangeText={setSearch}
            placeholder="Cerca lingua..."
            placeholderTextColor={colors.textMuted}
            style={styles.langSearchInput}
            value={search}
          />

          {languages.length > 0 ? (
            <View style={styles.langSelectedRow}>
              <ScrollView
                contentContainerStyle={styles.langChipsContent}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {languages.map((code) => {
                  const label =
                    LANGUAGE_OPTIONS.find((o) => o.value === code)?.label ?? code;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={code}
                      onPress={() => onToggle(code)}
                      style={styles.langChip}
                    >
                      <AppText variant="caption" color="accent">
                        {label}
                      </AppText>
                      <Ionicons
                        color={colors.accentStrong}
                        name="close"
                        size={14}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.langListContent}
            keyboardShouldPersistTaps="handled"
          >
            {filteredOptions.map((option) => {
              const isSelected = languages.includes(option.value);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => onToggle(option.value)}
                  style={[
                    styles.langOption,
                    isSelected ? styles.langOptionSelected : null,
                  ]}
                >
                  <AppText
                    variant="bodySm"
                    style={isSelected ? styles.langOptionTextSelected : undefined}
                  >
                    {option.label}
                  </AppText>
                  {isSelected ? (
                    <Ionicons
                      color={colors.accentStrong}
                      name="checkmark"
                      size={20}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
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
  languages,
  nationality,
  nationalityOptions,
  onBirthDateChange,
  onCityChange,
  onCitySuggestionPress,
  onFullNameChange,
  onLanguagesChange,
  onNationalityChange,
  onRegionChange,
  region,
  regionOptions,
}: PersonalInfoSectionProps) {
  const [langModalOpen, setLangModalOpen] = useState(false);

  const languageLabels = languages
    .map((code) => LANGUAGE_OPTIONS.find((o) => o.value === code)?.label ?? code)
    .join(", ");

  function toggleLanguage(code: string) {
    if (!onLanguagesChange) return;
    if (languages.includes(code)) {
      onLanguagesChange(languages.filter((l) => l !== code));
    } else {
      onLanguagesChange([...languages, code]);
    }
  }

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

      {editable ? (
        <LanguageMultiSelect
          languages={languages}
          modalOpen={langModalOpen}
          onClose={() => setLangModalOpen(false)}
          onOpen={() => setLangModalOpen(true)}
          onToggle={toggleLanguage}
        />
      ) : (
        <ProfileField label="Lingue parlate" value={languageLabels} />
      )}
    </ProfileSectionCard>
  );
}

const styles = StyleSheet.create({
  autocompleteField: {
    gap: spacing[10],
  },
  suggestionButton: {
    borderRadius: radius[12],
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
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing[10],
  },

  // Language multi-select
  languageField: {
    gap: spacing[8],
  },
  languageTrigger: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[12],
    backgroundColor: colors.background,
  },
  languageTriggerFilled: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  languageTriggerTextBold: {
    fontWeight: typography.fontWeight.bold,
  },

  // Language modal
  langModalRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  langModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[14],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  langModalTitle: {
    flex: 1,
  },
  langSearchInput: {
    minHeight: 48,
    marginHorizontal: spacing[20],
    marginTop: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[12],
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
  },
  langSelectedRow: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[10],
  },
  langChipsContent: {
    gap: spacing[8],
  },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentStrong,
  },
  langListContent: {
    padding: spacing[20],
    gap: spacing[8],
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  langOptionSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  langOptionTextSelected: {
    fontWeight: typography.fontWeight.bold,
  },
});
