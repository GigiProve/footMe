/**
 * Sheet del lifecycle evento (DAS-REV-31 §17, §18; screen 07–09, 11, 19).
 *
 * Tutti sul `BottomSheet` condiviso, come gli sheet della 29/30: nessuna
 * bottom navigation interattiva, fondo oscurato, chiusura che non invia
 * nulla.
 *
 *   · ManageEventSheet — «Gestisci evento», voci solo da capability server
 *     (07–08). Concludi ha contorno blu, mai rosso; Annulla contorno rosso;
 *   · CompleteEventSheet — conferma con primaria **blu** (09, §17: «non è
 *     una cancellazione»);
 *   · CancelEventSheet — conferma con messaggio facoltativo e primaria rossa
 *     (11). Nessun secondo popup dopo la conferma (§18);
 *   · DeleteDraftSheet — conferma distruttiva solo per DRAFT (19).
 *
 * Durante il commit la primaria mostra il loading e non accetta un secondo
 * tap (§17, §28); «Torna indietro» resta attivo perché chiudere la UI non
 * annulla una richiesta già partita.
 */
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";
import {
  CANCELLATION_MESSAGE_LIMIT,
  LIFECYCLE_COPY,
  cancellationMessageError,
  type ManageAction,
  type ManageActionKind,
} from "../event-lifecycle-presentation";

export function ManageEventSheet({
  actions,
  onClose,
  onDismiss,
  onSelect,
  visible,
}: {
  actions: readonly ManageAction[];
  onClose: () => void;
  /** iOS: apre la conferma scelta solo a menu chiuso (un modal alla volta). */
  onDismiss?: () => void;
  onSelect: (kind: ManageActionKind) => void;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} onDismiss={onDismiss} title={LIFECYCLE_COPY.manageTitle} visible={visible}>
      <View style={styles.actions} testID="event-manage-sheet">
        {actions.map((action) => (
          <Button
            destructive={action.tone === "destructive"}
            fullWidth
            key={action.kind}
            label={action.label}
            onPress={() => onSelect(action.kind)}
            size="lg"
            testID={`event-manage-${action.kind}`}
            /* Screen 07–08: Modifica e Concludi contorno blu, Annulla contorno
               rosso su fondo bianco. `outline` userebbe la hairline grigia. */
            variant={action.tone === "destructive" ? "neutralOutline" : "secondary"}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

/** Corpo comune: testo, primaria, «Torna indietro». */
function ConfirmBody({
  body,
  busy,
  children,
  confirmDisabled,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
  testID,
}: {
  body: string;
  busy: boolean;
  children?: ReactNode;
  confirmDisabled?: boolean;
  confirmLabel: string;
  destructive: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  testID: string;
}) {
  return (
    <View style={styles.body} testID={testID}>
      <AppText color="neutralMuted" variant="bodySm">
        {body}
      </AppText>

      {children}

      <View style={styles.actions}>
        <Button
          destructive={destructive}
          disabled={busy || confirmDisabled}
          fullWidth
          label={confirmLabel}
          loading={busy}
          onPress={onConfirm}
          size="lg"
          testID={`${testID}-confirm`}
          variant="primary"
        />
        <Button
          fullWidth
          label={LIFECYCLE_COPY.back}
          onPress={onCancel}
          size="lg"
          testID={`${testID}-back`}
          variant="secondary"
        />
      </View>
    </View>
  );
}

export function CompleteEventSheet({
  busy,
  onCancel,
  onConfirm,
  visible,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onCancel} title={LIFECYCLE_COPY.completeTitle} visible={visible}>
      <ConfirmBody
        body={LIFECYCLE_COPY.completeBody}
        busy={busy}
        confirmLabel={LIFECYCLE_COPY.complete}
        destructive={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
        testID="event-complete-sheet"
      />
    </BottomSheet>
  );
}

/**
 * §18: il testo resta nel campo dopo un errore (il chiamante possiede lo
 * stato); `KeyboardAvoidingView` tiene campo e CTA sopra la tastiera, come
 * `RemoveParticipantSheet` della 30.
 */
export function CancelEventSheet({
  busy,
  message,
  onCancel,
  onChangeMessage,
  onConfirm,
  visible,
}: {
  busy: boolean;
  message: string;
  onCancel: () => void;
  onChangeMessage: (value: string) => void;
  onConfirm: () => void;
  visible: boolean;
}) {
  const error = cancellationMessageError(message);
  const length = message.trim().length;

  return (
    <BottomSheet onClose={onCancel} title={LIFECYCLE_COPY.cancelTitle} visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ConfirmBody
          body={LIFECYCLE_COPY.cancelBody}
          busy={busy}
          confirmDisabled={!!error}
          confirmLabel={LIFECYCLE_COPY.cancel}
          destructive
          onCancel={onCancel}
          onConfirm={onConfirm}
          testID="event-cancel-sheet"
        >
          <View style={styles.field}>
            <AppText color="neutral" variant="metaStrong">
              {LIFECYCLE_COPY.cancelMessageLabel}
            </AppText>
            <TextInput
              accessibilityLabel={LIFECYCLE_COPY.cancelMessageLabel}
              editable={!busy}
              multiline
              onChangeText={onChangeMessage}
              placeholder={LIFECYCLE_COPY.cancelPlaceholder}
              placeholderTextColor={colors.textNeutralSoft}
              style={[styles.input, error ? styles.inputError : null]}
              testID="event-cancel-message"
              textAlignVertical="top"
              value={message}
            />
            {error || length > 0 ? (
              <View style={styles.helperRow}>
                <AppText color={error ? "danger" : "neutralMuted"} style={styles.flex} variant="meta">
                  {error ?? ""}
                </AppText>
                <AppText color={error ? "danger" : "neutralMuted"} variant="meta">
                  {`${length}/${CANCELLATION_MESSAGE_LIMIT}`}
                </AppText>
              </View>
            ) : null}
          </View>
        </ConfirmBody>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

export function DeleteDraftSheet({
  busy,
  onCancel,
  onConfirm,
  visible,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onCancel} title={LIFECYCLE_COPY.deleteDraftTitle} visible={visible}>
      <ConfirmBody
        body={LIFECYCLE_COPY.deleteDraftBody}
        busy={busy}
        confirmLabel={LIFECYCLE_COPY.deleteDraft}
        destructive
        onCancel={onCancel}
        onConfirm={onConfirm}
        testID="event-delete-draft-sheet"
      />
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
  flex: {
    flex: 1,
  },
  helperRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  /* Stesso campo di RemoveParticipantSheet (30): stessa resa, stesso limite. */
  input: {
    borderColor: colors.borderNeutral,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.textNeutral,
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
    minHeight: 96,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  inputError: {
    borderColor: colors.danger,
  },
});
