import { useMemo, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, typography } from "../../../styles";
import { AppText } from "../../../ui";
import { BottomSheetSelector, type SelectorOption } from "./BottomSheetSelector";
import { FieldShell } from "./FieldShell";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

type OnboardingSelectFieldProps<T extends string> = {
  label?: string;
  placeholder: string;
  value: T | "";
  options: SelectorOption<T>[];
  onChange: (value: T | "") => void;
  /** Titolo dello sheet. Se omesso usa la label del campo. */
  sheetTitle?: string;
  searchable?: boolean;
  allowClear?: boolean;
  helperText?: string;
  errorMessage?: string;
  optional?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadErrorMessage?: string;
  onRetry?: () => void;
  onOpen?: () => void;
  testID?: string;
};

/**
 * Scelta singola su lista lunga (§L): una riga compatta che apre il bottom
 * sheet condiviso. Nessuna chip riepilogativa sotto il campo.
 */
export function OnboardingSelectField<T extends string>({
  allowClear = false,
  disabled = false,
  errorMessage,
  helperText,
  label,
  loadErrorMessage,
  loading = false,
  onChange,
  onOpen,
  onRetry,
  optional,
  options,
  placeholder,
  searchable = false,
  sheetTitle,
  testID,
  value,
}: OnboardingSelectFieldProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label,
    [options, value],
  );

  return (
    <FieldShell
      errorMessage={errorMessage}
      helperText={helperText}
      label={label}
      optional={optional}
    >
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityValue={{ text: selectedLabel ?? "Nessuna selezione" }}
        disabled={disabled}
        onPress={() => {
          onOpen?.();
          setIsOpen(true);
        }}
        style={({ pressed }) => [
          styles.control,
          errorMessage ? styles.error : null,
          disabled ? styles.disabled : null,
          pressed ? styles.pressed : null,
        ]}
        testID={testID}
      >
        <AppText
          color={selectedLabel ? "primary" : "muted"}
          numberOfLines={1}
          style={styles.value}
        >
          {selectedLabel ?? placeholder}
        </AppText>
        <Ionicons
          color={colors.textMuted}
          name="chevron-forward"
          size={18}
        />
      </Pressable>

      <BottomSheetSelector
        allowClear={allowClear}
        errorMessage={loadErrorMessage}
        loading={loading}
        mode="single"
        onChange={onChange}
        onClose={() => setIsOpen(false)}
        onRetry={onRetry}
        options={options}
        searchable={searchable}
        title={sheetTitle ?? label ?? placeholder}
        value={value}
        visible={isOpen}
      />
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  control: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    gap: onboardingSpacing.s,
    minHeight: onboardingLayout.controlHeight,
    paddingHorizontal: onboardingSpacing.m - 2,
  },
  error: {
    borderColor: colors.danger,
    borderWidth: onboardingBorderWidth.selected,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    flex: 1,
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
  },
});
