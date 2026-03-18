import { useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, View } from "react-native";

import {
  isValidRegion,
  searchRegions,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Input } from "../../ui/Input/Input";

type AvailabilityRegionsSelectorProps = {
  editable?: boolean;
  hideLabel?: boolean;
  label?: string;
  onChange: (value: string[]) => void;
  placeholder?: string;
  value: string[];
};

export function AvailabilityRegionsSelector({
  editable = true,
  hideLabel = false,
  label = "Regioni in cui sei disponibile a giocare",
  onChange,
  placeholder = "Cerca una regione",
  value,
}: AvailabilityRegionsSelectorProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const validRegions = value.filter(isValidRegion);
  const suggestions = isOpen && query.trim().length >= 1
    ? searchRegions(query, validRegions, 6)
    : [];

  function handleSelect(region: string) {
    if (!validRegions.includes(region)) {
      onChange([...validRegions, region]);
    }
    setQuery("");
    setIsOpen(false);
    Keyboard.dismiss();
  }

  function handleRemove(region: string) {
    onChange(validRegions.filter((r) => r !== region));
  }

  return (
    <View style={{ gap: spacing[8] }}>
      {!hideLabel ? (
        <Text
          style={{
            color: colors.textPrimary,
            fontWeight: typography.fontWeight.bold,
          }}
        >
          {label}
        </Text>
      ) : null}
      {validRegions.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing[8],
          }}
        >
          {validRegions.map((region) => (
            <View
              key={region}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[6],
                paddingLeft: spacing[12],
                paddingRight: editable ? spacing[8] : spacing[12],
                paddingVertical: spacing[8],
                borderRadius: radius.full,
                backgroundColor: colors.accentSoft,
                borderWidth: 1,
                borderColor: colors.accentSoft,
              }}
            >
              <Text
                style={{
                  color: colors.accentStrong,
                  fontWeight: typography.fontWeight.bold,
                  fontSize: typography.fontSize[14],
                }}
              >
                {region}
              </Text>
              {editable ? (
                <Pressable
                  accessibilityLabel={`Rimuovi ${region}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => handleRemove(region)}
                >
                  <Text
                    style={{
                      color: colors.accentStrong,
                      fontWeight: typography.fontWeight.heavy,
                      fontSize: typography.fontSize[16],
                      lineHeight: typography.fontSize[16],
                    }}
                  >
                    ×
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : !editable ? (
        <Text style={{ color: colors.textSecondary }}>Da completare</Text>
      ) : null}
      {editable ? (
        <View style={{ gap: spacing[8] }}>
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
              style={{
                maxHeight: 220,
                borderRadius: radius[20],
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                padding: spacing[10],
              }}
              testID="availability-regions-suggestions"
            >
              <ScrollView
                contentContainerStyle={{ gap: spacing[8] }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {suggestions.map((suggestion) => (
                  <Pressable
                    accessibilityRole="button"
                    key={suggestion.value}
                    onPress={() => handleSelect(suggestion.value)}
                    style={({ pressed }) => ({
                      borderRadius: radius[16],
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.heroSoft : colors.surface,
                      paddingHorizontal: spacing[14],
                      paddingVertical: spacing[12],
                    })}
                    testID={`availability-region-suggestion-${suggestion.value}`}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontWeight: typography.fontWeight.bold,
                      }}
                    >
                      {suggestion.label}
                    </Text>
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
