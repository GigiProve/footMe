import { useMemo, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import type { SelectOption } from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText } from "../../ui";

function ModalContent<T extends string>({
  allowClear,
  clearLabel,
  filteredOptions,
  label,
  onChange,
  onClose,
  onSearchChange,
  searchPlaceholder,
  searchQuery,
  searchable,
  value,
}: {
  allowClear: boolean;
  clearLabel: string;
  filteredOptions: SelectOption<T>[];
  label: string;
  onChange: (value: T | "") => void;
  onClose: () => void;
  onSearchChange: (query: string) => void;
  searchPlaceholder: string;
  searchQuery: string;
  searchable: boolean;
  value: T | "";
}) {
  return (
    <>
      <View style={styles.modalHeader}>
        <AppText variant="headingSm">{label}</AppText>
        <Pressable accessibilityRole="button" onPress={onClose}>
          <AppText variant="titleSm" color="accent">
            Chiudi
          </AppText>
        </Pressable>
      </View>

      {searchable ? (
        <TextInput
          autoFocus
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={searchQuery}
        />
      ) : null}

      {allowClear ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onChange("");
            onClose();
          }}
          style={styles.clearButton}
        >
          <AppText variant="titleSm">{clearLabel}</AppText>
        </Pressable>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.optionsList}
        keyboardShouldPersistTaps="handled"
      >
        {filteredOptions.map((option) => {
          const isSelected = option.value === value;
          const isDisabled = option.disabled === true;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              disabled={isDisabled}
              onPress={() => {
                onChange(option.value);
                onClose();
              }}
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
    </>
  );
}

export function SelectField<T extends string>({
  allowClear = false,
  clearLabel = "Svuota selezione",
  fullScreen = false,
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

  function handleOpen() {
    Keyboard.dismiss();
    setSearchQuery("");
    setIsOpen(true);
  }

  function handleClose() {
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
        onPress={handleOpen}
        style={styles.trigger}
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

      <Modal
        animationType="slide"
        onRequestClose={handleClose}
        transparent={!fullScreen}
        visible={isOpen}
      >
        {fullScreen ? (
          <SafeAreaView style={styles.fullScreenContainer}>
            <View style={styles.fullScreenContent}>
              <ModalContent
                allowClear={allowClear}
                clearLabel={clearLabel}
                filteredOptions={filteredOptions}
                label={label}
                onChange={onChange}
                onClose={handleClose}
                onSearchChange={setSearchQuery}
                searchPlaceholder={searchPlaceholder}
                searchQuery={searchQuery}
                searchable={searchable}
                value={value}
              />
            </View>
          </SafeAreaView>
        ) : (
          <Pressable onPress={handleClose} style={styles.backdrop}>
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={styles.sheet}
            >
              <ModalContent
                allowClear={allowClear}
                clearLabel={clearLabel}
                filteredOptions={filteredOptions}
                label={label}
                onChange={onChange}
                onClose={handleClose}
                onSearchChange={setSearchQuery}
                searchPlaceholder={searchPlaceholder}
                searchQuery={searchQuery}
                searchable={searchable}
                value={value}
              />
            </Pressable>
          </Pressable>
        )}
      </Modal>
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
  triggerText: {
    flex: 1,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  triggerPlaceholder: {
    color: colors.textMuted,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[12],
  },
  searchInput: {
    minHeight: 48,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
  },
  clearButton: {
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
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
  fullScreenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullScreenContent: {
    flex: 1,
    gap: spacing[12],
    padding: spacing[18],
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    padding: spacing[16],
  },
  sheet: {
    maxHeight: "75%",
    gap: spacing[12],
    borderRadius: radius[12],
    backgroundColor: colors.surface,
    padding: spacing[18],
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "rgba(11, 43, 64, 0.08)",
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
