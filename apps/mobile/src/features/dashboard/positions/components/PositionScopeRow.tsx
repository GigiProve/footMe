import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { POSITIONS_COPY, filterRowLabel } from "../positions-presentation";
import type { PositionFilter } from "../positions-types";

type Props = {
  filter: PositionFilter;
  /** `null` quando esiste un solo contesto: testo in chiaro, non dropdown. */
  onPress: (() => void) | null;
  readOnly?: boolean;
  staticLabel?: string | null;
};

/**
 * Riga di filtro sotto le tab (§7, §14).
 *
 * «Con un solo contesto effettivamente consultabile usa testo non
 * interattivo»: lo screen 05 mostra `Ambito: Primavera` seguito da `Sola
 * consultazione`, senza caret e senza un dropdown con una voce sola.
 *
 * La decisione non è presa qui ma dal chiamante, che conosce le opzioni
 * autorizzate: questo componente disegna il caso che gli viene passato. Così
 * la regola di §14 vive in un posto solo e non si sdoppia fra UI e dati.
 */
export function PositionScopeRow({
  filter,
  onPress,
  readOnly = false,
  staticLabel,
}: Props) {
  if (!onPress) {
    return (
      <View style={styles.static} testID="position-scope-static">
        <AppText color="neutral" variant="bodyLg">
          {staticLabel ?? `Ambito: ${filterRowLabel(filter)}`}
        </AppText>

        {/* §30: la label non dipende dal solo colore. */}
        {readOnly ? (
          <AppText color="neutralMuted" variant="meta">
            {POSITIONS_COPY.readOnly}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityHint="Apre il filtro per ambito"
      accessibilityLabel={`Ambito: ${filterRowLabel(filter)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID="position-scope-row"
    >
      <AppText color="neutral" style={styles.label} variant="bodyLg">
        {filterRowLabel(filter)}
      </AppText>

      <Ionicons
        color={colors.textNeutralSoft}
        name="chevron-down"
        size={18}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  static: {
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: 1,
    gap: spacing[4],
    paddingBottom: spacing[12],
    paddingTop: spacing[12],
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
