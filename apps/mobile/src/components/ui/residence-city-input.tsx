import { useEffect, useMemo, useRef, useState } from "react";
import { type View as ViewType, Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  type ItalianCityOption,
  searchItalianCities,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText, Input } from "../../ui";
import { useKeyboardAwareScroll } from "./keyboard-aware-scroll-view";

type ResidenceCityInputProps = {
  errorMessage?: string;
  helperText?: string;
  label?: string;
  onChangeText: (value: string) => void;
  onSelectCity: (value: ItalianCityOption) => void;
  placeholder?: string;
  value: string;
};

export function ResidenceCityInput({
  errorMessage,
  helperText,
  label = "Residenza",
  onChangeText,
  onSelectCity,
  placeholder = "Cerca la tua città",
  value,
}: ResidenceCityInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const suggestions = useMemo(() => searchItalianCities(value, 6), [value]);
  const shouldShowSuggestions = isOpen && value.trim().length >= 2 && suggestions.length > 0;
  const rootRef = useRef<ViewType>(null);
  const keyboardAware = useKeyboardAwareScroll();

  useEffect(() => {
    if (shouldShowSuggestions && rootRef.current && keyboardAware) {
      keyboardAware.scrollElementToTop(rootRef.current);
    }
  }, [shouldShowSuggestions, keyboardAware]);

  return (
    <View ref={rootRef} style={styles.root}>
      <Input
        autoCapitalize="words"
        autoCorrect={false}
        label={label}
        onChangeText={(nextValue) => {
          setIsOpen(true);
          onChangeText(nextValue);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        style={errorMessage ? styles.errorBorder : undefined}
        value={value}
      />
      <AppText variant="bodySm" color={errorMessage ? "danger" : "secondary"}>
        {errorMessage ??
          helperText ??
          "Scrivi almeno 2 caratteri per vedere città reali e scegliere il suggerimento corretto."}
      </AppText>
      {shouldShowSuggestions ? (
        <View
          style={styles.suggestionsSurface}
          testID="residence-city-suggestions"
        >
          <ScrollView contentContainerStyle={styles.suggestionsContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {suggestions.map((suggestion) => (
              <Pressable
                accessibilityRole="button"
                key={`${suggestion.name}-${suggestion.region}`}
                onPress={() => {
                  setIsOpen(false);
                  onSelectCity(suggestion);
                  Keyboard.dismiss();
                }}
                style={({ pressed }) => [
                  styles.suggestionButton,
                  pressed ? styles.suggestionButtonPressed : null,
                ]}
                testID={`residence-city-suggestion-${suggestion.name}-${suggestion.region}`}
              >
                <AppText variant="titleSm">{suggestion.name}</AppText>
                <AppText variant="bodySm" color="secondary">{suggestion.region}</AppText>
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
