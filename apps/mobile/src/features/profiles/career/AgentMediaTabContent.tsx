import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { VideoPlayerModal } from "../../../components/ui/video-player-modal";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../ui";
import {
  getAgentMediaOperationTypeMeta,
  getAgentMediaTagMeta,
  type AgentMediaItemRecord,
} from "../agent-media";

type AgentMediaViewerMode = "owner" | "visitor";

type AgentMediaTabContentProps = {
  authorAvatarUrl: string | null;
  authorName: string;
  initialItems?: AgentMediaItemRecord[];
  mode: AgentMediaViewerMode;
  onAddContentPress?: () => void;
  onDeleteContentPress?: (itemId: string) => void;
  onEditContentPress?: (itemId: string) => void;
};

const GRID_GAP = 4;
const GRID_PADDING = spacing[20];
const VIEWER_HEADER_HEIGHT = 68;

export function AgentMediaTabContent({
  authorAvatarUrl,
  authorName,
  initialItems = [],
  mode,
  onAddContentPress,
  onDeleteContentPress,
  onEditContentPress,
}: AgentMediaTabContentProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeViewerIndex, setActiveViewerIndex] = useState(0);
  const [isGridInteractionLocked, setIsGridInteractionLocked] = useState(false);
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);
  const closeLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViewerCloseAtRef = useRef(0);
  const viewerScrollRef = useRef<ScrollView | null>(null);
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();

  const orderedItems = useMemo(
    () => [...initialItems].sort(compareAgentMediaByRecency),
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

    Alert.alert("Portfolio media", "Il composer del contenuto non è collegato.");
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

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="titleSm">Media</AppText>
          <AppText color="secondary" variant="bodySm">
            Portfolio dinamico di operazioni, firme e contenuti professionali.
          </AppText>
        </View>
        {mode === "owner" ? (
          <Button
            accessibilityLabel="Aggiungi contenuto media agente"
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
          testID="agent-media-grid"
        >
          {orderedItems.map((item) => {
            const badgeLabel =
              getAgentMediaTagMeta(item.tag)?.label ??
              getAgentMediaOperationTypeMeta(item.operation_type)?.label ??
              null;
            const previewUri = getAgentMediaPreviewUri(item);

            return (
              <View key={item.id} style={[styles.gridCell, { width: gridItemSize }]}>
                <Pressable
                  accessibilityLabel={`Apri contenuto media agente ${item.id}`}
                  disabled={isGridInteractionLocked}
                  onPress={() => handleOpenItem(item.id)}
                  style={({ pressed }) => [
                    styles.gridItem,
                    { height: gridItemSize },
                    pressed ? styles.pressed : null,
                  ]}
                  testID={`agent-media-grid-item-${item.id}`}
                >
                  {previewUri ? (
                    <Image source={{ uri: previewUri }} style={styles.gridImage} />
                  ) : (
                    <View style={styles.videoFallback}>
                      <Ionicons color={colors.inkInvert} name="play-circle" size={28} />
                    </View>
                  )}
                  <View style={styles.gridShade} />
                  {badgeLabel ? (
                    <View style={styles.overlayBadge}>
                      <AppText color="inverse" numberOfLines={1} variant="caption">
                        {badgeLabel}
                      </AppText>
                    </View>
                  ) : null}
                  {item.type === "video" ? (
                    <View style={styles.videoBadge}>
                      <Ionicons color={colors.inkInvert} name="play" size={12} />
                    </View>
                  ) : null}
                  {item.tagged_players.length > 0 ? (
                    <View style={styles.playersBadge}>
                      <Ionicons color={colors.inkInvert} name="people" size={12} />
                      <AppText color="inverse" variant="caption">
                        {String(item.tagged_players.length)}
                      </AppText>
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
            Nessun contenuto pubblicato
          </AppText>
          <AppText color="secondary" style={styles.emptySubtitle} variant="bodySm">
            {mode === "owner"
              ? "Carica foto e video per costruire un portfolio agente credibile e aggiornato."
              : "Questo agente non ha ancora contenuti nel portfolio media."}
          </AppText>
          {mode === "owner" ? (
            <Button
              accessibilityLabel="Aggiungi contenuto media agente"
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
                accessibilityLabel="Chiudi portfolio media agente"
                hitSlop={8}
                onPress={handleCloseViewer}
                style={({ pressed }) => [
                  styles.viewerHeaderButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
              </Pressable>

              <AppText variant="titleSm">Media</AppText>

              {mode === "owner" ? (
                <View style={styles.viewerHeaderActions}>
                  <Pressable
                    accessibilityLabel="Modifica contenuto media agente"
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
                    accessibilityLabel="Elimina contenuto media agente"
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
                const tagMeta = getAgentMediaTagMeta(item.tag);
                const operationMeta = getAgentMediaOperationTypeMeta(item.operation_type);
                const previewUri = getAgentMediaPreviewUri(item);

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
                            Video portfolio
                          </AppText>
                        </View>
                      )}

                      {item.type === "video" ? (
                        <Pressable
                          accessibilityLabel="Riproduci video portfolio agente"
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
                            Portfolio agente
                          </AppText>
                        </View>
                      </View>

                      {tagMeta || operationMeta ? (
                        <View style={styles.viewerChipRow}>
                          {tagMeta ? (
                            <View style={styles.viewerChip}>
                              <AppText color="accentStrong" variant="caption">
                                {tagMeta.label}
                              </AppText>
                            </View>
                          ) : null}
                          {operationMeta ? (
                            <View style={styles.viewerChip}>
                              <AppText color="accentStrong" variant="caption">
                                {operationMeta.label}
                              </AppText>
                            </View>
                          ) : null}
                        </View>
                      ) : null}

                      {item.tagged_players.length > 0 ? (
                        <View style={styles.viewerSection}>
                          <AppText color="secondary" variant="caption">
                            Calciatori collegati
                          </AppText>
                          <View style={styles.viewerPlayersWrap}>
                            {item.tagged_players.map((player) => (
                              <View key={`${item.id}-${player.profile_id}`} style={styles.viewerPlayerChip}>
                                <Avatar
                                  name={player.display_name}
                                  size="sm"
                                  uri={player.avatar_url}
                                />
                                <AppText variant="bodySm">{player.display_name}</AppText>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      {item.description ? (
                        <View style={styles.viewerSection}>
                          <AppText color="secondary" variant="caption">
                            Descrizione
                          </AppText>
                          <AppText style={styles.viewerDescription} variant="bodySm">
                            {item.description}
                          </AppText>
                        </View>
                      ) : (
                        <View style={styles.viewerSection}>
                          <AppText color="secondary" variant="bodySm">
                            Nessuna descrizione aggiunta per questo contenuto.
                          </AppText>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <VideoPlayerModal
              onClose={() => setIsVideoPlayerOpen(false)}
              title={currentViewerItem.description || "Media portfolio"}
              url={currentViewerItem.url}
              visible={isVideoPlayerOpen && currentViewerItem.type === "video"}
            />
          </SafeAreaView>
        ) : null}
      </Modal>
    </View>
  );
}

function compareAgentMediaByRecency(left: AgentMediaItemRecord, right: AgentMediaItemRecord) {
  const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
  const rightTime = right.created_at ? Date.parse(right.created_at) : 0;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return right.id.localeCompare(left.id);
}

function getAgentMediaPreviewUri(item: AgentMediaItemRecord) {
  if (item.thumbnail_url) {
    return item.thumbnail_url;
  }

  return item.type === "image" ? item.url : null;
}

const styles = StyleSheet.create({
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius[16],
    gap: spacing[12],
    marginHorizontal: spacing[20],
    marginTop: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[24],
  },
  emptySubtitle: {
    textAlign: "center",
  },
  emptyTitle: {
    textAlign: "center",
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
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
  },
  headerText: {
    flex: 1,
    gap: spacing[4],
  },
  overlayBadge: {
    backgroundColor: "rgba(11, 43, 64, 0.82)",
    borderRadius: radius[6],
    left: spacing[8],
    maxWidth: "72%",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    position: "absolute",
    top: spacing[8],
  },
  playersBadge: {
    alignItems: "center",
    backgroundColor: "rgba(11, 43, 64, 0.82)",
    borderRadius: radius.full,
    bottom: spacing[8],
    flexDirection: "row",
    gap: spacing[4],
    left: spacing[8],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    position: "absolute",
  },
  pressed: {
    opacity: 0.82,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  videoBadge: {
    alignItems: "center",
    backgroundColor: "rgba(11, 43, 64, 0.82)",
    borderRadius: radius.full,
    justifyContent: "center",
    padding: spacing[6],
    position: "absolute",
    right: spacing[8],
    top: spacing[8],
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
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  viewerChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  viewerDescription: {
    lineHeight: 22,
  },
  viewerHeader: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    height: VIEWER_HEADER_HEIGHT,
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
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
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  viewerHeaderSpacer: {
    width: 38,
  },
  viewerMedia: {
    height: "100%",
    width: "100%",
  },
  viewerMediaFrame: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[16],
    height: "58%",
    overflow: "hidden",
    position: "relative",
  },
  viewerPage: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    paddingBottom: spacing[20],
  },
  viewerPlayButton: {
    alignItems: "center",
    backgroundColor: "rgba(11, 43, 64, 0.6)",
    borderRadius: radius.full,
    height: 68,
    justifyContent: "center",
    left: "50%",
    marginLeft: -34,
    marginTop: -34,
    position: "absolute",
    top: "50%",
    width: 68,
  },
  viewerPlayerChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  viewerPlayersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  viewerRoot: {
    backgroundColor: colors.background,
    flex: 1,
  },
  viewerSection: {
    gap: spacing[8],
  },
  viewerSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius[16],
    flex: 1,
    gap: spacing[16],
    marginTop: spacing[14],
    padding: spacing[16],
  },
  viewerVideoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentStrong,
    flex: 1,
    gap: spacing[10],
    justifyContent: "center",
  },
});
