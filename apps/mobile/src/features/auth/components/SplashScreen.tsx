import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export function SplashScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={styles.logoBox}>
          <Ionicons name="football" size={40} color={colors.inkInvert} />
        </View>
        <AppText variant="displayLg" style={styles.title}>
          FootMe
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    gap: spacing[20],
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: radius[12],
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    letterSpacing: -0.5,
  },
});
