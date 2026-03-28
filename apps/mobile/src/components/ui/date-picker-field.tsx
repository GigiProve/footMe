import { useCallback, useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  FIRST_BIRTH_YEAR,
  formatBirthDate,
  formatBirthDateValue,
  parseBirthDate,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText } from "../../ui";

type DatePickerFieldProps = {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

type PickerMode = "days" | "months" | "years";

const minimumDate = new Date(FIRST_BIRTH_YEAR, 0, 1);
const CURRENT_YEAR = new Date().getFullYear();

const WEEKDAY_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

const MONTH_NAMES_SHORT = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

const MONTH_NAMES = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekdayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-based (Mon=0, Sun=6)
  return day === 0 ? 6 : day - 1;
}

type CalendarDay = {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
};

function buildCalendarGrid(year: number, month: number): CalendarDay[] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekdayOfMonth(year, month);
  const grid: CalendarDay[] = [];

  // Previous month trailing days
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  for (let i = firstWeekday - 1; i >= 0; i--) {
    grid.push({
      day: daysInPrevMonth - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push({ day: d, month, year, isCurrentMonth: true });
  }

  // Next month leading days to fill to complete rows
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const remaining = 7 - (grid.length % 7);

  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      grid.push({
        day: d,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
      });
    }
  }

  return grid;
}

function isSameDay(
  a: { day: number; month: number; year: number },
  b: { day: number; month: number; year: number } | null,
) {
  if (!b) return false;
  return a.day === b.day && a.month === b.month && a.year === b.year;
}

function isDateDisabled(
  entry: CalendarDay,
  min: Date,
  max: Date,
) {
  const d = new Date(entry.year, entry.month, entry.day);
  return d < min || d > max;
}

export function DatePickerField({
  label,
  onChange,
  placeholder = "GG/MM/AAAA",
  value,
}: DatePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>("days");

  const selectedDate = useMemo(() => {
    const parsed = parseBirthDate(value);
    if (!parsed) return null;
    return {
      day: parsed.getDate(),
      month: parsed.getMonth(),
      year: parsed.getFullYear(),
    };
  }, [value]);

  const [viewYear, setViewYear] = useState(
    () => selectedDate?.year ?? 2000,
  );
  const [viewMonth, setViewMonth] = useState(
    () => selectedDate?.month ?? 0,
  );

  const maximumDate = useMemo(() => new Date(), []);

  const grid = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  // Year grid: page of 12 years centered around viewYear
  const yearPageStart = useMemo(
    () => Math.floor(viewYear / 12) * 12,
    [viewYear],
  );
  const yearPageItems = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => yearPageStart + i).filter(
        (y) => y >= FIRST_BIRTH_YEAR && y <= CURRENT_YEAR,
      ),
    [yearPageStart],
  );

  const handleToggle = useCallback(() => {
    Keyboard.dismiss();
    setIsOpen((current) => {
      if (!current) {
        setPickerMode("days");
        if (selectedDate) {
          setViewYear(selectedDate.year);
          setViewMonth(selectedDate.month);
        }
      }
      return !current;
    });
  }, [selectedDate]);

  const handlePrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const handleSelectDay = useCallback(
    (entry: CalendarDay) => {
      const date = new Date(entry.year, entry.month, entry.day);
      onChange(formatBirthDateValue(date));
      setIsOpen(false);
    },
    [onChange],
  );

  const handleHeaderTap = useCallback(() => {
    setPickerMode((current) => (current === "days" ? "months" : "days"));
  }, []);

  const handleSelectMonth = useCallback((month: number) => {
    setViewMonth(month);
    setPickerMode("days");
  }, []);

  const handleSelectYear = useCallback((year: number) => {
    setViewYear(year);
    setPickerMode("months");
  }, []);

  return (
    <View style={styles.wrapper}>
      <AppText variant="caption" color="muted" style={styles.label}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        onPress={handleToggle}
        style={[styles.field, isOpen ? styles.fieldActive : null]}
        testID="date-picker-trigger"
      >
        <AppText variant="bodyLg" color={value ? "primary" : "muted"}>
          {value ? formatBirthDate(value) : placeholder}
        </AppText>
        <Ionicons
          name="calendar-outline"
          size={20}
          color={isOpen ? colors.accent : colors.textMuted}
        />
      </Pressable>

      {isOpen ? (
        <View style={styles.calendarCard} testID="date-picker-surface">
          {/* ---- YEARS MODE ---- */}
          {pickerMode === "years" ? (
            <>
              <View style={styles.calendarHeader}>
                <Pressable
                  accessibilityLabel="Anni precedenti"
                  accessibilityRole="button"
                  onPress={() => setViewYear((y) => Math.max(FIRST_BIRTH_YEAR, y - 12))}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
                </Pressable>
                <AppText variant="titleSm">
                  {yearPageStart} – {Math.min(yearPageStart + 11, CURRENT_YEAR)}
                </AppText>
                <Pressable
                  accessibilityLabel="Anni successivi"
                  accessibilityRole="button"
                  onPress={() => setViewYear((y) => Math.min(CURRENT_YEAR, y + 12))}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={styles.monthGrid}>
                {yearPageItems.map((year) => {
                  const isActive = year === viewYear;
                  return (
                    <Pressable
                      key={year}
                      accessibilityRole="button"
                      onPress={() => handleSelectYear(year)}
                      style={[styles.monthCell, isActive ? styles.monthCellActive : null]}
                    >
                      <AppText
                        variant="bodySm"
                        style={[
                          styles.monthCellText,
                          isActive ? styles.monthCellTextActive : null,
                        ]}
                      >
                        {year}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* ---- MONTHS MODE ---- */}
          {pickerMode === "months" ? (
            <>
              <View style={styles.calendarHeader}>
                <Pressable
                  accessibilityLabel="Anno precedente"
                  accessibilityRole="button"
                  onPress={() => setViewYear((y) => Math.max(FIRST_BIRTH_YEAR, y - 1))}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPickerMode("years")}
                >
                  <AppText variant="titleSm">{viewYear}</AppText>
                </Pressable>
                <Pressable
                  accessibilityLabel="Anno successivo"
                  accessibilityRole="button"
                  onPress={() => setViewYear((y) => Math.min(CURRENT_YEAR, y + 1))}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={styles.monthGrid}>
                {MONTH_NAMES_SHORT.map((name, index) => {
                  const isActive = index === viewMonth && viewYear === viewYear;
                  return (
                    <Pressable
                      key={index}
                      accessibilityRole="button"
                      onPress={() => handleSelectMonth(index)}
                      style={[styles.monthCell, isActive ? styles.monthCellActive : null]}
                    >
                      <AppText
                        variant="bodySm"
                        style={[
                          styles.monthCellText,
                          isActive ? styles.monthCellTextActive : null,
                        ]}
                      >
                        {name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* ---- DAYS MODE ---- */}
          {pickerMode === "days" ? (
            <>
              <View style={styles.calendarHeader}>
                <Pressable
                  accessibilityLabel="Mese precedente"
                  accessibilityRole="button"
                  onPress={handlePrevMonth}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleHeaderTap}
                >
                  <AppText variant="titleSm">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityLabel="Mese successivo"
                  accessibilityRole="button"
                  onPress={handleNextMonth}
                  style={styles.navButton}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((day, i) => (
                  <View key={i} style={styles.weekdayCell}>
                    <AppText variant="caption" color="muted">
                      {day}
                    </AppText>
                  </View>
                ))}
              </View>

              <View style={styles.dayGrid}>
                {Array.from(
                  { length: Math.ceil(grid.length / 7) },
                  (_, rowIndex) => {
                    const row = grid.slice(rowIndex * 7, rowIndex * 7 + 7);
                    return (
                      <View key={rowIndex} style={styles.dayRow}>
                        {row.map((entry, colIndex) => {
                          const isSelected = isSameDay(entry, selectedDate);
                          const disabled = isDateDisabled(
                            entry,
                            minimumDate,
                            maximumDate,
                          );

                          return (
                            <Pressable
                              key={colIndex}
                              accessibilityRole="button"
                              disabled={disabled}
                              onPress={() => handleSelectDay(entry)}
                              style={styles.dayCellOuter}
                            >
                              <View
                                style={[
                                  styles.dayCell,
                                  isSelected ? styles.dayCellSelected : null,
                                ]}
                              >
                                <AppText
                                  variant="bodySm"
                                  style={[
                                    styles.dayText,
                                    !entry.isCurrentMonth || disabled
                                      ? styles.dayTextMuted
                                      : null,
                                    isSelected ? styles.dayTextSelected : null,
                                  ]}
                                >
                                  {entry.day}
                                </AppText>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    );
                  },
                )}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <AppText variant="caption" color="secondary">
        {value
          ? `Data selezionata: ${formatBirthDate(value)}`
          : "Apri il calendario e scegli la data di nascita."}
      </AppText>
    </View>
  );
}

const DAY_SIZE = 36;

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[8],
  },
  label: {
    fontWeight: "500",
    fontSize: 13,
  },
  field: {
    minHeight: 52,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[6],
    backgroundColor: colors.inputBackground,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldActive: {
    borderColor: colors.accent,
  },
  // Calendar card
  calendarCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
    padding: spacing[16],
    shadowColor: "rgba(0,0,0,0.03)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 1,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[16],
  },
  navButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  // Weekday row
  weekdayRow: {
    flexDirection: "row",
    marginBottom: spacing[12],
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
  },
  // Day grid
  dayGrid: {
    gap: spacing[8],
  },
  dayRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  dayCellOuter: {
    flex: 1,
    alignItems: "center",
  },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    backgroundColor: colors.accent,
  },
  dayText: {
    fontWeight: "500",
    color: colors.textPrimary,
  },
  dayTextMuted: {
    color: colors.textMuted,
  },
  dayTextSelected: {
    color: colors.inkInvert,
  },
  // Month / year grid (3 columns × 4 rows)
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  monthCell: {
    width: "30%",
    flexGrow: 1,
    height: 44,
    borderRadius: radius[8],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  monthCellActive: {
    backgroundColor: colors.accent,
  },
  monthCellText: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  monthCellTextActive: {
    color: colors.inkInvert,
  },
});
