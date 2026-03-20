import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button, Card } from "../../ui";
import { VideoPlayerModal } from "./video-player-modal";

type MediaPickerFieldProps = {
  buttonLabel: string;
  helperText?: string;
  isUploading?: boolean;
  label: string;
  mediaType?: "image" | "video";
  onPick: () => void;
  onRemove?: () => void;
  previewLabel?: string;
  previewUrl?: string | null;
  removable?: boolean;
  removeLabel?: string;
  selectedCount?: number;
  selectedLabel?: string;
};

export function MediaPickerField({
  buttonLabel,
  helperText,
  isUploading = false,
  label,
  mediaType = "image",
  onPick,
  onRemove,
  previewLabel,
  previewUrl,
  removable = false,
  removeLabel = "Rimuovi",
  selectedCount,
  selectedLabel,
}: MediaPickerFieldProps) {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const hasMedia = Boolean(previewUrl) || (selectedCount != null && selectedCount > 0);
  const canRemove = removable && hasMedia && onRemove != null;
  const isVideo = mediaType === "video";
  const hasVideoUrl = isVideo && Boolean(previewUrl);

  return (
    <View style={{ gap: spacing[8] }}>
      <Text style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.bold }}>
        {label}
      </Text>
      <Card style={{ gap: spacing[12] }}>
        {previewUrl ? (
          isVideo ? (
            <>
              <Pressable
                accessibilityLabel={`Riproduci ${label.toLowerCase()}`}
                accessibilityRole="button"
                onPress={() => setIsPlayerOpen(true)}
                style={({ pressed }) => [
                  {
                    alignItems: "center",
                    backgroundColor: colors.accentSoft,
                    borderRadius: radius[20],
                    gap: spacing[8],
                    justifyContent: "center",
                    paddingVertical: spacing[20],
                    width: "100%",
                  },
                  pressed ? { opacity: 0.8 } : null,
                ]}
                testID="media-picker-video-preview"
              >
                <Ionicons color={colors.accentStrong} name="play-circle" size={40} />
                <Text style={{ color: colors.accentStrong, fontWeight: typography.fontWeight.bold }}>
                  Tocca per riprodurre
                </Text>
              </Pressable>
            </>
          ) : (
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: radius[20],
                overflow: "hidden",
                backgroundColor: colors.surfaceMuted,
              }}
              testID="media-picker-preview-frame"
            >
              <Image
                accessibilityLabel={previewLabel ?? `Anteprima ${label.toLowerCase()}`}
                source={{ uri: previewUrl }}
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: colors.surfaceMuted,
                }}
              />
            </View>
          )
        ) : null}

        <Text style={{ color: colors.textSecondary, lineHeight: 22 }}>
          {selectedLabel ??
            (selectedCount && selectedCount > 0
              ? `${selectedCount} file selezionati`
              : helperText ?? "Nessun file selezionato")}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing[10] }}>
          <View style={{ flex: 1 }}>
            <Button
              disabled={isUploading}
              label={isUploading ? "Caricamento..." : buttonLabel}
              onPress={onPick}
              variant="secondary"
            />
          </View>
          {canRemove ? (
            <View style={{ flex: 1 }}>
              <Button
                disabled={isUploading}
                label={removeLabel}
                onPress={onRemove}
                variant="danger"
              />
            </View>
          ) : null}
        </View>
      </Card>

      {hasVideoUrl ? (
        <VideoPlayerModal
          onClose={() => setIsPlayerOpen(false)}
          title={label}
          url={previewUrl!}
          visible={isPlayerOpen}
        />
      ) : null}
    </View>
  );
}
