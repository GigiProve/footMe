import { useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  isValidProvince,
  searchProvinces,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText } from "../../ui/AppText/AppText";
import { Input } from "../../ui/Input/Input";

type AvailabilityProvincesSelectorProps = {
  editable?: boolean;
  hideLabel?: boolean;
  label?: string;
  onChange: (value: string[]) => void;
  placeholder?: string;
  value: string[];
};

export function AvailabilityProvincesSelector({
  editable = true,
  hideLabel = false,
  label = "Province di interesse",
  onChange,
  placeholder = "Cerca una provincia",
  value,
}: AvailabilityProvincesSelectorProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const validProvinces = value.filter(isValidProvince);
  const suggestions =
    isOpen && query.trim().length >= 1
      ? searchProvinces(query, validProvinces, 6)
      : [];

  function handleSelect(province: string) {
    if (!validProvinces.includes(province)) {
      onChange([...validProvinces, province]);
    }
    setQuery("");
    setIsOpen(false);
    Keyboard.dismiss();
  }

  function handleRemove(province: string) {
    onChange(validProvinces.filter((p) => p !== province));
  }

  return (
    <View style={styles.container}>
      {!hideLabel ? (
        <AppText variant="bodySm" color="primary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      {validProvinces.length > 0 ? (
        <View style={styles.chipsRow}>
          {validProvinces.map((province) => (
            <View key={province} style={styles.chip}>
              <AppText variant="bodySm" color="accentStrong" style={styles.chipText}>
                {province}
              </AppText>
              {editable ? (
                <Pressable
                  accessibilityLabel={`Rimuovi ${province}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => handleRemove(province)}
                  style={styles.chipRemove}
                >
                  <AppText variant="bodyLg" color="accentStrong" style={styles.chipRemoveText}>
                    ×
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : !editable ? (
        <AppText variant="bodySm" color="secondary">
          Da completare
        </AppText>
      ) : null}
      {editable ? (
        <View style={styles.inputGroup}>
          <Input
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={(nextValue) => {
              setQuery(nextValue);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            value={query}
          />
          {suggestions.length > 0 ? (
            <View
              style={styles.suggestionsSurface}
              testID="availability-provinces-suggestions"
            >
              <ScrollView
                contentContainerStyle={styles.suggestionsContent}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {suggestions.map((suggestion) => (
                  <Pressable
                    accessibilityRole="button"
                    key={suggestion.value}
                    onPress={() => handleSelect(suggestion.value)}
                    style={({ pressed }) => [
                      styles.suggestionButton,
                      pressed ? styles.suggestionButtonPressed : null,
                    ]}
                    testID={`availability-province-suggestion-${suggestion.value}`}
                  >
                    <AppText variant="bodySm" color="primary" style={styles.suggestionText}>
                      {suggestion.label}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[8],
  },
  label: {
    fontWeight: "700",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingLeft: spacing[12],
    paddingRight: spacing[8],
    paddingVertical: spacing[8],
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentSoft,
  },
  chipText: {
    fontWeight: "700",
  },
  chipRemove: {
    paddingHorizontal: spacing[4],
  },
  chipRemoveText: {
    fontWeight: "800",
    lineHeight: 16,
  },
  inputGroup: {
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
  suggestionsContent: {
    gap: spacing[8],
  },
  suggestionButton: {
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  suggestionButtonPressed: {
    backgroundColor: colors.heroSoft,
  },
  suggestionText: {
    fontWeight: "700",
  },
});
