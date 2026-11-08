/**
 * «Richieste da valutare» nel dettaglio Società (DAS-REV-29 §17).
 *
 * «Se manca [un'entry gestionale], inserisci nel dettaglio Società
 * dell'evento una preview compatta … con massimo tre richieste PENDING più
 * vecchie.» Nessun «Vedi tutte»: il centro partecipanti è della 30 e una CTA
 * verso una destinazione inesistente è vietata. Dopo ogni decisione il
 * server restituisce le successive, quindi tutte restano raggiungibili.
 *
 * Un `ContentModule` senza rail azioni: eyebrow che dice perché il blocco è
 * lì, righe separate dal divider. Con zero richieste il chiamante non lo
 * monta (§17: «ometti la sezione senza grande empty card»).
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";
import { DETAIL_COPY, personMeta } from "../event-detail-presentation";
import type { PendingRequestPreview } from "../event-detail-types";

export function PendingRequestsPreview({
  items,
  onOpen,
}: {
  items: readonly PendingRequestPreview[];
  onOpen: (participationId: string) => void;
}) {
  return (
    <View style={styles.module} testID="event-pending-preview">
      <AppText color="neutralMuted" style={styles.eyebrow} variant="eyebrow">
        {DETAIL_COPY.pendingEyebrow}
      </AppText>

      {items.map((item, index) => (
        <Pressable
          accessibilityLabel={`${item.fullName}, ${personMeta(item.role, item.birthYear)}`}
          accessibilityRole="button"
          key={item.participationId}
          onPress={() => onOpen(item.participationId)}
          style={({ pressed }) => [
            styles.row,
            index > 0 ? styles.divider : null,
            pressed ? styles.pressed : null,
          ]}
          testID={`event-pending-${item.participationId}`}
        >
          <Avatar name={item.fullName} size="sm" uri={item.avatarUrl ?? undefined} />
          <View style={styles.body}>
            <AppText color="neutral" numberOfLines={1} variant="titleSm">
              {item.fullName}
            </AppText>
            <AppText color="neutralMuted" numberOfLines={1} variant="bodySm">
              {personMeta(item.role, item.birthYear)}
            </AppText>
          </View>
          <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={18} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[4],
  },
  divider: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: {
    paddingBottom: spacing[4],
    paddingTop: spacing[12],
  },
  module: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[12],
    paddingVertical: spacing[8],
  },
});
