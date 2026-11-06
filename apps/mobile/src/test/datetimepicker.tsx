/**
 * Stub di `@react-native-community/datetimepicker` per i test.
 *
 * Il pacchetto è distribuito in **Flow**, non in TypeScript né in JS
 * compilato: il transform di vitest lo incontra e fallisce al primo
 * annotatore di tipo, prima ancora di eseguire un test. L'alias in
 * `vitest.config.js` lo sostituisce con questo modulo.
 *
 * Non è un picker funzionante e non deve esserlo: nei test di rendering
 * serve solo che il componente esista, accetti le stesse props e produca un
 * nodo identificabile. La scelta della data si prova sulle funzioni pure
 * (`toCivilDate`, la validazione del giorno passato), non pilotando una
 * ruota nativa.
 */
import { View } from "react-native";

type Props = {
  testID?: string;
  value?: Date;
};

export default function DateTimePicker({ testID, value }: Props) {
  return (
    <View
      accessibilityLabel={value ? value.toDateString() : undefined}
      testID={testID ?? "date-time-picker"}
    />
  );
}
