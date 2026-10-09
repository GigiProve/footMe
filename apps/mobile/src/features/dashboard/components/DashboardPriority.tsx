import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { DashboardPriorityTypeId } from "../priority/priority-types";

/**
 * Icona per tipo di priorità.
 *
 * Vive qui e non nel registry perché il registry è logica pura, testata
 * senza montare nulla: farvi entrare il tipo di Ionicons costringerebbe ogni
 * test di ranking a risolvere una libreria di icone.
 */
export const PRIORITY_ICONS: Record<
  DashboardPriorityTypeId,
  keyof typeof Ionicons.glyphMap
> = {
  availability_required: "location-outline",
  new_applications: "people-outline",
  publication_failed: "alert-circle-outline",
};

export type DashboardPriorityItem = {
  /** Etichetta completa per screen reader: verbo + oggetto + contesto. */
  accessibilityLabel: string;
  /** Verbo specifico: "Valuta candidature", non "Apri". */
  actionLabel: string;
  /** Il contesto, non una ripetizione del titolo. */
  description: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  id: string;
  onPress: () => void;
  title: string;
};

type Props = {
  items: DashboardPriorityItem[];
};

/**
 * Sezione "Da gestire" (master 01, 05).
 *
 * Quando non ci sono priorità la sezione **sparisce del tutto**: titolo,
 * contenitore e spazio riservato (§24). È la ragione del `return null` —
 * non un contenitore vuoto di altezza zero, che lascerebbe il `gap` del
 * genitore.
 *
 * Ogni priorità dice oggetto, motivo e azione. Niente punteggi, percentuali,
 * countdown o etichette "critiche": il livello interno non arriva fin qui, e
 * il blu leggero è l'unico accento — §23 vieta il rosso e la severity da
 * emergenza per una novità da valutare.
 */
export function DashboardPriority({ items }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.block}>
      <AppText accessibilityRole="header" variant="headingSm">
        Da gestire
      </AppText>

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons color={colors.accent} name={item.icon} size={20} />
          </View>

          <View style={styles.body}>
            <AppText variant="titleMd">{item.title}</AppText>

            {item.description ? (
              <AppText color="secondary" variant="meta">
                {item.description}
              </AppText>
            ) : null}

            <Pressable
              accessibilityLabel={item.accessibilityLabel}
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
              <Ionicons color={colors.accent} name="arrow-forward" size={14} />
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
