/**
 * Riga destinatario del passo «Invia a» (HOM-09 §44, §59–§67, §228–§230).
 *
 * Una riga pulita, non una card selezionabile (§67, §244): avatar, nome con
 * check standard, una sola riga di metadata, controllo di selezione a destra.
 * Lo stato selezionato è il check (§67), non un fondo colorato. Un destinatario
 * non contattabile resta visibile e disabilitato con «Non disponibile per i
 * messaggi» (§56–§57): nessuna selezione destinata a fallire (§121).
 *
 * Un solo controllo per lo screen reader: nome, tipo e stato nell'etichetta
 * («Staff Prima Squadra, gruppo, 8 partecipanti, selezionato», §230). Target
 * ≥ 44pt (§236).
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, VerifiedCheck } from "../../../ui";
import { recipientAccessibilityLabel, recipientMetaLine } from "../share-presentation";
import type { ShareRecipient } from "../share-types";
import { RecipientAvatar } from "./RecipientAvatar";

type ShareRecipientRowProps = {
  recipient: ShareRecipient;
  selected: boolean;
  onToggle: (recipient: ShareRecipient) => void;
};

export function ShareRecipientRow({ recipient, selected, onToggle }: ShareRecipientRowProps) {
  const meta = recipientMetaLine(recipient);
  const disabled = !recipient.available;

  return (
    <Pressable
      accessibilityLabel={recipientAccessibilityLabel(recipient, disabled ? null : selected)}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onToggle(recipient)}
      style={({ pressed }) => [
        styles.row,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
      testID={`share-recipient-${recipient.key}`}
    >
      <RecipientAvatar recipient={recipient} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText numberOfLines={1} style={styles.name} variant="titleSm">
            {recipient.displayName}
          </AppText>
          {recipient.isVerified ? <VerifiedCheck size={14} /> : null}
        </View>
        {meta ? (
          <AppText color="secondary" numberOfLines={1} variant="bodySm">
            {meta}
          </AppText>
        ) : null}
      </View>
      {disabled ? null : (
        <Ionicons
          color={selected ? colors.accent : colors.borderStrong}
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          testID={selected ? "share-recipient-checked" : "share-recipient-unchecked"}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[4],
  },
  disabled: {
    opacity: 0.5,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[16],
    paddingVertical: spacing[8],
  },
});
