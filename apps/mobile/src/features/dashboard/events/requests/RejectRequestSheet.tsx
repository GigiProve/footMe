/**
 * «Non accettare la richiesta?» (DAS-REV-29 §18, screen 17).
 *
 * Messaggio facoltativo in testo semplice: nessuna motivazione obbligatoria,
 * nessun rich text, allegato o editor di valutazione. Il limite viene dal
 * server (`decisionMessage` in `selection_event_limits`) ed è controllato
 * anche lì; qui serve a dirlo prima, **conservando** il testo (QA-088). Il
 * contenuto resta nello stato del chiamante, quindi un errore di salvataggio
 * non lo perde.
 *
 * `KeyboardAvoidingView` dentro lo sheet: campo e CTA restano sopra la
 * tastiera (QA-133).
 */
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../ui";
import {
  DETAIL_COPY,
  decisionMessageError,
  firstName,
} from "../detail/event-detail-presentation";

export function RejectRequestSheet({
  busy,
  limit,
  message,
  onCancel,
  onChangeMessage,
  onConfirm,
  personName,
  visible,
}: {
  busy: boolean;
  limit: number;
  message: string;
  onCancel: () => void;
  onChangeMessage: (value: string) => void;
  onConfirm: () => void;
  personName: string;
  visible: boolean;
}) {
  const error = decisionMessageError(message, limit);
  const length = message.trim().length;

  return (
    <BottomSheet onClose={onCancel} title={DETAIL_COPY.rejectTitle} visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.body} testID="event-reject-sheet">
          <AppText color="neutralMuted" variant="bodySm">
            {DETAIL_COPY.rejectBody(personName)}
          </AppText>

          <View style={styles.field}>
            <AppText color="neutral" variant="metaStrong">
              {DETAIL_COPY.rejectMessageLabel(firstName(personName))}
            </AppText>
            <TextInput
              accessibilityHint={DETAIL_COPY.rejectHelper}
              accessibilityLabel={DETAIL_COPY.rejectMessageLabel(firstName(personName))}
              multiline
              onChangeText={onChangeMessage}
              placeholder={DETAIL_COPY.rejectPlaceholder}
              placeholderTextColor={colors.textNeutralSoft}
              style={[styles.input, error ? styles.inputError : null]}
              testID="event-reject-message"
              textAlignVertical="top"
              value={message}
            />
            <View style={styles.helperRow}>
              <AppText color={error ? "danger" : "neutralMuted"} style={styles.helper} variant="meta">
                {error ?? DETAIL_COPY.rejectHelper}
              </AppText>
              {length > 0 ? (
                <AppText color={error ? "danger" : "neutralMuted"} variant="meta">
                  {`${length}/${limit}`}
                </AppText>
              ) : null}
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              destructive
              disabled={busy || !!error}
              fullWidth
              label={DETAIL_COPY.reject}
              loading={busy}
              onPress={onConfirm}
              size="lg"
              testID="event-reject-confirm"
              variant="primary"
            />
            <Button
              fullWidth
              label={DETAIL_COPY.cancel}
              onPress={onCancel}
              size="lg"
              testID="event-reject-cancel"
              variant="secondary"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[12],
    paddingTop: spacing[4],
  },
  body: {
    gap: spacing[16],
  },
  field: {
    gap: spacing[8],
  },
  helper: {
    flex: 1,
  },
  helperRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  input: {
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
    borderColor: colors.borderNeutral,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.textNeutral,
    minHeight: 96,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  inputError: {
    borderColor: colors.danger,
  },
});
