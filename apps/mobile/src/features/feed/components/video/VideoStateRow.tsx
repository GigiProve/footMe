/**
 * Stato di un video che non si può riprodurre (HOM-03 §60–70, §110–114).
 *
 * Una riga compatta — icona leggera, titolo breve, helper — e non un rettangolo
 * grigio da schermo intero (§111–112). Mai un Play (§62, §67): il resto del Post
 * resta intero (§63, §68). Il copy è quello definitivo del §113 e non mostra mai
 * codici o enum (§114). Stesso aspetto per «in elaborazione» e «non
 * disponibile»: cambia l'icona (spinner o camera barrata) e il testo.
 */

import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  videoStateAccessibilityLabel,
  videoStateCopy,
  type VideoMediaState,
} from "../../feed-video-presentation";

type VideoStateRowProps = {
  state: Exclude<VideoMediaState, "ready">;
  style?: StyleProp<ViewStyle>;
};

export function VideoStateRow({ state, style }: VideoStateRowProps) {
  const copy = videoStateCopy(state);

  if (!copy) {
    return null;
  }

  return (
    <View
      accessibilityLabel={videoStateAccessibilityLabel(state) ?? undefined}
      accessible
      style={[styles.row, style]}
      testID="feed-video-state"
    >
      {state === "processing" ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : (
        <Ionicons color={colors.textMuted} name="videocam-off-outline" size={26} />
      )}
      <View style={styles.text}>
        <AppText numberOfLines={2} variant="actionLabel">
          {copy.title}
        </AppText>
        <AppText color="secondary" numberOfLines={2} variant="bodySm">
          {copy.helper}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Elevazione = hairline, non ombra; radius dei media (8), non quello dei moduli.
  row: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
    width: "100%",
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
