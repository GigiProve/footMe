import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

/**
 * Barra di tab del design ProLink (§1a).
 *
 * «Le tab non sono mai bottoni. Ovunque — Home, Profilo, Messaggi — la tab
 * attiva è testo blu con indicatore 2px sotto.» Niente pillole piene: una
 * pillola piena legge come CTA e ruba l'attenzione all'azione vera della
 * pagina.
 *
 * Di default le tab sono allineate a sinistra e spaziate di 24px, come nei
 * mockup. `fill` le distribuisce a larghezza uguale, per i casi con due sole
 * tab che devono coprire tutta la testata.
 */
export type TabBarItem<T extends string> = {
  /** Contatore opzionale accanto all'etichetta (in Mulish, come i numeri). */
  count?: number;
  label: string;
  value: T;
};

type TabBarProps<T extends string> = {
  active: T;
  fill?: boolean;
  items: readonly TabBarItem<T>[];
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * `neutral` disegna etichetta e indicatore in nero neutro invece che nel
   * blu ProLink (DAS-REV-11 §3: «Le tab interne hanno testo nero e
   * sottolineatura nera quando selezionate, grigio neutro quando inattive»).
   *
   * Resta una tab in tutto il resto — testo e indicatore 2px, mai una
   * pillola piena, che §3 vieta esplicitamente ("Non trasformarle in pill
   * blu sature") e che il design ProLink già escludeva.
   */
  tone?: "brand" | "neutral";
};

export function TabBar<T extends string>({
  active,
  fill = false,
  items,
  onChange,
  style,
  testID,
  tone = "brand",
}: TabBarProps<T>) {
  const neutral = tone === "neutral";
  const activeColor = neutral ? "neutral" : "accent";
  const inactiveColor = neutral ? "neutralMuted" : "muted";

  return (
    <View
      style={[styles.bar, neutral ? styles.barNeutral : null, style]}
      testID={testID}
    >
      {items.map((item) => {
        const isActive = item.value === active;

        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={item.value}
            onPress={() => onChange(item.value)}
            style={[
              styles.tab,
              fill ? styles.tabFill : null,
              isActive ? (neutral ? styles.tabActiveNeutral : styles.tabActive) : null,
            ]}
          >
            <AppText
              color={isActive ? activeColor : inactiveColor}
              style={isActive ? null : styles.inactiveLabel}
              variant="tabLabel"
            >
              {item.label}
            </AppText>
            {item.count != null && item.count > 0 ? (
              <AppText
                color={isActive ? activeColor : inactiveColor}
                style={styles.count}
                variant="numeric"
              >
                {item.count}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[24],
    paddingHorizontal: spacing[16],
  },
  tab: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    flexDirection: "row",
    gap: spacing[6],
    justifyContent: "center",
    paddingBottom: spacing[10],
    paddingHorizontal: spacing[0],
    paddingTop: spacing[12],
  },
  tabFill: {
    flex: 1,
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  barNeutral: {
    borderBottomColor: colors.dividerNeutral,
  },
  tabActiveNeutral: {
    borderBottomColor: colors.textNeutral,
  },
  inactiveLabel: {
    fontWeight: "600",
  },
  count: {
    fontSize: 13,
  },
});
