import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

export type EntityRowBookmark = {
  isSaved: boolean;
  onToggle: () => void;
};

export type DashboardEntityRowProps = {
  /** Azione secondaria con target proprio: non apre il dettaglio. */
  bookmark?: EntityRowBookmark;
  avatarName?: string;
  avatarUrl?: string | null;
  /**
   * Tile con icona al posto dell'avatar: lo usano le Posizioni, che non sono
   * persone e non hanno un logo proprio. Un avatar con le iniziali del ruolo
   * (AT per Attaccante) direbbe una cosa falsa.
   */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Thumbnail rettangolare dei contenuti editoriali. */
  thumbnailUrl?: string | null;
  meta?: string | null;
  onPress: () => void;
  showDivider?: boolean;
  /** Label canonica del dominio: "Nuova", "In valutazione", "Bozza". */
  status?: string | null;
  /** Data o informazione in coda allo stato. */
  trailingMeta?: string | null;
  title: string;
};

/**
 * Riga operativa condivisa da candidature, posizioni e contenuti (master 01,
 * 02, 03).
 *
 * Una sola riga visuale per tre domini: il Common Contract chiede di
 * riutilizzare l'archetipo, **non** di unificare i modelli. Gli adapter
 * restano separati e questa riga non sa che cosa sta mostrando.
 *
 * Lo stato va sotto i metadata e non accanto al titolo: a 320pt con un nome
 * lungo, titolo e stato sulla stessa riga collidono. §7 lo prevede
 * esplicitamente come soluzione preferibile al troncamento.
 */
export function DashboardEntityRow({
  bookmark,
  avatarName,
  avatarUrl,
  icon,
  thumbnailUrl,
  meta,
  onPress,
  showDivider = false,
  status,
  trailingMeta,
  title,
}: DashboardEntityRowProps) {
  const statusLine = [status, trailingMeta].filter(Boolean).join(" · ");

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      <View style={styles.row}>
        <Pressable
          accessibilityLabel={[title, meta, statusLine]
            .filter(Boolean)
            .join(", ")}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.main,
            pressed ? styles.pressed : null,
          ]}
        >
          {icon ? (
            <View style={styles.iconTile}>
              <Ionicons color={colors.accent} name={icon} size={20} />
            </View>
          ) : thumbnailUrl !== undefined ? (
            <Thumbnail uri={thumbnailUrl} />
          ) : (
            <Avatar
              name={avatarName ?? title}
              size="md"
              square={!avatarName}
              uri={avatarUrl ?? undefined}
            />
          )}

          <View style={styles.body}>
            <AppText numberOfLines={2} variant="titleMd">
              {title}
            </AppText>

            {meta ? (
              <AppText color="secondary" numberOfLines={1} variant="meta">
                {meta}
              </AppText>
            ) : null}

            {statusLine ? (
              <AppText color="muted" numberOfLines={1} variant="caption">
                {statusLine}
              </AppText>
            ) : null}
          </View>
        </Pressable>

        {bookmark ? (
          <Pressable
            accessibilityLabel={
              bookmark.isSaved
                ? `Rimuovi dai salvati: ${title}`
                : `Salva: ${title}`
            }
            accessibilityRole="button"
            hitSlop={8}
            onPress={bookmark.onToggle}
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons
              color={bookmark.isSaved ? colors.accent : colors.textMuted}
              name={bookmark.isSaved ? "bookmark" : "bookmark-outline"}
              size={20}
            />
          </Pressable>
        ) : null}

        <Ionicons
          color={colors.textMuted}
          name="chevron-forward"
          size={18}
          style={styles.chevron}
        />
      </View>
    </View>
  );
}

function Thumbnail({ uri }: { uri: string | null }) {
  if (!uri) {
    return <View style={[styles.thumbnail, styles.thumbnailEmpty]} />;
  }

  return <Image source={{ uri }} style={styles.thumbnail} />;
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.divider,
    height: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: sizes.touchTarget + spacing[14],
  },
  main: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[10],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  // La miniatura non detta l'altezza del modulo: è alta quanto un avatar md.
  thumbnail: {
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    height: 44,
    width: 58,
  },
  thumbnailEmpty: {
    borderColor: colors.border,
    borderWidth: 1,
  },
  iconTile: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[8],
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  secondaryAction: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  chevron: {
    marginLeft: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
});
