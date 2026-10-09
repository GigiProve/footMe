/**
 * Uscita da una schermata di modifica (§G).
 *
 * Tre comportamenti, non uno:
 *  - nessuna modifica → si esce subito;
 *  - modifiche non salvate → si conferma;
 *  - salvataggio in corso → non si esce e non si reinvia, per non lasciare
 *    la sezione in uno stato incoerente.
 *
 * Il chevron dello scaffold non è l'unico modo di uscire: il tasto back
 * Android e la gesture di scorrimento iOS bypassavano questo dialogo perché
 * nessuno intercettava il back "di sistema" (richiesto da tutte le spec
 * REV-PROF-02/04/05/07/08/11/16). Ci agganciamo quindi all'evento
 * `beforeRemove` del navigatore, che scatta anche per il back hardware e per
 * la gesture, non solo per `goBack()` chiamato a mano; non serve
 * `BackHandler` perché su Android il back dentro uno Stack passa comunque per
 * l'azione di pop del navigatore, cioè per lo stesso evento.
 *
 * Usiamo `useNavigation` di expo-router e non `usePreventRemove` di React
 * Navigation: `@react-navigation/native` non è una dipendenza di questo
 * progetto (expo-router ne incorpora una copia privata, non riesportata), e
 * importarlo direttamente non compila.
 */
import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";

/**
 * Vista minima del navigatore per il solo evento `beforeRemove`: l'azione
 * bloccata viaggia dentro l'evento e la rilanciamo invariata dopo la
 * conferma, senza sapere di che azione si tratti.
 */
type BeforeRemoveEvent = {
  data: { action: Parameters<BeforeRemoveNavigator["dispatch"]>[0] };
  preventDefault: () => void;
};

type BeforeRemoveNavigator = {
  addListener: (
    type: "beforeRemove",
    callback: (event: BeforeRemoveEvent) => void,
  ) => () => void;
  dispatch: (action: unknown) => void;
};

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
  title = "Uscire senza salvare?",
}: UnsavedChangesGuardOptions) {
  /*
    Quando l'utente conferma l'uscita dal dialogo di sistema, richiamiamo lo
    stesso `onLeave` usato dal chevron (es. `router.back()`), ma a quel punto
    `isDirty` è ancora vero: senza questo bypass, il nuovo tentativo di uscita
    verrebbe intercettato di nuovo da `usePreventRemove` e il dialogo si
    riaprirebbe all'infinito. Il ref è per-istanza dell'hook, quindi non
    sopravvive a un rimontaggio della schermata.
  */
  const bypassRef = useRef(false);
  const navigation = useNavigation();

  useEffect(() => {
    /*
      `beforeRemove` è cancellabile: finché ci sono modifiche non salvate
      blocchiamo la rimozione della schermata e chiediamo conferma. Se
      l'utente conferma, rilanciamo la stessa azione che il navigatore stava
      per eseguire, così back hardware e gesture si comportano come il
      chevron.

      L'evento esiste a runtime ma non nei tipi del navigatore generico
      esposto da expo-router, che non sa quale navigatore stia sotto la
      schermata: da qui la vista strutturale qui sotto, l'unico punto in cui
      aggiriamo i tipi.
    */
    const navigator = navigation as unknown as BeforeRemoveNavigator;

    const unsubscribe = navigator.addListener(
      "beforeRemove",
      (event: BeforeRemoveEvent) => {
        if (bypassRef.current || isSaving || !isDirty) {
          return;
        }

        event.preventDefault();

        Alert.alert(title, "Le modifiche effettuate andranno perse.", [
          { style: "cancel", text: "Continua a modificare" },
          {
            onPress: () => {
              bypassRef.current = true;
              navigator.dispatch(event.data.action);
            },
            style: "destructive",
            text: "Esci senza salvare",
          },
        ]);
      },
    );

    return unsubscribe;
  }, [isDirty, isSaving, navigation, title]);

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
