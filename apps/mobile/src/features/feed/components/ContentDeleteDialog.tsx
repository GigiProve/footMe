/**
 * Conferma di eliminazione (HOM-04 §39–46, §110, §113, §117).
 *
 * Il `ConfirmModal` di sistema con il copy per tipo (§40–42). «Annulla» non
 * cambia nulla (§44); durante la richiesta «Elimina» è disabilitato, mostra un
 * loading minimo e il dialogo non si chiude da fondale né da Back (§45, §110).
 * Un fallimento è mostrato DENTRO il dialogo (§69): il Toast vive nell'albero
 * dell'app e su iOS/Android resterebbe coperto dal Modal nativo ancora aperto.
 */

import { AppText, ConfirmModal } from "../../../ui";
import {
  CONTENT_DELETE_CONFIRM_LABEL,
  CONTENT_KIND_COPY,
  type ContentVisibleKind,
} from "../content-actions-presentation";

type ContentDeleteDialogProps = {
  kind: ContentVisibleKind;
  visible: boolean;
  isBusy: boolean;
  /** Messaggio dopo un tentativo fallito; il dialogo resta aperto per riprovare. */
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ContentDeleteDialog({
  errorMessage,
  isBusy,
  kind,
  onCancel,
  onConfirm,
  visible,
}: ContentDeleteDialogProps) {
  const copy = CONTENT_KIND_COPY[kind];

  return (
    <ConfirmModal
      confirmLabel={CONTENT_DELETE_CONFIRM_LABEL}
      destructive
      isBusy={isBusy}
      message={copy.confirmMessage}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={copy.confirmTitle}
      visible={visible}
    >
      {errorMessage ? (
        <AppText
          accessibilityLiveRegion="polite"
          align="center"
          color="danger"
          variant="bodySm"
        >
          {errorMessage}
        </AppText>
      ) : null}
    </ConfirmModal>
  );
}
