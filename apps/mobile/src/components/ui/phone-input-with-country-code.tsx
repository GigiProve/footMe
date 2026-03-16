import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing, typography } from "../../theme/tokens";

type PhoneCountryOption = {
  code: string;
  flag: string;
  label: string;
};

const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { code: "+39", flag: "🇮🇹", label: "Italia" },
  { code: "+1", flag: "🇺🇸", label: "USA / Canada" },
  { code: "+44", flag: "🇬🇧", label: "UK" },
  { code: "+33", flag: "🇫🇷", label: "Francia" },
  { code: "+49", flag: "🇩🇪", label: "Germania" },
  { code: "+34", flag: "🇪🇸", label: "Spagna" },
  { code: "+351", flag: "🇵🇹", label: "Portogallo" },
  { code: "+31", flag: "🇳🇱", label: "Paesi Bassi" },
  { code: "+32", flag: "🇧🇪", label: "Belgio" },
  { code: "+41", flag: "🇨🇭", label: "Svizzera" },
  { code: "+43", flag: "🇦🇹", label: "Austria" },
  { code: "+30", flag: "🇬🇷", label: "Grecia" },
  { code: "+48", flag: "🇵🇱", label: "Polonia" },
  { code: "+40", flag: "🇷🇴", label: "Romania" },
  { code: "+380", flag: "🇺🇦", label: "Ucraina" },
  { code: "+36", flag: "🇭🇺", label: "Ungheria" },
  { code: "+420", flag: "🇨🇿", label: "Rep. Ceca" },
  { code: "+421", flag: "🇸🇰", label: "Slovacchia" },
  { code: "+386", flag: "🇸🇮", label: "Slovenia" },
  { code: "+385", flag: "🇭🇷", label: "Croazia" },
  { code: "+381", flag: "🇷🇸", label: "Serbia" },
  { code: "+387", flag: "🇧🇦", label: "Bosnia" },
  { code: "+355", flag: "🇦🇱", label: "Albania" },
  { code: "+359", flag: "🇧🇬", label: "Bulgaria" },
  { code: "+47", flag: "🇳🇴", label: "Norvegia" },
  { code: "+46", flag: "🇸🇪", label: "Svezia" },
  { code: "+45", flag: "🇩🇰", label: "Danimarca" },
  { code: "+358", flag: "🇫🇮", label: "Finlandia" },
  { code: "+353", flag: "🇮🇪", label: "Irlanda" },
  { code: "+55", flag: "🇧🇷", label: "Brasile" },
  { code: "+54", flag: "🇦🇷", label: "Argentina" },
  { code: "+52", flag: "🇲🇽", label: "Messico" },
  { code: "+57", flag: "🇨🇴", label: "Colombia" },
  { code: "+56", flag: "🇨🇱", label: "Cile" },
  { code: "+51", flag: "🇵🇪", label: "Perù" },
  { code: "+598", flag: "🇺🇾", label: "Uruguay" },
  { code: "+595", flag: "🇵🇾", label: "Paraguay" },
  { code: "+593", flag: "🇪🇨", label: "Ecuador" },
  { code: "+81", flag: "🇯🇵", label: "Giappone" },
  { code: "+82", flag: "🇰🇷", label: "Corea del Sud" },
  { code: "+86", flag: "🇨🇳", label: "Cina" },
  { code: "+61", flag: "🇦🇺", label: "Australia" },
  { code: "+212", flag: "🇲🇦", label: "Marocco" },
  { code: "+213", flag: "🇩🇿", label: "Algeria" },
  { code: "+216", flag: "🇹🇳", label: "Tunisia" },
  { code: "+225", flag: "🇨🇮", label: "Costa d'Avorio" },
  { code: "+233", flag: "🇬🇭", label: "Ghana" },
  { code: "+234", flag: "🇳🇬", label: "Nigeria" },
  { code: "+237", flag: "🇨🇲", label: "Camerun" },
  { code: "+221", flag: "🇸🇳", label: "Senegal" },
  { code: "+228", flag: "🇹🇬", label: "Togo" },
  { code: "+972", flag: "🇮🇱", label: "Israele" },
  { code: "+90", flag: "🇹🇷", label: "Turchia" },
  { code: "+7", flag: "🇷🇺", label: "Russia" },
  { code: "+20", flag: "🇪🇬", label: "Egitto" },
  { code: "+354", flag: "🇮🇸", label: "Islanda" },
];

export { PHONE_COUNTRY_OPTIONS };
export type { PhoneCountryOption };

export function PhoneInputWithCountryCode({
  countryCode,
  label = "Numero di telefono (facoltativo)",
  onChangeCountryCode,
  onChangeNumber,
  phoneNumber,
}: {
  countryCode: string;
  label?: string;
  onChangeCountryCode: (code: string) => void;
  onChangeNumber: (number: string) => void;
  phoneNumber: string;
}) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const selectedCountry = useMemo(
    () => PHONE_COUNTRY_OPTIONS.find((o) => o.code === countryCode) ?? PHONE_COUNTRY_OPTIONS[0],
    [countryCode],
  );

  const filteredCountries = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return PHONE_COUNTRY_OPTIONS;
    return PHONE_COUNTRY_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.code.includes(q),
    );
  }, [pickerQuery]);

  function handleSelectCountry(option: PhoneCountryOption) {
    onChangeCountryCode(option.code);
    setIsPickerOpen(false);
    setPickerQuery("");
  }

  return (
    <View style={{ gap: spacing[8] }}>
      <Text
        style={{
          color: colors.textPrimary,
          fontWeight: typography.fontWeight.bold,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", gap: spacing[10] }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setPickerQuery("");
            setIsPickerOpen(true);
          }}
          style={{
            minHeight: 52,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: spacing[12],
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius[16],
            backgroundColor: colors.background,
            flexDirection: "row",
            gap: spacing[6],
          }}
        >
          <Text style={{ fontSize: typography.fontSize[18] }}>
            {selectedCountry.flag}
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: typography.fontWeight.bold,
              fontSize: typography.fontSize[14],
            }}
          >
            {selectedCountry.code}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: typography.fontSize[12] }}>
            ▼
          </Text>
        </Pressable>

        <TextInput
          keyboardType="phone-pad"
          onChangeText={(text) => onChangeNumber(text.replace(/[^0-9]/g, ""))}
          placeholder="Numero di cellulare"
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1,
            minHeight: 52,
            paddingHorizontal: spacing[16],
            paddingVertical: spacing[14],
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius[16],
            backgroundColor: colors.background,
            color: colors.textPrimary,
            fontSize: typography.fontSize[16],
          }}
          value={phoneNumber}
        />
      </View>

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
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsPickerOpen(false)}
              >
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

            <TextInput
              autoFocus
              onChangeText={setPickerQuery}
              placeholder="Cerca paese..."
              placeholderTextColor={colors.textMuted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius[14],
                paddingHorizontal: spacing[14],
                paddingVertical: spacing[10],
                color: colors.textPrimary,
                fontSize: typography.fontSize[16],
                backgroundColor: colors.background,
              }}
              value={pickerQuery}
            />

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: spacing[6] }}
              renderItem={({ item }) => {
                const isSelected = item.code === countryCode;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleSelectCountry(item)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing[10],
                      borderRadius: radius[14],
                      borderWidth: 1,
                      borderColor: isSelected ? colors.accentStrong : colors.border,
                      backgroundColor: isSelected
                        ? colors.accentSoft
                        : colors.background,
                      paddingHorizontal: spacing[14],
                      paddingVertical: spacing[12],
                    }}
                  >
                    <Text style={{ fontSize: typography.fontSize[18] }}>
                      {item.flag}
                    </Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontWeight: isSelected
                          ? typography.fontWeight.heavy
                          : typography.fontWeight.regular,
                        flex: 1,
                      }}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontWeight: typography.fontWeight.bold,
                        fontSize: typography.fontSize[14],
                      }}
                    >
                      {item.code}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
