/**
 * Fogli e modali dei Commenti, montati UNA volta dal dettaglio (HOM-08 §31–§33, §117–§121,
 * §146–§152, §160–§162): «Commenta come», ordinamento, menu •••, modifica a schermo
 * intero e conferma di eliminazione.
 *
 * Lo stato (cosa è aperto) sta nel controller, perché lo condividono sezione e
 * composer; il testo digitato sta nella bozza. «Commenta come» e la modifica si
 * montano solo quando servono: così non seguono ogni tasto digitato nel composer.
 *
 * Eliminazione (§160–§162): `ConfirmModal destructive` — «Eliminare questo commento?»,
 * «Annulla» / «Elimina»; solo «Elimina» ha il trattamento distruttivo. Il dialogo resta
 * occupato finché il server non risponde.
 */

import { ConfirmModal } from "../../../ui";
import { useCommentDraftSelect } from "../comment-draft-store";
import { COMMENT_DELETE_CANCEL, COMMENT_DELETE_CONFIRM, COMMENT_DELETE_TITLE } from "../comment-labels";
import type { CommentsController } from "../use-comments-controller";
import { CommentActionSheet } from "./CommentActionSheet";
import { CommentAsSheet } from "./CommentAsSheet";
import { CommentEditModal } from "./CommentEditModal";
import { CommentSortSheet } from "./CommentSortSheet";

export function CommentsOverlays({ controller }: { controller: CommentsController }) {
  const { overlays, remove } = controller;
  // Solo se c'è una modifica aperta: un booleano, non il testo.
  const editing = useCommentDraftSelect(controller.composer.store, (draft) => draft.edit !== null);

  return (
    <>
      <CommentSortSheet
        onClose={() => overlays.setSortOpen(false)}
        onSelect={controller.setSort}
        sort={controller.sort}
        visible={overlays.sortOpen}
      />

      {overlays.asOpen ? <CommentAsSheet controller={controller} /> : null}

      <CommentActionSheet
        comment={overlays.menuTarget}
        onClose={overlays.closeMenu}
        onSelect={overlays.runMenuAction}
      />

      {editing ? <CommentEditModal controller={controller} /> : null}

      <ConfirmModal
        cancelLabel={COMMENT_DELETE_CANCEL}
        confirmLabel={COMMENT_DELETE_CONFIRM}
        destructive
        isBusy={remove.isBusy}
        onCancel={remove.cancel}
        onConfirm={remove.confirm}
        title={COMMENT_DELETE_TITLE}
        visible={remove.target !== null}
      />
    </>
  );
}
