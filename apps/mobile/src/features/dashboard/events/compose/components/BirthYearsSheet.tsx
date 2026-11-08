import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { colors, radius, sizes, spacing, typography } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";
import { EVENTS_COPY, VALIDATION_COPY } from "../../events-copy";
import type { EventLimits } from "../../events-types";
import { normalizeYears, yearsError } from "../event-compose-model";

type Props = {
  from: string;
  limits: Pick<EventLimits, "birthYearMax" | "birthYearMin">;
  onClose: () => void;
  onConfirm: (value: { from: string; to: string }) => void;
  to: string;
  visible: boolean;
};

/**
 * «Anni di nascita di riferimento» (DAS-REV-28 §16; screen 08, 12).
 *
 * «helper Indica un singolo anno o un intervallo, due campi Da/A, azione
 * Nessun riferimento e Conferma.» Un solo anno si normalizza a entrambi gli
 * estremi; un intervallo invertito è un errore, mai uno scambio. Durante
 * l'errore i valori restano e Conferma è disabilitata (screen 12).
 *
 * «Nessun riferimento azzera il draft del selector; il commit rimane
 * Conferma.» Chiudere senza confermare non cambia nulla nel form.
 */
export function BirthYearsSheet({ from, limits, onClose, onConfirm, to, visible }: Props) {
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  const [opened, setOpened] = useState(false);

  /* Riparte dai valori confermati a ogni apertura (durante il render, non in
     un effetto). Chiudere senza Conferma non tocca il form. */
  if (visible && !opened) {
    setOpened(true);
    setDraftFrom(from);
    setDraftTo(to);
  } else if (!visible && opened) {
    setOpened(false);
  }

  const normalized = normalizeYears(draftFrom, draftTo);
  const error = yearsError(normalized.from, normalized.to, limits);
  /* Un anno a metà (due cifre) non è ancora un errore da annunciare: lo
     diventa quando il campo ha quattro caratteri o la conferma è tentata. */
  const showError =
    error !== null &&
    (draftFrom.trim().length >= 4 || draftTo.trim().length >= 4);

  return (
    <BottomSheet onClose={onClose} title={EVENTS_COPY.yearsSheetTitle} visible={visible}>
      <AppText color="neutralMuted" style={styles.helper} variant="bodySm">
        {EVENTS_COPY.yearsSheetHelper}
      </AppText>

      <YearInput
        error={showError}
        label={EVENTS_COPY.yearsFrom}
        onChange={setDraftFrom}
        testID="event-years-from"
        value={draftFrom}
      />
      <YearInput
        error={showError}
        label={EVENTS_COPY.yearsTo}
        onChange={setDraftTo}
        testID="event-years-to"
        value={draftTo}
      />

      {showError ? (
        <AppText accessibilityRole="alert" color="danger" testID="event-years-error" variant="meta">
          {VALIDATION_COPY[error]}
        </AppText>
      ) : (
        <AppText color="neutralMuted" variant="meta">
          {EVENTS_COPY.yearsHelper}
        </AppText>
      )}

      <View style={styles.actions}>
        <Button
          fullWidth
          label={EVENTS_COPY.yearsNone}
          onPress={() => {
            setDraftFrom("");
            setDraftTo("");
          }}
          testID="event-years-none"
          variant="secondary"
        />
        <Button
          disabled={error !== null}
          fullWidth
          label={EVENTS_COPY.confirm}
          onPress={() => onConfirm(normalized)}
          testID="event-years-confirm"
        />
      </View>
    </BottomSheet>
  );
}

function YearInput({
  error,
  label,
  onChange,
  testID,
  value,
}: {
  error: boolean;
  label: string;
  onChange: (value: string) => void;
  testID: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <AppText color="neutralMuted" variant="meta">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={`${label}, anno`}
        keyboardType="number-pad"
        maxLength={4}
        onChangeText={(next) => onChange(next.replace(/\D/g, ""))}
        style={[styles.input, error ? styles.inputError : null]}
        testID={testID}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[10],
    paddingTop: spacing[16],
  },
  field: {
    gap: spacing[6],
    paddingVertical: spacing[6],
  },
  helper: {
    paddingBottom: spacing[8],
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.textNeutral,
    fontSize: typography.fontSize[15],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
  },
  inputError: {
    borderColor: colors.danger,
  },
});
