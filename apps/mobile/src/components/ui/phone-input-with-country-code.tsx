import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import {
  PHONE_COUNTRY_CODE_OPTIONS,
  getPhoneCountryCodeOption,
  normalizePhoneLocalNumber,
} from "../../features/profiles/profile-form-utils";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Input } from "../../ui/Input/Input";

type PhoneInputWithCountryCodeProps = {
  countryCode: string;
  errorMessage?: string;
  label?: string;
  onChangeCountryCode: (value: string) => void;
  onChangePhoneNumber: (value: string) => void;
  phoneNumber: string;
};

export function PhoneInputWithCountryCode({
  countryCode,
  errorMessage,
  label = "Numero di cellulare",
  onChangeCountryCode,
  onChangePhoneNumber,
  phoneNumber,
}: PhoneInputWithCountryCodeProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const selectedCountry = useMemo(
    () => getPhoneCountryCodeOption(countryCode) ?? PHONE_COUNTRY_CODE_OPTIONS[0],
    [countryCode],
  );

  return (
    <View style={{ gap: spacing[8] }}>
      <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", gap: spacing[10] }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setIsPickerOpen(true)}
          style={{
            minHeight: 54,
            minWidth: 120,
            justifyContent: "center",
            borderRadius: radius[16],
            borderWidth: 1,
            borderColor: errorMessage ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing[14],
            paddingVertical: spacing[12],
          }}
          testID="phone-country-code-trigger"
        >
          <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
            {selectedCountry.flag} {selectedCountry.value}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Input
            keyboardType="phone-pad"
            onChangeText={(value) => onChangePhoneNumber(normalizePhoneLocalNumber(value))}
            placeholder="3331234567"
            style={errorMessage ? { borderColor: colors.danger } : undefined}
            value={phoneNumber}
          />
        </View>
      </View>
      <Text style={{ color: errorMessage ? colors.danger : colors.textSecondary }}>
        {errorMessage ?? "Prefisso internazionale separato dal numero per un salvataggio coerente."}
      </Text>
      <Modal
        animationType="slide"
        onRequestClose={() => setIsPickerOpen(false)}
        transparent
        visible={isPickerOpen}
      >
        <Pressable
          onPress={() => setIsPickerOpen(false)}
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
                Prefisso internazionale
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setIsPickerOpen(false)}>
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
            <ScrollView contentContainerStyle={{ gap: spacing[8] }}>
              {PHONE_COUNTRY_CODE_OPTIONS.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${option.countryCode}-${option.value}`}
                  onPress={() => {
                    onChangeCountryCode(option.value);
                    setIsPickerOpen(false);
                  }}
                  style={({ pressed }) => ({
                    gap: spacing[4],
                    borderRadius: radius[16],
                    borderWidth: 1,
                    borderColor: option.value === selectedCountry.value ? colors.hero : colors.border,
                    backgroundColor:
                      option.value === selectedCountry.value
                        ? colors.heroSoft
                        : pressed
                          ? colors.surfaceMuted
                          : colors.background,
                    paddingHorizontal: spacing[14],
                    paddingVertical: spacing[12],
                  })}
                  testID={`phone-country-code-option-${option.countryCode}`}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontWeight: typography.fontWeight.bold,
                    }}
                  >
                    {option.flag} {option.value}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>{option.countryName}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
