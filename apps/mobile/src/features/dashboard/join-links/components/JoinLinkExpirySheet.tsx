/**
 * Sheet «Modifica scadenza» (screen 15, §15, §29).
 *
 * Solo il giorno, mai l'ora: la fine effettiva del giorno la decide il
 * server nel fuso della Società (§45). Una data passata viene respinta qui
 * con lo stesso criterio (`isSelectableDay`) usato nel composer, per non far
 * approvare al client ciò che il commit rifiuterebbe comunque.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { DatePickerField } from "../../../../components/ui/date-picker-field";
import { AppText, BottomSheet, Button, Radio } from "../../../../ui";
import { colors, spacing } from "../../../../theme/tokens";
import {
  FIELD_ERRORS,
  JOIN_LINKS_COPY,
  isSelectableDay,
  parseDay,
} from "../join-links-presentation";

type ExpiryMode = "expiry" | "none";

type JoinLinkExpirySheetProps = {
  error?: string | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (value: string | null) => void;
  value: string | null;
  visible: boolean;
};

export function JoinLinkExpirySheet({
  error,
  isSaving = false,
  onClose,
  onSave,
  value,
  visible,
}: JoinLinkExpirySheetProps) {
  const [mode, setMode] = useState<ExpiryMode>(value === null ? "none" : "expiry");
  const [day, setDay] = useState<string | null>(value);

  useEffect(() => {
    if (visible) {
      setMode(value === null ? "none" : "expiry");
      setDay(value);
    }
  }, [value, visible]);

  const parsedDay = mode === "expiry" ? parseDay(day) : null;
  const localError =
    mode === "expiry" ? (day && parsedDay && !isSelectableDay(parsedDay) ? FIELD_ERRORS.expiry : null) : null;
  const canSave = mode === "none" || (day !== null && !localError);

  return (
    <BottomSheet onClose={onClose} title={JOIN_LINKS_COPY.expirySheetTitle} visible={visible}>
      <View style={styles.options}>
        <Radio
          checked={mode === "none"}
          label={JOIN_LINKS_COPY.noExpiry}
          onPress={() => setMode("none")}
          testID="join-link-expiry-none"
          tone="neutral"
        />
        <Radio
          checked={mode === "expiry"}
          label={JOIN_LINKS_COPY.setExpiry}
          onPress={() => setMode("expiry")}
          testID="join-link-expiry-set"
          tone="neutral"
        />
      </View>

      {mode === "expiry" ? (
        <View style={styles.field}>
          <DatePickerField
            label={JOIN_LINKS_COPY.expiryField}
            onChange={setDay}
            placeholder={JOIN_LINKS_COPY.setExpiry}
            value={day ?? ""}
          />
          <AppText color="neutralMuted" style={styles.helper} variant="meta">
            {JOIN_LINKS_COPY.expiryHelper}
          </AppText>
        </View>
      ) : null}

      {localError ? (
        <AppText accessibilityRole="alert" color="danger" style={styles.error} variant="meta">
          {localError}
        </AppText>
      ) : null}

      {!localError && error ? (
        <AppText accessibilityRole="alert" color="danger" style={styles.error} variant="meta">
          {error}
        </AppText>
      ) : null}

      <Button
        disabled={!canSave || isSaving}
        fullWidth
        label={JOIN_LINKS_COPY.save}
        loading={isSaving}
        onPress={() => onSave(mode === "none" ? null : day)}
        style={[
          styles.save,
          !canSave || isSaving ? styles.saveDisabled : null,
        ]}
        textStyle={!canSave || isSaving ? styles.saveDisabledLabel : undefined}
        testID="join-link-expiry-save"
        variant="primary"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  saveDisabled: {
    backgroundColor: colors.surfaceNeutral,
    borderColor: colors.borderNeutral,
    borderWidth: StyleSheet.hairlineWidth,
  },
  saveDisabledLabel: {
    color: colors.textNeutralSoft,
  },
  options: {
    gap: spacing[12],
  },
  field: {
    marginTop: spacing[16],
  },
  helper: {
    marginTop: spacing[8],
  },
  error: {
    marginTop: spacing[10],
  },
  save: {
    marginTop: spacing[20],
  },
});
