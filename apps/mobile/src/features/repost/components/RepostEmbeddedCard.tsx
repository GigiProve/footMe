/**
 * La card dell'originale incorporato (HOM-10 §45–§49, §55–§60, §100, §110–§114,
 * §173–§177, §276–§279). Una sola resa per quattro superfici: composer (§45),
 * Modifica (§161), Feed (§100) e dettaglio del Post (§60).
 *
 * È una preview, non un secondo Post (§56): niente barra di interazione, niente
 * Like, Commenti, Condividi, Salva (§48, §110), niente X né riordino (§47, §162).
 * Riusa `SharePreviewCard` di HOM-09 in formato «chat» (autore con check, excerpt o
 * titolo, thumbnail con Play e durata per il Video, label discreta Post/Articolo/
 * Video) dentro la sua cornice hairline radius 16: un solo core per riconoscere un
 * contenuto, nessun renderer Post annidato (§56–§57). Nessun autoplay: la
 * thumbnail è un'immagine (§113).
 *
 * Tappabile → apre l'originale (§111, §49); chi la usa passa `onPress`. Non
 * disponibile → card generica, SENZA tap (§177): «Contenuto originale non
 * disponibile» e, sotto, «Questo contenuto è stato eliminato o non è più
 * disponibile.» — nessun dettaglio tecnico (§174).
 *
 * A11y (§276–§277): un solo elemento che dice «Contenuto originale incorporato»
 * PRIMA dei metadata, così si capisce che il testo sopra è di chi pubblica e la
 * card di un altro autore.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { SharePreviewCard } from "../../share/components/SharePreviewCard";
import type { EmbeddedReferenceModel } from "../repost-presentation";

type RepostEmbeddedCardProps = {
  model: EmbeddedReferenceModel;
  /** Apre l'originale. Assente = card non tappabile (composer senza navigazione). */
  onPress?: () => void;
  testID?: string;
};

export function RepostEmbeddedCard({ model, onPress, testID = "repost-embedded-card" }: RepostEmbeddedCardProps) {
  if (model.kind === "unavailable") {
    return (
      <View
        accessible
        accessibilityLabel={model.accessibilityLabel}
        style={styles.unavailable}
        testID={`${testID}-unavailable`}
      >
        <Ionicons color={colors.textMuted} name="document-outline" size={24} />
        <AppText align="center" variant="titleSm">
          {model.title}
        </AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          {model.body}
        </AppText>
      </View>
    );
  }

  const card = <SharePreviewCard bordered maxLines={3} preview={model.preview} showAuthorMeta size="chat" />;

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={model.accessibilityLabel} testID={testID}>
        {card}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={model.accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
      testID={testID}
    >
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  unavailable: {
    alignItems: "center",
    backgroundColor: colors.surfacePlaceholder,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[16],
  },
});
