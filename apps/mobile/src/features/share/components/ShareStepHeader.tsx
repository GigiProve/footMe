/**
 * Barra dei passi a schermo intero «Invia a» e «Condividi» (HOM-09 §43–§44, §82;
 * mockup 2–3, 8): freccia a sinistra, titolo centrato, 44pt di tocco, come la
 * barra del dettaglio contenuto. `leading` sceglie tra «indietro» (passo
 * precedente) e «chiudi» (uscita dal flusso, quando non c'è un passo
 * precedente o la condivisione è già parzialmente partita).
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { SHARE_COPY } from "../share-presentation";

type ShareStepHeaderProps = {
  leading: "back" | "close";
  onLeadingPress: () => void;
  title: string;
};

export function ShareStepHeader({ leading, onLeadingPress, title }: ShareStepHeaderProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel={leading === "back" ? SHARE_COPY.back : SHARE_COPY.close}
        accessibilityRole="button"
        onPress={onLeadingPress}
        style={styles.button}
        testID="share-step-leading"
      >
        <Ionicons
          color={colors.textPrimary}
          name={leading === "back" ? "arrow-back" : "close"}
          size={24}
        />
      </Pressable>
      <AppText accessibilityRole="header" align="center" style={styles.title} variant="titleMd">
        {title}
      </AppText>
      <View style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
  },
  button: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  title: {
    flex: 1,
  },
});
