/**
 * Riga identity dell'Articolo e foglio «Pubblica come» (HOM-06.2 §16–§27). Riusa
 * `ComposerIdentityRow` e `PublishAsSheet` di HOM-06.1: nessun secondo selector.
 * Il foglio elenca solo le identity che usano la modalità corrente (§7B, §20).
 */

import { identityAccessibilityLabel } from "../../post-composer/composer-presentation";
import { ComposerIdentityRow } from "../../post-composer/components/ComposerIdentityRow";
import { PublishAsSheet } from "../../post-composer/components/PublishAsSheet";
import type { ArticleIdentityPicker } from "../use-article-identity";

export function ArticleIdentityBar({ picker }: { picker: ArticleIdentityPicker }) {
  const identity = picker.identity;
  if (!identity) {
    return null;
  }

  return (
    <>
      <ComposerIdentityRow
        accessibilityLabel={identityAccessibilityLabel(identity)}
        identity={identity}
        onPress={picker.openSheet}
        selectable={picker.selectable}
      />
      <PublishAsSheet
        identities={picker.options}
        onClose={picker.close}
        onSelect={picker.select}
        selected={{ id: identity.id, type: identity.type }}
        visible={picker.open}
      />
    </>
  );
}
