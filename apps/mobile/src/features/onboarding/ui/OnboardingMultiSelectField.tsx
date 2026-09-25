import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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

/** Etichette mostrate per esteso nel riepilogo prima di passare al "+N". */
const SUMMARY_VISIBLE_COUNT = 3;

type OnboardingMultiSelectFieldProps<T extends string> = {
  label?: string;
  placeholder: string;
  values: T[];
  options: SelectorOption<T>[];
  onChange: (values: T[]) => void;
  sheetTitle?: string;
  searchable?: boolean;
  maxSelection?: number;
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

export function buildSelectionSummary(labels: string[]) {
  if (labels.length === 0) {
    return "";
  }

  const visible = labels.slice(0, SUMMARY_VISIBLE_COUNT);
  const hidden = labels.length - visible.length;

  return hidden > 0 ? `${visible.join(", ")} +${hidden}` : visible.join(", ");
}

/**
 * Scelta multipla su dataset lungo (§M): riga con riepilogo "A, B, C +2" che
 * apre il bottom sheet. La selezione non viene mai replicata come nuvola di
 * chip sotto il campo.
 */
export function OnboardingMultiSelectField<T extends string>({
  disabled = false,
  errorMessage,
  helperText,
  label,
  loadErrorMessage,
  loading = false,
  maxSelection,
  onChange,
  onOpen,
  onRetry,
  optional,
  options,
  placeholder,
  searchable = false,
  sheetTitle,
  testID,
  values,
}: OnboardingMultiSelectFieldProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const summary = useMemo(() => {
    const labels = values
      .map((value) => options.find((option) => option.value === value)?.label)
      .filter((entry): entry is string => Boolean(entry));

    return buildSelectionSummary(labels);
  }, [options, values]);

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
        accessibilityValue={{ text: summary || "Nessuna selezione" }}
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
        <View style={styles.valueGroup}>
          <AppText
            color={summary ? "primary" : "muted"}
            numberOfLines={2}
            style={styles.value}
          >
            {summary || placeholder}
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      </Pressable>

      <BottomSheetSelector
        errorMessage={loadErrorMessage}
        loading={loading}
        maxSelection={maxSelection}
        mode="multi"
        onClose={() => setIsOpen(false)}
        onConfirm={onChange}
        onRetry={onRetry}
        options={options}
        searchable={searchable}
        title={sheetTitle ?? label ?? placeholder}
        values={values}
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
    paddingVertical: onboardingSpacing.s,
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
  valueGroup: {
    flex: 1,
  },
  value: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
  },
});
