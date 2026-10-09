/**
 * Superficie Media condivisa dai Master Profile — Calciatore, Allenatore,
 * Staff tecnico, Dirigente e ogni profilo futuro che la riusi: griglia,
 * filtri, viewer a schermo intero e azioni owner.
 *
 * REV-PROF-12, regola globale sulla griglia: le thumbnail non espongono
 * alcun controllo "Salva". Nessuna icona bookmark, nessuno stato
 * salvato/non salvato, nessuna hit-area invisibile — l'unico gesto della
 * thumbnail è aprire il contenuto. Il salvataggio vive nel dettaglio
 * contenuto (rail destro del viewer, lato Visitor) con il comportamento già
 * esistente; badge durata, filtri, spacing e CTA owner restano invariati.
 * Chi tocca questo file non reintroduca l'icona in griglia: la copertura è
 * in `MediaTabContent.test.tsx`.
 */
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { VideoPlayerModal } from "../../../components/ui/video-player-modal";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { ProfileFilterChips } from "../master/ProfileFilterChips";

/** "0:24" — i secondi sono sempre a due cifre. */
export function formatMediaDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Un video comunica tipologia e durata, non solo "apri contenuto" (§39). */
function buildMediaItemAccessibilityLabel(item: MediaContentItem): string {
  if (item.type === "video") {
    return item.durationSeconds != null
      ? `Video, durata ${formatMediaDuration(item.durationSeconds)}`
      : "Video";
  }

  return item.tag?.label ? `Foto, ${item.tag.label}` : "Foto";
}

export type MediaViewerMode = "owner" | "visitor";

/** Filtri della galleria (REV-PROF-01 §23). */
export type MediaFilter = "all" | "photo" | "video";

const MEDIA_FILTER_OPTIONS: readonly { label: string; value: MediaFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Foto", value: "photo" },
  { label: "Video", value: "video" },
];

type MediaTabContentProps = {
  authorName: string;
  /** Copy dell'empty state: cambia per tipologia di profilo (§24). */
  emptyCtaLabel?: string;
  emptyDescription?: string;
  emptyTitle?: string;
  /** Filtri Tutti/Foto/Video sopra la griglia. */
  filtersEnabled?: boolean;
  /**
   * Riga sotto la griglia: serve alla paginazione, che è del chiamante perché
   * dipende dalle sue sorgenti (REV-PROF-19). Nessun footer: nessuno spazio.
   */
  footer?: ReactNode;
  initialItems?: MediaContentItem[];
  mode: MediaViewerMode;
  onAddContentPress?: () => void;
  /**
   * Elimina il contenuto sul serio (REV-PROF-09). Senza handler la griglia
   * resta sul comportamento storico, cioè toglie la riga dallo stato locale:
   * chi persiste passa di qui, chi non lo fa ancora non cambia.
   */
  onDeleteContentPress?: (itemId: string) => void;
  /**
   * Apre l'editor del contenuto. Assente per il Visitor. Riceve l'id del
   * contenuto aperto nel viewer, per gli editor che lavorano su una riga sola.
   */
  onEditContentPress?: (itemId?: string) => void;
  onFilterChange?: (filter: MediaFilter) => void;
  onItemOpened?: (item: MediaContentItem) => void;
  /** Apre il profilo o la società collegati al contenuto. */
  onOpenLinkedTarget?: (target: MediaLinkedTarget) => void;
  onOpenTaggedItem?: (ref: { contentType: string; postId: string }) => void;
  /** Persiste l'evidenza. Vedi `onDeleteContentPress` per il fallback. */
  onToggleFeaturedPress?: (itemId: string) => void;
};

type MediaContentTag = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
};

/** Profilo o società collegati a un contenuto, quando la sorgente li porta. */
export type MediaLinkedTarget = {
  avatar_url: string | null;
  display_name: string;
  subtitle: string | null;
  target_id: string;
  target_type: "profile" | "club";
};

type MediaComment = {
  author: string;
  id: string;
  text: string;
};

export type MediaContentItem = {
  commentCount: number;
  comments: MediaComment[];
  /** Icon shown on a generated cover when the item has no thumbnail image
   *  (e.g. a tagged poll/formation/opinion). */
  coverIcon?: ComponentProps<typeof Ionicons>["name"];
  description: string;
  id: string;
  isFeatured: boolean;
  isLiked: boolean;
  isSaved: boolean;
  likeCount: number;
  /** Profili e società collegati al contenuto in fase di pubblicazione. */
  linkedTargets?: readonly MediaLinkedTarget[];
  tag?: MediaContentTag;
  /** Durata del video in secondi, quando la sorgente la conosce (§23). */
  durationSeconds?: number;
  /**
   * Contenuto che ha un dettaglio canonico proprio: il tap apre quello invece
   * del viewer locale, così commenti, reazioni e Salva restano in un posto
   * solo. REV-PROF-19 aggiunge `fan_media`, la bacheca storica del Tifoso.
   */
  taggedRef?: {
    contentType: "club_media" | "fan_media" | "fan_tribuna" | "media_profile";
    postId: string;
  };
  /*
    Opzionale: un video senza copertina non deve ereditare l'avatar del
    profilo (sarebbe un dato inventato). Griglia e viewer mostrano il
    placeholder quando manca.
  */
  thumbnailUrl?: string;
  type: "image" | "video";
  videoUrl?: string;
};

export function MediaTabContent({
  authorName,
  emptyCtaLabel = "Aggiungi contenuto",
  emptyDescription,
  emptyTitle = "Nessun contenuto",
  filtersEnabled = false,
  footer,
  initialItems = [],
  mode,
  onAddContentPress,
  onDeleteContentPress,
  onEditContentPress,
  onFilterChange,
  onItemOpened,
  onOpenLinkedTarget,
  onOpenTaggedItem,
  onToggleFeaturedPress,
}: MediaTabContentProps) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeViewerIndex, setActiveViewerIndex] = useState(0);
  const [isGridInteractionLocked, setIsGridInteractionLocked] = useState(false);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const closeLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViewerCloseAtRef = useRef(0);
  const viewerScrollRef = useRef<ScrollView | null>(null);
  const viewportHeight = Dimensions.get("window").height;

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    return () => {
      if (closeLockTimeoutRef.current) {
        clearTimeout(closeLockTimeoutRef.current);
      }
    };
  }, []);

  const orderedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        if (left.isFeatured !== right.isFeatured) {
          return left.isFeatured ? -1 : 1;
        }

        return left.id.localeCompare(right.id);
      }),
    [items],
  );

  // Il filtro cambia davvero il contenuto mostrato, non solo la chip attiva.
  const visibleItems = useMemo(
    () =>
      filter === "all"
        ? orderedItems
        : orderedItems.filter((item) =>
            filter === "video" ? item.type === "video" : item.type === "image",
          ),
    [filter, orderedItems],
  );

  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, visibleItems],
  );
  const currentViewerItem = visibleItems[activeViewerIndex] ?? selectedItem;

  useEffect(() => {
    if (selectedItemId !== null && viewerScrollRef.current && viewportHeight > 0) {
      viewerScrollRef.current.scrollTo({
        animated: false,
        y: activeViewerIndex * viewportHeight,
      });
    }
  }, [activeViewerIndex, selectedItemId, viewportHeight]);

  function handleOpenItem(itemId: string) {
    if (isGridInteractionLocked || Date.now() - lastViewerCloseAtRef.current < 350) {
      return;
    }

    const item = visibleItems.find((visibleItem) => visibleItem.id === itemId);
    if (!item) {
      return;
    }

    if (item.taggedRef && onOpenTaggedItem) {
      onOpenTaggedItem(item.taggedRef);
      return;
    }

    onItemOpened?.(item);

    // Il viewer sfoglia gli stessi contenuti della griglia: con il filtro su
    // "Video" uno swipe non deve far comparire una foto (§23).
    const itemIndex = visibleItems.indexOf(item);
    setActiveViewerIndex(itemIndex);
    setSelectedItemId(itemId);
  }

  function handleFilterChange(nextFilter: MediaFilter) {
    // Gli indici del viewer valgono sulla lista filtrata: cambiando filtro
    // vanno azzerati insieme alla selezione.
    setSelectedItemId(null);
    setActiveViewerIndex(0);
    setFilter(nextFilter);
    onFilterChange?.(nextFilter);
  }

  function handleCloseViewer() {
    lastViewerCloseAtRef.current = Date.now();
    setIsGridInteractionLocked(true);
    if (closeLockTimeoutRef.current) {
      clearTimeout(closeLockTimeoutRef.current);
    }
    closeLockTimeoutRef.current = setTimeout(() => {
      setIsGridInteractionLocked(false);
      closeLockTimeoutRef.current = null;
    }, 350);
    setSelectedItemId(null);
    setIsVideoPlayerOpen(false);
    setActiveViewerIndex(0);
  }

  function handleAddContent() {
    if (onAddContentPress) {
      onAddContentPress();
      return;
    }

    Alert.alert(
      "Aggiungi contenuto",
      "Il flusso di caricamento verra' collegato al backend media del profilo.",
    );
  }

  function handleToggleFeatured(itemId: string) {
    if (onToggleFeaturedPress) {
      onToggleFeaturedPress(itemId);
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? { ...item, isFeatured: !item.isFeatured }
          : item,
      ),
    );
  }

  function handleDeleteItem(itemId: string) {
    /*
      Con un handler di persistenza il viewer si chiude e la decisione passa
      al chiamante, che può chiedere conferma e ricaricare: togliere la riga
      qui mostrerebbe un'eliminazione che il backend non ha ancora accettato.
    */
    if (onDeleteContentPress) {
      handleCloseViewer();
      onDeleteContentPress(itemId);
      return;
    }

    setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
    if (selectedItemId === itemId) {
      handleCloseViewer();
    }
  }

  function handleToggleLike(itemId: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextLiked = !item.isLiked;

        return {
          ...item,
          isLiked: nextLiked,
          likeCount: item.likeCount + (nextLiked ? 1 : -1),
        };
      }),
    );
  }

  function handleToggleSaved(itemId: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? { ...item, isSaved: !item.isSaved }
          : item,
      ),
    );
  }

  /*
    REV-PROF-02 §O.8: la matita dell Owner porta al form reale della sezione
    "Media e contenuti", non piu a un avviso provvisorio. Il viewer si chiude
    prima di navigare, altrimenti resterebbe aperto sopra l editor.
  */
  function handleEditItem() {
    const currentItem = visibleItems[activeViewerIndex];

    if (!currentItem) {
      return;
    }

    setSelectedItemId(null);
    onEditContentPress?.(currentItem.id);
  }

  function handleOpenComments() {
    const currentItem = visibleItems[activeViewerIndex];

    if (!currentItem) {
      return;
    }

    Alert.alert(
      "Commenti",
      currentItem.commentCount > 0
        ? `Apri la lista completa dei ${currentItem.commentCount} commenti.`
        : "Non ci sono ancora commenti su questo contenuto.",
    );
  }

  function handleViewerScroll(offsetY: number) {
    if (viewportHeight <= 0) {
      return;
    }

    const nextIndex = Math.round(offsetY / viewportHeight);
    const boundedIndex = Math.max(0, Math.min(nextIndex, visibleItems.length - 1));
    setActiveViewerIndex(boundedIndex);
  }

  return (
    <View style={styles.root}>
      {filtersEnabled ? (
        <View style={styles.filtersRow}>
          <ProfileFilterChips
            accessibilityLabel="Filtro contenuti"
            onChange={handleFilterChange}
            options={MEDIA_FILTER_OPTIONS}
            testID="media-filter"
            value={filter}
          />
          {mode === "owner" && orderedItems.length > 0 ? (
            <Button
              accessibilityLabel="Aggiungi contenuto"
              label="+"
              onPress={handleAddContent}
              size="sm"
              testID="media-add"
              variant="primary"
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.header}>
          <AppText variant="titleSm">Media</AppText>
          {mode === "owner" && orderedItems.length > 0 ? (
            <Button
              accessibilityLabel="Aggiungi contenuto"
              label="+ Aggiungi contenuto"
              onPress={handleAddContent}
              size="sm"
              variant="primary"
            />
          ) : null}
        </View>
      )}

      {orderedItems.length > 0 && visibleItems.length === 0 ? (
        <View style={styles.filterEmpty} testID="media-filter-empty">
          <AppText color="secondary" variant="bodySm">
            {filter === "video"
              ? "Nessun video in questo profilo."
              : "Nessuna foto in questo profilo."}
          </AppText>
        </View>
      ) : null}

      {orderedItems.length > 0 ? (
        <View
          pointerEvents={isGridInteractionLocked ? "none" : "auto"}
          style={styles.grid}
          testID="media-grid"
        >
          {visibleItems.map((item) => (
            <View key={item.id} style={styles.gridCell}>
              <Pressable
                accessibilityLabel={buildMediaItemAccessibilityLabel(item)}
                disabled={isGridInteractionLocked}
                onPress={() => handleOpenItem(item.id)}
                style={({ pressed }) => [
                  styles.gridItem,
                  isGridInteractionLocked ? styles.gridItemDisabled : null,
                  pressed ? styles.pressed : null,
                ]}
                testID={`media-grid-item-${item.id}`}
              >
                {item.thumbnailUrl ? (
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.gridImage} />
                ) : (
                  <View style={styles.gridPlaceholder}>
                    <Ionicons
                      color={colors.accent}
                      name={item.coverIcon ?? "pricetag-outline"}
                      size={26}
                    />
                  </View>
                )}
                <View style={styles.gridShade} />
                {item.tag ? (
                  <View style={styles.tagBadge}>
                    <Ionicons color={colors.inkInvert} name={item.tag.icon} size={11} />
                    <AppText color="inverse" numberOfLines={1} style={styles.tagText} variant="caption">
                      {item.tag.label}
                    </AppText>
                  </View>
                ) : null}
                {item.type === "video" ? (
                  <View style={styles.videoBadge}>
                    <Ionicons color={colors.inkInvert} name="play" size={11} />
                    {item.durationSeconds != null ? (
                      <AppText color="inverse" style={styles.videoDuration} variant="caption">
                        {formatMediaDuration(item.durationSeconds)}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
                {item.isFeatured ? (
                  <View style={styles.featuredBadge}>
                    <Ionicons color={colors.inkInvert} name="pin" size={11} />
                  </View>
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons color={colors.textSecondary} name="images-outline" size={28} />
          </View>
          <AppText style={styles.emptyTitle} variant="titleSm">
            {emptyTitle}
          </AppText>
          <AppText color="secondary" style={styles.emptySubtitle} variant="bodySm">
            {emptyDescription ??
              (mode === "owner"
                ? "Aggiungi foto e video per mostrare il lavoro svolto sul campo."
                : "Questo profilo non ha ancora pubblicato contenuti.")}
          </AppText>
          {mode === "owner" ? (
            <Button
              accessibilityLabel={emptyCtaLabel}
              label={emptyCtaLabel}
              onPress={handleAddContent}
              variant="primary"
            />
          ) : null}
        </View>
      )}

      {footer ? <View style={styles.footer}>{footer}</View> : null}

      <Modal
        animationType="slide"
        onRequestClose={handleCloseViewer}
        visible={selectedItem !== null}
      >
        {currentViewerItem ? (
          <View style={styles.viewerRoot}>
            <Pressable
              accessibilityLabel="Chiudi contenuto media"
              hitSlop={8}
              onPress={handleCloseViewer}
              style={({ pressed }) => [styles.viewerBackButton, pressed ? styles.pressed : null]}
            >
              <Ionicons color={colors.inkInvert} name="arrow-back" size={22} />
            </Pressable>

            <ScrollView
              bounces={false}
              onMomentumScrollEnd={(event) =>
                handleViewerScroll(event.nativeEvent.contentOffset.y)
              }
              pagingEnabled
              ref={viewerScrollRef}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
            >
              {visibleItems.map((item) => (
                <View
                  key={item.id}
                  style={[styles.viewerPage, { height: viewportHeight || undefined }]}
                >
                  <Image source={{ uri: item.thumbnailUrl }} style={styles.viewerImage} />
                  <View style={styles.viewerOverlay} />

                  <View style={styles.viewerTopBar}>
                    <View />
                    {item.isFeatured ? (
                      <View style={styles.viewerPinnedBadge}>
                        <Ionicons color={colors.inkInvert} name="pin" size={12} />
                      </View>
                    ) : (
                      <View />
                    )}
                  </View>

                  {item.type === "video" ? (
                    <Pressable
                      accessibilityLabel="Riproduci video"
                      onPress={() => {
                        setSelectedItemId(item.id);
                        setIsVideoPlayerOpen(true);
                      }}
                      style={({ pressed }) => [
                        styles.videoPlayButton,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Ionicons color={colors.inkInvert} name="play" size={30} />
                    </Pressable>
                  ) : null}

                  <View style={styles.viewerRightRail}>
                    {mode === "visitor" ? (
                      <>
                        <ViewerAction
                          accessibilityLabel="Metti like al contenuto"
                          active={item.isLiked}
                          activeIcon="heart"
                          count={formatCount(item.likeCount)}
                          icon="heart-outline"
                          onPress={() => handleToggleLike(item.id)}
                        />
                        <ViewerAction
                          accessibilityLabel="Apri commenti contenuto"
                          count={formatCount(item.commentCount)}
                          icon="chatbubble-outline"
                          onPress={handleOpenComments}
                        />
                        <ViewerAction
                          accessibilityLabel="Salva contenuto"
                          active={item.isSaved}
                          activeIcon="bookmark"
                          icon="bookmark-outline"
                          onPress={() => handleToggleSaved(item.id)}
                        />
                      </>
                    ) : (
                      <>
                        <ViewerAction
                          accessibilityLabel={item.isFeatured ? "Rimuovi evidenza" : "Metti in evidenza"}
                          active={item.isFeatured}
                          activeIcon="pin"
                          icon="pin-outline"
                          onPress={() => handleToggleFeatured(item.id)}
                        />
                        <ViewerAction
                          accessibilityLabel="Modifica"
                          icon="create-outline"
                          onPress={handleEditItem}
                        />
                        <ViewerAction
                          accessibilityLabel="Elimina"
                          destructive
                          icon="trash-outline"
                          onPress={() => handleDeleteItem(item.id)}
                        />
                      </>
                    )}
                  </View>

                  <View style={styles.viewerBottomSheet}>
                    <AppText color="inverse" variant="metaStrong">
                      {authorName}
                    </AppText>
                    {item.description ? (
                      <AppText color="inverse" style={styles.viewerDescription} variant="bodySm">
                        {item.description}
                      </AppText>
                    ) : null}
                    <AppText color="inverse" style={styles.viewerStats} variant="caption">
                      {`Piace a ${formatCount(item.likeCount)} persone • ${item.commentCount} commenti`}
                    </AppText>

                    {item.linkedTargets && item.linkedTargets.length > 0 ? (
                      <View style={styles.viewerLinkedList}>
                        {item.linkedTargets.map((target) => (
                          <Pressable
                            accessibilityLabel={`Apri ${target.display_name}`}
                            accessibilityRole="button"
                            disabled={!onOpenLinkedTarget}
                            key={`${item.id}-${target.target_type}-${target.target_id}`}
                            onPress={() => onOpenLinkedTarget?.(target)}
                            style={({ pressed }) => [
                              styles.viewerLinkedItem,
                              pressed ? styles.pressed : null,
                            ]}
                          >
                            <Ionicons
                              color={colors.inkInvert}
                              name={
                                target.target_type === "club"
                                  ? "business-outline"
                                  : "person-outline"
                              }
                              size={14}
                            />
                            <AppText
                              color="inverse"
                              numberOfLines={1}
                              style={styles.viewerLinkedLabel}
                              variant="caption"
                            >
                              {target.display_name}
                            </AppText>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.commentsPreview}>
                      {item.comments.length > 0 ? (
                        item.comments.slice(0, 2).map((comment) => (
                          <AppText key={comment.id} color="inverse" variant="bodySm">
                            <AppText color="inverse" variant="metaStrong">
                              {comment.author}
                            </AppText>{" "}
                            {comment.text}
                          </AppText>
                        ))
                      ) : (
                        <AppText color="inverse" style={styles.noCommentsText} variant="bodySm">
                          Nessun commento per ora.
                        </AppText>
                      )}
                    </View>

                    <Pressable
                      accessibilityLabel="Vedi tutti i commenti"
                      onPress={handleOpenComments}
                      style={({ pressed }) => [
                        styles.viewAllButton,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <AppText color="inverse" variant="bodySm">
                        {item.commentCount > 0
                          ? `Vedi tutti i ${item.commentCount} commenti`
                          : "Apri commenti"}
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <VideoPlayerModal
              onClose={() => setIsVideoPlayerOpen(false)}
              title={currentViewerItem.tag?.label ?? "Media"}
              url={currentViewerItem.videoUrl ?? ""}
              visible={isVideoPlayerOpen}
            />
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

function ViewerAction({
  accessibilityLabel,
  active = false,
  activeIcon,
  count,
  destructive = false,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  active?: boolean;
  activeIcon?: ComponentProps<typeof Ionicons>["name"];
  count?: string;
  destructive?: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.viewerAction, pressed ? styles.pressed : null]}
    >
      <View style={[styles.viewerActionIconWrap, destructive ? styles.viewerDangerAction : null]}>
        <Ionicons
          color={colors.inkInvert}
          name={active && activeIcon ? activeIcon : icon}
          size={20}
        />
      </View>
      {count ? (
        <AppText color="inverse" variant="chipLabel">
          {count}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("it-IT").format(Math.max(0, value));
}

const styles = StyleSheet.create({
  commentsPreview: {
    gap: spacing[6],
    marginTop: spacing[8],
  },
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing[16],
    width: 64,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[36],
  },
  emptySubtitle: {
    marginBottom: spacing[20],
    maxWidth: 260,
    textAlign: "center",
  },
  emptyTitle: {
    marginBottom: spacing[8],
  },
  featuredBadge: {
    alignItems: "center",
    backgroundColor: colors.featuredBadgeSurface,
    borderRadius: radius.full,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: spacing[6],
    top: spacing[6],
    width: 22,
  },
  filterEmpty: {
    paddingBottom: spacing[20],
    paddingHorizontal: spacing[16],
  },
  filtersRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "space-between",
    paddingBottom: spacing[14],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -1,
  },
  gridCell: {
    padding: 1,
    width: "33.3333%",
  },
  gridImage: {
    ...StyleSheet.absoluteFill,
  },
  gridItem: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    position: "relative",
  },
  gridItemDisabled: {
    opacity: 0.72,
  },
  gridPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
  },
  gridShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.mediaScrim,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  noCommentsText: {
    opacity: 0.82,
  },
  pressed: {
    opacity: 0.82,
  },
  root: {
    backgroundColor: colors.surface,
    paddingBottom: spacing[20],
  },
  tagBadge: {
    alignItems: "center",
    backgroundColor: colors.mediaBadgeSurface,
    borderColor: colors.mediaHairlineOnMedia,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    flexShrink: 1,
    gap: 4,
    left: spacing[6],
    maxWidth: "82%",
    paddingHorizontal: spacing[6],
    paddingVertical: 4,
    position: "absolute",
    right: spacing[6],
    top: spacing[6],
  },
  tagText: {
    flexShrink: 1,
  },
  videoBadge: {
    alignItems: "center",
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius.full,
    bottom: spacing[6],
    flexDirection: "row",
    gap: 3,
    justifyContent: "center",
    left: spacing[6],
    minHeight: 20,
    paddingHorizontal: spacing[6],
    paddingVertical: 2,
    position: "absolute",
  },
  videoDuration: {
    lineHeight: 14,
  },
  videoPlayButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.mediaControlSurface,
    borderRadius: radius.full,
    height: 70,
    justifyContent: "center",
    position: "absolute",
    top: "42%",
    width: 70,
  },
  viewAllButton: {
    marginTop: spacing[10],
    paddingVertical: spacing[6],
  },
  viewerAction: {
    alignItems: "center",
    gap: spacing[6],
  },
  viewerActionIconWrap: {
    alignItems: "center",
    backgroundColor: colors.mediaControlSurface,
    borderRadius: radius.full,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  viewerBackButton: {
    left: spacing[12],
    padding: spacing[8],
    position: "absolute",
    top: 44,
    zIndex: 20,
  },
  viewerBottomSheet: {
    backgroundColor: colors.mediaSheetSurface,
    bottom: spacing[18],
    left: spacing[12],
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[14],
    paddingTop: spacing[14],
    position: "absolute",
    right: 74,
    borderRadius: radius[16],
  },
  viewerDangerAction: {
    backgroundColor: colors.mediaDangerSurface,
  },
  viewerDescription: {
    marginTop: spacing[6],
  },
  viewerImage: {
    ...StyleSheet.absoluteFill,
  },
  viewerLinkedItem: {
    alignItems: "center",
    borderColor: colors.mediaBorderOnMedia,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[6],
    maxWidth: "100%",
    minHeight: 32,
    paddingHorizontal: spacing[10],
  },
  viewerLinkedLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
  viewerLinkedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginTop: spacing[10],
  },
  viewerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.mediaViewerOverlay,
  },
  viewerPage: {
    backgroundColor: colors.hero,
    overflow: "hidden",
  },
  viewerPinnedBadge: {
    alignItems: "center",
    backgroundColor: colors.featuredBadgeSurface,
    borderRadius: radius.full,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  viewerRightRail: {
    alignItems: "center",
    bottom: spacing[28],
    gap: spacing[20],
    position: "absolute",
    right: spacing[14],
  },
  viewerRoot: {
    backgroundColor: colors.hero,
    flex: 1,
  },
  viewerStats: {
    marginTop: spacing[8],
    opacity: 0.9,
  },
  viewerTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    left: spacing[12],
    position: "absolute",
    right: spacing[12],
    top: 50,
  },
});
