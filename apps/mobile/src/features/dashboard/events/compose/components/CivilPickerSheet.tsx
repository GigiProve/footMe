import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { spacing } from "../../../../../theme/tokens";
import { BottomSheet, Button } from "../../../../../ui";
import { EVENTS_COPY } from "../../events-copy";

type Props = {
  mode: "date" | "time";
  onClose: () => void;
  /** `YYYY-MM-DD` per una data, `HH:MM` per un orario. */
  onConfirm: (value: string) => void;
  title: string;
  value: string | null;
  visible: boolean;
};

/**
 * Selettore di un giorno o di un orario **civile** (DAS-REV-28 §15).
 *
 * Il picker nativo lavora con un `Date` del dispositivo; qui se ne leggono
 * solo anno/mese/giorno o ore/minuti locali, e si restituisce una stringa
 * civile. Nessun `toISOString()`: la conversione in istante la fa il server,
 * nel fuso dell'evento, quindi un telefono con un altro fuso non sposta
 * l'orario scelto (QA-049).
 *
 * Su iOS la ruota sta in uno sheet con Conferma, come il selettore della
 * scadenza delle Posizioni; su Android si usa il dialogo di sistema, che
 * conferma da sé.
 */
export function CivilPickerSheet({ mode, onClose, onConfirm, title, value, visible }: Props) {
  const [draft, setDraft] = useState<Date>(() => fromCivil(mode, value));

  const [opened, setOpened] = useState(false);

  if (visible && !opened) {
    setOpened(true);
    setDraft(fromCivil(mode, value));
  } else if (!visible && opened) {
    setOpened(false);
  }

  if (Platform.OS !== "ios") {
    return visible ? (
      <DateTimePicker
        display="default"
        is24Hour
        mode={mode}
        onChange={(event, date) => {
          onClose();

          if (event.type === "set" && date) {
            onConfirm(toCivil(mode, date));
          }
        }}
        testID={`event-picker-${mode}`}
        value={draft}
      />
    ) : null;
  }

  return (
    <BottomSheet onClose={onClose} title={title} visible={visible}>
      <DateTimePicker
        display="spinner"
        is24Hour
        locale="it-IT"
        mode={mode}
        onChange={(_event, date) => {
          if (date) {
            setDraft(date);
          }
        }}
        testID={`event-picker-${mode}`}
        value={draft}
      />

      <View style={styles.confirm}>
        <Button
          fullWidth
          label={EVENTS_COPY.confirm}
          onPress={() => onConfirm(toCivil(mode, draft))}
          testID={`event-picker-${mode}-confirm`}
        />
      </View>
    </BottomSheet>
  );
}

const pad = (value: number) => String(value).padStart(2, "0");

export function toCivil(mode: "date" | "time", date: Date): string {
  return mode === "date"
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Il costruttore a componenti è locale; `new Date("YYYY-MM-DD")` sarebbe UTC. */
export function fromCivil(mode: "date" | "time", value: string | null): Date {
  const now = new Date();

  if (mode === "date") {
    const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;

    return match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const match = value ? /^(\d{2}):(\d{2})/.exec(value) : null;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  base.setHours(match ? Number(match[1]) : 15, match ? Number(match[2]) : 0, 0, 0);

  return base;
}

const styles = StyleSheet.create({
  confirm: {
    paddingTop: spacing[16],
  },
});
