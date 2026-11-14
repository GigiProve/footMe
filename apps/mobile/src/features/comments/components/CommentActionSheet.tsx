/**
 * Menu ••• di un commento (HOM-08 §146–§148, §171–§174, §197–§198, §231, mockup 7).
 *
 * Il repo non ha un popover ancorato alla riga: il menu è un `ActionSheet` (stesso
 * componente del menu dei contenuti), annunciato come «Azioni commento». Le azioni
 * arrivano dal costruttore puro `buildCommentActions` — dalle capability del server,
 * non dal ruolo (§198): per il proprio commento Modifica e Elimina, mai Segnala,
 * Salva, Copia link, Fissa (§147). Per i commenti altrui non ci sono azioni e quindi
 * nemmeno il •••. Il costruttore è il punto d'estensione di HOM-11 (§171–§173): le
 * azioni future per `target_type = COMMENT` si aggiungono lì, con `commentActionContext`.
 */

import { ActionSheet, type ActionSheetAction } from "../../../ui";
import { COMMENT_ACTIONS_LABEL } from "../comment-labels";
import { buildCommentActions } from "../comment-presentation";
import type { CommentEntity } from "../comment-types";

export function CommentActionSheet({
  comment,
  onSelect,
  onClose,
}: {
  comment: CommentEntity | null;
  onSelect: (action: "edit" | "delete") => void;
  onClose: () => void;
}) {
  const items = comment ? buildCommentActions(comment, { isSending: comment.send !== null }) : [];
  const actions: ActionSheetAction[] = items.map((item) => ({
    dividerBefore: item.dividerBefore,
    destructive: item.destructive,
    icon: item.icon,
    id: item.id,
    label: item.label,
    onPress: () => onSelect(item.id),
  }));

  return (
    <ActionSheet
      accessibilityLabel={COMMENT_ACTIONS_LABEL}
      actions={actions}
      onClose={onClose}
      showGrabber
      visible={comment !== null && actions.length > 0}
    />
  );
}
