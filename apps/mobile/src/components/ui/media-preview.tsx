import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../theme/tokens";
import { VideoPlayerModal } from "./video-player-modal";

type MediaPreviewProps = {
  emptyLabel?: string;
  label: string;
  mediaType?: "image" | "video";
  url: string | null | undefined;
};

type MediaGalleryPreviewProps = {
  emptyLabel?: string;
  label: string;
  urls: string[];
};

export function MediaPreview({
  emptyLabel = "Non caricato",
  label,
  mediaType = "image",
  url,
}: MediaPreviewProps) {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {url ? (
        mediaType === "video" ? (
          <>
            <Pressable
              accessibilityLabel={`Riproduci ${label.toLowerCase()}`}
              accessibilityRole="button"
              onPress={() => setIsPlayerOpen(true)}
              style={({ pressed }) => [styles.videoCard, pressed ? styles.pressed : null]}
            >
              <Ionicons color={colors.accentStrong} name="play-circle" size={40} />
              <Text style={styles.videoText}>Tocca per riprodurre</Text>
            </Pressable>
            <VideoPlayerModal
              onClose={() => setIsPlayerOpen(false)}
              title={label}
              url={url}
              visible={isPlayerOpen}
            />
          </>
        ) : (
          <Image
            accessibilityLabel={label}
            source={{ uri: url }}
            style={styles.imagePreview}
          />
        )
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons
            color={colors.textMuted}
            name={mediaType === "video" ? "videocam-outline" : "image-outline"}
            size={28}
          />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      )}
    </View>
  );
}

export function MediaGalleryPreview({
  emptyLabel = "Nessun file nella gallery",
  label,
  urls,
}: MediaGalleryPreviewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {urls.length > 0 ? (
        <View style={styles.galleryRow}>
          {urls.slice(0, 4).map((galleryUrl, index) => (
            <Image
              accessibilityLabel={`${label} ${index + 1}`}
              key={galleryUrl}
              source={{ uri: galleryUrl }}
              style={styles.galleryThumb}
            />
          ))}
          {urls.length > 4 ? (
            <View style={[styles.galleryThumb, styles.galleryOverflow]}>
              <Text style={styles.galleryOverflowText}>+{urls.length - 4}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons color={colors.textMuted} name="images-outline" size={28} />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[8],
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    gap: spacing[8],
    justifyContent: "center",
    paddingVertical: spacing[20],
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.fontSize[14],
  },
  galleryOverflow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
  },
  galleryOverflowText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
  },
  galleryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  galleryThumb: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    height: 80,
    width: 80,
  },
  imagePreview: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    height: 120,
    width: 120,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  pressed: {
    opacity: 0.8,
  },
  videoCard: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[12],
    gap: spacing[8],
    justifyContent: "center",
    paddingVertical: spacing[20],
  },
  videoText: {
    color: colors.accentStrong,
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.bold,
  },
});
