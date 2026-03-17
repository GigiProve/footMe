import { useEffect, useMemo, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, View } from "react-native";

import {
  getCountryByCode,
  searchCountries,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Input } from "../../ui/Input/Input";

type NationalityAutocompleteInputProps = {
  errorMessage?: string;
  label?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

export function NationalityAutocompleteInput({
  errorMessage,
  label = "Nazionalità",
  onChange,
  placeholder = "Cerca la nazionalità",
  value,
}: NationalityAutocompleteInputProps) {
  const selectedCountry = useMemo(() => getCountryByCode(value), [value]);
  const [query, setQuery] = useState(selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : "");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : "");
  }, [selectedCountry]);

  const suggestions = useMemo(() => {
    if (!isOpen) {
      return [];
    }

    return searchCountries(query, 6);
  }, [isOpen, query]);

  return (
    <View style={{ gap: spacing[8] }}>
      <Input
        autoCapitalize="words"
        autoCorrect={false}
        label={label}
        onBlur={() => {
          setQuery(selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : "");
        }}
        onChangeText={(nextValue) => {
          setQuery(nextValue);
          setIsOpen(true);

          if (!nextValue.trim()) {
            onChange("");
          }
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        style={errorMessage ? { borderColor: colors.danger } : undefined}
        value={query}
      />
      {isOpen && suggestions.length > 0 ? (
        <View
          style={{
            maxHeight: 220,
            borderRadius: radius[20],
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            padding: spacing[10],
          }}
          testID="nationality-autocomplete-suggestions"
        >
          <ScrollView
            contentContainerStyle={{ gap: spacing[8] }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {suggestions.map((suggestion) => (
              <Pressable
                accessibilityRole="button"
                key={suggestion.code}
                onPress={() => {
                  onChange(suggestion.code);
                  setQuery(`${suggestion.flag} ${suggestion.name}`);
                  setIsOpen(false);
                  Keyboard.dismiss();
                }}
                style={({ pressed }) => ({
                  gap: spacing[4],
                  borderRadius: radius[16],
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.heroSoft : colors.surface,
                  paddingHorizontal: spacing[14],
                  paddingVertical: spacing[12],
                })}
                testID={`nationality-autocomplete-suggestion-${suggestion.code}`}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontWeight: typography.fontWeight.bold,
                  }}
                >
                  {suggestion.flag} {suggestion.name}
                </Text>
                <Text style={{ color: colors.textSecondary }}>{suggestion.code}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
