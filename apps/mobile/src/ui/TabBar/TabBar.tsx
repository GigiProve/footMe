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
};

export function TabBar<T extends string>({
  active,
  fill = false,
  items,
  onChange,
  style,
  testID,
}: TabBarProps<T>) {
  return (
    <View style={[styles.bar, style]} testID={testID}>
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
              isActive ? styles.tabActive : null,
            ]}
          >
            <AppText
              color={isActive ? "accent" : "muted"}
              style={isActive ? null : styles.inactiveLabel}
              variant="tabLabel"
            >
              {item.label}
            </AppText>
            {item.count != null && item.count > 0 ? (
              <AppText
                color={isActive ? "accent" : "muted"}
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
  inactiveLabel: {
    fontWeight: "600",
  },
  count: {
    fontSize: 13,
  },
});
