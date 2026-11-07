/**
 * Selector dello stato (DAS-REV-25 §17, screen 07).
 *
 * «Nel selector Stato usa radio, non checkbox. Conferma conferma la scelta
 * soltanto nel draft dell'editor e chiude lo sheet. X/back/swipe annullano
 * la scelta temporanea non confermata. Nessuna di queste azioni salva
 * ancora la valutazione sul server.»
 *
 * Da cui una terza copia del valore, oltre a server-state e draft
 * dell'editor: la **selezione temporanea** dello sheet. §20 la vuole
 * separata — «La chiusura del solo selector Stato scarta soltanto la sua
 * selezione temporanea, mantenendo il resto del draft» — e senza una
 * variabile propria quella frase non sarebbe implementabile.
 *
 * I sei stati sono quelli canonici e le transizioni sono libere: §17 —
 * «Consentire transizioni dirette fra tutti i valori validi: non è una
 * pipeline con step obbligatori.»
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button, Radio } from "../../../../ui";
import {
  ALL_EVALUATION_STATUSES,
  EVALUATION_LABELS,
  SHORTLIST_COPY,
} from "../shortlist-presentation";
import type { ShortlistEvaluationStatus } from "../shortlist-types";

type Props = {
  onClose: () => void;
  onConfirm: (status: ShortlistEvaluationStatus) => void;
  value: ShortlistEvaluationStatus;
  visible: boolean;
};

export function ShortlistStatusSheet({
  onClose,
  onConfirm,
  value,
  visible,
}: Props) {
  const [pending, setPending] = useState<ShortlistEvaluationStatus>(value);

  useEffect(() => {
    if (visible) {
      setPending(value);
    }
  }, [value, visible]);

  return (
    <BottomSheet
      onClose={onClose}
      title={SHORTLIST_COPY.statusSheetTitle}
      visible={visible}
    >
      {/* §31: «Editor priorità e selector stato: radio singole correttamente
          raggruppate.» */}
      <View accessibilityRole="radiogroup" style={styles.group}>
        {ALL_EVALUATION_STATUSES.map((option) => (
          <Radio
            checked={pending === option}
            key={option}
            label={EVALUATION_LABELS[option]}
            onPress={() => setPending(option)}
            testID={`shortlist-status-${option}`}
          />
        ))}
      </View>

      <AppText color="neutralMuted" style={styles.helper} variant="meta">
        {SHORTLIST_COPY.statusSheetHelper}
      </AppText>

      {/* §17: Conferma tocca **solo** il draft dell'editor. §31: «La
          conferma locale dello stato non deve essere annunciata come
          salvataggio sul server.» */}
      <Button
        accessibilityLabel={`${SHORTLIST_COPY.statusSheetConfirm}. Aggiorna la scelta nel modulo, senza salvare.`}
        label={SHORTLIST_COPY.statusSheetConfirm}
        onPress={() => onConfirm(pending)}
        size="lg"
        testID="shortlist-status-confirm"
        variant="primary"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing[4],
    paddingTop: spacing[8],
  },
  helper: {
    paddingBottom: spacing[16],
    paddingTop: spacing[12],
  },
});
