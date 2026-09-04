import {
  Mulish_800ExtraBold,
  Mulish_900Black,
  useFonts,
} from "@expo-google-fonts/mulish";

/**
 * Mulish è la sola famiglia caricata: serve per numeri, statistiche, titoli di
 * schermata e nomi in hero (§1a). Tutto il resto usa la system UI, che non ha
 * bisogno di caricamento.
 *
 * Ritorna `true` quando i font sono pronti (o quando il caricamento è fallito:
 * in quel caso si continua con il fallback di sistema invece di bloccare l'app).
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Mulish_800ExtraBold,
    Mulish_900Black,
  });

  return loaded || error != null;
}
