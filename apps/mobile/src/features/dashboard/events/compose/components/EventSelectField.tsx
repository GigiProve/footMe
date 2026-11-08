import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  error?: string | null;
  /** Icona a sinistra del valore: calendario o orologio (screen 04/05). */
  leadingIcon?: IconName;
  label: string;
  onPress: () => void;
  placeholder: string;
  testID?: string;
  value: string | null;
};

/**
 * Campo a selezione del wizard eventi (DAS-REV-28 §14; screen 04, 05, 07).
 *
 * Nel PNG Tipologia, Squadra, Data, Ora e Anni sono riquadri con bordo
 * sottile, valore e chevron o icona — la stessa resa dei campi di testo
 * condivisi (`ComposerTextField`). Il bordo è `colors.border` (flat, nessuna
 * ombra) e il raggio quello dei campi di input.
 *
 * Il valore non scelto è un invito grigio, mai `null` o un ID. L'errore sta
 * sotto il campo, annunciato (§25: «Errori inline e annunciati»).
 */
export function EventSelectField({
  error,
  label,
  leadingIcon,
  onPress,
  placeholder,
  testID,
  value,
}: Props) {
  return (
    <View style={styles.block}>
      <AppText color="neutralMuted" variant="meta">
        {label}
      </AppText>

      <Pressable
        accessibilityHint="Apre la scelta"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.box,
          error ? styles.boxError : null,
          pressed ? styles.pressed : null,
        ]}
        testID={testID}
      >
        {leadingIcon ? (
          <Ionicons color={colors.textNeutral} name={leadingIcon} size={18} />
        ) : null}

        <AppText
          color={value ? "neutral" : "neutralSoft"}
          numberOfLines={2}
          style={styles.value}
          variant="bodyLg"
        >
          {value ?? placeholder}
        </AppText>

        {leadingIcon ? null : (
          <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
        )}
      </Pressable>

      {error ? (
        <AppText accessibilityRole="alert" color="danger" variant="meta">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
    gap: spacing[6],
    paddingVertical: spacing[8],
  },
  box: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
  },
  boxError: {
    borderColor: colors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    flex: 1,
  },
});
