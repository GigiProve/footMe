/**
 * Griglia media del composer (HOM-06.1 §45–60, §151–153, §190, §194–195,
 * mockup screen 3, 4 e 7).
 *
 * Differenza voluta dal Feed (§52–54): qui si mostrano TUTTI gli item, mai
 * «+N». Layout per numero di media:
 *   1  anteprima ampia (4:3, o 4:5 se il media è verticale);
 *   2  due celle quadrate bilanciate (§49);
 *   3  una principale e due secondarie (§50);
 *   4  griglia 2×2 (§51);
 *   >4 griglia a 3 colonne a celle quadrate: le miniature restano ≥ ~100pt su
 *      un telefono da 360pt (§53).
 *
 * Riordino (§55–58): long press + drag. Il tap lungo di una cella arma il drag
 * (`ComposerMediaTile`), poi il contenitore cattura il movimento con il sistema
 * responder di React Native: la cella segue il dito e quella sotto il dito è
 * evidenziata; al rilascio si chiama `onMove(localId, toIndex)` con l'indice
 * della cella di destinazione. Le celle si misurano con `measure` all'avvio del
 * drag, così l'hit-test non dipende dal layout flex. L'alternativa accessibile
 * (§58) è nelle `accessibilityActions` di ogni cella.
 *
 * Perché i responder e non un `PanResponder`: `PanResponder.create` chiamato in
 * render con callback che leggono ref viola `react-hooks/refs`. Gli handler
 * responder sono semplici props JSX e leggono i ref solo quando scattano. Per lo
 * stesso motivo righe e celle sono componenti (`GridRow`, `GridCell`) e non
 * funzioni di render chiamate nel corpo, e il valore animato nasce in `useState`.
 *
 * `onDragActiveChange` permette alla schermata di disattivare lo scroll
 * mentre si trascina (`scrollEnabled={!dragging}`): senza, lo ScrollView
 * genitore ruba il gesto.
 *
 * `readOnly` (Modifica, §151–153): niente X, niente drag, niente azioni di
 * spostamento. La regola deve emergere dall'assenza dei controlli (§194): la
 * microcopy «I media pubblicati non possono essere modificati.» compare solo
 * con `showReadOnlyNote`.
 */

import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { ComposerMediaItem } from "../composer-types";
import { ComposerMediaTile, defaultMediaAccessibilityLabel } from "./ComposerMediaTile";

export const COMPOSER_REORDER_HINT = "Tieni premuto e trascina per riordinare";
export const COMPOSER_READONLY_MEDIA_NOTE = "I media pubblicati non possono essere modificati.";

const GRID_COLUMNS = 3;

type TileRect = { pageX: number; pageY: number; width: number; height: number };

type ComposerMediaGridProps = {
  items: ComposerMediaItem[];
  /** Modifica di un Post pubblicato: nessun controllo di modifica (§151–153). */
  readOnly?: boolean;
  /** Helper transitorio «Tieni premuto e trascina per riordinare» (§56). */
  showReorderHint?: boolean;
  /** Microcopy discreta per i media read-only (§195). */
  showReadOnlyNote?: boolean;
  /** Etichetta parlata della cella (§198); default interno se omessa. */
  getAccessibilityLabel?: (item: ComposerMediaItem, index: number, total: number) => string;
  onOpen: (localId: string) => void;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
  /** `toIndex` è l'indice finale desiderato nella collection. */
  onMove: (localId: string, toIndex: number) => void;
  onDragActiveChange?: (active: boolean) => void;
};

function hitTest(
  x: number,
  y: number,
  skipId: string | null,
  rects: Record<string, TileRect>,
): string | null {
  for (const [id, rect] of Object.entries(rects)) {
    if (id === skipId) {
      continue;
    }

    if (
      x >= rect.pageX &&
      x <= rect.pageX + rect.width &&
      y >= rect.pageY &&
      y <= rect.pageY + rect.height
    ) {
      return id;
    }
  }

  return null;
}

function chunk<T>(list: T[], size: number): T[][] {
  const rows: T[][] = [];

  for (let start = 0; start < list.length; start += size) {
    rows.push(list.slice(start, start + size));
  }

  return rows;
}

/** Tutto ciò che le celle ricevono dalla griglia, uguale per ognuna. */
type CellShared = {
  items: ComposerMediaItem[];
  dragId: string | null;
  hoverId: string | null;
  dragTranslate: Animated.ValueXY;
  readOnly: boolean;
  getAccessibilityLabel: (item: ComposerMediaItem, index: number, total: number) => string;
  registerRef: (localId: string, node: View | null) => void;
  onOpen: (localId: string) => void;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
  onMove: (localId: string, toIndex: number) => void;
  onDragStart: (localId: string) => void;
  onTouchEnd: () => void;
};

type GridCellProps = {
  index: number;
  compact: boolean;
  tileStyle?: StyleProp<ViewStyle>;
  shared: CellShared;
};

function GridCell({ index, compact, tileStyle, shared }: GridCellProps) {
  const item = shared.items[index];
  const total = shared.items.length;

  return (
    <ComposerMediaTile
      accessibilityLabel={shared.getAccessibilityLabel(item, index, total)}
      compact={compact}
      dragTranslate={shared.dragTranslate}
      index={index}
      isDragging={shared.dragId === item.localId}
      isDropTarget={shared.hoverId === item.localId}
      item={item}
      onDragStart={shared.onDragStart}
      onMove={shared.onMove}
      onOpen={shared.onOpen}
      onRemove={shared.onRemove}
      onRetry={shared.onRetry}
      onTouchEnd={shared.onTouchEnd}
      raised={shared.dragId === item.localId}
      readOnly={shared.readOnly}
      registerRef={shared.registerRef}
      style={tileStyle}
      total={total}
    />
  );
}

type GridRowProps = {
  indices: number[];
  compact: boolean;
  tileStyle: StyleProp<ViewStyle>;
  shared: CellShared;
};

function GridRow({ indices, compact, tileStyle, shared }: GridRowProps) {
  const raised = shared.dragId !== null && indices.some((index) => shared.items[index].localId === shared.dragId);

  return (
    <View style={[styles.row, raised ? styles.raised : null]}>
      {indices.map((index) => (
        <GridCell
          compact={compact}
          index={index}
          key={shared.items[index].localId}
          shared={shared}
          tileStyle={tileStyle}
        />
      ))}
      {indices.length < GRID_COLUMNS && compact
        ? Array.from({ length: GRID_COLUMNS - indices.length }, (_unused, filler) => (
            <View key={`filler-${filler}`} style={styles.filler} />
          ))
        : null}
    </View>
  );
}

export function ComposerMediaGrid({
  items,
  readOnly = false,
  showReorderHint = false,
  showReadOnlyNote = false,
  getAccessibilityLabel = defaultMediaAccessibilityLabel,
  onOpen,
  onRemove,
  onRetry,
  onMove,
  onDragActiveChange,
}: ComposerMediaGridProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragTranslate] = useState(() => new Animated.ValueXY());
  const tileNodes = useRef<Record<string, View | null>>({});
  const rects = useRef<Record<string, TileRect>>({});
  const dragIdRef = useRef<string | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const capturedRef = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });

  // Gli handler del drag leggono sempre l'ultima versione di items/onMove da
  // questo ref, aggiornato dopo ogni render e letto solo quando scattano.
  const latest = useRef({ items, onMove, onDragActiveChange });
  useEffect(() => {
    latest.current = { items, onMove, onDragActiveChange };
  });

  // Un media rimosso durante il drag non deve lasciare il drag armato.
  useEffect(() => {
    if (dragIdRef.current && !items.some((item) => item.localId === dragIdRef.current)) {
      dragIdRef.current = null;
      hoverIdRef.current = null;
      capturedRef.current = false;
      setDragId(null);
      setHoverId(null);
      onDragActiveChange?.(false);
    }
  }, [items, onDragActiveChange]);

  if (items.length === 0) {
    return null;
  }

  const total = items.length;
  const canReorder = !readOnly && total > 1;

  function registerRef(localId: string, node: View | null) {
    tileNodes.current[localId] = node;
  }

  function handleDragStart(localId: string) {
    if (!canReorder) {
      return;
    }

    dragIdRef.current = localId;
    hoverIdRef.current = null;
    capturedRef.current = false;
    rects.current = {};
    setDragId(localId);
    onDragActiveChange?.(true);

    for (const item of items) {
      tileNodes.current[item.localId]?.measure((_x, _y, width, height, pageX, pageY) => {
        rects.current[item.localId] = { height, pageX, pageY, width };
      });
    }
  }

  // Il dito si è alzato prima che il contenitore catturasse il gesto
  // (long press senza movimento): il drag finisce senza spostare nulla.
  function handleTouchEnd() {
    if (dragIdRef.current && !capturedRef.current) {
      dragIdRef.current = null;
      hoverIdRef.current = null;
      setDragId(null);
      setHoverId(null);
      onDragActiveChange?.(false);
    }
  }

  function finishDrag(commit: boolean) {
    const from = dragIdRef.current;
    const target = hoverIdRef.current;

    dragIdRef.current = null;
    hoverIdRef.current = null;
    capturedRef.current = false;
    setDragId(null);
    setHoverId(null);
    dragTranslate.setValue({ x: 0, y: 0 });

    // Prima lo spostamento, poi la fine del drag: chi ascolta entrambi sa che
    // `onMove` è arrivato da un trascinamento (analytics `via: "drag"`).
    if (commit && from && target) {
      const toIndex = latest.current.items.findIndex((item) => item.localId === target);

      if (toIndex >= 0) {
        latest.current.onMove(from, toIndex);
      }
    }

    latest.current.onDragActiveChange?.(false);
  }

  function handleTouchStart(event: GestureResponderEvent) {
    touchStartRef.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
  }

  function handleResponderGrant() {
    capturedRef.current = true;
    dragTranslate.setValue({ x: 0, y: 0 });
  }

  function handleResponderMove(event: GestureResponderEvent) {
    const { pageX, pageY } = event.nativeEvent;

    dragTranslate.setValue({
      x: pageX - touchStartRef.current.x,
      y: pageY - touchStartRef.current.y,
    });

    const next = hitTest(pageX, pageY, dragIdRef.current, rects.current);

    if (next !== hoverIdRef.current) {
      hoverIdRef.current = next;
      setHoverId(next);
    }
  }

  const shared: CellShared = {
    dragId,
    dragTranslate,
    getAccessibilityLabel,
    hoverId,
    items,
    onDragStart: handleDragStart,
    onMove,
    onOpen,
    onRemove,
    onRetry,
    onTouchEnd: handleTouchEnd,
    readOnly,
    registerRef,
  };

  let layout: ReactElement;

  if (total === 1) {
    const only = items[0];
    const isPortrait = only.width !== null && only.height !== null && only.height > only.width * 1.1;

    layout = (
      <View style={isPortrait ? styles.singlePortrait : styles.singleLandscape}>
        <GridCell compact={false} index={0} key={only.localId} shared={shared} />
      </View>
    );
  } else if (total === 2) {
    layout = <GridRow compact={false} indices={[0, 1]} shared={shared} tileStyle={styles.square} />;
  } else if (total === 3) {
    const secondaryRaised = dragId !== null && [1, 2].some((index) => items[index].localId === dragId);

    layout = (
      <View style={styles.threeLayout}>
        <GridCell compact={false} index={0} key={items[0].localId} shared={shared} />
        <View style={[styles.threeColumn, secondaryRaised ? styles.raised : null]}>
          <GridCell compact={false} index={1} key={items[1].localId} shared={shared} />
          <GridCell compact={false} index={2} key={items[2].localId} shared={shared} />
        </View>
      </View>
    );
  } else if (total === 4) {
    layout = (
      <View style={styles.stack}>
        <GridRow compact={false} indices={[0, 1]} shared={shared} tileStyle={styles.square} />
        <GridRow compact={false} indices={[2, 3]} shared={shared} tileStyle={styles.square} />
      </View>
    );
  } else {
    const rows = chunk(
      items.map((_item, index) => index),
      GRID_COLUMNS,
    );

    layout = (
      <View style={styles.stack}>
        {rows.map((indices) => (
          <GridRow
            compact
            indices={indices}
            key={items[indices[0]].localId}
            shared={shared}
            tileStyle={styles.square}
          />
        ))}
      </View>
    );
  }

  return (
    <View testID="composer-media-grid">
      <View
        onMoveShouldSetResponderCapture={() => dragIdRef.current !== null}
        onResponderGrant={handleResponderGrant}
        onResponderMove={handleResponderMove}
        onResponderRelease={() => finishDrag(true)}
        onResponderTerminate={() => finishDrag(false)}
        onResponderTerminationRequest={() => false}
        onTouchStart={handleTouchStart}
        style={styles.grid}
      >
        {layout}
      </View>

      {canReorder && showReorderHint ? (
        <AppText color="secondary" style={styles.note} variant="caption">
          {COMPOSER_REORDER_HINT}
        </AppText>
      ) : null}

      {readOnly && showReadOnlyNote ? (
        <AppText color="secondary" style={styles.note} variant="caption">
          {COMPOSER_READONLY_MEDIA_NOTE}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filler: {
    flex: 1,
  },
  grid: {
    paddingHorizontal: spacing[16],
  },
  note: {
    marginTop: spacing[8],
    paddingHorizontal: spacing[16],
  },
  raised: {
    zIndex: 10,
  },
  row: {
    flexDirection: "row",
    gap: spacing[4],
  },
  singleLandscape: {
    aspectRatio: 4 / 3,
  },
  singlePortrait: {
    aspectRatio: 4 / 5,
  },
  square: {
    aspectRatio: 1,
  },
  stack: {
    gap: spacing[4],
  },
  threeColumn: {
    flex: 1,
    gap: spacing[4],
  },
  threeLayout: {
    aspectRatio: 1,
    flexDirection: "row",
    gap: spacing[4],
  },
});
