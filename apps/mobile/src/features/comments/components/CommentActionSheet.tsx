/**
 * Menu ••• di un commento (HOM-08 §146–§148, §171–§174, §197–§198, §231, mockup 7;
 * HOM-11 §69–§73, §132).
 *
 * Il repo non ha un popover ancorato alla riga: il menu è un `ActionSheet` (stesso
 * componente del menu dei contenuti), annunciato come «Azioni commento». Le azioni
 * arrivano dal costruttore puro `buildCommentActions` — dalle capability del server,
 * non dal ruolo (§198):
 *  • il proprio commento: Modifica e Elimina, invariato (HOM-11 §73);
 *  • il commento altrui: «Non seguire <autore>» solo se il viewer lo segue davvero e
 *    «Segnala» — o «Segnalazione inviata ✓» non azionabile se già segnalato — mai Non
 *    mi interessa (§71), mai Salva (§72), né Copia link o Fissa (HOM-08 §147).
 * Senza azioni non c'è nemmeno il •••. Segnala è lo stesso flow dei contenuti, con
 * `target_type = COMMENT` (§132–§133): il menu non ne ha uno suo.
 *
 * Gli insiemi di sessione (Non seguire appena fatto, Segnala appena inviato) valgono
 * prima che il refetch porti il dato del server: sono store di modulo, nessun provider.
 */

import { ActionSheet, type ActionSheetAction } from "../../../ui";
import { followSourceKey, followSourceOfIdentity } from "../../following/follow-source";
import { useIsSourceUnfollowed } from "../../following/unfollowed-sources-store";
import { useIsReported } from "../../moderation/reported-store";
import { COMMENT_ACTIONS_LABEL } from "../comment-labels";
import { buildCommentActions, commentReportKey, type CommentActionId } from "../comment-presentation";
import type { CommentEntity } from "../comment-types";

/** Le azioni selezionabili: «Segnalazione inviata ✓» non lo è mai. */
export type CommentMenuSelection = Exclude<CommentActionId, "reported">;

export function CommentActionSheet({
  comment,
  onSelect,
  onClose,
}: {
  comment: CommentEntity | null;
  onSelect: (action: CommentMenuSelection) => void;
  onClose: () => void;
}) {
  const source = comment?.author ? followSourceOfIdentity(comment.author) : null;
  const unfollowedInSession = useIsSourceUnfollowed(source ? followSourceKey(source) : null);
  const reportedInSession = useIsReported(comment ? commentReportKey(comment.id) : null);

  const items = comment
    ? buildCommentActions(comment, {
        isSending: comment.send !== null,
        reportedInSession,
        unfollowedInSession,
      })
    : [];
  const actions: ActionSheetAction[] = items.map((item) => ({
    accessibilityHint: item.accessibilityHint,
    accessibilityLabel: item.accessibilityLabel,
    dividerBefore: item.dividerBefore,
    destructive: item.destructive,
    disabled: item.disabled,
    icon: item.icon,
    id: item.id,
    label: item.label,
    onPress: () => {
      if (item.id !== "reported") {
        onSelect(item.id);
      }
    },
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
