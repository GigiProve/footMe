/**
 * Sheet «Modifica limite utilizzi» (screen 14, §15, §27, §29, §41).
 *
 * Nessuna mutazione qui dentro: il composer riusa questo stesso sheet per un
 * draft puramente locale (§15), quindi la persistenza resta responsabilità
 * di chi lo monta. Se il valore digitato è sotto il consumo già registrato
 * mostra l'errore del server-twin (§41) e disabilita Salva senza mai
 * autocorreggere al minimo consentito.
 */
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { AppText, BottomSheet, Button, Radio } from "../../../../ui";
import { colors, radius, spacing } from "../../../../theme/tokens";
import {
  FIELD_ERRORS,
  JOIN_LINKS_COPY,
  limitBelowUsageError,
  parseLimit,
} from "../join-links-presentation";

type LimitMode = "limit" | "none";

type JoinLinkLimitSheetProps = {
  completedUses: number;
  error?: string | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (value: number | null) => void;
  value: number | null;
  visible: boolean;
};

export function JoinLinkLimitSheet({
  completedUses,
  error,
  isSaving = false,
  onClose,
  onSave,
  value,
  visible,
}: JoinLinkLimitSheetProps) {
  const [mode, setMode] = useState<LimitMode>(value === null ? "none" : "limit");
  const [raw, setRaw] = useState(value === null ? "" : `${value}`);

  // Il draft riparte dal valore corrente ogni volta che lo sheet si riapre:
  // chiudere senza confermare non deve lasciare residui della volta prima.
  useEffect(() => {
    if (visible) {
      setMode(value === null ? "none" : "limit");
      setRaw(value === null ? "" : `${value}`);
    }
  }, [value, visible]);

  const parsed = mode === "limit" ? parseLimit(raw) : null;
  const belowUsage = mode === "limit" && parsed !== null && parsed < completedUses;
  const invalid = mode === "limit" && raw.trim().length > 0 && parsed === null;
  const localError = belowUsage
    ? limitBelowUsageError(completedUses)
    : invalid
      ? FIELD_ERRORS.limit
      : null;
  const canSave = mode === "none" || parsed !== null;

  return (
    <BottomSheet onClose={onClose} title={JOIN_LINKS_COPY.limitSheetTitle} visible={visible}>
      <View style={styles.options}>
        <Radio
          checked={mode === "none"}
          label={JOIN_LINKS_COPY.noLimit}
          onPress={() => setMode("none")}
          testID="join-link-limit-none"
          tone="neutral"
        />
        <Radio
          checked={mode === "limit"}
          label={JOIN_LINKS_COPY.setLimit}
          onPress={() => setMode("limit")}
          testID="join-link-limit-set"
          tone="neutral"
        />
      </View>

      {mode === "limit" ? (
        <View style={styles.field}>
          <AppText color="neutralMuted" variant="meta">
            {JOIN_LINKS_COPY.limitInputLabel}
          </AppText>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setRaw}
            style={styles.input}
            testID="join-link-limit-input"
            value={raw}
          />
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
        disabled={!canSave || Boolean(localError) || isSaving}
        fullWidth
        label={JOIN_LINKS_COPY.save}
        loading={isSaving}
        onPress={() => onSave(mode === "none" ? null : parsed)}
        style={[
          styles.save,
          !canSave || Boolean(localError) || isSaving ? styles.saveDisabled : null,
        ]}
        textStyle={!canSave || Boolean(localError) || isSaving ? styles.saveDisabledLabel : undefined}
        testID="join-link-limit-save"
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
  input: {
    borderColor: colors.borderNeutral,
    borderRadius: radius[8],
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.textNeutral,
    marginTop: spacing[8],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  error: {
    marginTop: spacing[10],
  },
  save: {
    marginTop: spacing[20],
  },
});
