import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";

type Props = {
  busy?: boolean;
  error?: string | null;
  /** Giorno civile `YYYY-MM-DD` già nel fuso della Società, o `null`. */
  onChange: (deadlineDate: string | null) => void;
  value: string | null;
};

/**
 * Scadenza candidature, nella fase di pubblicazione (DAS-REV-16 §23,
 * master DAS-REV-18).
 *
 * «Nello step 3, dopo il contenuto della preview e prima delle CTA, mostra
 * il controllo owner Scadenza candidature · Nessuna scadenza. Il selector
 * condiviso offre soltanto Nessuna scadenza e Imposta una data.»
 *
 * Il valore è un **giorno civile**, non un istante: il server lo trasforma
 * nell'ultimo istante di quel giorno nel fuso della Società. Per questo qui
 * non compare nessun `toISOString()`, che sposterebbe il giorno di chi vive
 * a ovest di Greenwich (§23).
 *
 * Nessuna ora, nessun preset di durata, nessun «Applica a tutte»: §23 li
 * esclude, e §24 chiede che la modifica riguardi solo quell'ID.
 */
export function DeadlineControl({ busy = false, error, onChange, value }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"none" | "date">(value ? "date" : "none");
  const [draftDate, setDraftDate] = useState<string | null>(value);
  const [pickerOpen, setPickerOpen] = useState(false);

  /* Riapertura: lo sheet riparte sempre dal valore confermato, mai da ciò
     che era rimasto da un'apertura abbandonata. */
  useEffect(() => {
    if (sheetOpen) {
      setMode(value ? "date" : "none");
      setDraftDate(value);
      setPickerOpen(false);
    }
  }, [sheetOpen, value]);

  const summary = value ? formatCivilDate(value) : "Nessuna scadenza";

  return (
    <View style={styles.block}>
      <Pressable
        accessibilityHint="Apre la scelta della scadenza"
        accessibilityLabel={`Scadenza candidature: ${summary}`}
        accessibilityRole="button"
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID="compose-deadline"
      >
        <View style={styles.rowText}>
          <AppText color="neutralMuted" variant="meta">
            Scadenza candidature
          </AppText>

          <AppText color="neutral" variant="bodyLg">
            {summary}
          </AppText>
        </View>

        <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
      </Pressable>

      {error ? (
        <AppText accessibilityRole="alert" color="danger" variant="meta">
          {error}
        </AppText>
      ) : null}

      <BottomSheet
        onClose={() => setSheetOpen(false)}
        title="Scadenza candidature"
        visible={sheetOpen}
      >
        <OptionRow
          label="Nessuna scadenza"
          onPress={() => {
            setMode("none");
            setDraftDate(null);
            setPickerOpen(false);
          }}
          selected={mode === "none"}
        />

        <OptionRow
          label="Imposta una data"
          onPress={() => {
            setMode("date");
            setPickerOpen(true);
          }}
          selected={mode === "date"}
        />

        {mode === "date" ? (
          <View style={styles.picker}>
            {Platform.OS === "ios" ? (
              <DateTimePicker
                display="inline"
                mode="date"
                onChange={(_event, date) => {
                  if (date) {
                    setDraftDate(toCivilDate(date));
                  }
                }}
                value={fromCivilDate(draftDate)}
              />
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPickerOpen(true)}
                  style={styles.androidDate}
                >
                  <AppText color="neutral" variant="bodyLg">
                    {draftDate ? formatCivilDate(draftDate) : "Scegli una data"}
                  </AppText>
                </Pressable>

                {pickerOpen ? (
                  <DateTimePicker
                    display="default"
                    mode="date"
                    onChange={(_event, date) => {
                      setPickerOpen(false);

                      if (date) {
                        setDraftDate(toCivilDate(date));
                      }
                    }}
                    value={fromCivilDate(draftDate)}
                  />
                ) : null}
              </>
            )}
          </View>
        ) : null}

        <View style={styles.confirm}>
          <Button
            disabled={mode === "date" && !draftDate}
            fullWidth
            label="Conferma"
            onPress={() => {
              onChange(mode === "none" ? null : draftDate);
              setSheetOpen(false);
            }}
            testID="compose-deadline-confirm"
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function OptionRow({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}
    >
      <AppText color="neutral" style={styles.optionLabel} variant="bodyLg">
        {label}
      </AppText>

      <View style={[styles.radio, selected ? styles.radioOn : null]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * `Date` → `YYYY-MM-DD` nel fuso **locale**.
 *
 * `toISOString()` convertirebbe in UTC e, per chi sta a ovest di Greenwich,
 * restituirebbe il giorno precedente. §23 vieta esattamente questo: «senza
 * fuso orario implicito o conversione UTC che sposti il giorno».
 */
function toCivilDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** `new Date("YYYY-MM-DD")` sarebbe UTC: il costruttore a tre argomenti no. */
function fromCivilDate(value: string | null): Date {
  if (!value) {
    return new Date();
  }

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatCivilDate(value: string): string {
  const [year, month, day] = value.split("-");

  return year && month && day ? `${day}/${month}/${year}` : value;
}

const styles = StyleSheet.create({
  androidDate: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  block: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingTop: spacing[12],
  },
  confirm: {
    paddingTop: spacing[12],
  },
  dot: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  option: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
  },
  optionLabel: {
    flex: 1,
  },
  picker: {
    paddingTop: spacing[8],
  },
  pressed: {
    opacity: 0.7,
  },
  radio: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  radioOn: {
    borderColor: colors.accent,
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
