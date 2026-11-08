/**
 * Passi del flusso di invito (DAS-REV-30 §15–§17; screen 04, 06, 20, 24).
 *
 *   · EventSummary — contesto evento nella conferma e nell'esito: titolo,
 *     Team, data/ora, luogo; mai una seconda scelta dell'evento (§13);
 *   · ConfirmStep — «Invia invito»: N profili, messaggio facoltativo con
 *     limite centrale, primaria «Invia invito» anche al plurale (§15);
 *   · OutcomeStep — esito per destinatario quando non tutto è stato inviato
 *     (§16): nessun reinvio dei successi, ritorno esplicito;
 *   · PickStep — «Invita a evento» dal profilo, selezione singola (§17),
 *     con l'empty «Nessun evento disponibile» (screen 24).
 */
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing, typography } from "../../../../../theme/tokens";
import { AppText, Avatar, Button, EmptyState } from "../../../../../ui";
import {
  INVITE_COPY,
  candidateSubtitle,
  inviteMessageError,
  invitableEventLines,
  invitableEventSubtitle,
  selectedProfilesLabel,
  type OutcomeView,
} from "../invite-presentation";
import type { InvitableEvent, SelectedPerson } from "../invite-types";

export type EventSummaryModel = {
  clubLogoUrl: string | null;
  clubName: string;
  lines: string[];
  subtitle: string;
  title: string;
};

export function EventSummary({ model }: { model: EventSummaryModel }) {
  return (
    <View style={styles.event} testID="invite-event-summary">
      <Avatar name={model.clubName} size="sm" square tone="ink" uri={model.clubLogoUrl ?? undefined} />
      <View style={styles.flex}>
        <AppText color="neutral" variant="titleSm">
          {model.title}
        </AppText>
        {[model.subtitle, ...model.lines].filter(Boolean).map((line) => (
          <AppText color="neutralMuted" key={line} variant="meta">
            {line}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export function ConfirmStep({
  busy,
  event,
  limit,
  message,
  onBack,
  onChangeMessage,
  onSend,
  people,
  bottomInset,
}: {
  bottomInset: number;
  busy: boolean;
  event: EventSummaryModel;
  limit: number;
  message: string;
  onBack: () => void;
  onChangeMessage: (value: string) => void;
  onSend: () => void;
  people: readonly SelectedPerson[];
}) {
  const error = inviteMessageError(message, limit);
  const length = message.trim().length;
  const single = people.length === 1 ? people[0] : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing[32] + bottomInset }]}
        keyboardShouldPersistTaps="handled"
        testID="invite-confirm"
      >
        <AppText accessibilityRole="header" color="neutral" variant="screenTitle">
          {INVITE_COPY.confirmTitle}
        </AppText>

        <EventSummary model={event} />

        {/* §15: per selezione singola una riga semplice; mai i nomi in chip. */}
        {single ? (
          <View style={styles.person} testID="invite-confirm-single">
            <Avatar name={single.fullName} size="md" uri={single.avatarUrl ?? undefined} />
            <View style={styles.flex}>
              <AppText color="neutral" variant="titleSm">
                {single.fullName}
              </AppText>
              <AppText color="neutralMuted" variant="meta">
                {candidateSubtitle(single)}
              </AppText>
            </View>
          </View>
        ) : (
          <AppText color="neutral" testID="invite-confirm-count" variant="titleSm">
            {selectedProfilesLabel(people.length)}
          </AppText>
        )}

        <View style={styles.field}>
          <AppText color="neutral" variant="metaStrong">
            {INVITE_COPY.messageLabel}
          </AppText>
          <TextInput
            accessibilityHint={INVITE_COPY.messageHelper}
            accessibilityLabel={INVITE_COPY.messageLabel}
            editable={!busy}
            multiline
            onChangeText={onChangeMessage}
            placeholder={INVITE_COPY.messagePlaceholder}
            placeholderTextColor={colors.textNeutralSoft}
            style={[styles.input, error ? styles.inputError : null]}
            testID="invite-message"
            textAlignVertical="top"
            value={message}
          />
          <View style={styles.helperRow}>
            <AppText color={error ? "danger" : "neutralMuted"} style={styles.flex} variant="meta">
              {error ?? INVITE_COPY.messageHelper}
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
            disabled={busy || !!error || people.length === 0}
            fullWidth
            label={INVITE_COPY.send}
            loading={busy}
            onPress={onSend}
            size="lg"
            testID="invite-send"
            variant="primary"
          />
          <Button
            disabled={busy}
            fullWidth
            label={INVITE_COPY.back}
            onPress={onBack}
            size="lg"
            testID="invite-confirm-back"
            variant="secondary"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function OutcomeStep({
  bottomInset,
  event,
  onBackToSelection,
  onDone,
  doneLabel,
  view,
}: {
  bottomInset: number;
  doneLabel: string;
  event: EventSummaryModel;
  onBackToSelection: (() => void) | null;
  onDone: () => void;
  view: Exclude<OutcomeView, { kind: "success" }>;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: spacing[32] + bottomInset }]}
      testID="invite-outcome"
    >
      <AppText accessibilityRole="header" color="neutral" variant="screenTitle">
        {INVITE_COPY.confirmTitle}
      </AppText>

      <EventSummary model={event} />

      <View
        accessible
        accessibilityLabel={view.summary.join(" ")}
        accessibilityLiveRegion="polite"
        style={styles.notice}
        testID="invite-outcome-summary"
      >
        <Ionicons color={colors.textNeutral} name="information-circle-outline" size={22} />
        <View style={styles.flex}>
          <AppText color="neutral" variant="titleSm">
            {view.summary[0]}
          </AppText>
          <AppText color="neutralMuted" variant="bodySm">
            {view.summary[1]}
          </AppText>
        </View>
      </View>

      <View>
        {view.lines.map((line, index) => (
          <View
            key={`${line.name}-${index}`}
            style={[styles.outcomeRow, index > 0 ? styles.divider : null]}
            testID={`invite-outcome-row-${index}`}
          >
            <Avatar name={line.name} size="sm" />
            <View style={styles.flex}>
              <AppText color="neutral" variant="titleSm">
                {line.name}
              </AppText>
              <AppText color="neutralMuted" variant="meta">
                {line.label}
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button fullWidth label={doneLabel} onPress={onDone} size="lg" testID="invite-outcome-done" variant="primary" />
        {onBackToSelection ? (
          <Button
            fullWidth
            label={INVITE_COPY.backToSelection}
            onPress={onBackToSelection}
            size="lg"
            testID="invite-outcome-selection"
            variant="secondary"
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

export function PickStep({
  bottomInset,
  clubName,
  events,
  onClose,
  onContinue,
  onSelect,
  selectedId,
}: {
  bottomInset: number;
  clubName: string;
  events: readonly InvitableEvent[];
  onClose: () => void;
  onContinue: () => void;
  onSelect: (eventId: string) => void;
  selectedId: string | null;
}) {
  if (events.length === 0) {
    /* Screen 24: nessun evento non eleggibile mostrato, solo Chiudi. */
    return (
      <View style={[styles.scroll, styles.empty]} testID="invite-pick-empty">
        <EmptyState
          description={INVITE_COPY.pickEmptyBody}
          icon="calendar-outline"
          title={INVITE_COPY.pickEmptyTitle}
        />
        <Button fullWidth label={INVITE_COPY.close} onPress={onClose} size="lg" testID="invite-pick-close" variant="secondary" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: spacing[32] + bottomInset }]}
      testID="invite-pick"
    >
      <View style={styles.titleBlock}>
        <AppText accessibilityRole="header" color="neutral" variant="screenTitle">
          {INVITE_COPY.pickTitle}
        </AppText>
        <AppText color="neutralMuted" variant="bodySm">
          {INVITE_COPY.pickSubtitle(clubName)}
        </AppText>
      </View>

      <View accessibilityRole="radiogroup">
        {events.map((event, index) => {
          const checked = selectedId === event.eventId;
          const lines = [invitableEventSubtitle(event), ...invitableEventLines(event)].filter(Boolean);

          /* Il cerchio del Radio condiviso, con titolo e righe gerarchiche
             che il componente base (una sola label) non prevede. */
          return (
            <Pressable
              accessibilityLabel={[event.title, ...lines].join(", ")}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              key={event.eventId}
              onPress={() => onSelect(event.eventId)}
              style={({ pressed }) => [styles.pickRow, index > 0 ? styles.divider : null, pressed ? styles.pressed : null]}
              testID={`invite-pick-${event.eventId}`}
            >
              <View style={[styles.circle, checked ? styles.circleChecked : null]} />
              <View style={styles.flex}>
                <AppText color="neutral" variant="titleSm">
                  {event.title}
                </AppText>
                {lines.map((line) => (
                  <AppText color="neutralMuted" key={line} variant="meta">
                    {line}
                  </AppText>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Button
        disabled={!selectedId}
        fullWidth
        label={INVITE_COPY.continue}
        onPress={onContinue}
        size="lg"
        testID="invite-pick-continue"
        variant="primary"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[12],
    paddingTop: spacing[8],
  },
  divider: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
  },
  event: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
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
  notice: {
    alignItems: "flex-start",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[16],
  },
  outcomeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[10],
  },
  person: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  circle: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    marginTop: spacing[4],
    width: 22,
  },
  circleChecked: {
    borderColor: colors.accent,
    borderWidth: 6,
  },
  pickRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  pressed: {
    opacity: 0.6,
  },
  scroll: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  titleBlock: {
    gap: spacing[4],
  },
});
