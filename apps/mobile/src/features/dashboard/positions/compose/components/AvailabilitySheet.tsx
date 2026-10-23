import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";
import type { PositionAvailability, PositionAvailabilityMode } from "../compose-types";

type Props = {
  initial: PositionAvailability | null;
  onClose: () => void;
  /** `null` rimuove il criterio: §19 — «Deve essere possibile rimuovere». */
  onConfirm: (value: PositionAvailability | null) => void;
  /** Catalogo stagioni, per risolvere NEXT_SEASON alla conferma. */
  seasons: readonly { id: string; label: string }[];
  visible: boolean;
};

type Selection = PositionAvailabilityMode | "none";

/** Data civile `YYYY-MM-DD`: `toISOString()` sposterebbe il giorno col fuso (§19). */
function toCivilDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fromCivilDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

/** §19: in assenza della stagione corrente, l'ultima del catalogo è il fallback. */
function resolveNextSeasonId(
  seasons: readonly { id: string; label: string }[],
  currentSeasonId: string | null,
): string | null {
  if (seasons.length === 0) {
    return null;
  }

  if (currentSeasonId) {
    const index = seasons.findIndex((season) => season.id > currentSeasonId);

    if (index >= 0) {
      return seasons[index].id;
    }
  }

  return seasons[seasons.length - 1].id;
}

/**
 * Sheet «Disponibilità richiesta» del composer Position (DAS-REV-16 §19).
 *
 * Cambiare modalità azzera atomicamente i parametri non più applicabili: una
 * bozza non deve mai serializzare data e stagione insieme.
 */
export function AvailabilitySheet({ initial, onClose, onConfirm, seasons, visible }: Props) {
  const [selection, setSelection] = useState<Selection>("immediate");
  const [date, setDate] = useState<Date>(new Date());
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (!initial) {
      setSelection("none");
    } else if (initial.mode === "from_date" && initial.date) {
      setSelection("from_date");
      setDate(fromCivilDate(initial.date));
    } else {
      setSelection(initial.mode);
    }

    setShowAndroidPicker(false);
  }, [visible, initial]);

  function selectMode(next: Selection) {
    setSelection(next);

    if (next === "from_date") {
      setDate(new Date());
    }
  }

  function handleAndroidDatePress() {
    setShowAndroidPicker(true);
  }

  function handleDateChange(_event: unknown, picked?: Date) {
    setShowAndroidPicker(false);

    if (picked) {
      setDate(picked);
    }
  }

  function handleConfirm() {
    if (selection === "none") {
      onConfirm(null);
      return;
    }

    if (selection === "immediate") {
      onConfirm({ mode: "immediate" });
      return;
    }

    if (selection === "from_date") {
      onConfirm({ mode: "from_date", date: toCivilDate(date) });
      return;
    }

    // next_season: risolto solo alla conferma, mai alla selezione (§19).
    const currentSeasonId = seasons.length > 0 ? seasons[0].id : null;
    const seasonId = resolveNextSeasonId(seasons, currentSeasonId);

    onConfirm({ mode: "next_season", seasonId });
  }

  const resolvedNextSeasonId = resolveNextSeasonId(seasons, seasons.length > 0 ? seasons[0].id : null);
  const nextSeasonLabel = seasons.find((season) => season.id === resolvedNextSeasonId)?.label ?? null;

  return (
    <BottomSheet onClose={onClose} title="Disponibilità richiesta" visible={visible}>
      <OptionRow
        label="Immediata"
        onPress={() => selectMode("immediate")}
        selected={selection === "immediate"}
      />

      <OptionRow
        label="Da una data"
        onPress={() => selectMode("from_date")}
        selected={selection === "from_date"}
      />

      {selection === "from_date" ? (
        Platform.OS === "ios" ? (
          <DateTimePicker
            display="inline"
            mode="date"
            onChange={handleDateChange}
            value={date}
          />
        ) : (
          <View>
            <Pressable
              accessibilityRole="button"
              onPress={handleAndroidDatePress}
              style={styles.dateValue}
            >
              <AppText color="neutral" variant="bodyLg">
                {toCivilDate(date)}
              </AppText>
            </Pressable>

            {showAndroidPicker ? (
              <DateTimePicker
                display="default"
                mode="date"
                onChange={handleDateChange}
                value={date}
              />
            ) : null}
          </View>
        )
      ) : null}

      <OptionRow
        label="Inizio prossima stagione"
        onPress={() => selectMode("next_season")}
        selected={selection === "next_season"}
      />

      {selection === "next_season" ? (
        <AppText color="neutralMuted" style={styles.helper} variant="meta">
          {seasons.length === 0
            ? "La stagione verrà confermata più avanti."
            : nextSeasonLabel}
        </AppText>
      ) : null}

      <OptionRow
        label="Nessuna preferenza"
        onPress={() => selectMode("none")}
        selected={selection === "none"}
      />

      <View style={styles.confirm}>
        <Button fullWidth label="Conferma" onPress={handleConfirm} />
      </View>
    </BottomSheet>
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
      <AppText color="neutral" style={styles.optionText} variant="bodyLg">
        {label}
      </AppText>

      <View style={[styles.radio, selected ? styles.radioOn : null]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  confirm: {
    marginTop: spacing[16],
  },
  dateValue: {
    paddingBottom: spacing[12],
    paddingLeft: spacing[12],
  },
  dot: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  helper: {
    paddingBottom: spacing[8],
    paddingLeft: spacing[12],
  },
  option: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  optionText: {
    flex: 1,
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
});
