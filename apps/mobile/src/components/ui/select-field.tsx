import { useMemo, useState } from "react";
import {
  Keyboard,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  Platform,
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

export function SelectField<T extends string>({
  allowClear = false,
  clearLabel = "Svuota selezione",
  fullScreen: _fullScreen,
  label,
  onChange,
  options,
  placeholder,
  searchable = false,
  searchPlaceholder = "Cerca...",
  value,
}: {
  allowClear?: boolean;
  clearLabel?: string;
  /** @deprecated No longer used — dropdown expands inline */
  fullScreen?: boolean;
  label: string;
  onChange: (value: T | "") => void;
  options: SelectOption<T>[];
  placeholder: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  value: T | "";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const query = searchQuery.trim().toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [options, searchable, searchQuery]);

  function toggle() {
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

  function handleSelect(selected: T | "") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onChange(selected);
    setSearchQuery("");
    setIsOpen(false);
  }

  return (
    <View style={styles.container}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>

      <Pressable
        accessibilityRole="button"
        onPress={toggle}
        style={[styles.trigger, isOpen && styles.triggerOpen]}
      >
        <AppText
          variant="bodySm"
          style={[
            styles.triggerText,
            !selectedLabel && styles.triggerPlaceholder,
          ]}
        >
          {selectedLabel ?? placeholder}
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

          {allowClear ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => handleSelect("")}
              style={styles.clearButton}
            >
              <AppText variant="bodySm" color="muted">
                {clearLabel}
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
              const isSelected = option.value === value;
              const isDisabled = option.disabled === true;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  disabled={isDisabled}
                  onPress={() => handleSelect(option.value)}
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
  container: {
    gap: spacing[6],
  },
  label: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
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
  triggerText: {
    flex: 1,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  triggerPlaceholder: {
    color: colors.textMuted,
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
  clearButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing[12],
    borderRadius: radius[6],
    marginBottom: spacing[4],
  },
  optionsScroll: {
    maxHeight: MAX_DROPDOWN_HEIGHT,
  },
  optionsList: {
    gap: spacing[4],
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[12],
    minHeight: 44,
    paddingHorizontal: spacing[12],
    borderRadius: radius[8],
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
  },
  optionDisabled: {
    opacity: 0.4,
  },
  optionText: {
    flex: 1,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  optionTextActive: {
    color: colors.accentStrong,
    fontWeight: typography.fontWeight.semibold,
  },
  optionTextDisabled: {
    color: colors.textMuted,
  },
});
