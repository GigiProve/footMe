/**
 * Sheet «Notifiche» (DAS-REV-34 §8, §9; PNG 02), condiviso da DIRECT e GROUP:
 * un solo selector, un solo sistema di salvataggio (QA-006).
 *
 * Cinque opzioni esatte, una sola selezione. Il tap applica la preferenza
 * senza «Salva» e senza conferma: durante l'invio la riga scelta mostra lo
 * stato locale, al successo lo sheet si chiude e il chiamante legge il valore
 * aggiornato dalla stessa cache. In errore lo sheet resta aperto con lo stato
 * confermato dal server e il messaggio, e un nuovo tap è il retry (stesso
 * operation id: non ricalcola la durata). Il foglio scorre: con font grandi
 * l'opzione «finché non le riattivi» resta raggiungibile (§29).
 */
import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet, Radio, useToast } from "../../../ui";
import { conversationTypeProp, trackMute } from "./mute-analytics";
import { MUTE_OPTIONS, NOTIFICATIONS_COPY, type MuteErrorKind } from "./mute-presentation";
import type { ConversationKind, MuteChoice } from "./mute-types";
import { useConversationMute } from "./use-conversation-mute";

type Props = {
  conversationId: string;
  conversationType: ConversationKind;
  onAccessLost?: (kind: MuteErrorKind) => void;
  onClose: () => void;
  /** GROUP: periodo osservato dalla schermata che apre lo sheet. */
  periodId: string | null;
  profileId: string;
  visible: boolean;
};

export function ConversationNotificationsSheet({
  conversationId,
  conversationType,
  onAccessLost,
  onClose,
  periodId,
  profileId,
  visible,
}: Props) {
  const { showToast } = useToast();
  const mute = useConversationMute({
    conversationId,
    conversationType,
    enabled: visible,
    onAccessLost,
    periodId,
    profileId,
  });
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  });

  // §27: una sola volta per apertura.
  useEffect(() => {
    if (visible) {
      trackMute({
        conversationType: conversationTypeProp(conversationType),
        name: "conversation_notifications_opened",
      });
    }
  }, [conversationType, visible]);

  function close() {
    mute.reset();
    onClose();
  }

  async function handleSelect(choice: MuteChoice) {
    const result = await mute.select(choice);

    if (result === "applied") {
      close();
    } else if (result === "failed" && !visibleRef.current) {
      // Chiuso nel frattempo: l'errore non resta muto (§9).
      showToast({ id: "conversation-mute-error", message: NOTIFICATIONS_COPY.error, tone: "neutral" });
    }
  }

  return (
    <BottomSheet onClose={close} scrollable title={NOTIFICATIONS_COPY.title} visible={visible}>
      <View accessibilityRole="radiogroup" testID="conversation-notifications-sheet">
        {MUTE_OPTIONS.map((option) => (
          <Radio
            checked={option.value === mute.selected}
            key={option.value}
            label={option.label}
            onPress={() => void handleSelect(option.value)}
            testID={`mute-option-${option.value}`}
          />
        ))}
      </View>

      {mute.failed ? (
        <AppText accessibilityRole="alert" color="danger" style={styles.feedback} testID="mute-error" variant="bodySm">
          {NOTIFICATIONS_COPY.error}
        </AppText>
      ) : null}

      <View style={styles.helperRow}>
        <AppText color="neutralMuted" style={styles.helper} variant="bodySm">
          {NOTIFICATIONS_COPY.helper}
        </AppText>
        {mute.isPending ? (
          <ActivityIndicator
            accessibilityLabel={NOTIFICATIONS_COPY.saving}
            color={colors.accent}
            size="small"
            testID="mute-saving"
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  feedback: {
    paddingTop: spacing[8],
  },
  helper: {
    flex: 1,
  },
  helperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingTop: spacing[12],
  },
});
