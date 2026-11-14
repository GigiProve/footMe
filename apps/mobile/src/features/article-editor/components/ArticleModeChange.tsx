/**
 * «Cambia modalità» (HOM-06.2 §7X), un'azione discreta degli articoli non ancora
 * programmati né pubblicati.
 *
 *  • prima di una bozza significativa (nulla di scritto, nessuna riga sul server)
 *    si torna al selector senza chiedere nulla;
 *  • dopo, la modalità non si converte in silenzio: si sceglie la nuova e si chiede
 *    conferma — «Cambiare modalità di creazione?» / «Alcuni dati specifici di
 *    questa modalità potrebbero non essere conservati.» — elencando cosa verrebbe
 *    tolto (`modeSwitchLosses`). Nessuno scraping del body per convertire un link in
 *    testo importato, nessuna rimozione automatica di fonte o diritti oltre a ciò
 *    che l'elenco dichiara.
 *
 * Il cambio conserva identity, tag, pubblicazione e la bozza sul server: la
 * sessione passa alla schermata della nuova modalità (`handoff`), che prosegue lo
 * stesso salvataggio.
 */

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { spacing } from "../../../styles";
import { AppText, BottomSheet, Button, ConfirmModal } from "../../../ui";
import type { ArticleCreationMode } from "../../publishing/publishing-types";
import { articleHandoffHref, articleNewHref } from "../article-routes";
import { articleStore, modeSwitchLosses, selectArticleView, type ArticleStoreState } from "../article-store";
import type { ArticleEditor } from "../use-article-editor";
import { ArticleModeOptions } from "./ArticleModeOptions";

type Props = {
  editor: ArticleEditor;
  state: ArticleStoreState;
};

export function ArticleModeChange({ editor, state }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [choice, setChoice] = useState<ArticleCreationMode | null>(null);
  const [confirmFor, setConfirmFor] = useState<ArticleCreationMode | null>(null);
  const [busy, setBusy] = useState(false);

  const view = selectArticleView(state);
  const others = (view.identity?.modes ?? []).filter((mode) => mode !== state.mode);
  const hasWork = view.significant || editor.autosave.ref !== null;

  // Un articolo programmato o pubblicato non cambia modalità (§7X parla di articoli non ancora pubblicati).
  if (state.session?.editing || others.length === 0) {
    return null;
  }

  function open() {
    if (!hasWork) {
      editor.navigateAway(articleNewHref(state.session?.origin ?? "HOME_PER_TE", state.identityId));
      return;
    }
    setChoice(others[0]);
    setSheetOpen(true);
  }

  async function apply(next: ArticleCreationMode) {
    setBusy(true);
    // La bozza con le modifiche ancora in attesa si salva PRIMA del cambio: la nuova schermata riparte da lì.
    const saved = await editor.flush();
    if (saved) {
      // Lo store deve avere subito ref e versione: la schermata che subentra li legge all'apertura.
      articleStore.dispatch({ ref: saved.ref, type: "serverSynced", version: saved.version });
    }
    articleStore.dispatch({ mode: next, type: "modeChanged" });
    setConfirmFor(null);
    setSheetOpen(false);
    setBusy(false);
    editor.navigateAway(articleHandoffHref(next, state.session?.origin ?? "HOME_PER_TE", articleStore.getState().identityId));
  }

  const losses = confirmFor ? modeSwitchLosses(state, confirmFor) : [];

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityHint="Scegli un altro modo di creare l'articolo"
        accessibilityLabel="Cambia modalità"
        accessibilityRole="button"
        onPress={open}
        style={styles.trigger}
        testID="article-mode-change"
      >
        <AppText color="secondary" variant="actionLabel">
          Cambia modalità
        </AppText>
      </Pressable>

      <BottomSheet onClose={() => setSheetOpen(false)} title="Cambia modalità" visible={sheetOpen}>
        <ArticleModeOptions modes={others} onSelect={setChoice} selected={choice} />
        <View style={styles.sheetAction}>
          <Button
            disabled={!choice}
            fullWidth
            label="Continua"
            onPress={() => {
              if (!choice) return;
              // Niente conferma se non c'è nulla che il cambio possa togliere.
              if (modeSwitchLosses(articleStore.getState(), choice).length === 0) {
                void apply(choice);
              } else {
                setSheetOpen(false);
                setConfirmFor(choice);
              }
            }}
            testID="article-mode-change-continue"
          />
        </View>
      </BottomSheet>

      <ConfirmModal
        cancelLabel="Continua a modificare"
        confirmLabel="Cambia modalità"
        isBusy={busy}
        message="Alcuni dati specifici di questa modalità potrebbero non essere conservati."
        onCancel={() => setConfirmFor(null)}
        onConfirm={() => {
          if (confirmFor) void apply(confirmFor);
        }}
        title="Cambiare modalità di creazione?"
        visible={confirmFor !== null}
      >
        {losses.length > 0 ? (
          <AppText color="secondary" variant="bodySm">
            {`Verrebbero rimossi: ${losses.join(", ")}.`}
          </AppText>
        ) : null}
      </ConfirmModal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetAction: {
    paddingTop: spacing[12],
  },
  trigger: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 44,
  },
  wrapper: {
    paddingHorizontal: spacing[16],
  },
});
