import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, typography } from "../../../styles";
import { AppText, BottomSheet, Button } from "../../../ui";
import { FieldShell } from "./FieldShell";
import {
  buildDateSelectorValue,
  buildSeasonOptions,
  buildYearOptions,
  formatDateSelectorValue,
  getDaysInMonth,
  MONTH_NAMES,
  parseDateSelectorValue,
  type DateSelectorMode,
} from "./date-selector-utils";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

const COLUMN_HEIGHT = 240;
const DEFAULT_FIRST_YEAR = 1950;
const SEASON_COUNT = 40;

type DateSelectorProps = {
  label?: string;
  /**
   * Valore canonico: "2026-01-12" (date), "2026-01" (monthYear),
   * "2026" (year), "2023/24" (season).
   */
  value: string;
  onChange: (value: string) => void;
  mode?: DateSelectorMode;
  placeholder?: string;
  sheetTitle?: string;
  firstYear?: number;
  lastYear?: number;
  helperText?: string;
  errorMessage?: string;
  optional?: boolean;
  disabled?: boolean;
  testID?: string;
};

/**
 * Selettore di periodo condiviso (§Y): una sola riga per una data, mai
 * quattro campi separati per mese e anno di inizio e di fine.
 */
export function DateSelector({
  disabled = false,
  errorMessage,
  firstYear = DEFAULT_FIRST_YEAR,
  helperText,
  label,
  lastYear,
  mode = "date",
  onChange,
  optional,
  placeholder = "Seleziona",
  sheetTitle,
  testID,
  value,
}: DateSelectorProps) {
  const maxYear = lastYear ?? new Date().getFullYear() + 1;
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseDateSelectorValue(mode, value));

  useEffect(() => {
    if (isOpen) {
      setDraft(parseDateSelectorValue(mode, value));
    }
  }, [isOpen, mode, value]);

  const years = useMemo(
    () => buildYearOptions(firstYear, maxYear),
    [firstYear, maxYear],
  );
  const seasons = useMemo(() => buildSeasonOptions(SEASON_COUNT), []);
  const days = useMemo(() => {
    if (mode !== "date" || !draft.year || !draft.month) {
      return [];
    }

    return Array.from(
      { length: getDaysInMonth(draft.year, draft.month) },
      (_, index) => index + 1,
    );
  }, [draft.month, draft.year, mode]);

  const formatted = formatDateSelectorValue(mode, value);
  const draftValue = buildDateSelectorValue(mode, draft);

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
        accessibilityValue={{ text: formatted || "Nessuna data" }}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.control,
          errorMessage ? styles.error : null,
          disabled ? styles.disabled : null,
          pressed ? styles.pressed : null,
        ]}
        testID={testID}
      >
        <AppText
          color={formatted ? "primary" : "muted"}
          numberOfLines={1}
          style={styles.value}
        >
          {formatted || placeholder}
        </AppText>
        <Ionicons
          color={colors.textMuted}
          name={mode === "season" ? "chevron-forward" : "calendar-outline"}
          size={18}
        />
      </Pressable>

      <BottomSheet onClose={() => setIsOpen(false)} visible={isOpen}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />
          <AppText variant="headingSm">
            {sheetTitle ?? label ?? "Seleziona una data"}
          </AppText>

          <View style={styles.columns}>
            {mode === "season" ? (
              <PickerColumn
                items={seasons.map((season) => ({
                  key: season,
                  label: season,
                  selected: draft.season === season,
                  onPress: () => setDraft({ season }),
                }))}
              />
            ) : (
              <>
                {mode === "date" ? (
                  <PickerColumn
                    items={days.map((day) => ({
                      key: String(day),
                      label: String(day),
                      selected: draft.day === day,
                      onPress: () => setDraft((current) => ({ ...current, day })),
                    }))}
                    placeholder="Scegli prima mese e anno"
                  />
                ) : null}

                {mode === "date" || mode === "monthYear" ? (
                  <PickerColumn
                    items={MONTH_NAMES.map((name, index) => ({
                      key: name,
                      label: name,
                      selected: draft.month === index + 1,
                      onPress: () =>
                        setDraft((current) => ({
                          ...current,
                          day:
                            current.day && current.year
                              ? Math.min(
                                  current.day,
                                  getDaysInMonth(current.year, index + 1),
                                )
                              : current.day,
                          month: index + 1,
                        })),
                    }))}
                  />
                ) : null}

                <PickerColumn
                  items={years.map((year) => ({
                    key: String(year),
                    label: String(year),
                    selected: draft.year === year,
                    onPress: () =>
                      setDraft((current) => ({ ...current, year })),
                  }))}
                />
              </>
            )}
          </View>

          <Button
            disabled={!draftValue}
            fullWidth
            label="Conferma"
            onPress={() => {
              onChange(draftValue);
              setIsOpen(false);
            }}
            size="lg"
            variant="primary"
          />
        </View>
      </BottomSheet>
    </FieldShell>
  );
}

type PickerColumnItem = {
  key: string;
  label: string;
  selected: boolean;
  onPress: () => void;
};

function PickerColumn({
  items,
  placeholder,
}: {
  items: PickerColumnItem[];
  placeholder?: string;
}) {
  if (items.length === 0) {
    return (
      <View style={styles.column}>
        <AppText align="center" color="muted" variant="meta">
          {placeholder ?? ""}
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.column}
      contentContainerStyle={styles.columnContent}
    >
      {items.map((item) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: item.selected, selected: item.selected }}
          key={item.key}
          onPress={item.onPress}
          style={[styles.option, item.selected ? styles.optionOn : null]}
        >
          <AppText
            color={item.selected ? "accent" : "secondary"}
            numberOfLines={1}
            variant={item.selected ? "titleSm" : "bodyLg"}
          >
            {item.label}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
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
  sheet: {
    gap: onboardingSpacing.m - 4,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.borderStrong,
    borderRadius: onboardingRadius.pill,
    height: 4,
    width: 36,
  },
  columns: {
    flexDirection: "row",
    gap: onboardingSpacing.s,
  },
  column: {
    flex: 1,
    maxHeight: COLUMN_HEIGHT,
  },
  columnContent: {
    gap: onboardingSpacing.xs,
  },
  option: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.selected,
    justifyContent: "center",
    minHeight: onboardingLayout.touchTarget - 6,
    paddingHorizontal: onboardingSpacing.s,
  },
  optionOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
});
