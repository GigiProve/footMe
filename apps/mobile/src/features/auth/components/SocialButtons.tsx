import { Platform, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui";
import { authStyles } from "./auth-styles";

type SocialButtonsProps = {
  loading: "apple" | "google" | null;
  onApple: () => void;
  onGoogle: () => void;
};

export function SocialButtons({ loading, onApple, onGoogle }: SocialButtonsProps) {
  return (
    <View style={styles.container}>
      <Button
        disabled={loading !== null}
        label={loading === "google" ? "Connessione a Google..." : "Continua con Google"}
        leftIcon={<Ionicons name="logo-google" size={20} color={colors.textPrimary} />}
        onPress={onGoogle}
        size="lg"
        style={authStyles.socialButton}
        textStyle={styles.socialText}
        variant="outline"
      />
      {Platform.OS === "ios" ? (
        <Button
          disabled={loading !== null}
          label={loading === "apple" ? "Connessione ad Apple..." : "Continua con Apple"}
          leftIcon={<Ionicons name="logo-apple" size={20} color={colors.inkInvert} />}
          onPress={onApple}
          size="lg"
          style={authStyles.socialButtonDark}
          textStyle={styles.socialDarkText}
          variant="outline"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
  },
  socialText: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  socialDarkText: {
    color: colors.inkInvert,
    fontWeight: "600",
  },
});
