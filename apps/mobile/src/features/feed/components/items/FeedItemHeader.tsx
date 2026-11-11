/**
 * Intestazione autore di un elemento del Feed (HOM-01.1 §17, §18, §75).
 *
 * Avatar/logo, nome, check di verifica, metadata sintetico e menu ⋯. Persona,
 * Società e Media usano la stessa riga: cambia solo l'avatar (quadrato per le
 * Società) e il testo, mai un fondo, un badge o "Profilo ufficiale". La
 * verifica è sempre lo stesso piccolo check accanto al nome.
 *
 * `formatRelativeTime` è già in src/lib: non si reimplementa il calcolo del
 * tempo relativo.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { formatRelativeTime } from "../../../../lib/relative-time";
import { spacing } from "../../../../theme/tokens";
import { AppText, Avatar, VerifiedCheck } from "../../../../ui";
import type { FeedItem } from "../../feed-types";

type FeedItemHeaderProps = {
  item: FeedItem;
  /** Tipologia del contenuto ("Articolo", "Video") quando serve dirla (§61). */
  kindLabel?: string | null;
  /**
   * HOM-02 §9: il Post compone da sé la seconda riga (ruolo · Società · tempo,
   * senza motivo di suggerimento). Se passata sostituisce quella predefinita,
   * che resta per gli elementi editoriali.
   */
  metaLine?: string | null;
  /** HOM-02 §75: etichetta parlata completa dell'autore. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPressAuthor?: () => void;
  right?: React.ReactNode;
};

export function FeedItemHeader({
  item,
  kindLabel,
  metaLine,
  accessibilityLabel,
  accessibilityHint,
  onPressAuthor,
  right,
}: FeedItemHeaderProps) {
  const author = item.author;

  if (!author) {
    return null;
  }

  const meta =
    metaLine !== undefined
      ? (metaLine ?? "")
      : [item.publishedAt ? formatRelativeTime(item.publishedAt) : null, kindLabel, item.reasonLabel]
          .filter(Boolean)
          .join(" · ");

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel ?? `Apri ${author.name}`}
        accessibilityRole="button"
        disabled={!onPressAuthor}
        onPress={onPressAuthor}
        style={styles.identity}
      >
        <Avatar
          name={author.name}
          size="sm"
          square={author.kind === "club"}
          uri={author.avatarUrl ?? undefined}
        />
        <View style={styles.identityText}>
          <View style={styles.nameRow}>
            <AppText numberOfLines={1} style={styles.name} variant="titleMd">
              {author.name}
            </AppText>
            {author.isVerified ? <VerifiedCheck /> : null}
          </View>
          {meta ? (
            <AppText color="muted" numberOfLines={1} variant="feedMeta">
              {meta}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[10],
  },
  identityText: {
    flex: 1,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[8],
  },
});
