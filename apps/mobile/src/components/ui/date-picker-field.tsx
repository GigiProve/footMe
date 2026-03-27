import { useMemo, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import {
  FIRST_BIRTH_YEAR,
  formatBirthDate,
  formatBirthDateValue,
  parseBirthDate,
} from "../../features/profiles/profile-form-utils";
import { AppText } from "../../ui";
import { colors, radius, spacing } from "../../theme/tokens";

type DatePickerFieldProps = {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

const minimumBirthDate = new Date(FIRST_BIRTH_YEAR, 0, 1);
const DEFAULT_PICKER_DATE = new Date(2000, 0, 1);

export function DatePickerField({
  label,
  onChange,
  placeholder = "Seleziona una data",
  value,
}: DatePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = useMemo(
    () => parseBirthDate(value) ?? DEFAULT_PICKER_DATE,
    [value],
  );
  const maximumDate = useMemo(() => new Date(), []);

  function handlePickerChange(event: DateTimePickerEvent, nextDate?: Date) {
    if (Platform.OS !== "ios") {
      setIsOpen(false);
    }

    if (event.type === "dismissed" || !nextDate) {
      return;
    }

    onChange(formatBirthDateValue(nextDate));
  }

  return (
    <View style={styles.container}>
      <AppText variant="titleSm">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          Keyboard.dismiss();
          setIsOpen((current) => !current);
        }}
        style={[styles.trigger, isOpen ? styles.triggerOpen : null]}
        testID="date-picker-trigger"
      >
        <AppText variant="bodySm" color={value ? "primary" : "secondary"}>
          {value ? formatBirthDate(value) : placeholder}
        </AppText>
      </Pressable>

      {isOpen ? (
        <View style={styles.pickerSurface} testID="date-picker-surface">
          <DateTimePicker
            accentColor={colors.hero}
            display={Platform.OS === "ios" ? "inline" : "default"}
            maximumDate={maximumDate}
            minimumDate={minimumBirthDate}
            mode="date"
            onChange={handlePickerChange}
            themeVariant="light"
            value={selectedDate}
          />
          {Platform.OS === "ios" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsOpen(false)}
              style={styles.confirmButton}
              testID="date-picker-confirm"
            >
              <AppText variant="titleSm" color="hero">
                Conferma
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <AppText variant="bodySm" color="secondary">
        {value
          ? `Data selezionata: ${formatBirthDate(value)}`
          : "Apri il calendario e scegli la data di nascita."}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmButton: {
    alignSelf: "flex-end",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  container: {
    gap: spacing[8],
  },
  pickerSurface: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[20],
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[8],
  },
  trigger: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  triggerOpen: {
    borderColor: colors.hero,
  },
});
