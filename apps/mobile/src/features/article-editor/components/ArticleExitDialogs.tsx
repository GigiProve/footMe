/**
 * Dialoghi d'uscita dell'editor Articolo (HOM-06.2 §133–§136, §225–§226):
 *  • bozza significativa → «Uscire dal contenuto?» a tre azioni
 *    (`ExitDraftDialog`: Continua a modificare / Esci e conserva bozza / Elimina bozza);
 *  • modifica a salvataggio esplicito (programmato, pubblicato) con modifiche →
 *    conferma di scarto: il pubblicato non è stato toccato (§226), si perde solo la
 *    copia locale.
 * Un editor vuoto non mostra nulla: Annulla chiude direttamente (§133).
 */

import { ConfirmModal } from "../../../ui";
import { ExitDraftDialog } from "../../publishing/components/ExitDraftDialog";
import type { ArticleEditor } from "../use-article-editor";

export function ArticleExitDialogs({ exit }: { exit: ArticleEditor["exit"] }) {
  return (
    <>
      <ExitDraftDialog
        busy={exit.busy}
        error={exit.error}
        onContinue={exit.dismiss}
        onDelete={() => {
          void exit.discardDraft();
        }}
        onKeep={() => {
          void exit.keep();
        }}
        visible={exit.open && exit.decision === "ask"}
      />
      <ConfirmModal
        cancelLabel="Continua a modificare"
        confirmLabel="Annulla modifiche"
        confirmVariant="neutralOutline"
        destructive
        message="Le modifiche non salvate andranno perse."
        onCancel={exit.dismiss}
        onConfirm={() => {
          void exit.discardChanges();
        }}
        title="Annullare le modifiche?"
        visible={exit.open && exit.decision === "confirm-discard"}
      />
    </>
  );
}
