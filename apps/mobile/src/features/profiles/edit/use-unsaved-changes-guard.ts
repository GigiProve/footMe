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
};

export function useUnsavedChangesGuard({
  isDirty,
  isSaving,
  onLeave,
}: UnsavedChangesGuardOptions) {
  return useCallback(() => {
    if (isSaving) {
      return;
    }

    if (!isDirty) {
      onLeave();
      return;
    }

    Alert.alert(
      "Vuoi uscire senza salvare?",
      "Le modifiche effettuate andranno perse.",
      [
        { style: "cancel", text: "Continua a modificare" },
        { onPress: onLeave, style: "destructive", text: "Esci senza salvare" },
      ],
    );
  }, [isDirty, isSaving, onLeave]);
}
