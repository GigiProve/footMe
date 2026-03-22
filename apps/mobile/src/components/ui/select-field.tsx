import { useMemo, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import type { SelectOption } from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";

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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing[12],
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: typography.fontSize[18],
            fontWeight: typography.fontWeight.heavy,
          }}
        >
          {label}
        </Text>
        <Pressable accessibilityRole="button" onPress={onClose}>
          <Text
            style={{
              color: colors.accentStrong,
              fontWeight: typography.fontWeight.bold,
            }}
          >
            Chiudi
          </Text>
        </Pressable>
      </View>

      {searchable ? (
        <TextInput
          autoFocus
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          style={{
            minHeight: 48,
            paddingHorizontal: spacing[16],
            paddingVertical: spacing[12],
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius[16],
            backgroundColor: colors.background,
            color: colors.textPrimary,
            fontSize: typography.fontSize[16],
          }}
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
          style={{
            borderRadius: radius[16],
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            paddingHorizontal: spacing[14],
            paddingVertical: spacing[12],
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
            {clearLabel}
          </Text>
        </Pressable>
      ) : null}

      <ScrollView contentContainerStyle={{ gap: spacing[8] }} keyboardShouldPersistTaps="handled">
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
              style={{
                borderRadius: radius[16],
                borderWidth: 1,
                borderColor: isSelected ? colors.accentStrong : colors.border,
                backgroundColor: isDisabled
                  ? colors.surfaceMuted
                  : isSelected
                    ? colors.accentSoft
                    : colors.background,
                paddingHorizontal: spacing[14],
                paddingVertical: spacing[12],
                opacity: isDisabled ? 0.4 : 1,
              }}
            >
              <Text
                style={{
                  color: isDisabled ? colors.textMuted : colors.textPrimary,
                  fontWeight: isSelected
                    ? typography.fontWeight.heavy
                    : typography.fontWeight.regular,
                }}
              >
                {option.label}
              </Text>
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
    return options.filter((option) => option.label.toLowerCase().includes(query));
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
    <View style={{ gap: spacing[8] }}>
      <Text
        style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={handleOpen}
        style={{
          minHeight: 52,
          justifyContent: "center",
          paddingHorizontal: spacing[16],
          paddingVertical: spacing[14],
          borderWidth: 1,
          borderColor: isOpen ? colors.accentStrong : colors.border,
          borderRadius: radius[16],
          backgroundColor: selectedLabel ? colors.accentSoft : colors.background,
        }}
      >
        <Text
          style={{
            color: selectedLabel ? colors.textPrimary : colors.textMuted,
            fontWeight: selectedLabel
              ? typography.fontWeight.bold
              : typography.fontWeight.regular,
          }}
        >
          {selectedLabel ?? placeholder}
        </Text>
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={handleClose}
        transparent={!fullScreen}
        visible={isOpen}
      >
        {fullScreen ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View
              style={{
                flex: 1,
                gap: spacing[12],
                padding: spacing[18],
              }}
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
            </View>
          </SafeAreaView>
        ) : (
          <Pressable
            onPress={handleClose}
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(15, 23, 42, 0.45)",
              padding: spacing[16],
            }}
          >
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={{
                maxHeight: "75%",
                gap: spacing[12],
                borderRadius: radius[24],
                backgroundColor: colors.surface,
                padding: spacing[18],
                borderWidth: 1,
                borderColor: colors.border,
              }}
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
