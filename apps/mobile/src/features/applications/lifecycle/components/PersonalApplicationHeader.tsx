/**
 * Testata delle pagine personali della candidatura (screen 01-04).
 *
 * Back e titolo dell'origine, nient'altro: §10 — «Mantieni back e contesto
 * dell'origine». Non è `SocietyContextHeader`, e non per distrazione: quella
 * mostra l'identità della Società che si sta gestendo, e §28 è esplicito —
 * «La pagina personale 01-04 appartiene alla PERSON; la società mostrata è il
 * destinatario.» Metterne lo stemma in testata direbbe il contrario.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

export function PersonalApplicationHeader({
  onBack,
  title,
}: {
  onBack: () => void;
  title: string;
}) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel="Indietro"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        testID="my-application-back"
      >
        <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
      </Pressable>

      <AppText
        accessibilityRole="header"
        color="neutral"
        numberOfLines={1}
        style={styles.title}
        variant="titleSm"
      >
        {title}
      </AppText>

      {/* Simmetrico al back: il titolo resta centrato senza misurarlo. */}
      <View style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  title: {
    flex: 1,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
