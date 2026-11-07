/**
 * Lo sheet di conferma dei due comandi personali (screen 02 e 04).
 *
 * Uno solo per entrambi: cambiano titolo, corpo e il contesto mostrato, non
 * la forma. §12 — «Questa è l'unica conferma del flusso, non uno step
 * aggiunto sopra un'altra conferma equivalente»: una seconda implementazione
 * sarebbe esattamente il modo in cui ne nasce una seconda.
 *
 * Resta sopra lo stack di origine (§28): il fondo è la pagina da cui è
 * partito — per lo screen 04 la candidatura **ritirata**, non quella già
 * reinviata — e lo sheet copre la bottom navigation rispettando la safe area.
 */
import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  StyleSheet,
  View,
} from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText, Avatar, BottomSheet, Button } from "../../../../ui";
import { LIFECYCLE_COPY } from "../lifecycle-presentation";

export type LifecycleSheetParty = {
  /**
   * Nome da cui ricavare le iniziali quando manca l'immagine. Distinto da
   * `name`, che è la riga di testo: «Centrocampista · AC Como» darebbe
   * «CC» al posto dello stemma della società.
   */
  avatarName?: string;
  avatarUrl: string | null;
  /** Righe secondarie grigie: ruolo, situazione, squadra. */
  meta: readonly (string | null)[];
  name: string;
  square?: boolean;
  /** Riga in evidenza sotto il nome: il ruolo della Position. */
  strong?: string | null;
};

export function ConfirmLifecycleSheet({
  body,
  bodyPlacement = "before",
  busy,
  confirmLabel,
  onCancel,
  onConfirm,
  parties,
  testID,
  title,
  visible,
}: {
  body: string;
  /**
   * Screen 02 spiega **prima** di mostrare il contesto; screen 04 mostra
   * prima chi si candida e a che cosa, e solo dopo che cosa comporta. Il
   * PNG li ordina così e l'ordine è parte del significato.
   */
  bodyPlacement?: "after" | "before";
  busy: boolean;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  parties: readonly LifecycleSheetParty[];
  testID?: string;
  title: string;
  visible: boolean;
}) {
  const titleRef = useRef<View>(null);

  /*
   * §34: «Aprendo uno sheet, sposta il focus al titolo.» Senza, il lettore di
   * schermo resta sul pulsante che ha aperto lo sheet e legge il fondo.
   *
   * In try/catch perché `findNodeHandle` non esiste su ogni renderer — su
   * react-native-web solleva — e uno sheet che non si apre è un danno molto
   * peggiore di un focus non spostato.
   */
  useEffect(() => {
    if (!visible) {
      return;
    }

    try {
      const node = findNodeHandle(titleRef.current);

      if (node != null) {
        AccessibilityInfo.setAccessibilityFocus?.(node);
      }
    } catch {
      /* Il focus resta dov'era: lo sheet è comunque `accessibilityViewIsModal`
         per via del Modal, quindi il fondo non viene letto. */
    }
  }, [visible]);

  return (
    <BottomSheet onClose={onCancel} visible={visible}>
      <View style={styles.body} testID={testID}>
        <View accessibilityRole="header" accessible ref={titleRef}>
          <AppText color="neutral" variant="headingSm">
            {title}
          </AppText>
        </View>

        {bodyPlacement === "before" ? (
          <AppText color="neutralMuted" variant="bodySm">
            {body}
          </AppText>
        ) : null}

        {parties.map((party) => (
          <View key={party.name} style={styles.party}>
            <Avatar
              name={party.avatarName ?? party.name}
              size="md"
              square={party.square}
              uri={party.avatarUrl ?? undefined}
            />

            <View style={styles.partyBody}>
              {party.strong ? (
                <>
                  <AppText color="neutralMuted" variant="bodySm">
                    {party.name}
                  </AppText>
                  <AppText color="neutral" variant="titleSm">
                    {party.strong}
                  </AppText>
                </>
              ) : (
                <AppText color="neutral" variant="titleSm">
                  {party.name}
                </AppText>
              )}

              {party.meta
                .filter((line): line is string => !!line)
                .map((line) => (
                  <AppText color="neutralMuted" key={line} variant="bodySm">
                    {line}
                  </AppText>
                ))}
            </View>
          </View>
        ))}

        {bodyPlacement === "after" ? (
          <AppText color="neutralMuted" variant="bodySm">
            {body}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          {/* §29: la primaria della conferma è blu con testo bianco, anche
              quando l'azione che conferma è un ritiro. §27 — «Ritiro,
              scadenza e chiusura sono stati di business regolari»: niente
              `destructive`. */}
          <Button
            disabled={busy}
            fullWidth
            label={confirmLabel}
            loading={busy}
            onPress={onConfirm}
            size="lg"
            testID={testID ? `${testID}-confirm` : undefined}
            variant="primary"
          />

          <Button
            /* §10: «Annulla, back o chiusura prima della conferma non
               eseguono il ritiro.» Resta attivo anche durante l'invio: la
               richiesta è già partita e chiudere la UI non la annulla. */
            fullWidth
            label={LIFECYCLE_COPY.cancel}
            onPress={onCancel}
            size="lg"
            testID={testID ? `${testID}-cancel` : undefined}
            variant="neutralOutline"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing[12],
  },
  party: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[4],
  },
  partyBody: {
    flex: 1,
    gap: spacing[4],
  },
  actions: {
    gap: spacing[8],
    paddingTop: spacing[4],
  },
});
