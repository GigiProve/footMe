/**
 * Piè dell'editor Articolo (HOM-06.2 §77–§80, §119–§120, §247; mockup 2–3):
 * stato dell'autosave a sinistra e la CTA primaria a destra.
 *
 *  • la CTA riflette SEMPRE la pubblicazione scelta (§79): «Pubblica» con Ora,
 *    «Programma» con una data futura, «Salva» in modifica — il testo lo decide lo
 *    store (`selectArticleView`), qui non si ricalcola;
 *  • disabilitata mostra perché (§32, §7J, §7Q): una riga di testo sopra il piè,
 *    ma solo dopo che l'utente ha cominciato — su un editor vuoto il segnaposto
 *    «Inserisci un titolo» dice già cosa manca;
 *  • «Salvataggio…» / «Bozza salvata» sono discreti e non toast (§119–§120);
 *  • un conflitto di versione (§128–§130) non sovrascrive: offre «Ricarica».
 */

import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../styles";
import { AppText, Button } from "../../../ui";
import { AutosaveStatus } from "../../publishing/components/AutosaveStatus";
import type { AutosaveStatus as AutosaveState } from "../../publishing/publishing-types";

type Props = {
  autosave: AutosaveState;
  /** false per le modifiche a salvataggio esplicito: nessuna bozza da mostrare. */
  showAutosave: boolean;
  ctaLabel: string;
  ctaDisabled: boolean;
  busy: boolean;
  /** Il motivo del blocco (`blockerCopy`), già filtrato dal chiamante. */
  hint: string | null;
  onSubmit: () => void;
  onReload?: (() => void) | null;
};

export function ArticleFooter({ autosave, showAutosave, ctaLabel, ctaDisabled, busy, hint, onSubmit, onReload = null }: Props) {
  return (
    <View style={styles.container}>
      {hint ? (
        <AppText color="secondary" style={styles.hint} variant="feedMeta">
          {hint}
        </AppText>
      ) : null}
      <View style={styles.row}>
        <View style={styles.status}>
          {showAutosave ? <AutosaveStatus status={autosave} /> : null}
          {showAutosave && autosave.status === "conflict" && onReload ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={onReload} style={styles.reload}>
              <AppText color="accent" variant="actionLabel">
                Ricarica
              </AppText>
            </Pressable>
          ) : null}
        </View>
        <Button
          accessibilityHint={hint ?? undefined}
          disabled={ctaDisabled}
          label={ctaLabel}
          loading={busy}
          onPress={onSubmit}
          size="lg"
          testID="article-cta"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  hint: {
    textAlign: "right",
  },
  reload: {
    justifyContent: "center",
    minHeight: 32,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  status: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[12],
  },
});
