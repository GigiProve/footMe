import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { INTEREST_CATEGORY_OPTIONS } from "../../features/profiles/player-sports";
import { colors, radius, spacing, typography } from "../../theme/tokens";

type InterestCategoriesSelectorProps = {
  editable?: boolean;
  hideLabel?: boolean;
  label?: string;
  onChange: (value: string[]) => void;
  value: string[];
};

export function InterestCategoriesSelector({
  editable = true,
  hideLabel = false,
  label = "Categorie in cui sei interessato a giocare",
  onChange,
  value,
}: InterestCategoriesSelectorProps) {
  const selectedSet = new Set(value);

  function handleToggle(category: string) {
    if (selectedSet.has(category)) {
      onChange(value.filter((v) => v !== category));
    } else {
      onChange([...value, category]);
    }
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
      {editable ? (
        <View style={{ gap: spacing[6] }}>
          {INTEREST_CATEGORY_OPTIONS.map((option) => {
            const isSelected = selectedSet.has(option.value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                key={option.value}
                onPress={() => handleToggle(option.value)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[12],
                  paddingHorizontal: spacing[14],
                  paddingVertical: spacing[12],
                  borderRadius: radius[16],
                  borderWidth: 1,
                  borderColor: isSelected ? colors.hero : colors.border,
                  backgroundColor: pressed
                    ? colors.heroSoft
                    : isSelected
                      ? colors.heroSoft
                      : colors.surface,
                })}
                testID={`interest-category-${option.value}`}
              >
                <Ionicons
                  color={isSelected ? colors.hero : colors.border}
                  name={isSelected ? "checkbox" : "square-outline"}
                  size={22}
                />
                <Text
                  style={{
                    flex: 1,
                    color: colors.textPrimary,
                    fontWeight: isSelected
                      ? typography.fontWeight.bold
                      : typography.fontWeight.regular,
                    fontSize: typography.fontSize[16],
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : value.length > 0 ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing[8],
          }}
        >
          {value.map((category) => (
            <View
              key={category}
              style={{
                paddingHorizontal: spacing[12],
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
                {category}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.textSecondary }}>Da completare</Text>
      )}
    </View>
  );
}
