import {
  type ComponentProps,
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

export type MediaViewerMode = "owner" | "visitor";

type MediaTabContentProps = {
  authorName: string;
  initialItems?: MediaContentItem[];
  mode: MediaViewerMode;
  onAddContentPress?: () => void;
};

type MediaContentTag = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
};

type MediaComment = {
  author: string;
  id: string;
  text: string;
};

export type MediaContentItem = {
  commentCount: number;
  comments: MediaComment[];
  description: string;
  id: string;
  isFeatured: boolean;
  isLiked: boolean;
  isSaved: boolean;
  likeCount: number;
  tag?: MediaContentTag;
  thumbnailUrl: string;
  type: "image" | "video";
  videoUrl?: string;
};

export function MediaTabContent({
  authorName,
  initialItems = [],
  mode,
  onAddContentPress,
}: MediaTabContentProps) {
  const [items, setItems] = useState(initialItems);
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

  const selectedItem = useMemo(
    () => orderedItems.find((item) => item.id === selectedItemId) ?? null,
    [orderedItems, selectedItemId],
  );
  const currentViewerItem = orderedItems[activeViewerIndex] ?? selectedItem;

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

    const itemIndex = orderedItems.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) {
      return;
    }

    setActiveViewerIndex(itemIndex);
    setSelectedItemId(itemId);
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
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? { ...item, isFeatured: !item.isFeatured }
          : item,
      ),
    );
  }

  function handleDeleteItem(itemId: string) {
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

  function handleEditItem() {
    const currentItem = orderedItems[activeViewerIndex];

    if (!currentItem) {
      return;
    }

    Alert.alert(
      "Modifica contenuto",
      `La scheda di modifica per "${currentItem.tag?.label ?? "Media"}" verra' collegata al form media dedicato.`,
    );
  }

  function handleOpenComments() {
    const currentItem = orderedItems[activeViewerIndex];

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
    const boundedIndex = Math.max(0, Math.min(nextIndex, orderedItems.length - 1));
    setActiveViewerIndex(boundedIndex);
  }

  return (
    <View style={styles.root}>
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

      {orderedItems.length > 0 ? (
        <View
          pointerEvents={isGridInteractionLocked ? "none" : "auto"}
          style={styles.grid}
          testID="media-grid"
        >
          {orderedItems.map((item) => (
            <View key={item.id} style={styles.gridCell}>
              <Pressable
                accessibilityLabel={`Apri contenuto ${item.tag?.label ?? "Media"}`}
                disabled={isGridInteractionLocked}
                onPress={() => handleOpenItem(item.id)}
                style={({ pressed }) => [
                  styles.gridItem,
                  isGridInteractionLocked ? styles.gridItemDisabled : null,
                  pressed ? styles.pressed : null,
                ]}
                testID={`media-grid-item-${item.id}`}
              >
                <Image source={{ uri: item.thumbnailUrl }} style={styles.gridImage} />
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
                    <Ionicons color={colors.inkInvert} name="play" size={12} />
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
            Nessun contenuto
          </AppText>
          <AppText color="secondary" style={styles.emptySubtitle} variant="bodySm">
            {mode === "owner"
              ? "Aggiungi foto e video per mostrare il lavoro svolto sul campo."
              : "Questo profilo allenatore non ha ancora pubblicato contenuti."}
          </AppText>
          {mode === "owner" ? (
            <Button
              accessibilityLabel="Aggiungi contenuto"
              label="Aggiungi contenuto"
              onPress={handleAddContent}
              variant="primary"
            />
          ) : null}
        </View>
      )}

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
              {orderedItems.map((item) => (
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
                    <AppText color="inverse" style={styles.viewerAuthor} variant="bodySm">
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

                    <View style={styles.commentsPreview}>
                      {item.comments.length > 0 ? (
                        item.comments.slice(0, 2).map((comment) => (
                          <AppText key={comment.id} color="inverse" variant="bodySm">
                            <AppText color="inverse" style={styles.commentAuthor} variant="bodySm">
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
        <AppText color="inverse" style={styles.viewerActionCount} variant="caption">
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
  commentAuthor: {
    fontWeight: "700",
  },
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
    backgroundColor: "rgba(10,102,194,0.92)",
    borderRadius: radius.full,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: spacing[6],
    top: spacing[6],
    width: 22,
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
    ...StyleSheet.absoluteFillObject,
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
  gridShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,43,64,0.08)",
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
    backgroundColor: "rgba(11, 43, 64, 0.74)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radius[6],
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
    fontSize: 11,
    lineHeight: 14,
  },
  videoBadge: {
    alignItems: "center",
    backgroundColor: "rgba(11, 43, 64, 0.74)",
    borderRadius: radius.full,
    bottom: spacing[6],
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: spacing[6],
    width: 22,
  },
  videoPlayButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(11,43,64,0.46)",
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
  viewerActionCount: {
    fontWeight: "700",
  },
  viewerActionIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(11,43,64,0.46)",
    borderRadius: radius.full,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  viewerAuthor: {
    fontWeight: "700",
  },
  viewerBackButton: {
    left: spacing[12],
    padding: spacing[8],
    position: "absolute",
    top: 44,
    zIndex: 20,
  },
  viewerBottomSheet: {
    backgroundColor: "rgba(11,43,64,0.32)",
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
    backgroundColor: "rgba(220,38,38,0.45)",
  },
  viewerDescription: {
    marginTop: spacing[6],
  },
  viewerImage: {
    ...StyleSheet.absoluteFillObject,
  },
  viewerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  viewerPage: {
    backgroundColor: colors.hero,
    overflow: "hidden",
  },
  viewerPinnedBadge: {
    alignItems: "center",
    backgroundColor: "rgba(10,102,194,0.92)",
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
