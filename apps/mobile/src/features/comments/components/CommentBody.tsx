/**
 * Il testo di un commento (HOM-08 §26, §67, §108–§116, §232).
 *
 * Testo leggibile, NON in un balloon da chat (§67). Mention e link sono segmenti
 * dentro lo stesso `AppText`, in accent e con ruolo `link`, quindi riconoscibili dallo
 * screen reader come riferimenti (§232): la mention apre l'identità canonica (§110),
 * il link apre l'URL INTERO validato dal server (§115) — il testo mostrato può essere
 * troncato con ellissi (§114) senza cambiare il target. Nessuna anteprima (§113), mai
 * HTML (§116). Sono link solo quelli che il server ha restituito.
 */

import { Fragment } from "react";

import { AppText } from "../../../ui";
import { segmentCommentBody } from "../comment-presentation";
import type { CommentLink, CommentMentionRef } from "../comment-types";

type CommentBodyProps = {
  body: string;
  mentions: readonly CommentMentionRef[];
  links: readonly CommentLink[];
  onPressMention: (mention: CommentMentionRef) => void;
  onPressLink: (url: string) => void;
  testID?: string;
};

export function CommentBody({ body, mentions, links, onPressMention, onPressLink, testID }: CommentBodyProps) {
  const segments = segmentCommentBody(body, mentions, links);

  if (segments.length === 0) {
    return null;
  }

  return (
    <AppText testID={testID} variant="feedBody">
      {segments.map((segment, index) => {
        if (segment.kind === "mention") {
          return (
            <AppText
              accessibilityLabel={`Apri ${segment.mention.displayName}`}
              accessibilityRole="link"
              color="accent"
              key={index}
              onPress={() => onPressMention(segment.mention)}
              variant="feedBody"
            >
              {segment.text}
            </AppText>
          );
        }

        if (segment.kind === "link") {
          return (
            <AppText
              accessibilityLabel={`Apri il link ${segment.text}`}
              accessibilityRole="link"
              color="accent"
              key={index}
              onPress={() => onPressLink(segment.url)}
              variant="feedBody"
            >
              {segment.text}
            </AppText>
          );
        }

        return <Fragment key={index}>{segment.text}</Fragment>;
      })}
    </AppText>
  );
}
