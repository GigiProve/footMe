import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type PriorityTone = "neutral" | "alert";

export type DashboardPriorityItem = {
  /** Verbo specifico: "Valuta candidature", non "Apri". */
  actionLabel: string;
  /** Il motivo, non una ripetizione del titolo. */
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  id: string;
  onPress: () => void;
  title: string;
  tone: PriorityTone;
};

type Props = {
  items: DashboardPriorityItem[];
};

/**
 * Sezione "Da gestire" (master 01, 02, 03).
 *
 * Ogni priorità dice **oggetto, motivo e azione**. Niente punteggi,
 * percentuali o etichette "critiche": il tono `alert` esiste solo per un
 * fallimento operativo reale, e il rosso non è mai l'unico segnale — l'icona
 * cambia insieme al colore.
 *
 * L'azione è un link testuale blu, non una tile colorata: l'enfasi della
 * pagina resta sul contenuto, non sul pannello.
 */
export function DashboardPriority({ items }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.block}>
      <AppText variant="headingSm">Da gestire</AppText>

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View
            style={[
              styles.iconCircle,
              item.tone === "alert" ? styles.iconCircleAlert : null,
            ]}
          >
            <Ionicons
              color={item.tone === "alert" ? colors.danger : colors.accent}
              name={item.icon}
              size={20}
            />
          </View>

          <View style={styles.body}>
            <AppText variant="titleMd">{item.title}</AppText>
            <AppText color="secondary" variant="meta">
              {item.description}
            </AppText>

            <Pressable
              accessibilityLabel={item.actionLabel}
              accessibilityRole="button"
              hitSlop={8}
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.action,
                pressed ? styles.pressed : null,
              ]}
            >
              <AppText color="accent" variant="actionLabel">
                {item.actionLabel}
              </AppText>
              <Ionicons
                color={colors.accent}
                name="arrow-forward"
                size={14}
              />
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[10],
  },
  card: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[14],
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  iconCircleAlert: {
    backgroundColor: colors.dangerSoft,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  action: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    marginTop: spacing[6],
    minHeight: sizes.touchTarget - spacing[14],
  },
  pressed: {
    opacity: 0.6,
  },
});
