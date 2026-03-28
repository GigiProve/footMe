import { useEffect, useMemo, useRef, useState } from "react";
import { type View as ViewType, Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  getCountryByCode,
  searchCountries,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText, Input } from "../../ui";
import { useKeyboardAwareScroll } from "./keyboard-aware-scroll-view";

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
  const rootRef = useRef<ViewType>(null);
  const keyboardAware = useKeyboardAwareScroll();

  useEffect(() => {
    setQuery(selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : "");
  }, [selectedCountry]);

  const suggestions = useMemo(() => {
    if (!isOpen) {
      return [];
    }

    return searchCountries(query, 6);
  }, [isOpen, query]);

  const hasSuggestions = isOpen && suggestions.length > 0;

  useEffect(() => {
    if (hasSuggestions && rootRef.current && keyboardAware) {
      keyboardAware.scrollElementToTop(rootRef.current);
    }
  }, [hasSuggestions, keyboardAware]);

  return (
    <View ref={rootRef} style={styles.root}>
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
        style={errorMessage ? styles.errorBorder : undefined}
        value={query}
      />
      {hasSuggestions ? (
        <View
          style={styles.suggestionsSurface}
          testID="nationality-autocomplete-suggestions"
        >
          <ScrollView
            contentContainerStyle={styles.suggestionsContent}
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
                style={({ pressed }) => [
                  styles.suggestionButton,
                  pressed ? styles.suggestionButtonPressed : null,
                ]}
                testID={`nationality-autocomplete-suggestion-${suggestion.code}`}
              >
                <AppText variant="titleSm">{suggestion.flag} {suggestion.name}</AppText>
                <AppText variant="bodySm" color="secondary">{suggestion.code}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  errorBorder: {
    borderColor: colors.danger,
  },
  root: {
    gap: spacing[8],
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
    backgroundColor: colors.heroSoft,
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
});
