import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Divider discreto fra righe dello **stesso** dominio (§4). */
  showDivider?: boolean;
  testID?: string;
  title: string;
};

/**
 * Riga di navigazione dell'hub (§4).
 *
 * «Righe dell'hub | Superficie bianca, icona lineare neutra, testo nero,
 * chevron.» Non riusa `DashboardAreaRows` della Dashboard, che disegna un
 * contenitore con bordo e un'icona dentro un cerchio blu: §4 chiede sezioni
 * **aperte** con divider discreti, e quella pastiglia blu è l'accento che la
 * tavola v2 riserva alla sola primaria.
 *
 * Una riga non diventa un pulsante primario perché è tappabile: niente fondo,
 * niente bordo, niente peso in più. Il chevron è decorativo — lo screen
 * reader annuncia già un pulsante — e §28 vieta di duplicarne l'annuncio.
 */
export function StructureRow({
  icon,
  onPress,
  showDivider = false,
  testID,
  title,
}: Props) {
  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID={testID}
      >
        <Ionicons color={colors.textNeutral} name={icon} size={20} />

        <AppText
          color="neutral"
          numberOfLines={2}
          style={styles.title}
          variant="bodyLg"
        >
          {title}
        </AppText>

        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.dividerNeutral,
    height: 1,
    marginLeft: spacing[32],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    // §28: target interattivi di almeno 44 pt. L'altezza cresce con il testo
    // dinamico invece di tagliarlo.
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[6],
  },
  title: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
