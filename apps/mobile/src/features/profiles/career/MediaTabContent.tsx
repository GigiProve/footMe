import { type ComponentProps, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { VideoPlayerModal } from "../../../components/ui/video-player-modal";

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
  tag: MediaContentTag;
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
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  function handleOpenItem(itemId: string) {
    setSelectedItemId(itemId);
  }

  function handleCloseViewer() {
    setSelectedItemId(null);
    setIsVideoPlayerOpen(false);
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
    if (!selectedItem) {
      return;
    }

    Alert.alert(
      "Modifica contenuto",
      `La scheda di modifica per "${selectedItem.tag.label}" verra' collegata al form media dedicato.`,
    );
  }

  function handleOpenComments() {
    if (!selectedItem) {
      return;
    }

    Alert.alert(
      "Commenti",
      `Apri la lista completa dei ${selectedItem.commentCount} commenti.`,
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="titleSm">Media</AppText>
        {mode === "owner" ? (
          <Button
            accessibilityLabel="Aggiungi contenuto"
            label="+ Aggiungi contenuto"
            onPress={handleAddContent}
            size="sm"
            variant="primary"
          />
        ) : null}
      </View>

      {items.length > 0 ? (
        <View style={styles.grid} testID="media-grid">
          {items.map((item) => (
            <View key={item.id} style={styles.gridCell}>
              <Pressable
                accessibilityLabel={`Apri contenuto ${item.tag.label}`}
                onPress={() => handleOpenItem(item.id)}
                style={({ pressed }) => [
                  styles.gridItem,
                  pressed ? styles.pressed : null,
                ]}
                testID={`media-grid-item-${item.id}`}
              >
                <Image source={{ uri: item.thumbnailUrl }} style={styles.gridImage} />
                <View style={styles.tagBadge}>
                  <Ionicons color={colors.inkInvert} name={item.tag.icon} size={11} />
                  <AppText color="inverse" style={styles.tagText} variant="caption">
                    {item.tag.label}
                  </AppText>
                </View>
                {item.type === "video" ? (
                  <View style={styles.videoBadge}>
                    <Ionicons color={colors.inkInvert} name="play" size={12} />
                  </View>
                ) : null}
                {item.isFeatured ? (
                  <View style={styles.featuredBadge}>
                    <Ionicons color={colors.inkInvert} name="bookmark" size={12} />
                  </View>
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={handleCloseViewer}
        visible={selectedItem !== null}
      >
        {selectedItem ? (
          <SafeAreaView style={styles.viewerRoot}>
            <View style={styles.viewerHeader}>
              <Pressable
                accessibilityLabel="Chiudi contenuto media"
                hitSlop={8}
                onPress={handleCloseViewer}
                style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
              >
                <Ionicons color={colors.textPrimary} name="arrow-back" size={22} />
              </Pressable>
              <AppText variant="titleSm">{`Post di ${authorName}`}</AppText>
              <View style={styles.iconButtonPlaceholder} />
            </View>

            <ScrollView
              bounces={false}
              contentContainerStyle={styles.viewerContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.heroMedia}>
                <Image source={{ uri: selectedItem.thumbnailUrl }} style={styles.heroImage} />
                <View style={styles.viewerTagBadge}>
                  <Ionicons color={colors.inkInvert} name={selectedItem.tag.icon} size={14} />
                  <AppText color="inverse" style={styles.viewerTagText} variant="caption">
                    {selectedItem.tag.label}
                  </AppText>
                </View>
                {selectedItem.type === "video" ? (
                  <Pressable
                    accessibilityLabel="Riproduci video"
                    onPress={() => setIsVideoPlayerOpen(true)}
                    style={({ pressed }) => [
                      styles.videoPlayButton,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Ionicons color={colors.inkInvert} name="play" size={28} />
                  </Pressable>
                ) : null}
              </View>

              {mode === "owner" ? (
                <View style={styles.ownerActionsRow}>
                  <ActionChip
                    icon="create-outline"
                    label="Modifica"
                    onPress={handleEditItem}
                  />
                  <ActionChip
                    icon={selectedItem.isFeatured ? "bookmark-outline" : "bookmark"}
                    label={selectedItem.isFeatured ? "Rimuovi" : "Evidenza"}
                    onPress={() => handleToggleFeatured(selectedItem.id)}
                  />
                  <ActionChip
                    destructive
                    icon="trash-outline"
                    label="Elimina"
                    onPress={() => handleDeleteItem(selectedItem.id)}
                  />
                </View>
              ) : (
                <View style={styles.visitorActionsRow}>
                  <View style={styles.visitorPrimaryActions}>
                    <IconAction
                      accessibilityLabel="Metti like al contenuto"
                      active={selectedItem.isLiked}
                      activeIcon="heart"
                      icon="heart-outline"
                      onPress={() => handleToggleLike(selectedItem.id)}
                    />
                    <IconAction
                      accessibilityLabel="Apri commenti contenuto"
                      icon="chatbubble-outline"
                      onPress={handleOpenComments}
                    />
                  </View>
                  <IconAction
                    accessibilityLabel="Salva contenuto"
                    active={selectedItem.isSaved}
                    activeIcon="bookmark"
                    icon="bookmark-outline"
                    onPress={() => handleToggleSaved(selectedItem.id)}
                  />
                </View>
              )}

              <View style={styles.viewerMetaBlock}>
                <AppText variant="bodySm" style={styles.statsText}>
                  {`Piace a ${formatCount(selectedItem.likeCount)} persone • ${selectedItem.commentCount} commenti`}
                </AppText>
                <AppText variant="bodySm">
                  <AppText style={styles.authorText} variant="bodySm">
                    {authorName}
                  </AppText>{" "}
                  {selectedItem.description}
                </AppText>
              </View>

              <View style={styles.commentsBlock}>
                {selectedItem.comments.slice(0, 2).map((comment) => (
                  <AppText key={comment.id} variant="bodySm">
                    <AppText style={styles.authorText} variant="bodySm">
                      {comment.author}
                    </AppText>{" "}
                    {comment.text}
                  </AppText>
                ))}
                <Pressable
                  accessibilityLabel="Vedi tutti i commenti"
                  onPress={handleOpenComments}
                  style={({ pressed }) => [styles.viewAllButton, pressed ? styles.pressed : null]}
                >
                  <AppText color="secondary" variant="bodySm">
                    {`Vedi tutti i ${selectedItem.commentCount} commenti`}
                  </AppText>
                </Pressable>
              </View>
            </ScrollView>

            <VideoPlayerModal
              onClose={() => setIsVideoPlayerOpen(false)}
              title={selectedItem.tag.label}
              url={selectedItem.videoUrl ?? ""}
              visible={isVideoPlayerOpen}
            />
          </SafeAreaView>
        ) : null}
      </Modal>
    </View>
  );
}

function ActionChip({
  destructive = false,
  icon,
  label,
  onPress,
}: {
  destructive?: boolean;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.ownerAction,
        destructive ? styles.ownerActionDanger : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Ionicons
        color={destructive ? colors.danger : colors.textPrimary}
        name={icon}
        size={16}
      />
      <AppText
        color={destructive ? "danger" : "primary"}
        style={styles.ownerActionText}
        variant="caption"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function IconAction({
  accessibilityLabel,
  active = false,
  activeIcon,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  active?: boolean;
  activeIcon?: ComponentProps<typeof Ionicons>["name"];
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}
    >
      <Ionicons
        color={active ? colors.accent : colors.textPrimary}
        name={active && activeIcon ? activeIcon : icon}
        size={24}
      />
    </Pressable>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("it-IT").format(value);
}

const styles = StyleSheet.create({
  authorText: {
    fontWeight: "700",
  },
  commentsBlock: {
    gap: spacing[8],
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[16],
  },
  featuredBadge: {
    alignItems: "center",
    backgroundColor: colors.accent,
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroMedia: {
    aspectRatio: 4 / 5,
    backgroundColor: colors.hero,
    overflow: "hidden",
    position: "relative",
  },
  iconButton: {
    alignItems: "center",
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  iconButtonPlaceholder: {
    width: 36,
  },
  ownerAction: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    flex: 1,
    flexDirection: "row",
    gap: spacing[6],
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[10],
  },
  ownerActionDanger: {
    backgroundColor: colors.dangerSoft,
  },
  ownerActionText: {
    fontWeight: "700",
  },
  ownerActionsRow: {
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
  },
  pressed: {
    opacity: 0.82,
  },
  root: {
    backgroundColor: colors.surface,
    paddingBottom: spacing[20],
  },
  statsText: {
    fontWeight: "700",
  },
  tagBadge: {
    alignItems: "center",
    backgroundColor: "rgba(11, 43, 64, 0.74)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radius[6],
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    left: spacing[6],
    paddingHorizontal: spacing[6],
    paddingVertical: 4,
    position: "absolute",
    top: spacing[6],
  },
  tagText: {
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
    backgroundColor: "rgba(11, 43, 64, 0.5)",
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
  viewAllButton: {
    paddingVertical: spacing[4],
  },
  viewerContent: {
    paddingBottom: spacing[24],
  },
  viewerHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  viewerMetaBlock: {
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  viewerRoot: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  viewerTagBadge: {
    alignItems: "center",
    backgroundColor: "rgba(11, 43, 64, 0.74)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[6],
    left: spacing[16],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    position: "absolute",
    top: spacing[16],
  },
  viewerTagText: {
    fontWeight: "700",
  },
  visitorActionsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingTop: spacing[14],
  },
  visitorPrimaryActions: {
    flexDirection: "row",
    gap: spacing[14],
  },
});
