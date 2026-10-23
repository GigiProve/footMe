import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";

type Props = {
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
  onBack: () => void;
};

/**
 * App bar del composer (DAS-REV-16 §4, screen 01-12).
 *
 * «Mantieni app bar compatta con back, logo Society, nome e verifica solo se
 * reale. La Society rimane fissa per la sessione di creazione.»
 *
 * Non è `SocietyIdentityHeader`: quella è l'identità in testa a una pagina
 * gestionale, con `kindLabel` e ambito sotto. Qui l'identità sta **nella**
 * barra, accanto al back, e i titoli funzionali stanno nel body — come il
 * PNG mostra in tutti e dodici gli screen.
 *
 * Nessuna azione a destra: §4 vieta «FAB, campanella o menu generale sopra i
 * campi», e un cambio di identità dentro il form.
 */
export function ComposerNavBar({ isVerified, logoUrl, name, onBack }: Props) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel="Indietro"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        testID="compose-back"
      >
        <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
      </Pressable>

      <Avatar name={name} size="sm" square tone="ink" uri={logoUrl ?? undefined} />

      <AppText
        color="neutral"
        numberOfLines={1}
        style={styles.name}
        variant="titleSm"
      >
        {name}
      </AppText>

      {isVerified ? (
        <Ionicons
          accessibilityLabel="Società verificata"
          color={colors.accent}
          name="checkmark-circle"
          size={15}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    /* Il gutter appartiene alla barra: tenerlo nei chiamanti significava
       ripeterlo in tre schermate e dimenticarlo nelle altre due. */
    paddingHorizontal: spacing[20],
  },
  name: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
