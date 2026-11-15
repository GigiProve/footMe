/**
 * Passo «Condividi» (HOM-09 §82–§94, §125–§139; mockup 3 e 8).
 *
 * Destinatario (il nome se uno solo, «N conversazioni selezionate» se più,
 * §84–§85, senza chip: §68), campo «Aggiungi un messaggio…» facoltativo con
 * contatore 0/500 (§87–§90), preview strutturata sotto il testo (§92), una sola
 * CTA: «Invia» / «Invia a N» (§93–§94) e, per il multi-send, l'helper discreto
 * «Il contenuto verrà inviato separatamente a ogni conversazione» (§86).
 *
 * Esiti, sempre dentro questo passo e con i dati preservati (§137):
 *  • errore totale — «Invio non riuscito» e «Riprova» (§135–§136); se nessuna
 *    consegna è ritentabile niente «Riprova» inutile (§216);
 *  • successo parziale — banner warning leggero «Inviato a X di N
 *    conversazioni», esito per destinatario e «Riprova N invii» (§138–§141).
 *    Il testo si blocca: i destinatari già raggiunti hanno ricevuto quello;
 *  • contenuto non disponibile — nessun invio (§212–§213).
 * Nessuna schermata di successo dedicata (§134): il successo chiude il flusso e
 * il feedback è un toast sull'origine. CTA disabilitata durante l'invio (§126).
 */

import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, sizes, spacing, typography } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import type { ComposeStatus } from "../share-batch";
import {
  clampShareText,
  failedCountLabel,
  partialTitle,
  recipientsSummary,
  retryLabel,
  SHARE_COPY,
  SHARE_TEXT_MAX,
  sendAccessibilityLabel,
  sendLabel,
  shareTextCounter,
} from "../share-presentation";
import type { SharePreview, ShareRecipient } from "../share-types";
import { RecipientAvatar } from "./RecipientAvatar";
import { SharePreviewCard } from "./SharePreviewCard";
import { ShareStepHeader } from "./ShareStepHeader";

type ShareComposeStepProps = {
  /** Consegne deduplicate della selezione (`deliveryCount` di share-batch). */
  deliveryCount: number;
  leading: "back" | "close";
  preview: SharePreview;
  recipients: ShareRecipient[];
  status: ComposeStatus;
  text: string;
  textLocked: boolean;
  onChangeText: (text: string) => void;
  onClose: () => void;
  onLeadingPress: () => void;
  onRetry: () => void;
  onSend: () => void;
};

function Banner({
  body,
  icon,
  testID,
  title,
  tone,
}: {
  body?: string;
  icon: "warning" | "alert-circle";
  testID: string;
  title: string;
  tone: "warning" | "danger";
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, tone === "warning" ? styles.bannerWarning : styles.bannerDanger]}
      testID={testID}
    >
      <Ionicons
        color={tone === "warning" ? colors.warning : colors.danger}
        name={icon}
        size={20}
      />
      <View style={styles.bannerText}>
        <AppText color={tone === "warning" ? "warning" : "danger"} variant="titleSm">
          {title}
        </AppText>
        {body ? (
          <AppText color={tone === "warning" ? "warning" : "secondary"} variant="bodySm">
            {body}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export function ShareComposeStep({
  deliveryCount,
  leading,
  preview,
  recipients,
  status,
  text,
  textLocked,
  onChangeText,
  onClose,
  onLeadingPress,
  onRetry,
  onSend,
}: ShareComposeStepProps) {
  // Le consegne reali (dedup): persona P e Società di P selezionate insieme sono
  // una sola. CTA, riepilogo e helper usano questo numero, mai le righe.
  const count = deliveryCount;
  const isSending = status.kind === "sending";
  const isMulti = count > 1;
  // L'esito per destinatario si mostra dopo un parziale e anche se un retry
  // trova il contenuto sparito: i successi già avvenuti restano visibili.
  const outcomeStatuses =
    status.kind === "partial" || status.kind === "unavailable" ? status.statuses : null;

  const cta =
    status.kind === "failed"
      ? status.canRetry
        ? { label: SHARE_COPY.retry, onPress: onRetry, variant: "primary" as const }
        : // §216: niente «Riprova» inutile, ma un'uscita sì.
          { label: SHARE_COPY.close, onPress: onClose, variant: "secondary" as const }
      : status.kind === "partial"
        ? status.retryCount > 0
          ? { label: retryLabel(status.retryCount), onPress: onRetry, variant: "primary" as const }
          : { label: SHARE_COPY.close, onPress: onClose, variant: "secondary" as const }
        : status.kind === "unavailable"
          ? { label: SHARE_COPY.close, onPress: onClose, variant: "secondary" as const }
          : { label: sendLabel(count), onPress: onSend, variant: "primary" as const };

  return (
    <SafeAreaView style={styles.root} testID="share-compose">
      <ShareStepHeader leading={leading} onLeadingPress={onLeadingPress} title={SHARE_COPY.stepTitle} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          style={styles.flex}
        >
          {status.kind === "partial" ? (
            <Banner
              body={failedCountLabel(status.failedCount)}
              icon="warning"
              testID="share-banner-partial"
              title={partialTitle(status.okCount, status.total)}
              tone="warning"
            />
          ) : null}
          {status.kind === "failed" ? (
            <Banner
              icon="alert-circle"
              testID="share-banner-failed"
              title={SHARE_COPY.sendFailed}
              tone="danger"
            />
          ) : null}
          {status.kind === "unavailable" ? (
            <Banner
              body={SHARE_COPY.unavailableBody}
              icon="alert-circle"
              testID="share-banner-unavailable"
              title={SHARE_COPY.unavailableTitle}
              tone="danger"
            />
          ) : null}

          {outcomeStatuses ? (
            <View style={styles.outcomes} testID="share-outcomes">
              {recipients.map((recipient) => {
                const sent = outcomeStatuses[recipient.key] === "sent";

                return (
                  <View
                    accessible
                    accessibilityLabel={`${recipient.displayName}, ${sent ? "inviato" : "invio non riuscito"}`}
                    key={recipient.key}
                    style={styles.outcomeRow}
                  >
                    <RecipientAvatar recipient={recipient} size="sm" />
                    <AppText numberOfLines={2} style={styles.outcomeName} variant="titleSm">
                      {recipient.displayName}
                    </AppText>
                    <Ionicons
                      color={sent ? colors.success : colors.warningForeground}
                      name={sent ? "checkmark-circle" : "alert-circle"}
                      size={20}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View accessible style={styles.summary} testID="share-recipients-summary">
              {count === 1 ? <RecipientAvatar recipient={recipients[0]} size="sm" /> : null}
              <AppText numberOfLines={2} style={styles.summaryText} variant="titleSm">
                {recipientsSummary(recipients, count)}
              </AppText>
            </View>
          )}

          {/* Bloccato dopo una consegna (o un tentativo ambiguo): fondo e testo da
              disabilitato, perché non sembri un campo che ignora la digitazione. */}
          <View style={[styles.field, textLocked ? styles.fieldLocked : null]}>
            <TextInput
              accessibilityHint={SHARE_COPY.messageOptionalHint}
              accessibilityLabel={`${SHARE_COPY.messageLabel} ${SHARE_COPY.messageOptionalHint.toLowerCase()}`}
              editable={!textLocked && !isSending}
              maxLength={SHARE_TEXT_MAX}
              multiline
              onChangeText={(value) => onChangeText(clampShareText(value))}
              placeholder={SHARE_COPY.messageLabel}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, textLocked ? styles.inputLocked : null]}
              testID="share-message-input"
              value={text}
            />
            <AppText color="muted" style={styles.counter} variant="caption">
              {shareTextCounter(text)}
            </AppText>
          </View>

          <SharePreviewCard bordered maxLines={2} preview={preview} showAuthorMeta testID="share-compose-preview" />
        </ScrollView>

        <View style={styles.footer}>
          {cta ? (
            <Button
              accessibilityLabel={
                cta.label === sendLabel(count) ? sendAccessibilityLabel(count) : cta.label
              }
              label={cta.label}
              loading={isSending}
              onPress={cta.onPress}
              size="lg"
              testID="share-cta"
              variant={cta.variant}
            />
          ) : null}
          {isMulti && status.kind !== "partial" && status.kind !== "unavailable" ? (
            <View style={styles.helper} testID="share-multi-helper">
              <Ionicons color={colors.textMuted} name="shield-checkmark-outline" size={16} />
              <AppText color="muted" style={styles.helperText} variant="caption">
                {SHARE_COPY.helperMultiSend}
              </AppText>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "flex-start",
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[10],
    padding: spacing[12],
  },
  bannerDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  bannerText: {
    flex: 1,
    gap: spacing[4],
  },
  bannerWarning: {
    backgroundColor: colors.noticeWarnSurface,
    borderColor: colors.noticeWarnBorder,
  },
  content: {
    gap: spacing[16],
    padding: spacing[20],
  },
  counter: {
    alignSelf: "flex-end",
  },
  field: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[14],
  },
  fieldLocked: {
    backgroundColor: colors.surfaceMuted,
  },
  flex: {
    flex: 1,
  },
  footer: {
    gap: spacing[12],
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  helper: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[8],
  },
  helperText: {
    flex: 1,
  },
  input: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[15],
    lineHeight: typography.lineHeight[22],
    minHeight: sizes.multilineFieldMinHeight,
    padding: 0,
    textAlignVertical: "top",
  },
  inputLocked: {
    color: colors.textSecondary,
  },
  outcomeName: {
    flex: 1,
  },
  outcomeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    minHeight: sizes.touchTarget,
  },
  outcomes: {
    gap: spacing[4],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  summary: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
  },
  summaryText: {
    flex: 1,
  },
});
