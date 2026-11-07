/**
 * Conferma di rimozione (DAS-REV-25 §21, screen 10).
 *
 * Una sola conferma per i due ingressi — lo sheet della candidatura e la
 * scheda interna — perché §21 li fa aprire «la stessa conferma», con lo
 * stesso testo e lo stesso contesto reale.
 *
 * «Non proporre Rimuovi da tutte le shortlist, elimina profilo o rifiuta
 * candidatura»: la conferma riguarda **una** membership e non offre altro.
 *
 * §4: «Rimuovi usa il trattamento distruttivo sobrio condiviso: testo rosso,
 * conferma contenuta, nessun grande banner rosso.» Da cui il `destructive`
 * del modale condiviso e nessuna decorazione in più.
 */
import { ConfirmModal } from "../../../../ui";
import { SHORTLIST_COPY, removeConfirmBody } from "../shortlist-presentation";

type Props = {
  busy: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  positionTitle: string;
  scopeLabel: string | null;
  visible: boolean;
};

export function ShortlistRemoveConfirm({
  busy,
  name,
  onCancel,
  onConfirm,
  positionTitle,
  scopeLabel,
  visible,
}: Props) {
  return (
    <ConfirmModal
      cancelLabel={SHORTLIST_COPY.removeCancel}
      confirmLabel={SHORTLIST_COPY.removeConfirm}
      destructive
      isBusy={busy}
      message={removeConfirmBody({ name, positionTitle, scopeLabel })}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={SHORTLIST_COPY.removeTitle}
      visible={visible}
    />
  );
}
