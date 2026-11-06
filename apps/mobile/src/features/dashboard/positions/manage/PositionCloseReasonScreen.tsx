/**
 * Scelta del motivo di chiusura (DAS-REV-18 §20; screen 08).
 *
 * Un flusso focalizzato, senza bottom navigation: §41 — «Composer e form
 * focalizzati non mostrano bottom navigation», e il master mostra qui solo
 * back, titolo e CTA.
 *
 * **Il motivo è facoltativo.** Lo screen 08 fotografa un momento successivo
 * alla scelta di «Profilo trovato»; non è una preselezione (§20). Da qui
 * l'assenza di un valore iniziale e la presenza di «Rimuovi motivo», che
 * compare solo quando c'è qualcosa da rimuovere.
 *
 * Questa schermata **non chiude niente**: §20 — «Conferma motivo torna allo
 * sheet finale preservando lo stato; non chiude la Position e non salva un
 * motivo storico separatamente.» La chiusura persiste stato e motivo insieme
 * solo al commit finale (§22).
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button, Radio } from "../../../../ui";
import { ComposerTextField } from "../compose/components/ComposerTextField";
import {
  CLOSE_REASON_LABELS,
  CLOSE_REASON_ORDER,
  CLOSE_REASON_TEXT_MAX,
} from "../positions-presentation";
import type { PositionCloseReason } from "../positions-types";
import {
  readCloseDraft,
  withReason,
  writeCloseDraft,
} from "./close-draft";

const COPY = {
  back: "Indietro",
  confirm: "Conferma motivo",
  helper: "Il motivo resta interno alla società.",
  otherLabel: "Aggiungi un dettaglio",
  remove: "Rimuovi motivo",
  textTooLong: `Il dettaglio supera i ${CLOSE_REASON_TEXT_MAX} caratteri.`,
  title: "Motivo di chiusura",
} as const;

export function PositionCloseReasonScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const positionId = typeof id === "string" ? id : "";

  /* Lo stato di partenza è la bozza già in viaggio: tornare qui dopo un back
     non riazzera la scelta (§38 — «non perdere il buffer tornando da una
     subview»). */
  const [draft, setDraft] = useState(() =>
    readCloseDraft(queryClient, positionId),
  );

  const tooLong =
    Array.from(draft.reasonText ?? "").length > CLOSE_REASON_TEXT_MAX;

  const commit = () => {
    if (tooLong) {
      return;
    }

    /* Il testo vuoto non viaggia come stringa vuota: §20 vuole trim e
       normalizzazione, e «Altro senza testo» deve restare una chiusura
       valida. */
    const reasonText = draft.reason === "other"
      ? (draft.reasonText?.trim() || null)
      : null;

    writeCloseDraft(queryClient, positionId, {
      reason: draft.reason,
      reasonText,
    });

    router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel={COPY.back}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
          testID="close-reason-back"
        >
          <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
        </Pressable>

        <AppText
          accessibilityRole="header"
          color="neutral"
          numberOfLines={1}
          style={styles.barTitle}
          variant="titleSm"
        >
          {COPY.title}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        testID="position-close-reason-screen"
      >
        <View accessibilityRole="radiogroup" style={styles.options}>
          {CLOSE_REASON_ORDER.map((reason) => (
            <Radio
              checked={draft.reason === reason}
              key={reason}
              label={CLOSE_REASON_LABELS[reason]}
              onPress={() => setDraft((current) => withReason(current, reason))}
              testID={`close-reason-${reason}`}
            />
          ))}
        </View>

        {/* §20: «Deve essere possibile … rimuovere una scelta prima del
            commit tramite un'azione leggera Rimuovi motivo, visibile solo se
            esiste.» */}
        {draft.reason ? (
          <Button
            label={COPY.remove}
            onPress={() => setDraft((current) => withReason(current, null))}
            size="md"
            testID="close-reason-remove"
            variant="link"
          />
        ) : null}

        {/* §20: «Con Altro mostra nello stesso flow un campo testo … Anche il
            testo di Altro è facoltativo.» */}
        {draft.reason === "other" ? (
          <ComposerTextField
            error={tooLong ? COPY.textTooLong : null}
            label={COPY.otherLabel}
            limit={CLOSE_REASON_TEXT_MAX}
            onChangeText={(value) =>
              setDraft((current) => ({ ...current, reasonText: value }))
            }
            testID="close-reason-text"
            value={draft.reasonText ?? ""}
          />
        ) : null}

        <AppText color="neutralMuted" style={styles.helper} variant="bodySm">
          {COPY.helper}
        </AppText>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[12] }]}>
        <Button
          disabled={tooLong}
          fullWidth
          label={COPY.confirm}
          onPress={commit}
          testID="close-reason-confirm"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    paddingRight: spacing[20],
  },
  barTitle: {
    flex: 1,
  },
  content: {
    gap: spacing[12],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  helper: {
    paddingTop: spacing[4],
  },
  options: {
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
});
