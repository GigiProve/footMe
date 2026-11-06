/**
 * Conferma finale della chiusura (DAS-REV-18 §19; screen 07).
 *
 * È **la** conferma: §19 — «non aggiungere un altro "Sei sicuro?" o una
 * pagina intermedia». Il tap su «Chiudi posizione» nel dettaglio non ha
 * cambiato nulla; qui si decide.
 *
 * Il rosso vive solo nella primaria di questo sheet: §4 lo limita a questo
 * comando, e l'azione nel dettaglio resta testo rosso sobrio, non un
 * pulsante pieno.
 *
 * Il motivo è una **riga con chevron**, non un selector inline: la scelta
 * avviene nella schermata dedicata di §20, e il ritorno conserva lo stato di
 * questo sheet. Qui non si salva niente: §20 — «Conferma motivo … non chiude
 * la Position e non salva un motivo storico separatamente.»
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";
import { closeReasonLabel } from "../../positions-presentation";
import type { PositionCloseReason } from "../../positions-types";

type Props = {
  busy?: boolean;
  /** «Prima squadra · Serie D» oppure «Intera società». */
  context: string;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenReason: () => void;
  reason: PositionCloseReason | null;
  /**
   * `true` quando la scadenza ha già interrotto la ricezione: §19 chiede di
   * adattare la prima conseguenza, perché annunciare che «non accetterà più
   * candidature» a una posizione che ha già smesso di riceverne non informa
   * di niente.
   */
  receivingClosed?: boolean;
  title: string;
  visible: boolean;
};

export const CLOSE_SHEET_COPY = {
  cancel: "Annulla",
  confirm: "Chiudi posizione",
  consequenceApplications: "Le candidature già ricevute resteranno disponibili.",
  consequenceOpen:
    "La posizione non accetterà più candidature e verrà spostata tra le posizioni Chiuse.",
  consequenceReceivingClosed:
    "La posizione verrà chiusa definitivamente e spostata tra le posizioni Chiuse.",
  irreversible: "Questa operazione non può essere annullata.",
  reasonLabel: "Motivo · Facoltativo",
  reasonHelper: "Il motivo è visibile solo alla società.",
  reasonUnset: "Nessun motivo",
  title: "Chiudere la posizione?",
} as const;

export function ClosePositionSheet({
  busy = false,
  context,
  error,
  onCancel,
  onConfirm,
  onOpenReason,
  reason,
  receivingClosed = false,
  title,
  visible,
}: Props) {
  return (
    <BottomSheet
      onClose={onCancel}
      title={CLOSE_SHEET_COPY.title}
      visible={visible}
    >
      <View style={styles.identity}>
        <AppText color="neutral" variant="titleMd">
          {title}
        </AppText>

        <AppText color="neutralMuted" variant="bodySm">
          {context}
        </AppText>
      </View>

      <AppText color="neutral" style={styles.consequence} variant="bodySm">
        {receivingClosed
          ? CLOSE_SHEET_COPY.consequenceReceivingClosed
          : CLOSE_SHEET_COPY.consequenceOpen}
      </AppText>

      <AppText color="neutral" style={styles.consequence} variant="bodySm">
        {CLOSE_SHEET_COPY.consequenceApplications}
      </AppText>

      <Pressable
        accessibilityHint="Apre la scelta del motivo di chiusura"
        accessibilityLabel={`${CLOSE_SHEET_COPY.reasonLabel}: ${closeReasonLabel(reason) ?? CLOSE_SHEET_COPY.reasonUnset}`}
        accessibilityRole="button"
        disabled={busy}
        onPress={onOpenReason}
        style={({ pressed }) => [styles.reason, pressed ? styles.pressed : null]}
        testID="position-close-reason"
      >
        <View style={styles.reasonText}>
          <AppText color="neutralMuted" variant="meta">
            {CLOSE_SHEET_COPY.reasonLabel}
          </AppText>

          {/* §21: «Motivo nullo non produce una label "Nessun motivo"
              nell'interfaccia storica». Qui però è un controllo da compilare,
              non una riga di storico: il segnaposto dice che è vuoto e che si
              può lasciare così. */}
          <AppText
            color={reason ? "neutral" : "neutralMuted"}
            variant="bodyLg"
          >
            {closeReasonLabel(reason) ?? CLOSE_SHEET_COPY.reasonUnset}
          </AppText>
        </View>

        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      </Pressable>

      <AppText color="neutralMuted" style={styles.helper} variant="meta">
        {CLOSE_SHEET_COPY.reasonHelper}
      </AppText>

      <AppText color="neutral" style={styles.irreversible} variant="metaStrong">
        {CLOSE_SHEET_COPY.irreversible}
      </AppText>

      {error ? (
        <AppText
          accessibilityRole="alert"
          color="danger"
          style={styles.error}
          testID="position-close-error"
          variant="meta"
        >
          {error}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {/* §4: «Un solo pulsante distruttivo del design system; rosso
            limitato a questo comando.» */}
        <Button
          destructive
          fullWidth
          label={CLOSE_SHEET_COPY.confirm}
          loading={busy}
          onPress={onConfirm}
          testID="position-close-confirm"
        />

        <Button
          disabled={busy}
          fullWidth
          label={CLOSE_SHEET_COPY.cancel}
          onPress={onCancel}
          size="md"
          testID="position-close-cancel"
          variant="link"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[4],
    paddingTop: spacing[20],
  },
  consequence: {
    paddingTop: spacing[12],
  },
  error: {
    paddingTop: spacing[12],
  },
  helper: {
    paddingTop: spacing[4],
  },
  identity: {
    gap: spacing[4],
    paddingTop: spacing[8],
  },
  irreversible: {
    paddingTop: spacing[16],
  },
  pressed: {
    opacity: 0.7,
  },
  reason: {
    alignItems: "center",
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[8],
    marginTop: spacing[16],
    minHeight: sizes.touchTarget,
    paddingTop: spacing[12],
  },
  reasonText: {
    flex: 1,
    gap: spacing[4],
  },
});
