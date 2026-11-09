/**
 * Sezione «Partecipanti» del dettaglio Società (DAS-REV-30 §8, screen 01).
 *
 * «Tre righe leggere: “32 confermati”, “8 richieste in attesa”, “12 inviti
 * inviati”, ciascuna con chevron verso lo stesso centro filtrato.
 * “Gestisci partecipanti” apre il centro con Confermati come default. Non
 * duplicare il riepilogo con tre card numeriche.»
 *
 * Sostituisce la preview «Richieste da valutare» della 29 (§4: «Preferisci
 * il nuovo riepilogo di tre righe … evitando una seconda sezione duplicata
 * con gli stessi pending»). Il chiamante la monta solo se il server ha
 * restituito i count, cioè con la lettura partecipanti (§8).
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Button } from "../../../../../ui";
import { DETAIL_COPY, participantsSummaryRows } from "../event-detail-presentation";
import type { ParticipantsSummary as Summary } from "../event-detail-types";

export function ParticipantsSummary({
  footnote = null,
  manageLabel = DETAIL_COPY.manageParticipants,
  onManage,
  onOpen,
  summary,
}: {
  /**
   * DAS-REV-31 §19, screen 10: nello storico i tre count restano gli stessi
   * (non diventano presenti/assenti); la CTA diventa «Visualizza
   * partecipanti» con la nota sullo storico.
   */
  footnote?: string | null;
  manageLabel?: string;
  onManage: () => void;
  onOpen: (filter: "confirmed" | "pending" | "invited") => void;
  summary: Summary;
}) {
  return (
    <View style={styles.section} testID="event-participants-summary">
      <AppText accessibilityRole="header" color="neutral" variant="titleSm">
        {DETAIL_COPY.participantsTitle}
      </AppText>

      <View>
        {participantsSummaryRows(summary).map((row, index) => (
          <Pressable
            accessibilityHint="Apre i partecipanti con questo filtro"
            accessibilityLabel={row.label}
            accessibilityRole="button"
            key={row.filter}
            onPress={() => onOpen(row.filter)}
            style={({ pressed }) => [styles.row, index > 0 ? styles.divider : null, pressed ? styles.pressed : null]}
            testID={`event-participants-${row.filter}`}
          >
            <Ionicons color={colors.textNeutral} name={row.icon} size={20} />
            <AppText color="neutral" style={styles.label} variant="bodySm">
              {row.label}
            </AppText>
            <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={18} />
          </Pressable>
        ))}
      </View>

      <Button
        fullWidth
        label={manageLabel}
        onPress={onManage}
        size="lg"
        testID="event-manage-participants"
        variant="secondary"
      />

      {footnote ? (
        <AppText color="neutralMuted" testID="event-participants-footnote" variant="meta">
          {footnote}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[4],
  },
  section: {
    gap: spacing[8],
  },
});
