import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import {
  FIRST_BIRTH_YEAR,
  formatBirthDate,
  formatBirthDateValue,
  parseBirthDate,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";

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
  const selectedDate = useMemo(() => parseBirthDate(value) ?? DEFAULT_PICKER_DATE, [value]);
  const maximumDate = useMemo(() => new Date(), []);

  function handlePickerChange(event: DateTimePickerEvent, nextDate?: Date) {
    if (Platform.OS === "android") {
      setIsOpen(false);
    }

    if (event.type === "dismissed" || !nextDate) {
      return;
    }

    onChange(formatBirthDateValue(nextDate));
  }

  return (
    <View style={{ gap: spacing[8] }}>
      <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen((current) => !current)}
        style={{
          minHeight: 54,
          justifyContent: "center",
          borderRadius: radius[16],
          borderWidth: 1,
          borderColor: isOpen ? colors.hero : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing[16],
          paddingVertical: spacing[14],
        }}
        testID="date-picker-trigger"
      >
        <Text style={{ color: value ? colors.textPrimary : colors.textSecondary }}>
          {value ? formatBirthDate(value) : placeholder}
        </Text>
      </Pressable>

      {isOpen ? (
        <View
          style={{
            borderRadius: radius[20],
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            paddingHorizontal: spacing[12],
            paddingVertical: spacing[8],
          }}
          testID="date-picker-surface"
        >
          <DateTimePicker
            accentColor={colors.hero}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={maximumDate}
            minimumDate={minimumBirthDate}
            mode="date"
            onChange={handlePickerChange}
            themeVariant="light"
            value={selectedDate}
          />
        </View>
      ) : null}

      <Text style={{ color: colors.textSecondary }}>
        {value ? `Data selezionata: ${formatBirthDate(value)}` : "Apri il calendario e scegli la data di nascita."}
      </Text>
    </View>
  );
}
