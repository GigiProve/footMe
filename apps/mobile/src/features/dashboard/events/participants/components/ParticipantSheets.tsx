/**
 * Sheet del centro Partecipanti (DAS-REV-30 §21–§25; screen 12-16).
 *
 * Tutti sul `BottomSheet` condiviso: nessuna bottom navigation interattiva
 * dentro lo sheet, il fondo oscurato non riceve tap (§5). Le azioni che lo
 * sheet mostra sono quelle che il server ha restituito per la riga (§27);
 * il comando le rivalida al commit.
 *
 *   · FilterSheet — «Mostra», sette opzioni a selezione singola (screen 12);
 *   · ParticipantActionsSheet — richiesta (13), invito inviato (14),
 *     confermato: identità, contesto, azioni distinte;
 *   · RemoveParticipantSheet — conferma distruttiva con messaggio
 *     facoltativo (16).
 *
 * La revoca (15) è un `ConfirmModal` distruttivo montato dalla schermata.
 */
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../../../theme/tokens";
import { AppText, Avatar, BottomSheet, Button, Radio } from "../../../../../ui";
import { DETAIL_COPY, firstName } from "../../detail/event-detail-presentation";
import {
  PARTICIPANTS_COPY,
  PARTICIPANTS_FILTERS,
  PARTICIPANT_STATUS_LABELS,
  invitedOnLine,
  messageError,
} from "../participants-presentation";
import type { ParticipantRow, ParticipantsFilter } from "../participants-types";

export function FilterSheet({
  onClose,
  onSelect,
  selected,
  visible,
}: {
  onClose: () => void;
  onSelect: (filter: ParticipantsFilter) => void;
  selected: ParticipantsFilter;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} title={PARTICIPANTS_COPY.filterTitle} visible={visible}>
      <View accessibilityRole="radiogroup" style={styles.options} testID="participants-filter-sheet">
        {PARTICIPANTS_FILTERS.map((option) => (
          <Radio
            checked={option.id === selected}
            key={option.id}
            label={option.label}
            onPress={() => onSelect(option.id)}
            testID={`participants-filter-${option.id}`}
            tone="neutral"
          />
        ))}
      </View>
    </BottomSheet>
  );
}

export function ParticipantActionsSheet({
  busy,
  capacityLine,
  eventLines,
  onClose,
  onConfirm,
  onOpenProfile,
  onReject,
  onRemove,
  onRevoke,
  row,
}: {
  busy: boolean;
  capacityLine: string | null;
  eventLines: string[];
  onClose: () => void;
  onConfirm: () => void;
  onOpenProfile: () => void;
  onReject: () => void;
  onRemove: () => void;
  onRevoke: () => void;
  row: ParticipantRow | null;
}) {
  const visible = !!row;
  const actions = row?.actions ?? [];
  const pending = row?.status === "pending";
  const invited = row?.status === "invited";
  const meta = row ? (invited ? invitedOnLine(row.invitedAt) : null) ?? PARTICIPANT_STATUS_LABELS[row.status] : "";

  return (
    <BottomSheet onClose={onClose} visible={visible}>
      {row ? (
        <View style={styles.body} testID="participant-actions-sheet">
          <View style={styles.person}>
            <Avatar name={row.fullName} size="md" uri={row.avatarUrl ?? undefined} />
            <View style={styles.flex}>
              <AppText color="neutral" numberOfLines={1} variant="titleSm">
                {row.fullName}
              </AppText>
              <AppText color="neutralMuted" numberOfLines={1} variant="meta">
                {meta}
              </AppText>
            </View>
          </View>

          {/* Screen 13: contesto evento e capienza per decidere. */}
          {pending ? (
            <View style={styles.context}>
              {[...eventLines, ...(capacityLine ? [capacityLine] : [])].map((line) => (
                <AppText color="neutralMuted" key={line} variant="bodySm">
                  {line}
                </AppText>
              ))}
            </View>
          ) : null}

          {/* Screen 14: snapshot del messaggio recapitato, non modificabile. */}
          {invited && row.invitationMessage ? (
            <View style={styles.message} testID="participant-invitation-message">
              <AppText color="neutral" variant="metaStrong">
                {PARTICIPANTS_COPY.messageSent}
              </AppText>
              <AppText color="neutralMuted" selectable variant="bodySm">
                {row.invitationMessage}
              </AppText>
            </View>
          ) : null}

          <View style={styles.actions}>
            {pending && (actions.includes("confirm") || row.confirmBlockedReason === "full") ? (
              <>
                <Button
                  disabled={!actions.includes("confirm") || busy}
                  fullWidth
                  label={DETAIL_COPY.confirmParticipation}
                  loading={busy}
                  onPress={onConfirm}
                  size="lg"
                  testID="participant-confirm"
                  variant="primary"
                />
                {row.confirmBlockedReason === "full" ? (
                  <AppText color="neutralMuted" style={styles.reason} variant="bodySm">
                    {DETAIL_COPY.noSeats}
                  </AppText>
                ) : null}
              </>
            ) : null}
            {pending && actions.includes("reject") ? (
              <Button
                disabled={busy}
                fullWidth
                label={DETAIL_COPY.reject}
                onPress={onReject}
                size="lg"
                testID="participant-reject"
                variant="secondary"
              />
            ) : null}
            <Button
              fullWidth
              label={PARTICIPANTS_COPY.viewProfile}
              onPress={onOpenProfile}
              size="lg"
              testID="participant-view-profile"
              variant="secondary"
            />
            {invited && actions.includes("revoke") ? (
              <Button
                destructive
                disabled={busy}
                fullWidth
                label={PARTICIPANTS_COPY.revoke}
                onPress={onRevoke}
                size="lg"
                testID="participant-revoke"
                variant="primary"
              />
            ) : null}
            {row.status === "confirmed" && actions.includes("remove") ? (
              <Button
                destructive
                disabled={busy}
                fullWidth
                label={PARTICIPANTS_COPY.remove}
                onPress={onRemove}
                size="lg"
                testID="participant-remove"
                variant="primary"
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

export function RemoveParticipantSheet({
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
  const error = messageError(message, limit);
  const length = message.trim().length;
  const first = firstName(personName);

  return (
    <BottomSheet onClose={onCancel} title={PARTICIPANTS_COPY.removeTitle(first)} visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.body} testID="participant-remove-sheet">
          <AppText color="neutralMuted" variant="bodySm">
            {PARTICIPANTS_COPY.removeBody(personName)}
          </AppText>

          <View style={styles.field}>
            <AppText color="neutral" variant="metaStrong">
              {PARTICIPANTS_COPY.removeMessageLabel(first)}
            </AppText>
            <TextInput
              accessibilityHint={PARTICIPANTS_COPY.removeHelper}
              accessibilityLabel={PARTICIPANTS_COPY.removeMessageLabel(first)}
              multiline
              onChangeText={onChangeMessage}
              placeholder={PARTICIPANTS_COPY.removePlaceholder}
              placeholderTextColor={colors.textNeutralSoft}
              style={[styles.input, error ? styles.inputError : null]}
              testID="participant-remove-message"
              textAlignVertical="top"
              value={message}
            />
            <View style={styles.helperRow}>
              <AppText color={error ? "danger" : "neutralMuted"} style={styles.flex} variant="meta">
                {error ?? PARTICIPANTS_COPY.removeHelper}
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
              label={PARTICIPANTS_COPY.removeConfirm}
              loading={busy}
              onPress={onConfirm}
              size="lg"
              testID="participant-remove-confirm"
              variant="primary"
            />
            <Button
              fullWidth
              label={PARTICIPANTS_COPY.cancel}
              onPress={onCancel}
              size="lg"
              testID="participant-remove-cancel"
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
  context: {
    gap: spacing[4],
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
  /* Stesso campo di RejectRequestSheet (29): stessa resa, stesso limite. */
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
  message: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius[12],
    gap: spacing[4],
    padding: spacing[12],
  },
  options: {
    gap: spacing[4],
  },
  person: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  reason: {
    textAlign: "center",
  },
});
