/**
 * Conferma di abbandono del composer (HOM-06.1 §137–141, §246).
 *
 * Nuovo post: «Eliminare questa bozza?» con «Continua a modificare» / «Elimina»
 * (§139). Modifica di un Post pubblicato non c'è nessuna bozza da eliminare: la
 * stessa conferma parla di modifiche — «Annullare le modifiche?» con «Continua a
 * modificare» / «Annulla modifiche».
 *
 * Riusa `ConfirmModal`: la conferma è destructive nella variante sobria del
 * design system (bordo e testo rossi su fondo bianco, DAS-REV-27 §4), mentre
 * l'azione sicura «Continua a modificare» resta quella a tutta evidenza.
 * Fondale e tasto Indietro valgono «Continua a modificare»: un tap accidentale
 * non deve cancellare il lavoro. Il dialogo compare solo se il composer non è
 * vuoto (§137–138); non propone mai «Salva bozza» (§140).
 */

import { ConfirmModal } from "../../../ui";

type DiscardDraftDialogProps = {
  visible: boolean;
  /** Default `create`. */
  mode?: "create" | "edit";
  onContinue: () => void;
  onDiscard: () => void;
};

export const DISCARD_COPY = {
  create: { confirm: "Elimina", title: "Eliminare questa bozza?" },
  edit: { confirm: "Annulla modifiche", title: "Annullare le modifiche?" },
} as const;

export const CONTINUE_EDITING_LABEL = "Continua a modificare";

export function DiscardDraftDialog({ visible, mode = "create", onContinue, onDiscard }: DiscardDraftDialogProps) {
  const copy = DISCARD_COPY[mode];

  return (
    <ConfirmModal
      cancelLabel={CONTINUE_EDITING_LABEL}
      confirmLabel={copy.confirm}
      confirmVariant="neutralOutline"
      destructive
      onCancel={onContinue}
      onConfirm={onDiscard}
      title={copy.title}
      visible={visible}
    />
  );
}
