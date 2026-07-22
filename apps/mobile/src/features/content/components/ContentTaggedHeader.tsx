import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../styles";
import { AppText } from "../../../ui";
import {
  type ContentTaggedTarget,
  TaggedProfilesSheet,
} from "./TaggedProfilesSheet";

type ContentTaggedHeaderProps = {
  authorName?: string | null;
  onOpenTarget: (target: ContentTaggedTarget) => void;
  onPressPublisher?: () => void;
  publishedAt?: string | null;
  publisherName: string;
  /** Reading time label, e.g. "3 min". Omitted for news. */
  readingLabel?: string | null;
  tagged: ContentTaggedTarget[];
};

/**
 * Lightweight editorial content header rendered near the publisher:
 *
 *   Gazzetta dello Sport
 *   con Marco Rossi e altri 2
 *   di Luca Verdi • Oggi • 3 min
 *
 * Tagged names are tappable; "e altri N" opens a bottom sheet with the full list.
 * Replaces the heavy "Profili taggati" section.
 */
export function ContentTaggedHeader({
  authorName,
  onOpenTarget,
  onPressPublisher,
  publishedAt,
  publisherName,
  readingLabel,
  tagged,
}: ContentTaggedHeaderProps) {
  const [isSheetOpen, setSheetOpen] = useState(false);

  const metaLine = [
    authorName ? `di ${authorName}` : null,
    formatRelativeDate(publishedAt),
    readingLabel || null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        disabled={!onPressPublisher}
        onPress={onPressPublisher}
      >
        <AppText numberOfLines={1} style={styles.publisher} variant="titleSm">
          {publisherName}
        </AppText>
      </Pressable>

      {tagged.length > 0 ? (
        <AppText color="secondary" variant="bodySm">
          con{" "}
          <AppText
            accessibilityLabel={`Apri ${tagged[0].display_name}`}
            accessibilityRole="link"
            color="accent"
            onPress={() => onOpenTarget(tagged[0])}
            variant="bodySm"
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
                variant="bodySm"
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
                variant="bodySm"
              >
                altri {tagged.length - 1}
              </AppText>
            </>
          ) : null}
        </AppText>
      ) : null}

      {metaLine ? (
        <AppText color="secondary" variant="caption">
          {metaLine}
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

/** "Oggi" / "Ieri" / localized date. */
function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (diffDays <= 0) {
    return "Oggi";
  }

  if (diffDays === 1) {
    return "Ieri";
  }

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  publisher: {
    color: colors.textPrimary,
  },
});
