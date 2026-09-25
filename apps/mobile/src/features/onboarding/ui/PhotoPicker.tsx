import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { ActionSheet, AppText, Button } from "../../../ui";
import { InlineError } from "./InlineError";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

const PREVIEW_SIZE = 132;

type PhotoPickerProps = {
  /** URI dell'immagine già scelta. Vuoto quando lo stato è "empty". */
  value?: string | null;
  onPickFromLibrary: () => void;
  onTakePhoto: () => void;
  onRemove?: () => void;
  uploading?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  /** Cerchio per una foto profilo, quadrato arrotondato per un logo. */
  shape?: "circle" | "square";
  addLabel?: string;
  replaceLabel?: string;
  sheetTitle?: string;
  testID?: string;
};

/**
 * Caricamento di una foto profilo o di un logo (§S). Una sola azione
 * principale: il resto delle scelte vive nel bottom sheet.
 */
export function PhotoPicker({
  addLabel = "Aggiungi foto",
  errorMessage,
  onPickFromLibrary,
  onRemove,
  onRetry,
  onTakePhoto,
  replaceLabel = "Cambia foto",
  shape = "circle",
  sheetTitle = "Foto profilo",
  testID,
  uploading = false,
  value,
}: PhotoPickerProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const hasImage = Boolean(value);
  const isCircle = shape === "circle";

  const actions = [
    {
      icon: "images-outline" as const,
      label: "Scegli dalla galleria",
      onPress: () => {
        setIsSheetOpen(false);
        onPickFromLibrary();
      },
    },
    {
      icon: "camera-outline" as const,
      label: "Scatta una foto",
      onPress: () => {
        setIsSheetOpen(false);
        onTakePhoto();
      },
    },
    ...(hasImage && onRemove
      ? [
          {
            destructive: true,
            icon: "trash-outline" as const,
            label: "Rimuovi foto",
            onPress: () => {
              setIsSheetOpen(false);
              onRemove();
            },
          },
        ]
      : []),
  ];

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        accessibilityLabel={hasImage ? replaceLabel : addLabel}
        accessibilityRole="button"
        disabled={uploading}
        onPress={() => setIsSheetOpen(true)}
        style={[
          styles.preview,
          isCircle ? styles.previewCircle : styles.previewSquare,
          hasImage ? styles.previewFilled : null,
        ]}
      >
        {value ? (
          <Image source={{ uri: value }} style={styles.image} />
        ) : (
          <Ionicons
            color={colors.textMuted}
            name={isCircle ? "person-outline" : "image-outline"}
            size={34}
          />
        )}

        {uploading ? (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator color={colors.inkInvert} />
          </View>
        ) : null}

        <View style={styles.badge}>
          <Ionicons color={colors.inkInvert} name="camera" size={16} />
        </View>
      </Pressable>

      <Button
        disabled={uploading}
        label={hasImage ? replaceLabel : addLabel}
        onPress={() => setIsSheetOpen(true)}
        size="md"
        variant="secondary"
      />

      {errorMessage ? (
        <View style={styles.errorGroup}>
          <InlineError message={errorMessage} />
          {onRetry ? (
            <Button label="Riprova" onPress={onRetry} size="sm" variant="link" />
          ) : null}
        </View>
      ) : null}

      <ActionSheet
        actions={actions}
        onClose={() => setIsSheetOpen(false)}
        title={sheetTitle}
        visible={isSheetOpen}
      />
    </View>
  );
}

type PhotoTipsProps = {
  tips: string[];
};

/** Tre indicazioni brevi sotto l'anteprima. Nessun testo tecnico (§K). */
export function PhotoTips({ tips }: PhotoTipsProps) {
  return (
    <View style={styles.tips}>
      {tips.map((tip) => (
        <View key={tip} style={styles.tipRow}>
          <Ionicons color={colors.success} name="checkmark-circle" size={16} />
          <AppText color="secondary" style={styles.tipText} variant="meta">
            {tip}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: onboardingSpacing.m - 4,
  },
  preview: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: onboardingBorderWidth.selected,
    height: PREVIEW_SIZE,
    justifyContent: "center",
    overflow: "hidden",
    width: PREVIEW_SIZE,
  },
  previewCircle: {
    borderRadius: PREVIEW_SIZE / 2,
  },
  previewSquare: {
    borderRadius: onboardingRadius.card,
  },
  previewFilled: {
    borderColor: colors.accentSoftBorder,
  },
  image: {
    height: "100%",
    width: "100%",
  },
  uploadingOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(12,27,42,0.45)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: colors.surface,
    borderRadius: onboardingRadius.pill,
    borderWidth: 3,
    bottom: 2,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 34,
  },
  errorGroup: {
    alignItems: "center",
    gap: onboardingSpacing.xs,
  },
  tips: {
    alignSelf: "stretch",
    gap: onboardingSpacing.s,
  },
  tipRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: onboardingSpacing.s,
  },
  tipText: {
    flex: 1,
  },
});
