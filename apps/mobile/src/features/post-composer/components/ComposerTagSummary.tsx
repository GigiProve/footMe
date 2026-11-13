/**
 * Riga di sintesi dei tag nel composer (HOM-06.1 §107–109, mockup screen 3, 4 e 7).
 *
 * Una sola riga tappabile — «Con Marco Bianchi e AC Como», «Con Marco Bianchi
 * e altre 3 persone» — mai una successione di chip (§109). Il tap riapre il
 * selettore con le selezioni correnti (§108).
 *
 * Il testo è già composto dal chiamante (`text`); `highlightedNames` elenca i
 * nomi da rendere in accent, nell'ordine in cui compaiono. Il componente li
 * cerca in `text` e non altera il resto: se un nome non è trovato, resta
 * semplice testo.
 */

import { Pressable, StyleSheet } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type ComposerTagSummaryProps = {
  /** Es. «Con Marco Bianchi e AC Como». */
  text: string;
  /** Nomi da evidenziare in accent, nell'ordine in cui compaiono in `text`. */
  highlightedNames: string[];
  accessibilityHint?: string;
  onPress: () => void;
};

type Segment = { text: string; highlighted: boolean };

function splitSegments(text: string, names: string[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const name of names) {
    const at = name.length > 0 ? text.indexOf(name, cursor) : -1;

    if (at < 0) {
      continue;
    }

    if (at > cursor) {
      segments.push({ highlighted: false, text: text.slice(cursor, at) });
    }

    segments.push({ highlighted: true, text: name });
    cursor = at + name.length;
  }

  if (cursor < text.length) {
    segments.push({ highlighted: false, text: text.slice(cursor) });
  }

  return segments;
}

export function ComposerTagSummary({
  text,
  highlightedNames,
  accessibilityHint,
  onPress,
}: ComposerTagSummaryProps) {
  const segments = splitSegments(text, highlightedNames);

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={text}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.line}
      testID="composer-tag-summary"
    >
      <AppText color="secondary" variant="feedMeta">
        {segments.map((segment, index) =>
          segment.highlighted ? (
            <AppText color="accent" key={`${index}-${segment.text}`} variant="feedMeta">
              {segment.text}
            </AppText>
          ) : (
            segment.text
          ),
        )}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[16],
  },
});
