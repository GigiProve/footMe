import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type DashboardSuggestionProps = {
  actionLabel: string;
  body: string;
  onPress: () => void;
  title: string;
};

/**
 * Suggerimento facoltativo del profilo (DAS-REV-03 §19).
 *
 * Non è "Da gestire" e non è "Informazioni richieste": §19 vieta entrambi i
 * nomi quando il dato non è obbligatorio, e chiede che siano gerarchia,
 * testo e posizione a comunicarne il carattere facoltativo. Da qui tre
 * scelte deliberate:
 *
 *   · sta **sotto** i moduli operativi, non sopra;
 *   · non ha badge, conteggio, percentuale o punteggio di completamento —
 *     «La superficie azzurra tenue del mockup non autorizza badge di
 *     urgenza»;
 *   · non ha dismiss: §19 vieta sia di farlo sparire per sempre con un flag
 *     locale sia di costruire un frequency engine. Quando la composizione è
 *     densa il modulo semplicemente non viene composto, e torna quando è di
 *     nuovo pertinente.
 *
 * Il titolo è volutamente al positivo ("Migliora la tua visibilità"): è un
 * miglioramento possibile, non una mancanza da sanare.
 */
export function DashboardSuggestion({
  actionLabel,
  body,
  onPress,
  title,
}: DashboardSuggestionProps) {
  return (
    <View style={styles.surface}>
      <View style={styles.header}>
        <Ionicons color={colors.accent} name="people-outline" size={18} />
        <AppText style={styles.title} variant="titleMd">
          {title}
        </AppText>
      </View>

      <AppText color="secondary" variant="bodySm">
        {body}
      </AppText>

      <Pressable
        accessibilityLabel={`${actionLabel}: ${title}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.action,
          pressed ? styles.pressed : null,
        ]}
      >
        <AppText color="accent" variant="actionLabel">
          {actionLabel}
        </AppText>
        <Ionicons color={colors.accent} name="arrow-forward" size={14} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[6],
    padding: spacing[14],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  title: {
    flexShrink: 1,
  },
  action: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget - spacing[14],
  },
  pressed: {
    opacity: 0.6,
  },
});
