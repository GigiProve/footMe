/**
 * Cornice di un elemento del Feed (HOM-01.1 §9, §10, §63).
 *
 * Sostituisce le card: il Feed è una superficie aperta e gli elementi sono
 * separati da spazio e da una sola hairline `divider` in fondo, non da bordo,
 * ombra e radius attorno a ciascuno. Il ritmo verticale (§10) vive qui, una
 * volta sola, così post, posizioni e moduli discovery hanno lo stesso passo.
 *
 * La linea sta DENTRO l'elemento e non in `ItemSeparatorComponent`: un modulo
 * discovery senza righe rende `null`, e con un separatore esterno lascerebbe
 * due hairline una sopra l'altra.
 */

import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../theme/tokens";

type FeedItemFrameProps = {
  children: React.ReactNode;
  testID?: string;
};

export function FeedItemFrame({ children, testID }: FeedItemFrameProps) {
  return (
    <View style={styles.frame} testID={testID}>
      {children}
    </View>
  );
}

/** Hairline fra le righe di un modulo (§20), per chi non usa la cornice. */
export function FeedDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.divider,
    height: 1,
  },
  frame: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    paddingBottom: spacing[8],
    paddingTop: spacing[20],
  },
});
