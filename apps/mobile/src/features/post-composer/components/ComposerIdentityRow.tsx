/**
 * Riga identità autore, subito sotto l'header (HOM-06.1 §14–17, §181, §197).
 *
 * Avatar/logo ben visibile, nome, check standard. Il chevron e il tap esistono
 * solo con `selectable` (più identità autorizzate, §17): con una sola identità
 * la riga è puramente informativa, senza freccia né «Pubblica come» (§16). In
 * Modifica l'autore è fisso (§147): il chiamante passa `selectable={false}`.
 *
 * L'etichetta parlata arriva dal chiamante (es. «Pubblica come Matteo Rossi,
 * profilo verificato», §197) perché dipende dal contesto create/edit.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, VerifiedCheck } from "../../../ui";
import type { ComposerIdentity } from "../composer-types";
import { ComposerAvatar } from "./ComposerAvatar";

type ComposerIdentityRowProps = {
  identity: ComposerIdentity;
  /** true solo se esiste più di una identità autorizzata. */
  selectable: boolean;
  accessibilityLabel: string;
  /** Apre «Pubblica come». Ignorato quando `selectable` è false. */
  onPress?: () => void;
  /**
   * HOM-10 §26: nel Repost sotto il nome sta il metadata breve («Allenatore · AC Como»,
   * «Società»). Il composer Post non lo mostra.
   */
  showContext?: boolean;
  /**
   * HOM-10 §38–§39: l'identità non è più fra quelle autorizzate. Resta visibile, attenuata, così non sembra
   * valida; il selector (se c'è un'altra identità) e la frase di permesso perso dicono il resto.
   */
  unauthorized?: boolean;
};

export function ComposerIdentityRow({
  identity,
  selectable,
  accessibilityLabel,
  onPress,
  showContext = false,
  unauthorized = false,
}: ComposerIdentityRowProps) {
  const content = (
    <>
      <ComposerAvatar
        name={identity.name}
        size="md"
        square={identity.type !== "person"}
        uri={identity.avatarUrl}
      />
      <View style={styles.identityText}>
        <View style={styles.nameRow}>
          <AppText numberOfLines={1} style={styles.name} variant="titleMd">
            {identity.name}
          </AppText>
          {identity.isVerified ? <VerifiedCheck /> : null}
        </View>
        {showContext && identity.contextLabel ? (
          <AppText color="muted" numberOfLines={1} variant="feedMeta">
            {identity.contextLabel}
          </AppText>
        ) : null}
      </View>
      {selectable ? (
        <Ionicons color={colors.textSecondary} name="chevron-down" size={20} />
      ) : null}
    </>
  );

  if (!selectable) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        accessible
        style={[styles.row, unauthorized ? styles.unauthorized : null]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unauthorized ? styles.unauthorized : null,
        pressed ? styles.pressed : null,
      ]}
      testID="composer-identity-row"
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identityText: {
    flex: 1,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  unauthorized: {
    opacity: 0.5,
  },
});
