/**
 * Anteprima a tutto schermo del media toccato nel composer (HOM-06.1 §45–46,
 * §148–151).
 *
 * Il Feed non ha un viewer riusabile con URI locali: il dettaglio del Post
 * mostra i media inline e i video passano dal `VideoPlayerModal` condiviso. Qui
 * quindi:
 *  • video → lo stesso `VideoPlayerModal` (player `expo-video`, controlli
 *    nativi), con l'URI locale o, per i Post già pubblicati, l'URL remoto. Parte
 *    solo all'apertura del modale: nessun autoplay nel composer (§46);
 *  • immagine → un modale minimo, sfondo scuro, `contain`, un solo controllo
 *    «Chiudi».
 * Nessuna azione di modifica: rimozione e riordino restano sulla cella.
 */

import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { VideoPlayerModal } from "../../../components/ui/video-player-modal";
import { colors, radius, spacing } from "../../../theme/tokens";
import type { ComposerMediaItem } from "../composer-types";

type ComposerMediaPreviewProps = {
  /** `null` = chiuso. */
  item: ComposerMediaItem | null;
  onClose: () => void;
};

/** Il file da mostrare: quello locale appena scelto, altrimenti l'URL del Post pubblicato. */
export function previewUri(item: ComposerMediaItem): string | null {
  return item.localUri ?? item.remoteUrl;
}

export function ComposerMediaPreview({ item, onClose }: ComposerMediaPreviewProps) {
  const uri = item ? previewUri(item) : null;

  if (!item || !uri) {
    return null;
  }

  if (item.type === "video") {
    return <VideoPlayerModal onClose={onClose} title="Video" url={uri} visible />;
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Chiudi anteprima"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.close}
            testID="composer-media-preview-close"
          >
            <Ionicons color={colors.inkInvert} name="close" size={22} />
          </Pressable>
        </View>
        <View style={styles.stage}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Anteprima della foto"
            resizeMode="contain"
            source={{ uri }}
            style={styles.image}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: {
    alignItems: "center",
    backgroundColor: colors.mediaBadgeSurface,
    borderRadius: radius.full,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  header: {
    alignItems: "flex-start",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  image: {
    flex: 1,
    width: "100%",
  },
  root: {
    backgroundColor: colors.surfaceInverse,
    flex: 1,
  },
  stage: {
    flex: 1,
  },
});
