import { Pressable, StyleSheet, View } from "react-native";

import { INTEREST_CATEGORY_OPTIONS } from "../../features/profiles/player-sports";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText } from "../../ui/AppText/AppText";

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
  label = "Categorie di interesse",
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
    <View style={styles.container}>
      {!hideLabel ? (
        <AppText variant="bodySm" color="primary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.pillsRow}>
        {INTEREST_CATEGORY_OPTIONS.map((option) => {
          const isSelected = selectedSet.has(option.value);
          return editable ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              key={option.value}
              onPress={() => handleToggle(option.value)}
              style={[styles.pill, isSelected ? styles.pillActive : null]}
              testID={`interest-category-${option.value}`}
            >
              <AppText
                variant="bodySm"
                color={isSelected ? "accent" : "primary"}
                style={[
                  styles.pillText,
                  isSelected ? styles.pillTextActive : null,
                ]}
              >
                {option.label}
              </AppText>
            </Pressable>
          ) : isSelected ? (
            <View key={option.value} style={styles.pillReadonly}>
              <AppText
                variant="bodySm"
                color="accent"
                style={styles.pillTextActive}
              >
                {option.label}
              </AppText>
            </View>
          ) : null;
        })}
        {!editable && value.length === 0 ? (
          <AppText variant="bodySm" color="secondary">
            Da completare
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[8],
  },
  label: {
    fontWeight: typography.fontWeight.bold,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  pill: {
    minHeight: 40,
    paddingHorizontal: spacing[14],
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(10,102,194,0.18)",
  },
  pillText: {
    fontWeight: typography.fontWeight.bold,
  },
  pillTextActive: {
    fontWeight: typography.fontWeight.bold,
  },
  pillReadonly: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentSoft,
  },
});
