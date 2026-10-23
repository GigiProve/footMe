import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { colors, radius, sizes, spacing, typography } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";
import { validateAgeInput } from "../compose-presentation";

export type AgeRangeValue =
  | { mode: "range"; min: string; max: string }
  | { mode: "unrestricted" };

type Props = {
  initial: AgeRangeValue | null;
  limits: { ageMax: number; ageMin: number };
  onClose: () => void;
  onConfirm: (value: AgeRangeValue) => void;
  /** Proposta dalla TeamSeason: mostrata, mai applicata da sola (§13). */
  suggestion?: { label: string; max: string; min: string } | null;
  visible: boolean;
};

/**
 * Sheet «Fascia d'età» del composer Position (DAS-REV-16 §13).
 *
 * Range e «Nessun limite di età» sono mutuamente esclusivi: scegliere uno
 * svuota/disattiva l'altro, perché §13 vieta che due valori null significhino
 * contemporaneamente "non configurato" e "nessun limite".
 */
export function AgeRangeSheet({
  initial,
  limits,
  onClose,
  onConfirm,
  suggestion,
  visible,
}: Props) {
  const [mode, setMode] = useState<"range" | "unrestricted">("range");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (initial?.mode === "unrestricted") {
      setMode("unrestricted");
      setMin("");
      setMax("");
    } else if (initial?.mode === "range") {
      setMode("range");
      setMin(initial.min);
      setMax(initial.max);
    } else {
      setMode("range");
      setMin("");
      setMax("");
    }

    setTouched(false);
  }, [visible, initial]);

  const error = touched ? validateAgeInput({ mode, min, max }, limits) : null;

  function handleMinChange(value: string) {
    setMode("range");
    setMin(value);
    setTouched(true);
  }

  function handleMaxChange(value: string) {
    setMode("range");
    setMax(value);
    setTouched(true);
  }

  function handleSelectUnrestricted() {
    setMode("unrestricted");
    setMin("");
    setMax("");
    setTouched(false);
  }

  function handleApplySuggestion() {
    if (!suggestion) {
      return;
    }

    setMode("range");
    setMin(suggestion.min);
    setMax(suggestion.max);
  }

  function handleConfirm() {
    const validationError = validateAgeInput({ mode, min, max }, limits);

    if (validationError) {
      setTouched(true);
      return;
    }

    onConfirm(mode === "unrestricted" ? { mode: "unrestricted" } : { mode: "range", min, max });
  }

  const unrestrictedSelected = mode === "unrestricted";

  return (
    <BottomSheet onClose={onClose} title="Fascia d'età" visible={visible}>
      <View style={styles.row}>
        <View style={styles.field}>
          <AppText color="neutralMuted" variant="meta">
            Età minima
          </AppText>
          <TextInput
            editable={!unrestrictedSelected}
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={handleMinChange}
            style={[styles.input, unrestrictedSelected ? styles.inputDisabled : null]}
            value={min}
          />
        </View>

        <View style={styles.field}>
          <AppText color="neutralMuted" variant="meta">
            Età massima
          </AppText>
          <TextInput
            editable={!unrestrictedSelected}
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={handleMaxChange}
            style={[styles.input, unrestrictedSelected ? styles.inputDisabled : null]}
            value={max}
          />
        </View>
      </View>

      {error ? (
        <AppText accessibilityRole="alert" color="danger" style={styles.error} variant="meta">
          {error}
        </AppText>
      ) : null}

      {suggestion && mode === "range" ? (
        <View style={styles.suggestion}>
          <AppText color="neutralMuted" style={styles.suggestionLabel} variant="meta">
            {suggestion.label}
          </AppText>
          <Button
            label="Usa questa fascia"
            onPress={handleApplySuggestion}
            variant="ghost"
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: unrestrictedSelected }}
        onPress={handleSelectUnrestricted}
        style={({ pressed }) => [styles.option, pressed ? styles.pressed : null]}
      >
        <AppText color="neutral" style={styles.optionText} variant="bodyLg">
          Nessun limite di età
        </AppText>

        <View style={[styles.radio, unrestrictedSelected ? styles.radioOn : null]}>
          {unrestrictedSelected ? <View style={styles.dot} /> : null}
        </View>
      </Pressable>

      <View style={styles.confirm}>
        <Button fullWidth label="Conferma" onPress={handleConfirm} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  confirm: {
    marginTop: spacing[16],
  },
  dot: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  error: {
    paddingTop: spacing[8],
  },
  field: {
    flex: 1,
    gap: spacing[4],
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.inkInvert,
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
  },
  inputDisabled: {
    opacity: 0.5,
  },
  option: {
    alignItems: "center",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    marginTop: spacing[16],
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
  row: {
    flexDirection: "row",
    gap: spacing[12],
  },
  suggestion: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "space-between",
    paddingTop: spacing[12],
  },
  suggestionLabel: {
    flex: 1,
  },
});
