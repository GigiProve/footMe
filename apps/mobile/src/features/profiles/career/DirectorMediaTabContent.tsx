import {
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { VideoPlayerModal } from "../../../components/ui/video-player-modal";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../ui";
import {
  getDirectorMediaTagMeta,
  type DirectorMediaItemRecord,
  type DirectorMediaLinkedTarget,
} from "../director-media";

type DirectorMediaViewerMode = "owner" | "visitor";

type DirectorMediaTabContentProps = {
  authorAvatarUrl: string | null;
  authorName: string;
  initialItems?: DirectorMediaItemRecord[];
  mode: DirectorMediaViewerMode;
  onAddContentPress?: () => void;
  onDeleteContentPress?: (itemId: string) => void;
  onEditContentPress?: (itemId: string) => void;
  onOpenLinkedTarget?: (target: DirectorMediaLinkedTarget) => void;
  onToggleFeaturedPress?: (itemId: string) => void;
};

const GRID_GAP = 8;
const GRID_PADDING = spacing[16];
const VIEWER_HEADER_HEIGHT = 64;

export function DirectorMediaTabContent({
  authorAvatarUrl,
  authorName,
  initialItems = [],
  mode,
  onAddContentPress,
  onDeleteContentPress,
  onEditContentPress,
  onOpenLinkedTarget,
  onToggleFeaturedPress,
}: DirectorMediaTabContentProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeViewerIndex, setActiveViewerIndex] = useState(0);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [isGridInteractionLocked, setIsGridInteractionLocked] = useState(false);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const closeLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViewerCloseAtRef = useRef(0);
  const viewerScrollRef = useRef<ScrollView | null>(null);
  const { height: viewportHeight, width: viewportWidth } = Dimensions.get("window");

  const orderedItems = useMemo(
    () => [...initialItems].sort(compareDirectorMediaItems),
    [initialItems],
  );
  const selectedItem = useMemo(
    () => orderedItems.find((item) => item.id === selectedItemId) ?? null,
    [orderedItems, selectedItemId],
  );
  const currentViewerItem = orderedItems[activeViewerIndex] ?? selectedItem;
  const gridItemSize = useMemo(() => {
    const availableWidth = Math.max(viewportWidth - GRID_PADDING * 2 - GRID_GAP * 2, 0);
    return Math.floor(availableWidth / 3);
  }, [viewportWidth]);
  const viewerPageHeight = Math.max(viewportHeight - VIEWER_HEADER_HEIGHT, 0);

  useEffect(() => {
    if (selectedItemId !== null && !selectedItem) {
      setSelectedItemId(null);
      setActiveViewerIndex(0);
      setIsVideoPlayerOpen(false);
    }
  }, [selectedItem, selectedItemId]);

  useEffect(() => {
    return () => {
      if (closeLockTimeoutRef.current) {
        clearTimeout(closeLockTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedItemId !== null && viewerScrollRef.current && viewerPageHeight > 0) {
      viewerScrollRef.current.scrollTo({
        animated: false,
        y: activeViewerIndex * viewerPageHeight,
      });
    }
  }, [activeViewerIndex, selectedItemId, viewerPageHeight]);

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
    setActiveViewerIndex(0);
    setIsVideoPlayerOpen(false);
  }

  function handleViewerScroll(offsetY: number) {
    if (viewerPageHeight <= 0) {
      return;
    }

    const nextIndex = Math.round(offsetY / viewerPageHeight);
    const boundedIndex = Math.max(0, Math.min(nextIndex, orderedItems.length - 1));
    setActiveViewerIndex(boundedIndex);
  }

  function handleAddContent() {
    if (onAddContentPress) {
      onAddContentPress();
      return;
    }

    Alert.alert("Media dirigente", "Il composer del contenuto non e' collegato.");
  }

  function handleToggleSet(
    itemId: string,
    setter: Dispatch<SetStateAction<Set<string>>>,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function handleOpenComments() {
    Alert.alert("Commenti", "La conversazione sul contenuto verra' aperta qui.");
  }

  function handleEditCurrentItem() {
    if (!currentViewerItem) {
      return;
    }

    handleCloseViewer();
    onEditContentPress?.(currentViewerItem.id);
  }

  function handleDeleteCurrentItem() {
    if (!currentViewerItem) {
      return;
    }

    handleCloseViewer();
    onDeleteContentPress?.(currentViewerItem.id);
  }

  function handleToggleFeaturedCurrentItem() {
    if (!currentViewerItem) {
      return;
    }

    onToggleFeaturedPress?.(currentViewerItem.id);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="titleSm">Media</AppText>
          <AppText color="secondary" variant="bodySm">
            Presenza istituzionale, scouting e momenti professionali.
          </AppText>
        </View>
        {mode === "owner" ? (
          <Button
            accessibilityLabel="Aggiungi contenuto media dirigente"
            label="+ Nuovo"
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
          testID="director-media-grid"
        >
          {orderedItems.map((item) => {
            const tagMeta = getDirectorMediaTagMeta(item.tag);
            const previewUri = getDirectorMediaPreviewUri(item);

            return (
              <View key={item.id} style={[styles.gridCell, { width: gridItemSize }]}>
                <Pressable
                  accessibilityLabel={`Apri contenuto media dirigente ${item.id}`}
                  disabled={isGridInteractionLocked}
                  onPress={() => handleOpenItem(item.id)}
                  style={({ pressed }) => [
                    styles.gridItem,
                    { height: gridItemSize },
                    pressed ? styles.pressed : null,
                  ]}
                  testID={`director-media-grid-item-${item.id}`}
                >
                  {previewUri ? (
                    <Image source={{ uri: previewUri }} style={styles.gridImage} />
                  ) : (
                    <View style={styles.videoFallback}>
                      <Ionicons color={colors.inkInvert} name="play-circle" size={28} />
                    </View>
                  )}
                  {tagMeta ? (
                    <>
                      <View style={styles.gridShade} />
                      <View style={styles.overlayBadge}>
                        <AppText color="inverse" numberOfLines={1} variant="caption">
                          {tagMeta.label}
                        </AppText>
                      </View>
                    </>
                  ) : null}
                  {item.is_featured ? (
                    <View style={styles.featuredBadge}>
                      <Ionicons color={colors.inkInvert} name="pin" size={12} />
                    </View>
                  ) : null}
                  {item.type === "video" ? (
                    <View style={styles.videoBadge}>
                      <Ionicons color={colors.inkInvert} name="play" size={12} />
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
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
              ? "Pubblica contenuti istituzionali, scouting o club per completare il profilo dirigente."
              : "Questo dirigente non ha ancora pubblicato contenuti."}
          </AppText>
          {mode === "owner" ? (
            <Button
              accessibilityLabel="Aggiungi contenuto media dirigente"
              label="Pubblica contenuto"
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
          <SafeAreaView style={styles.viewerRoot}>
            <View style={styles.viewerHeader}>
              <Pressable
                accessibilityLabel="Chiudi contenuto media dirigente"
                hitSlop={8}
                onPress={handleCloseViewer}
                style={({ pressed }) => [
                  styles.viewerHeaderButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
              </Pressable>

              <AppText variant="titleSm">Contenuto</AppText>

              {mode === "owner" ? (
                <View style={styles.viewerHeaderActions}>
                  <Pressable
                    accessibilityLabel={
                      currentViewerItem.is_featured
                        ? "Rimuovi evidenza contenuto dirigente"
                        : "Metti in evidenza contenuto dirigente"
                    }
                    hitSlop={8}
                    onPress={handleToggleFeaturedCurrentItem}
                    style={({ pressed }) => [
                      styles.viewerHeaderButton,
                      currentViewerItem.is_featured ? styles.viewerHeaderButtonActive : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Ionicons
                      color={currentViewerItem.is_featured ? colors.inkInvert : colors.textPrimary}
                      name={currentViewerItem.is_featured ? "pin" : "pin-outline"}
                      size={18}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Modifica contenuto media dirigente"
                    hitSlop={8}
                    onPress={handleEditCurrentItem}
                    style={({ pressed }) => [
                      styles.viewerHeaderButton,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Ionicons color={colors.textPrimary} name="create-outline" size={18} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Elimina contenuto media dirigente"
                    hitSlop={8}
                    onPress={handleDeleteCurrentItem}
                    style={({ pressed }) => [
                      styles.viewerHeaderButton,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Ionicons color={colors.danger} name="trash-outline" size={18} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.viewerHeaderSpacer} />
              )}
            </View>

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
              {orderedItems.map((item) => {
                const tagMeta = getDirectorMediaTagMeta(item.tag);
                const previewUri = getDirectorMediaPreviewUri(item);
                const isLiked = likedIds.has(item.id);
                const isSaved = savedIds.has(item.id);

                return (
                  <View
                    key={item.id}
                    style={[styles.viewerPage, { height: viewerPageHeight || undefined }]}
                  >
                    <View style={styles.viewerMediaFrame}>
                      {previewUri ? (
                        <Image source={{ uri: previewUri }} style={styles.viewerMedia} />
                      ) : (
                        <View style={styles.viewerVideoFallback}>
                          <Ionicons color={colors.inkInvert} name="play-circle" size={48} />
                          <AppText color="inverse" variant="bodySm">
                            Video media
                          </AppText>
                        </View>
                      )}

                      {item.type === "video" ? (
                        <Pressable
                          accessibilityLabel="Riproduci video media dirigente"
                          onPress={() => {
                            setSelectedItemId(item.id);
                            setIsVideoPlayerOpen(true);
                          }}
                          style={({ pressed }) => [
                            styles.viewerPlayButton,
                            pressed ? styles.pressed : null,
                          ]}
                        >
                          <Ionicons color={colors.inkInvert} name="play" size={32} />
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={styles.viewerSheet}>
                      <View style={styles.viewerAuthorRow}>
                        <Avatar name={authorName} size="sm" uri={authorAvatarUrl} />
                        <View style={styles.viewerAuthorText}>
                          <AppText variant="titleSm">{authorName}</AppText>
                          <AppText color="secondary" variant="caption">
                            Profilo dirigente
                          </AppText>
                        </View>
                      </View>

                      <View style={styles.feedActions}>
                        <FeedAction
                          accessibilityLabel="Metti like al contenuto"
                          active={isLiked}
                          activeIcon="heart"
                          icon="heart-outline"
                          label={isLiked ? "1" : "0"}
                          onPress={() => handleToggleSet(item.id, setLikedIds)}
                        />
                        <FeedAction
                          accessibilityLabel="Apri commenti contenuto"
                          icon="chatbubble-outline"
                          label="0"
                          onPress={handleOpenComments}
                        />
                        <FeedAction
                          accessibilityLabel="Salva contenuto"
                          active={isSaved}
                          activeIcon="bookmark"
                          icon="bookmark-outline"
                          onPress={() => handleToggleSet(item.id, setSavedIds)}
                        />
                      </View>

                      {tagMeta ? (
                        <View style={styles.viewerChip}>
                          <AppText color="accentStrong" variant="caption">
                            {tagMeta.label}
                          </AppText>
                        </View>
                      ) : null}

                      {item.description ? (
                        <AppText style={styles.viewerDescription} variant="bodySm">
                          {item.description}
                        </AppText>
                      ) : null}

                      {item.linked_targets.length > 0 ? (
                        <View style={styles.viewerLinkedBox}>
                          <AppText color="secondary" style={styles.viewerLinkedTitle} variant="caption">
                            Profili collegati
                          </AppText>
                          <View style={styles.viewerLinkedList}>
                            {item.linked_targets.map((target) => (
                              <Pressable
                                accessibilityLabel={`Apri ${target.display_name}`}
                                accessibilityRole="button"
                                key={`${item.id}-${target.target_type}-${target.target_id}`}
                                onPress={() => onOpenLinkedTarget?.(target)}
                                style={({ pressed }) => [
                                  styles.viewerLinkedItem,
                                  pressed ? styles.pressed : null,
                                ]}
                              >
                                <Avatar
                                  name={target.display_name}
                                  size="sm"
                                  square={target.target_type === "club"}
                                  uri={target.avatar_url}
                                />
                                <View style={styles.viewerLinkedText}>
                                  <AppText numberOfLines={1} variant="bodySm">
                                    {target.display_name}
                                  </AppText>
                                  {target.subtitle ? (
                                    <AppText color="secondary" numberOfLines={1} variant="caption">
                                      {target.subtitle}
                                    </AppText>
                                  ) : null}
                                </View>
                                <Ionicons
                                  color={colors.textMuted}
                                  name={target.target_type === "club" ? "business-outline" : "person-outline"}
                                  size={16}
                                />
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <VideoPlayerModal
              onClose={() => setIsVideoPlayerOpen(false)}
              title={getDirectorMediaTagMeta(currentViewerItem.tag)?.label ?? "Media dirigente"}
              url={currentViewerItem.url}
              visible={isVideoPlayerOpen && currentViewerItem.type === "video"}
            />
          </SafeAreaView>
        ) : null}
      </Modal>
    </View>
  );
}

function FeedAction({
  accessibilityLabel,
  active = false,
  activeIcon,
  icon,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  active?: boolean;
  activeIcon?: ComponentProps<typeof Ionicons>["name"];
  icon: ComponentProps<typeof Ionicons>["name"];
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.feedAction, pressed ? styles.pressed : null]}
    >
      <Ionicons
        color={active ? colors.accent : colors.textPrimary}
        name={active && activeIcon ? activeIcon : icon}
        size={22}
      />
      {label ? (
        <AppText color="secondary" variant="caption">
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function compareDirectorMediaItems(
  left: DirectorMediaItemRecord,
  right: DirectorMediaItemRecord,
) {
  if (left.is_featured !== right.is_featured) {
    return left.is_featured ? -1 : 1;
  }

  const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
  const rightTime = right.created_at ? Date.parse(right.created_at) : 0;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return right.id.localeCompare(left.id);
}

function getDirectorMediaPreviewUri(item: DirectorMediaItemRecord) {
  if (item.thumbnail_url) {
    return item.thumbnail_url;
  }

  return item.type === "image" ? item.url : null;
}

const styles = StyleSheet.create({
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[36],
  },
  emptySubtitle: {
    maxWidth: 280,
    textAlign: "center",
  },
  emptyTitle: {
    textAlign: "center",
  },
  featuredBadge: {
    alignItems: "center",
    backgroundColor: "rgba(10, 102, 194, 0.88)",
    borderRadius: radius.full,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: spacing[6],
    top: spacing[6],
    width: 22,
  },
  feedAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    minHeight: 32,
  },
  feedActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[18],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    paddingHorizontal: GRID_PADDING,
    paddingVertical: spacing[12],
  },
  gridCell: {
    overflow: "hidden",
  },
  gridImage: {
    height: "100%",
    width: "100%",
  },
  gridItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    overflow: "hidden",
    position: "relative",
  },
  gridShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.14)",
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  headerText: {
    flex: 1,
    gap: spacing[4],
  },
  overlayBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    borderRadius: radius[4],
    left: spacing[6],
    maxWidth: "72%",
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    position: "absolute",
    top: spacing[6],
  },
  pressed: {
    opacity: 0.82,
  },
  root: {
    backgroundColor: "#F7FAFD",
    flex: 1,
    paddingBottom: spacing[20],
  },
  videoBadge: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    borderRadius: radius.full,
    bottom: spacing[6],
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: spacing[6],
    width: 22,
  },
  videoFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: colors.accentStrong,
    justifyContent: "center",
  },
  viewerAuthorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
  },
  viewerAuthorText: {
    flex: 1,
    gap: spacing[4],
  },
  viewerChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[6],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  viewerDescription: {
    lineHeight: 22,
  },
  viewerHeader: {
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderBottomColor: "#00000014",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    height: VIEWER_HEADER_HEIGHT,
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
  },
  viewerHeaderActions: {
    flexDirection: "row",
    gap: spacing[8],
  },
  viewerHeaderButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  viewerHeaderButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  viewerHeaderSpacer: {
    width: 36,
  },
  viewerLinkedBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    gap: spacing[10],
    padding: spacing[12],
  },
  viewerLinkedItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    minHeight: 44,
  },
  viewerLinkedList: {
    gap: spacing[8],
  },
  viewerLinkedText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  viewerLinkedTitle: {
    fontWeight: "700",
    textTransform: "uppercase",
  },
  viewerMedia: {
    height: "100%",
    width: "100%",
  },
  viewerMediaFrame: {
    alignSelf: "stretch",
    aspectRatio: 4 / 5,
    backgroundColor: colors.surfaceMuted,
    position: "relative",
  },
  viewerPage: {
    backgroundColor: "#F7FAFD",
  },
  viewerPlayButton: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    borderRadius: radius.full,
    height: 64,
    justifyContent: "center",
    left: "50%",
    marginLeft: -32,
    marginTop: -32,
    position: "absolute",
    top: "50%",
    width: 64,
  },
  viewerRoot: {
    backgroundColor: "#F7FAFD",
    flex: 1,
  },
  viewerSheet: {
    backgroundColor: "#F7FAFD",
    gap: spacing[14],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  viewerVideoFallback: {
    alignItems: "center",
    flex: 1,
    gap: spacing[10],
    justifyContent: "center",
    backgroundColor: colors.accentStrong,
  },
});
