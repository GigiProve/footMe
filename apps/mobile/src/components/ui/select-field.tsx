import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import type { SelectOption } from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";

export function SelectField<T extends string>({
  allowClear = false,
  clearLabel = "Svuota selezione",
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  allowClear?: boolean;
  clearLabel?: string;
  label: string;
  onChange: (value: T | "") => void;
  options: SelectOption<T>[];
  placeholder: string;
  value: T | "";
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value],
  );

  return (
    <View style={{ gap: spacing[8] }}>
      <Text
        style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
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
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <Pressable
          onPress={() => setIsOpen(false)}
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
              <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)}>
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

            {allowClear ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange("");
                  setIsOpen(false);
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

            <ScrollView contentContainerStyle={{ gap: spacing[8] }}>
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    onPress={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    style={{
                      borderRadius: radius[16],
                      borderWidth: 1,
                      borderColor: isSelected ? colors.accentStrong : colors.border,
                      backgroundColor: isSelected
                        ? colors.accentSoft
                        : colors.background,
                      paddingHorizontal: spacing[14],
                      paddingVertical: spacing[12],
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
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
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
