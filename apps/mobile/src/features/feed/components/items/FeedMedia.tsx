/**
 * Media di un elemento del Feed (HOM-01.1 §64).
 *
 * Proporzione fissa 16:9 invece di un'altezza fissa: l'immagine non si
 * schiaccia su uno schermo largo e lo spazio è riservato prima che arrivi, così
 * il caricamento non provoca salti (§42). Larghezza piena della colonna di
 * testo, radius moderato: nessuna miniatura rimpicciolita per far entrare più
 * informazioni.
 *
 * Per i video aggiunge il segno play e la durata, che sono ciò che dice la
 * tipologia senza un colore dedicato (§61).
 */

import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type FeedMediaProps = {
  uri: string;
  accessibilityLabel: string;
  isVideo?: boolean;
  duration?: string | null;
  onPress: () => void;
};

export function FeedMedia({
  uri,
  accessibilityLabel,
  isVideo = false,
  duration = null,
  onPress,
}: FeedMediaProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.frame}
      testID="feed-media"
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={{ uri }}
        style={styles.image}
      />

      {isVideo ? (
        <View style={styles.play}>
          <Ionicons color={colors.inkInvert} name="play" size={18} />
        </View>
      ) : null}

      {duration ? (
        <View style={styles.duration}>
          <AppText color="inverse" variant="feedMeta">
            {duration}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  duration: {
    backgroundColor: colors.surfaceOverlay,
    borderRadius: radius[4],
    bottom: spacing[8],
    paddingHorizontal: spacing[6],
    position: "absolute",
    right: spacing[8],
  },
  frame: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[8],
    marginTop: spacing[12],
    overflow: "hidden",
    width: "100%",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  play: {
    alignItems: "center",
    backgroundColor: colors.surfaceOverlay,
    borderRadius: radius.full,
    height: 44,
    justifyContent: "center",
    left: "50%",
    marginLeft: -22,
    marginTop: -22,
    position: "absolute",
    top: "50%",
    width: 44,
  },
});
