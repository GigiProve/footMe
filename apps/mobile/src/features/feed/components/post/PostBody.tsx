/**
 * Testo del Post con mention e «Mostra altro» (HOM-02 §13–19).
 *
 * Testo corto: tutto, senza controllo (§13). Testo lungo: circa cinque righe e
 * «Mostra altro» (§14), che espande sul posto senza aprire pagine né spostare
 * il Feed (§15) e diventa «Mostra meno» (§16). Lo stato vive nel componente:
 * una pagina o un reload non c'entrano.
 *
 * Il superamento delle righe si misura sul layout reale con `onTextLayout`, non
 * sul numero di caratteri: la stessa frase occupa righe diverse su uno schermo
 * stretto o con Dynamic Type. `onTextLayout` può restituire solo le righe
 * visibili quando `numberOfLines` è impostato, quindi la misura la fa una copia
 * invisibile, fuori flusso, senza limite di righe e senza handler, che si
 * smonta appena ha risposto. Per i testi certamente brevi o lunghi
 * (`classifyBodyLength`) la copia non serve.
 *
 * Le mention sono Text annidati: il tap apre l'identità per id (§19) e, essendo
 * un Text figlio, non risale al tap sul corpo che apre il contenuto. Il corpo
 * non è un unico elemento accessibile, per non nascondere le mention allo
 * screen reader.
 */

import { Fragment, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { trackFeed } from "../../feed-analytics";
import { FEED_POST_SHOW_LESS, FEED_POST_SHOW_MORE } from "../../feed-labels";
import {
  bodyOverflows,
  classifyBodyLength,
  POST_BODY_MAX_LINES,
  segmentBody,
} from "../../feed-post-presentation";
import type { FeedMention } from "../../feed-types";

type PostBodyProps = {
  itemId: string;
  body: string;
  mentions: readonly FeedMention[];
  /** Tap sul corpo: apre il contenuto, come prima di HOM-02. */
  onPress: () => void;
  onPressMention: (mention: FeedMention) => void;
};

// 13px di tipografia + 8px di padding + 9px di hitSlop per lato = 44pt (§73).
const TOGGLE_HIT_SLOP = { bottom: 9, left: 8, right: 24, top: 9 };

export function PostBody({ itemId, body, mentions, onPress, onPressMention }: PostBodyProps) {
  const [isExpanded, setExpanded] = useState(false);
  const [measuredOverflow, setMeasuredOverflow] = useState<boolean | null>(null);

  const segments = segmentBody(body, mentions);

  if (segments.length === 0) {
    return null;
  }

  const lengthClass = classifyBodyLength(body);
  const overflows =
    lengthClass === "long" ? true : lengthClass === "short" ? false : measuredOverflow;
  const toggleLabel = isExpanded ? FEED_POST_SHOW_LESS : FEED_POST_SHOW_MORE;

  function handleMeasure(event: NativeSyntheticEvent<TextLayoutEventData>) {
    setMeasuredOverflow(bodyOverflows(event.nativeEvent.lines.length));
  }

  function handleToggle() {
    if (isExpanded) {
      trackFeed({ itemId, name: "feed_post_text_collapse" });
    } else {
      trackFeed({ itemId, name: "feed_post_text_expand" });
    }

    setExpanded(!isExpanded);
  }

  return (
    <View style={styles.wrap}>
      <Pressable accessible={false} onPress={onPress}>
        <AppText
          numberOfLines={isExpanded ? undefined : POST_BODY_MAX_LINES}
          testID="feed-post-body"
          variant="feedBody"
        >
          {segments.map((segment, index) =>
            segment.kind === "mention" ? (
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
            ) : (
              <Fragment key={index}>{segment.text}</Fragment>
            ),
          )}
        </AppText>
      </Pressable>

      {lengthClass === "unknown" && measuredOverflow === null ? (
        <AppText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onTextLayout={handleMeasure}
          style={styles.measure}
          testID="feed-post-body-measure"
          variant="feedBody"
        >
          {body}
        </AppText>
      ) : null}

      {overflows ? (
        <Pressable
          accessibilityLabel={toggleLabel}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          hitSlop={TOGGLE_HIT_SLOP}
          onPress={handleToggle}
          style={styles.toggle}
        >
          <AppText color="accent" variant="feedMeta">
            {toggleLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Copia di misura: fuori flusso, stessa larghezza del testo, mai visibile.
  measure: {
    left: 0,
    opacity: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  toggle: {
    alignSelf: "flex-start",
    paddingVertical: spacing[4],
  },
  wrap: {
    marginTop: spacing[10],
  },
});
