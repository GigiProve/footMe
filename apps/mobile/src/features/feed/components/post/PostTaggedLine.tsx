/**
 * Riga «Con …» del Post (HOM-02 §20–22).
 *
 * Compare solo quando aggiunge informazione: `summarizeTagged` ha già tolto le
 * identità menzionate nel testo. Con un solo tag il tap apre direttamente
 * quell'identità; con più tag apre la lista completa nel componente dedicato
 * già esistente (`TaggedProfilesSheet`, usato dal dettaglio contenuto) e la
 * scelta di un profilo risale come `onOpenIdentity`. Nessun nuovo foglio.
 */

import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  TaggedProfilesSheet,
  type ContentTaggedTarget,
} from "../../../content/components/TaggedProfilesSheet";
import { trackFeed } from "../../feed-analytics";
import { FEED_POST_TAGGED_LEAD, FEED_POST_TAGGED_SHEET_HINT } from "../../feed-labels";
import type { TaggedSummary } from "../../feed-post-presentation";
import type { FeedTaggedIdentity } from "../../feed-types";
import type { FeedIdentityTarget } from "../FeedItemRenderer";

type PostTaggedLineProps = {
  itemId: string;
  summary: TaggedSummary;
  onOpenIdentity: (target: FeedIdentityTarget) => void;
};

// 18px di riga + 26px di hitSlop = 44pt (§73) senza gonfiare il Feed.
const LINE_HIT_SLOP = { bottom: 13, left: 8, right: 8, top: 13 };

function toTarget(identity: FeedTaggedIdentity): ContentTaggedTarget {
  return {
    avatar_url: identity.avatarUrl,
    display_name: identity.displayName,
    target_id: identity.identityId,
    target_type: identity.identityType,
  };
}

export function PostTaggedLine({ itemId, summary, onOpenIdentity }: PostTaggedLineProps) {
  const [isSheetOpen, setSheetOpen] = useState(false);
  const hasList = summary.remaining.length > 1;

  function handlePress() {
    if (hasList) {
      trackFeed({ count: summary.remaining.length, itemId, name: "feed_post_tagged_list_open" });
      setSheetOpen(true);
      return;
    }

    onOpenIdentity({
      identityId: summary.lead.identityId,
      identityType: summary.lead.identityType,
    });
  }

  return (
    <>
      <Pressable
        accessibilityHint={hasList ? FEED_POST_TAGGED_SHEET_HINT : undefined}
        accessibilityLabel={summary.text}
        accessibilityRole="button"
        hitSlop={LINE_HIT_SLOP}
        onPress={handlePress}
        style={styles.line}
      >
        <AppText color="secondary" variant="feedMeta">
          {FEED_POST_TAGGED_LEAD}{" "}
          <AppText color="accent" variant="feedMeta">
            {summary.lead.displayName}
          </AppText>
          {summary.suffix ? ` ${summary.suffix}` : ""}
        </AppText>
      </Pressable>

      {hasList ? (
        <TaggedProfilesSheet
          onClose={() => setSheetOpen(false)}
          onOpenTarget={(target) => {
            setSheetOpen(false);
            onOpenIdentity({ identityId: target.target_id, identityType: target.target_type });
          }}
          targets={summary.remaining.map(toTarget)}
          visible={isSheetOpen}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  line: {
    alignSelf: "flex-start",
    marginTop: spacing[8],
  },
});
