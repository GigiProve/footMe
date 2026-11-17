/**
 * Attribuzione sotto la testata del dettaglio editoriale (HOM-15 §26–§27, §54).
 *
 * L'identità di chi pubblica (avatar/logo, nome, verifica, tempo) ora è
 * nell'header condiviso col Feed (`AuthorHeaderRow`): qui resta solo ciò che
 * l'header non dice — i profili taggati e la firma dell'articolo:
 *
 *   con Marco Rossi e altri 2
 *   di Luca Verdi · 3 min di lettura
 *
 * I nomi taggati sono toccabili; «altri N» apre il foglio con l'elenco intero.
 * Sostituisce `ContentTaggedHeader`, che duplicava nome e data con un suo
 * formatter (§277) e il separatore «•» invece di «·».
 */

import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../styles";
import { AppText } from "../../../ui";
import {
  type ContentTaggedTarget,
  TaggedProfilesSheet,
} from "./TaggedProfilesSheet";

type ContentAttributionProps = {
  authorName?: string | null;
  onOpenTarget: (target: ContentTaggedTarget) => void;
  /** Tempo di lettura già formattato, es. «3 min di lettura». Assente per le news. */
  readingLabel?: string | null;
  tagged: ContentTaggedTarget[];
};

export function ContentAttribution({
  authorName,
  onOpenTarget,
  readingLabel,
  tagged,
}: ContentAttributionProps) {
  const [isSheetOpen, setSheetOpen] = useState(false);

  const byline = [authorName ? `di ${authorName}` : null, readingLabel || null]
    .filter(Boolean)
    .join(" · ");

  if (tagged.length === 0 && !byline) {
    return null;
  }

  return (
    <View style={styles.container}>
      {tagged.length > 0 ? (
        <AppText color="secondary" variant="feedMeta">
          con{" "}
          <AppText
            accessibilityLabel={`Apri ${tagged[0].display_name}`}
            accessibilityRole="link"
            color="accent"
            onPress={() => onOpenTarget(tagged[0])}
            variant="feedMeta"
          >
            {tagged[0].display_name}
          </AppText>
          {tagged.length === 2 ? (
            <>
              {" e "}
              <AppText
                accessibilityLabel={`Apri ${tagged[1].display_name}`}
                accessibilityRole="link"
                color="accent"
                onPress={() => onOpenTarget(tagged[1])}
                variant="feedMeta"
              >
                {tagged[1].display_name}
              </AppText>
            </>
          ) : null}
          {tagged.length > 2 ? (
            <>
              {" e "}
              <AppText
                accessibilityLabel="Mostra tutti i profili taggati"
                accessibilityRole="button"
                color="accent"
                onPress={() => setSheetOpen(true)}
                variant="feedMeta"
              >
                altri {tagged.length - 1}
              </AppText>
            </>
          ) : null}
        </AppText>
      ) : null}

      {byline ? (
        <AppText color="muted" variant="feedMeta">
          {byline}
        </AppText>
      ) : null}

      <TaggedProfilesSheet
        onClose={() => setSheetOpen(false)}
        onOpenTarget={(target) => {
          setSheetOpen(false);
          onOpenTarget(target);
        }}
        targets={tagged}
        visible={isSheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
});
