/**
 * Intestazione autore di un elemento del Feed (HOM-01.1 §17, §18, §75).
 *
 * Avatar/logo, nome, check di verifica, metadata sintetico e menu ⋯. Persona,
 * Società e Media usano la stessa riga: cambia solo l'avatar (quadrato per le
 * Società) e il testo, mai un fondo, un badge o "Profilo ufficiale". La
 * verifica è sempre lo stesso piccolo check accanto al nome.
 *
 * HOM-15 §26–§27, §54: la riga identità (`AuthorHeaderRow`) è esportata perché
 * anche il dettaglio di Articolo/Video/Tribuna, che non ha un `FeedItem`, usi
 * lo stesso header del Feed invece di un secondo componente. §277: il tempo
 * passa dal solo formatter compatto (`formatCompactRelativeTime`).
 */

import { Pressable, StyleSheet, View } from "react-native";

import { formatCompactRelativeTime } from "../../../../lib/relative-time";
import { spacing } from "../../../../theme/tokens";
import { AppText, Avatar, VerifiedCheck } from "../../../../ui";
import { ReposterRow } from "../../../repost/components/ReposterRow";
import { isContentItem, type FeedItem } from "../../feed-types";

export type AuthorHeaderIdentity = {
  avatarUrl: string | null;
  isVerified: boolean;
  kind: "club" | "profile";
  name: string;
};

type AuthorHeaderRowProps = {
  author: AuthorHeaderIdentity;
  meta: string;
  /** HOM-02 §75: etichetta parlata completa dell'autore. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPressAuthor?: () => void;
  right?: React.ReactNode;
};

/** La riga avatar · nome · check · meta · azioni, senza dipendere da un `FeedItem`. */
export function AuthorHeaderRow({
  author,
  meta,
  accessibilityLabel,
  accessibilityHint,
  onPressAuthor,
  right,
}: AuthorHeaderRowProps) {
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
      : // HOM-13 §214–§216, §280–§282: nessuna reason sulle card dei contenuti («Dalla tua
        // zona», «Consigliato»…). Solo tempo e tipologia.
        [item.publishedAt ? formatCompactRelativeTime(item.publishedAt) : null, kindLabel]
          .filter(Boolean)
          .join(" · ");

  const row = (
    <AuthorHeaderRow
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      author={author}
      meta={meta}
      onPressAuthor={onPressAuthor}
      right={right}
    />
  );

  // HOM-10 §73–§76: un Simple Repost è l'originale con una riga discreta sopra. L'header resta
  // dell'autore dell'originale (§75); Post, Articolo e Video passano tutti da qui.
  if (isContentItem(item) && item.repost) {
    return (
      <View>
        <ReposterRow
          repost={item.repost}
          target={{ contentId: item.payload.postId, contentType: item.payload.contentType }}
        />
        {row}
      </View>
    );
  }

  return row;
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
