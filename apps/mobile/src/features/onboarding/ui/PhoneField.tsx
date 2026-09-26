import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  PHONE_COUNTRY_CODE_OPTIONS,
  getPhoneCountryCodeOption,
  normalizePhoneLocalNumber,
} from "../../profiles/profile-form-utils";
import { colors, typography } from "../../../styles";
import { AppText } from "../../../ui";
import { BottomSheetSelector, type SelectorOption } from "./BottomSheetSelector";
import { FieldShell } from "./FieldShell";
import { OnboardingTextField } from "./OnboardingTextField";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

type PhoneFieldProps = {
  label?: string;
  countryCode: string;
  phoneNumber: string;
  onChangeCountryCode: (value: string) => void;
  onChangePhoneNumber: (value: string) => void;
  placeholder?: string;
  errorMessage?: string;
  helperText?: string;
  optional?: boolean;
  testID?: string;
};

/**
 * Telefono con prefisso internazionale (§J del Master, REV-ONB-05 §F).
 *
 * Il prefisso è un controllo a sé, che si apre nel bottom sheet condiviso:
 * si vede che è selezionabile senza che nessuno debba spiegarlo. Il modo in
 * cui il numero viene salvato è un fatto nostro e non compare a schermo.
 */
export function PhoneField({
  countryCode,
  errorMessage,
  helperText,
  label = "Telefono",
  onChangeCountryCode,
  onChangePhoneNumber,
  optional,
  phoneNumber,
  placeholder = "333 1234567",
  testID,
}: PhoneFieldProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const selected = useMemo(
    () =>
      getPhoneCountryCodeOption(countryCode) ?? PHONE_COUNTRY_CODE_OPTIONS[0],
    [countryCode],
  );

  const options = useMemo<SelectorOption<string>[]>(
    () =>
      PHONE_COUNTRY_CODE_OPTIONS.map((option) => ({
        description: option.countryName,
        label: `${option.flag}  ${option.value}`,
        value: `${option.countryCode}|${option.value}`,
      })),
    [],
  );

  return (
    <FieldShell
      errorMessage={errorMessage}
      helperText={helperText}
      label={label}
      optional={optional}
    >
      <View style={styles.row} testID={testID}>
        <Pressable
          accessibilityHint="Apre l'elenco dei prefissi"
          accessibilityLabel={`Prefisso ${selected.value}, ${selected.countryName}`}
          accessibilityRole="button"
          onPress={() => setIsPickerOpen(true)}
          style={({ pressed }) => [
            styles.prefix,
            errorMessage ? styles.prefixError : null,
            pressed ? styles.pressed : null,
          ]}
          testID="phone-country-code-trigger"
        >
          <AppText style={styles.prefixText}>
            {selected.flag} {selected.value}
          </AppText>
        </Pressable>

        <View style={styles.number}>
          <OnboardingTextField
            accessibilityLabel={label}
            keyboardType="phone-pad"
            onChangeText={(value) =>
              onChangePhoneNumber(normalizePhoneLocalNumber(value))
            }
            placeholder={placeholder}
            textContentType="telephoneNumber"
            value={phoneNumber}
          />
        </View>
      </View>

      <BottomSheetSelector
        mode="single"
        onChange={(value) => {
          const next = String(value).split("|")[1] ?? "";

          if (next) {
            onChangeCountryCode(next);
          }
        }}
        onClose={() => setIsPickerOpen(false)}
        options={options}
        searchable
        searchPlaceholder="Cerca paese"
        title="Prefisso"
        value={`${selected.countryCode}|${selected.value}`}
        visible={isPickerOpen}
      />
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: onboardingSpacing.s + 2,
  },
  prefix: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: onboardingLayout.controlHeight,
    minWidth: 104,
    paddingHorizontal: onboardingSpacing.m - 4,
  },
  prefixError: {
    borderColor: colors.danger,
    borderWidth: onboardingBorderWidth.selected,
  },
  pressed: {
    opacity: 0.7,
  },
  prefixText: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
  },
  number: {
    flex: 1,
  },
});
