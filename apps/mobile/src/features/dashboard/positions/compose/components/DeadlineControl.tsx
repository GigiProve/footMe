import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";
import { PositionDeadlineSheet } from "../../components/PositionDeadlineSheet";
import {
  POSITIONS_COPY,
  formatCivilDateLabel,
} from "../../positions-presentation";

type Props = {
  busy?: boolean;
  error?: string | null;
  /**
   * Giorno civile `YYYY-MM-DD` già nel fuso della Società, o `null`.
   *
   * Può restituire una promessa: lo sheet si chiude **solo** quando quella
   * si risolve. §9 — «in errore conserva la selezione e non mostrare la
   * scelta come già salvata»: chiudere prima dell'esito farebbe esattamente
   * il contrario, e costringerebbe a riscegliere la data.
   */
  onChange: (deadlineDate: string | null) => void | Promise<unknown>;
  /** Nascosto su una riga di riepilogo: lo screen 01 lo mostra, §11 no. */
  showHelper?: boolean;
  testID?: string;
  value: string | null;
};

/**
 * Riga «Scadenza candidature» nella fase di pubblicazione (DAS-REV-18 §9;
 * screen 01).
 *
 * «Inserisci Scadenza candidature nella fase 3 di 3 · Anteprima, dopo il
 * contenuto di preview e prima delle azioni finali. È una configurazione
 * owner della pubblicazione, visivamente separata dal renderer del
 * candidato.»
 *
 * Il selector non vive qui: è `PositionDeadlineSheet`, lo stesso che la
 * posizione attiva apre da «Modifica scadenza». §3 — «La proprietà del
 * container non giustifica una seconda implementazione del comando.»
 * Questo componente è solo la riga e il suo stato di apertura.
 *
 * Confermare **non pubblica** (§9): `onChange` persiste sulla stessa bozza,
 * e la pubblicazione resta la CTA del footer.
 */
export function DeadlineControl({
  busy = false,
  error,
  onChange,
  showHelper = true,
  testID = "compose-deadline",
  value,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const summary = formatCivilDateLabel(value) ?? POSITIONS_COPY.deadlineNone;

  return (
    <View style={styles.block}>
      <Pressable
        accessibilityHint="Apre la scelta della scadenza"
        accessibilityLabel={`${POSITIONS_COPY.deadlineLabel}: ${summary}`}
        accessibilityRole="button"
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID={testID}
      >
        <View style={styles.rowText}>
          <AppText color="neutralMuted" variant="meta">
            {POSITIONS_COPY.deadlineLabel}
          </AppText>

          <AppText color="neutral" variant="bodyLg">
            {summary}
          </AppText>
        </View>

        <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
      </Pressable>

      {/* §9: «Puoi impostare un termine prima di pubblicare.» Una data
          assente è valida, e la riga lo dice invece di sembrare un campo da
          compilare. */}
      {showHelper ? (
        <AppText color="neutralMuted" variant="meta">
          {POSITIONS_COPY.deadlineComposeHelper}
        </AppText>
      ) : null}

      {/* L'errore compare sotto la riga solo quando lo sheet è chiuso: con
          lo sheet aperto è lì che va letto, accanto alla scelta. */}
      {error && !sheetOpen ? (
        <AppText accessibilityRole="alert" color="danger" variant="meta">
          {error}
        </AppText>
      ) : null}

      <PositionDeadlineSheet
        busy={busy}
        error={error}
        mode="draft"
        onClose={() => setSheetOpen(false)}
        onConfirm={(deadlineDate) => {
          const result = onChange(deadlineDate);

          if (result instanceof Promise) {
            result.then(
              () => setSheetOpen(false),
              /* Il messaggio arriva da `error`: qui basta non chiudere, e
                 non lasciare una promessa rifiutata senza gestore. */
              () => undefined,
            );

            return;
          }

          setSheetOpen(false);
        }}
        value={value}
        visible={sheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingTop: spacing[12],
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
});
