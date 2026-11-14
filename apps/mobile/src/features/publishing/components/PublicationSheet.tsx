/**
 * «Quando vuoi pubblicare?» (HOM-06.2 §86–§102, §168–§169; mockup 5).
 *
 * UNO scheduler per Post e Articolo, per la scelta nel composer e per «Cambia
 * data e ora» dalla lista (§169: nessun EditScheduleScreen separato).
 *  • default Ora (§87); Programma mostra Data e Ora (§89) e Conferma (§90);
 *  • la scelta si fa in data e ora civili del dispositivo, convertite UNA volta
 *    in istante UTC (§99, §102); nessun selector di fuso in V1 (§101), il fuso
 *    è solo dichiarato nella nota;
 *  • si rivalida alla conferma (§98: l'ora può passare a sheet aperto);
 *  • `blockedReason` (es. video in elaborazione §108–§109) impedisce la
 *    conferma di una data futura ma lascia scegliere Ora.
 *
 * Su iOS il picker è inline nello stesso sheet (niente secondo Modal sopra il
 * primo); su Android il dialogo di sistema, che conferma da sé.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { fromCivil, toCivil } from "../../dashboard/events/compose/components/CivilPickerSheet";
import { colors, radius, sizes, spacing } from "../../../styles";
import { AppText, BottomSheet, Button } from "../../../ui";
import {
  defaultScheduleChoice,
  deviceTimeZone,
  instantToCivil,
  scheduleValidationCopy,
  validateScheduleChoice,
  type CivilChoice,
} from "../publishing-presentation";
import type { Publication, SchedulePolicy } from "../publishing-types";

type Props = {
  visible: boolean;
  publication: Publication;
  policy: SchedulePolicy;
  onClose: () => void;
  onConfirm: (publication: Publication) => void;
  /** «Cambia data e ora» di un programmato: niente opzione Ora (Pubblica ora è un'azione a parte, §93). */
  futureOnly?: boolean;
  /** Motivo per cui una data futura non è confermabile ora (§108–§109). */
  blockedReason?: string | null;
  busy?: boolean;
  /** Errore del server sulla conferma (es. schedule_too_soon), mostrato sotto i campi. */
  serverError?: string | null;
};

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function longDate(civil: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(civil);
  return match ? `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : "";
}

export function PublicationSheet({
  visible,
  publication,
  policy,
  onClose,
  onConfirm,
  futureOnly = false,
  blockedReason = null,
  busy = false,
  serverError = null,
}: Props) {
  const initialChoice = () =>
    (publication.mode === "scheduled" ? instantToCivil(publication.scheduledAt) : null) ?? defaultScheduleChoice();

  const [mode, setMode] = useState<"now" | "scheduled">(futureOnly ? "scheduled" : publication.mode);
  const [choice, setChoice] = useState<CivilChoice>(initialChoice);
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  // Ogni apertura riparte dalla pubblicazione corrente (stesso schema di CivilPickerSheet).
  if (visible && !opened) {
    setOpened(true);
    setMode(futureOnly ? "scheduled" : publication.mode);
    setChoice(initialChoice());
    setPicker(null);
    setError(null);
  } else if (!visible && opened) {
    setOpened(false);
  }

  const timeZone = deviceTimeZone();

  const confirm = () => {
    if (mode === "now") {
      onConfirm({ mode: "now" });
      return;
    }
    if (blockedReason) {
      setError(blockedReason);
      return;
    }
    const result = validateScheduleChoice(choice, policy);
    if (!result.ok) {
      setError(scheduleValidationCopy(result.reason, policy));
      return;
    }
    onConfirm({ mode: "scheduled", scheduledAt: result.scheduledAt, timezone: timeZone });
  };

  const setPart = (part: "date" | "time", value: Date) => {
    setChoice((current) => ({ ...current, [part]: toCivil(part, value) }));
    setError(null);
  };

  const option = (value: "now" | "scheduled", title: string, subtitle: string) => {
    const selected = mode === value;
    return (
      <Pressable
        accessibilityLabel={`${title}. ${subtitle}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={() => {
          setMode(value);
          setError(null);
        }}
        style={[styles.option, selected ? styles.optionSelected : null]}
        testID={`publication-option-${value}`}
      >
        <View style={styles.optionText}>
          <AppText variant="titleSm">{title}</AppText>
          <AppText color="secondary" variant="bodySm">
            {subtitle}
          </AppText>
        </View>
        {/* Lo stato selezionato non è affidato al solo colore: cerchio pieno vs vuoto (§7A). */}
        <Ionicons
          color={selected ? colors.accent : colors.textMuted}
          name={selected ? "radio-button-on" : "radio-button-off"}
          size={24}
        />
      </Pressable>
    );
  };

  const fieldRow = (part: "date" | "time") => (
    <Pressable
      accessibilityLabel={part === "date" ? `Data: ${longDate(choice.date)}` : `Ora: ${choice.time}`}
      accessibilityRole="button"
      onPress={() => setPicker(picker === part ? null : part)}
      style={styles.field}
      testID={`publication-${part}`}
    >
      <View style={styles.fieldText}>
        <AppText color="secondary" variant="caption">
          {part === "date" ? "Data" : "Ora"}
        </AppText>
        <AppText variant="titleSm">{part === "date" ? longDate(choice.date) : choice.time}</AppText>
      </View>
      <Ionicons color={colors.textPrimary} name={part === "date" ? "calendar-outline" : "time-outline"} size={22} />
    </Pressable>
  );

  const pickerValue = picker ? fromCivil(picker, picker === "date" ? choice.date : choice.time) : new Date();

  return (
    <BottomSheet onClose={onClose} title="Quando vuoi pubblicare?" visible={visible}>
      <View style={styles.body}>
        {/* «Cambia data e ora» (§168): la sola scelta è la data, nessuna card radio da selezionare. */}
        {futureOnly ? null : option("now", "Ora", "Pubblica subito")}
        {futureOnly ? null : option("scheduled", "Programma", "Scegli data e ora")}

        {mode === "scheduled" ? (
          <View style={styles.fields}>
            {fieldRow("date")}
            {fieldRow("time")}
            {picker && Platform.OS === "ios" ? (
              <DateTimePicker
                display={picker === "date" ? "inline" : "spinner"}
                is24Hour
                locale="it-IT"
                minimumDate={picker === "date" ? new Date() : undefined}
                mode={picker}
                onChange={(_event, date) => {
                  if (date) setPart(picker, date);
                }}
                testID={`publication-picker-${picker}`}
                value={pickerValue}
              />
            ) : null}
            {picker && Platform.OS !== "ios" ? (
              <DateTimePicker
                display="default"
                is24Hour
                minimumDate={picker === "date" ? new Date() : undefined}
                mode={picker}
                onChange={(event, date) => {
                  const part = picker;
                  setPicker(null);
                  if (event.type === "set" && date) setPart(part, date);
                }}
                testID={`publication-picker-${picker}`}
                value={pickerValue}
              />
            ) : null}
            <View accessibilityRole="text" style={styles.note}>
              <Ionicons color={colors.textSecondary} name="information-circle-outline" size={18} />
              <AppText color="secondary" style={styles.noteText} variant="caption">
                {`Il contenuto sarà pubblicato in base al tuo fuso orario: ${timeZone}`}
              </AppText>
            </View>
          </View>
        ) : null}

        {error || serverError ? (
          <AppText accessibilityLiveRegion="polite" color="danger" variant="bodySm">
            {error ?? serverError}
          </AppText>
        ) : null}

        <Button
          disabled={busy}
          fullWidth
          label="Conferma"
          loading={busy}
          onPress={confirm}
          testID="publication-confirm"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing[12],
  },
  field: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  fieldText: {
    flex: 1,
    gap: spacing[4],
  },
  fields: {
    gap: spacing[4],
  },
  note: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[16],
    flexDirection: "row",
    gap: spacing[8],
    marginTop: spacing[8],
    padding: spacing[12],
  },
  noteText: {
    flex: 1,
  },
  option: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    padding: spacing[16],
  },
  optionSelected: {
    borderColor: colors.accent,
  },
  optionText: {
    flex: 1,
    gap: spacing[4],
  },
});
