import { useEffect, useRef, useState } from "react";
import {
  type View as ViewType,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useKeyboardAwareScroll } from "../../../components/ui/keyboard-aware-scroll-view";
import {
  type ItalianCityOption,
  searchItalianCities,
} from "../../profiles/profile-form-utils";
import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import { OnboardingTextField } from "./OnboardingTextField";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 6;

type CityAutocompleteFieldProps = {
  label?: string;
  placeholder?: string;
  value: string;
  /** Regione del comune già scelto: conferma la selezione senza spiegarla. */
  selectedRegion?: string;
  onChangeText: (value: string) => void;
  onSelectCity: (value: ItalianCityOption) => void;
  errorMessage?: string;
  testID?: string;
};

/**
 * Ricerca di un comune italiano (REV-ONB-05 §AC).
 *
 * I suggerimenti compaiono mentre si scrive: il comportamento si spiega da
 * sé, quindi sotto al campo non c'è nessuna istruzione sul numero minimo di
 * caratteri. Quello che si salva è il comune normalizzato, con la sua
 * regione, non la stringa digitata.
 */
export function CityAutocompleteField({
  errorMessage,
  label = "Città",
  onChangeText,
  onSelectCity,
  placeholder = "Cerca città",
  selectedRegion,
  testID,
  value,
}: CityAutocompleteFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<ViewType>(null);
  const keyboardAware = useKeyboardAwareScroll();

  const suggestions =
    isOpen && value.trim().length >= MIN_QUERY_LENGTH
      ? searchItalianCities(value, MAX_SUGGESTIONS)
      : [];
  const showSuggestions = suggestions.length > 0;

  useEffect(() => {
    if (showSuggestions && rootRef.current && keyboardAware) {
      keyboardAware.scrollElementToTop(rootRef.current);
    }
  }, [keyboardAware, showSuggestions]);

  return (
    <View ref={rootRef} style={styles.root} testID={testID}>
      <OnboardingTextField
        autoCapitalize="words"
        autoCorrect={false}
        errorMessage={errorMessage}
        helperText={
          !showSuggestions && selectedRegion && value.trim()
            ? selectedRegion
            : undefined
        }
        label={label}
        onChangeText={(next) => {
          setIsOpen(true);
          onChangeText(next);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        trailing={
          <Ionicons color={colors.textMuted} name="search" size={18} />
        }
        value={value}
      />

      {showSuggestions ? (
        <View style={styles.suggestions} testID="city-autocomplete-suggestions">
          {suggestions.map((suggestion, index) => (
            <Pressable
              accessibilityRole="button"
              key={`${suggestion.name}-${suggestion.region}`}
              onPress={() => {
                setIsOpen(false);
                onSelectCity(suggestion);
                Keyboard.dismiss();
              }}
              style={({ pressed }) => [
                styles.suggestion,
                index > 0 ? styles.suggestionDivided : null,
                pressed ? styles.suggestionPressed : null,
              ]}
            >
              <AppText variant="titleSm">{suggestion.name}</AppText>
              <AppText color="secondary" variant="meta">
                {suggestion.region}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: onboardingSpacing.s,
  },
  suggestions: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    overflow: "hidden",
  },
  suggestion: {
    gap: 2,
    paddingHorizontal: onboardingSpacing.m - 2,
    paddingVertical: onboardingSpacing.s + 2,
  },
  suggestionDivided: {
    borderTopColor: colors.divider,
    borderTopWidth: onboardingBorderWidth.hairline,
  },
  suggestionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
