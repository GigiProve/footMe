import { useMemo, useState } from "react";
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import type { SelectOption } from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText } from "../../ui";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_DROPDOWN_HEIGHT = 264;

type MultiSelectFieldProps<T extends string> = {
  label: string;
  onChange: (value: T[]) => void;
  options: SelectOption<T>[];
  placeholder: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  value: T[];
};

export function MultiSelectField<T extends string>({
  label,
  onChange,
  options,
  placeholder,
  searchable = false,
  searchPlaceholder = "Cerca...",
  value,
}: MultiSelectFieldProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedSet = useMemo(() => new Set(value), [value]);

  const selectedLabel = useMemo(() => {
    if (value.length === 0) {
      return "";
    }

    return options
      .filter((option) => selectedSet.has(option.value))
      .map((option) => option.label)
      .join(", ");
  }, [options, selectedSet, value.length]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const query = searchQuery.trim().toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [options, searchable, searchQuery]);

  function toggleDropdown() {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (isOpen) {
      setSearchQuery("");
      setIsOpen(false);
    } else {
      setSearchQuery("");
      setIsOpen(true);
    }
  }

  function toggleValue(nextValue: T) {
    const hasValue = selectedSet.has(nextValue);
    const next = hasValue
      ? value.filter((entry) => entry !== nextValue)
      : [...value, nextValue];
    onChange(next);
  }

  function clearSelection() {
    onChange([]);
  }

  return (
    <View style={styles.container}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>

      <Pressable
        accessibilityRole="button"
        onPress={toggleDropdown}
        style={[styles.trigger, isOpen && styles.triggerOpen]}
      >
        <AppText
          variant="bodySm"
          style={[
            styles.triggerText,
            !selectedLabel && styles.triggerPlaceholder,
          ]}
        >
          {selectedLabel || placeholder}
        </AppText>
        <Ionicons
          color={colors.textMuted}
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={20}
        />
      </Pressable>

      {isOpen ? (
        <View style={styles.dropdownCard}>
          {searchable ? (
            <TextInput
              autoFocus
              onChangeText={setSearchQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              value={searchQuery}
            />
          ) : null}

          {value.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={clearSelection}
              style={styles.clearButton}
            >
              <AppText variant="bodySm" color="muted">
                Svuota selezione
              </AppText>
            </Pressable>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.optionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.optionsScroll}
          >
            {filteredOptions.map((option) => {
              const isSelected = selectedSet.has(option.value);
              const isDisabled = option.disabled === true;

              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  disabled={isDisabled}
                  key={option.value}
                  onPress={() => toggleValue(option.value)}
                  style={[
                    styles.option,
                    isSelected && styles.optionActive,
                    isDisabled && styles.optionDisabled,
                  ]}
                >
                  <AppText
                    variant="bodySm"
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextActive,
                      isDisabled && styles.optionTextDisabled,
                    ]}
                  >
                    {option.label}
                  </AppText>
                  {isSelected ? (
                    <Ionicons
                      color={colors.accentStrong}
                      name="checkmark"
                      size={18}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clearButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing[12],
    borderRadius: radius[6],
    marginBottom: spacing[4],
  },
  container: {
    gap: spacing[6],
  },
  dropdownCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius[8],
    borderBottomRightRadius: radius[8],
    padding: spacing[8],
    shadowColor: "rgba(11, 43, 64, 0.08)",
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    borderRadius: radius[6],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[12],
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
  },
  optionDisabled: {
    opacity: 0.45,
  },
  optionText: {
    flex: 1,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  optionTextActive: {
    color: colors.accentStrong,
    fontWeight: typography.fontWeight.semibold,
  },
  optionTextDisabled: {
    color: colors.textMuted,
  },
  optionsList: {
    gap: spacing[4],
  },
  optionsScroll: {
    maxHeight: MAX_DROPDOWN_HEIGHT,
  },
  searchInput: {
    minHeight: 44,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[6],
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing[4],
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: spacing[16],
    gap: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
    backgroundColor: colors.surfaceMuted,
  },
  triggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  triggerPlaceholder: {
    color: colors.textMuted,
  },
  triggerText: {
    flex: 1,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
});
