/**
 * Media collection del Post (HOM-02 §23–37, §40).
 *
 * Una sola collezione ordinata, foto e video insieme, che sostituisce il media
 * singolo del Feed. Il layout lo decide `buildMediaLayout` dal numero di
 * elementi: 1 largo, 2 affiancati 50/50, 3 con il principale a sinistra e due
 * impilati a destra, 4 in griglia 2×2, oltre quattro le prime quattro con +N
 * sull'ultima. Non esistono componenti per «solo foto» o «solo video».
 *
 * Lo spazio è riservato dal rapporto del contenitore prima che le immagini
 * arrivino (§40): nessun salto di altezza al caricamento. Gutter uniforme, il
 * radius solo sul contorno esterno (§26). Il tap su una cella comunica
 * l'indice; apertura del dettaglio e analytics del media sono di FeedPane. Qui
 * si traccia solo ciò che nasce nel componente: la selezione di un video (§36)
 * e l'apertura della galleria dalla cella +N (§32).
 *
 * HOM-03 (Luigi 2026-11-12): un Post con UN solo media video lo riproduce
 * inline nel Feed con `VideoMedia` (Play → player nella stessa area, stati
 * «in elaborazione»/«non disponibile» come riga compatta); le gallery con più
 * media tengono le celle e il tap apre il dettaglio. Nel dettaglio (`list`)
 * ogni video è un `VideoMedia`, e quello toccato nel Feed (`autoStartIndex`)
 * parte una volta sola.
 */

import { useRef } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { trackFeed } from "../../feed-analytics";
import {
  buildMediaLayout,
  orderMedia,
  singleMediaAspectRatio,
  type MediaCellPlan,
} from "../../feed-post-presentation";
import type { FeedMediaItem } from "../../feed-types";
import { VideoMedia } from "../video/VideoMedia";
import { PostMediaCell } from "./PostMediaCell";

type PostMediaCollectionProps = {
  itemId: string;
  media: readonly FeedMediaItem[];
  onOpenMedia: (index: number) => void;
  /**
   * `grid` nel Feed (al massimo quattro celle, +N). `list` nel dettaglio
   * (Luigi 2026-11-11: il tap su un media apre il dettaglio, non un viewer):
   * l’intera collezione nell’ordine del Post, ogni media intero (§37).
   */
  variant?: "grid" | "list";
  /** Solo `list`: posizione verticale di ogni media, per portare in vista quello scelto. */
  onMediaLayout?: (index: number, y: number) => void;
  /** Solo `list`: indice del video da avviare subito, una volta sola (`?media=N`). */
  autoStartIndex?: number | null;
};

export function PostMediaCollection({
  itemId,
  media,
  onOpenMedia,
  variant = "grid",
  onMediaLayout,
  autoStartIndex = null,
}: PostMediaCollectionProps) {
  const layoutRef = useRef<{ listY: number | null; items: Map<number, number> }>({
    items: new Map(),
    listY: null,
  });
  const layout = buildMediaLayout(media);

  if (layout.kind === "none") {
    return null;
  }

  if (variant === "list") {
    // Le y arrivano in due tempi (lista nel Post, media nella lista): si
    // comunicano sommate solo quando entrambe sono note.
    const emit = (index: number) => {
      const itemY = layoutRef.current.items.get(index);
      if (layoutRef.current.listY !== null && itemY !== undefined) {
        onMediaLayout?.(index, layoutRef.current.listY + itemY);
      }
    };

    // Nel dettaglio l’evento di selezione video lo traccia chi riceve il tap.
    return (
      <View
        onLayout={(event) => {
          layoutRef.current.listY = event.nativeEvent.layout.y;
          layoutRef.current.items.forEach((_y, index) => emit(index));
        }}
        style={styles.list}
        testID="feed-post-media-list"
      >
        {orderMedia(media).map((item, index) => {
          const handleLayout = (event: LayoutChangeEvent) => {
            layoutRef.current.items.set(index, event.nativeEvent.layout.y);
            emit(index);
          };

          // Un video ha la sua area (miniatura o riga di stato) e il suo player.
          if (item.type === "video") {
            return (
              <View key={`${item.id}:${index}`} onLayout={handleLayout}>
                <VideoMedia
                  autoStart={autoStartIndex === index}
                  itemId={itemId}
                  media={item}
                  surface="detail"
                />
              </View>
            );
          }

          return (
            <View
              key={`${item.id}:${index}`}
              onLayout={handleLayout}
              style={[styles.listItem, { aspectRatio: singleMediaAspectRatio(item) }]}
            >
              <PostMediaCell
                cell={{ index, item, overflowCount: null }}
                compact={false}
                onPress={(cell) => onOpenMedia(cell.index)}
                preferFull
                total={media.length}
              />
            </View>
          );
        })}
      </View>
    );
  }

  function handlePress(cell: MediaCellPlan) {
    if (cell.overflowCount !== null) {
      trackFeed({ count: layout.total, itemId, name: "feed_post_gallery_open" });
    } else if (cell.item.type === "video") {
      trackFeed({ index: cell.index, itemId, name: "feed_post_video_select" });
    }

    onOpenMedia(cell.index);
  }

  function renderCell(cell: MediaCellPlan, compact: boolean, style?: StyleProp<ViewStyle>) {
    return (
      <PostMediaCell
        cell={cell}
        compact={compact}
        key={`${cell.item.id}:${cell.index}`}
        onPress={handlePress}
        preferFull={layout.kind === "single"}
        style={style}
        total={layout.total}
      />
    );
  }

  const [first, second, third, fourth] = layout.cells;
  const ratio = { aspectRatio: layout.aspectRatio };

  switch (layout.kind) {
    case "single":
      // Un solo video: area propria e player inline (HOM-03). Il «+N» non può
      // esistere con un solo media, quindi la cella è sempre il video stesso.
      if (first.item.type === "video") {
        return (
          <VideoMedia
            itemId={itemId}
            media={first.item}
            style={styles.single}
            surface="feed"
          />
        );
      }

      return (
        <View style={[styles.frame, ratio]} testID="feed-post-media">
          {renderCell(first, false)}
        </View>
      );

    case "pair":
      return (
        <View style={[styles.frame, styles.row, ratio]} testID="feed-post-media">
          {renderCell(first, true)}
          {renderCell(second, true)}
        </View>
      );

    case "trio":
      return (
        <View style={[styles.frame, styles.row, ratio]} testID="feed-post-media">
          {renderCell(first, false, styles.trioMain)}
          <View style={styles.trioSide}>
            {renderCell(second, true)}
            {renderCell(third, true)}
          </View>
        </View>
      );

    default:
      return (
        <View style={[styles.frame, styles.column, ratio]} testID="feed-post-media">
          <View style={styles.rowFill}>
            {renderCell(first, true)}
            {renderCell(second, true)}
          </View>
          <View style={styles.rowFill}>
            {renderCell(third, true)}
            {renderCell(fourth, true)}
          </View>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  column: {
    gap: spacing[4],
  },
  list: {
    gap: spacing[8],
    marginTop: spacing[12],
  },
  listItem: {
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    overflow: "hidden",
    width: "100%",
  },
  // Il radius è del contorno esterno; il fondo bianco fa da gutter tra le celle.
  frame: {
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    marginTop: spacing[12],
    overflow: "hidden",
    width: "100%",
  },
  row: {
    flexDirection: "row",
    gap: spacing[4],
  },
  rowFill: {
    flex: 1,
    flexDirection: "row",
    gap: spacing[4],
  },
  single: {
    marginTop: spacing[12],
  },
  trioMain: {
    flex: 2,
  },
  trioSide: {
    flex: 1,
    gap: spacing[4],
  },
});
