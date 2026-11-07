import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type AreaRowItem = {
  /** null quando l'actor può aprire l'area ma non vedere il totale. */
  count: number | null;
  icon: keyof typeof Ionicons.glyphMap;
  id: string;
  onPress: () => void;
  /**
   * Descrizione sotto il titolo, quando la task che possiede la riga la
   * prescrive — DAS-REV-24 §8 per Shortlist: «descrizione: Profili
   * selezionati e valutazioni interne». Facoltativa: §8 vieta di
   * ricostruire le altre righe del mockup, e una riga senza descrizione
   * resta esattamente com'era.
   */
  subtitle?: string;
  /** Riga indirizzabile nei test e nella QA visuale. */
  testID?: string;
  title: string;
};

type Props = {
  items: AreaRowItem[];
};

/**
 * Righe sintetiche "Aree di gestione" (master 02).
 *
 * Un conteggio `null` non diventa zero: significa che la capability di
 * lettura manca, e uno "0" lì direbbe all'actor che non c'è nulla quando in
 * realtà non gli è dato saperlo.
 */
export function DashboardAreaRows({ items }: Props) {
  return (
    <View style={styles.group}>
      {items.map((item, index) => (
        <View key={item.id}>
          {index > 0 ? <View style={styles.divider} /> : null}

          <Pressable
            accessibilityLabel={[
              item.title,
              item.subtitle,
              item.count === null ? null : String(item.count),
            ]
              .filter((part): part is string => !!part)
              .join(", ")}
            accessibilityRole="button"
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.row,
              pressed ? styles.pressed : null,
            ]}
            testID={item.testID}
          >
            <View style={styles.iconCircle}>
              <Ionicons color={colors.accent} name={item.icon} size={18} />
            </View>

            <View style={styles.body}>
              <AppText numberOfLines={1} variant="titleMd">
                {item.title}
              </AppText>

              {item.subtitle ? (
                <AppText color="secondary" numberOfLines={2} variant="meta">
                  {item.subtitle}
                </AppText>
              ) : null}
            </View>

            {item.count !== null ? (
              <AppText color="secondary" variant="metaStrong">
                {String(item.count)}
              </AppText>
            ) : null}

            <Ionicons
              color={colors.textMuted}
              name="chevron-forward"
              size={18}
            />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    paddingHorizontal: spacing[14],
  },
  divider: {
    backgroundColor: colors.divider,
    height: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[8],
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
