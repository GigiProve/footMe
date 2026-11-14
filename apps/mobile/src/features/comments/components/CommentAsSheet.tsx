/**
 * Foglio «Commenta come» (HOM-08 §31–§34, §40–§41, §45, mockup 4).
 *
 * Riusa `PublishAsSheet` del composer Post parametrizzando titolo e prefisso dei test:
 * un solo foglio per scegliere l'identità. Mostra SOLO le identità con `can_comment`
 * nel contesto (§34), con «Profilo personale» / «Società · Serie D» / «Media» e il check
 * su quella attiva (§32–§33). Scegliere non cancella nulla del composer (§40): il tap
 * passa dal controller, che cambia solo l'identità e rilegge le capability (§41).
 */

import { PublishAsSheet } from "../../post-composer/components/PublishAsSheet";
import { useCommentDraftSelect } from "../comment-draft-store";
import { COMMENT_AS_TITLE } from "../comment-labels";
import { resolveCommentIdentity, toComposerIdentity } from "../comment-presentation";
import type { CommentsController } from "../use-comments-controller";

export function CommentAsSheet({ controller }: { controller: CommentsController }) {
  const { composer, overlays } = controller;
  const chosen = useCommentDraftSelect(composer.store, (draft) => draft.identity);
  const resolved = resolveCommentIdentity(composer.identities, chosen);

  return (
    <PublishAsSheet
      identities={composer.identities.map(toComposerIdentity)}
      onClose={() => overlays.setAsOpen(false)}
      onSelect={(picked) => {
        const identity = composer.identities.find(
          (candidate) => candidate.type === picked.type && candidate.id === picked.id,
        );

        if (identity) {
          composer.chooseIdentity(identity);
        }
      }}
      selected={resolved.identity ? { id: resolved.identity.id, type: resolved.identity.type } : null}
      testIDPrefix="comment-as"
      title={COMMENT_AS_TITLE}
      visible
    />
  );
}
