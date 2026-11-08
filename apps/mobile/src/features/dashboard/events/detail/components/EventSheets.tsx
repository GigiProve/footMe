/**
 * Sheet della persona (DAS-REV-29 §14, §19; screen 09, 10, 13).
 *
 * Sul `BottomSheet` condiviso (titolo + chiusura): nessuna bottom navigation
 * interattiva nel sheet (§4), il fondo è oscurato e non riceve tap. La
 * chiusura non invia nulla (§14). Durante l'invio la CTA mostra il loading e
 * non accetta un secondo tap; «Annulla» resta attivo perché la richiesta è
 * già partita e chiudere la UI non la annulla.
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../../theme/tokens";
import { AppText, Avatar, BottomSheet, Button } from "../../../../../ui";
import { DETAIL_COPY, type RegisterSheetModel } from "../event-detail-presentation";
import { EventNoticeCard } from "./EventDetailParts";

export function RegisterSheet({
  busy,
  club,
  model,
  onCancel,
  onConfirm,
  person,
  title,
  venue,
  visible,
  when,
}: {
  busy: boolean;
  club: { isVerified: boolean; logoUrl: string | null; name: string };
  model: RegisterSheetModel;
  onCancel: () => void;
  onConfirm: () => void;
  person: { avatarUrl: string | null; meta: string; name: string };
  title: string;
  venue: string | null;
  visible: boolean;
  when: string | null;
}) {
  return (
    <BottomSheet onClose={onCancel} title={DETAIL_COPY.sheetTitle} visible={visible}>
      <View style={styles.body} testID="event-register-sheet">
        <View style={styles.row}>
          <Avatar name={club.name} size="sm" square tone="ink" uri={club.logoUrl ?? undefined} />
          <AppText color="neutral" style={styles.flex} variant="bodySm">
            {club.name}
          </AppText>
        </View>

        {/* §14: titolo, Società, Team, data/ora e identità personale. Nessun
            campo anagrafico, CV, motivazione o checkbox. */}
        <View style={styles.context}>
          <AppText color="neutral" variant="titleSm">
            {title}
          </AppText>
          {when ? (
            <AppText color="neutralMuted" variant="bodySm">
              {when}
            </AppText>
          ) : null}
          {venue ? (
            <AppText color="neutralMuted" variant="bodySm">
              {venue}
            </AppText>
          ) : null}
        </View>

        <View style={styles.row}>
          <Avatar name={person.name} size="md" uri={person.avatarUrl ?? undefined} />
          <View style={styles.flex}>
            <AppText color="neutral" variant="titleSm">
              {person.name}
            </AppText>
            {person.meta ? (
              <AppText color="neutralMuted" variant="bodySm">
                {person.meta}
              </AppText>
            ) : null}
          </View>
        </View>

        {model.yearsWarning ? (
          <EventNoticeCard
            notice={{
              icon: "warning-outline",
              lines: [model.yearsWarning.lines[1]],
              title: model.yearsWarning.lines[0],
              tone: "warning",
            }}
            testID="event-register-years-warning"
          />
        ) : null}

        {model.notes.map((note) => (
          <AppText color="neutralMuted" key={note} variant="bodySm">
            {note}
          </AppText>
        ))}

        <View style={styles.actions}>
          <Button
            disabled={busy}
            fullWidth
            label={model.confirmLabel}
            loading={busy}
            onPress={onConfirm}
            size="lg"
            testID="event-register-confirm"
            variant="primary"
          />
          <Button
            fullWidth
            label={DETAIL_COPY.cancel}
            onPress={onCancel}
            size="lg"
            testID="event-register-cancel"
            variant="secondary"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

/** Ritiro di una richiesta o annullamento della partecipazione (§19). */
export function WithdrawSheet({
  body,
  busy,
  confirmLabel,
  onCancel,
  onConfirm,
  title,
  visible,
}: {
  body: string;
  busy: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onCancel} title={title} visible={visible}>
      <View style={styles.body} testID="event-withdraw-sheet">
        <AppText color="neutralMuted" variant="bodySm">
          {body}
        </AppText>

        <View style={styles.actions}>
          <Button
            disabled={busy}
            fullWidth
            label={confirmLabel}
            loading={busy}
            onPress={onConfirm}
            size="lg"
            testID="event-withdraw-confirm"
            variant="primary"
          />
          <Button
            fullWidth
            label={DETAIL_COPY.cancel}
            onPress={onCancel}
            size="lg"
            testID="event-withdraw-cancel"
            variant="secondary"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[12],
    paddingTop: spacing[8],
  },
  body: {
    gap: spacing[16],
  },
  context: {
    gap: spacing[4],
  },
  flex: {
    flex: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
});
