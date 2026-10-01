/**
 * Griglia di chip con icona (REV-PROF-09, Screen 4 "Aree di responsabilità").
 *
 * È la forma che il mockup usa per un elenco di attributi brevi: pill con
 * bordo hairline e icona lineare a sinistra, due per riga finché ci stanno.
 * Non è una card: un'area di responsabilità è un'etichetta, non un contenuto,
 * e la regola del design system è che gli attributi sono pill.
 *
 * L'etichetta va a capo invece di essere troncata: "Organizzazione logistica"
 * resta leggibile anche a 320 px e con Dynamic Type elevato. L'icona è sempre
 * accompagnata dal testo, mai da sola (§accessibilità).
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type ProfileIconChip = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  key: string;
  label: string;
};

type ProfileIconChipsProps = {
  chips: readonly ProfileIconChip[];
  testID?: string;
};

export function ProfileIconChips({ chips, testID }: ProfileIconChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={styles.grid} testID={testID}>
      {chips.map((chip) => (
        <View
          accessible
          accessibilityLabel={chip.label}
          key={chip.key}
          style={styles.chip}
        >
          <Ionicons color={colors.accent} name={chip.icon} size={14} />
          <AppText color="primary" style={styles.label} variant="meta">
            {chip.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    gap: spacing[8],
    // Due per riga sui viewport di riferimento, una sola quando il testo
    // cresce: la larghezza minima evita la terza colonna stretta.
    minWidth: 150,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  label: {
    flexShrink: 1,
    minWidth: 0,
  },
});
