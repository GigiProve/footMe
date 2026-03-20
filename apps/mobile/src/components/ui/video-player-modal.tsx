import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Video, ResizeMode } from "expo-av";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../theme/tokens";

type VideoPlayerModalProps = {
  onClose: () => void;
  title?: string;
  url: string;
  visible: boolean;
};

export function VideoPlayerModal({
  onClose,
  title = "Video",
  url,
  visible,
}: VideoPlayerModalProps) {
  const videoRef = useRef<Video>(null);
  const [hasError, setHasError] = useState(false);

  function handleClose() {
    setHasError(false);
    onClose();
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Chiudi"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleClose}
            style={styles.closeButton}
          >
            <Ionicons color={colors.textPrimary} name="close" size={24} />
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.videoContainer}>
          {hasError ? (
            <View style={styles.errorContainer}>
              <Ionicons color={colors.textMuted} name="alert-circle-outline" size={48} />
              <Text style={styles.errorText}>
                Impossibile riprodurre il video.
              </Text>
            </View>
          ) : (
            <>
              <ActivityIndicator color={colors.accent} size="large" style={styles.loader} />
              <Video
                ref={videoRef}
                onError={() => setHasError(true)}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                source={{ uri: url }}
                style={styles.video}
                useNativeControls
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  errorContainer: {
    alignItems: "center",
    gap: spacing[12],
    justifyContent: "center",
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[16],
  },
  header: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  headerSpacer: {
    width: 44,
  },
  loader: {
    position: "absolute",
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.heavy,
    textAlign: "center",
  },
  video: {
    height: "100%",
    width: "100%",
  },
  videoContainer: {
    alignItems: "center",
    backgroundColor: "#000",
    flex: 1,
    justifyContent: "center",
  },
});
