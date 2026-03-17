import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  type ItalianCityOption,
  searchItalianCities,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Input } from "../../ui/Input/Input";

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
  const suggestions = useMemo(() => searchItalianCities(value, 6), [value]);
  const shouldShowSuggestions = value.trim().length >= 2 && suggestions.length > 0;

  return (
    <View style={{ gap: spacing[8] }}>
      <Input
        autoCapitalize="words"
        autoCorrect={false}
        label={label}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={errorMessage ? { borderColor: colors.danger } : undefined}
        value={value}
      />
      <Text style={{ color: errorMessage ? colors.danger : colors.textSecondary }}>
        {errorMessage ??
          helperText ??
          "Seleziona una città reale dai suggerimenti per salvare una residenza valida."}
      </Text>
      {shouldShowSuggestions ? (
        <View
          style={{
            maxHeight: 220,
            borderRadius: radius[20],
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            padding: spacing[10],
          }}
          testID="residence-city-suggestions"
        >
          <ScrollView contentContainerStyle={{ gap: spacing[8] }} nestedScrollEnabled>
            {suggestions.map((suggestion) => (
              <Pressable
                accessibilityRole="button"
                key={`${suggestion.name}-${suggestion.region}`}
                onPress={() => onSelectCity(suggestion)}
                style={({ pressed }) => ({
                  gap: spacing[4],
                  borderRadius: radius[16],
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.heroSoft : colors.surface,
                  paddingHorizontal: spacing[14],
                  paddingVertical: spacing[12],
                })}
                testID={`residence-city-suggestion-${suggestion.name}-${suggestion.region}`}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontWeight: typography.fontWeight.bold,
                  }}
                >
                  {suggestion.name}
                </Text>
                <Text style={{ color: colors.textSecondary }}>{suggestion.region}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
