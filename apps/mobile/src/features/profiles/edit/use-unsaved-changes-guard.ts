/**
 * Uscita da una schermata di modifica (§G).
 *
 * Tre comportamenti, non uno:
 *  - nessuna modifica → si esce subito;
 *  - modifiche non salvate → si conferma;
 *  - salvataggio in corso → non si esce e non si reinvia, per non lasciare
 *    la sezione in uno stato incoerente.
 */
import { useCallback } from "react";
import { Alert } from "react-native";

type UnsavedChangesGuardOptions = {
  isDirty: boolean;
  isSaving: boolean;
  onLeave: () => void;
  /**
   * Titolo del dialogo. Il default è quello con cui i primi ruoli sono stati
   * approvati; REV-PROF-20 chiede la forma più breve, e cambiarla solo dove è
   * richiesta evita di riscrivere la copy di sei editor già rilasciati.
   */
  title?: string;
};

export function useUnsavedChangesGuard({
  isDirty,
  isSaving,
  onLeave,
  title = "Vuoi uscire senza salvare?",
}: UnsavedChangesGuardOptions) {
  return useCallback(() => {
    if (isSaving) {
      return;
    }

    if (!isDirty) {
      onLeave();
      return;
    }

    Alert.alert(title, "Le modifiche effettuate andranno perse.", [
      { style: "cancel", text: "Continua a modificare" },
      { onPress: onLeave, style: "destructive", text: "Esci senza salvare" },
    ]);
  }, [isDirty, isSaving, onLeave, title]);
}
