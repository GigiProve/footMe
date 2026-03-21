import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type ModalHeaderProps = {
  onClose: () => void;
  title: string;
};

export function ModalHeader({ onClose, title }: ModalHeaderProps) {
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel="Chiudi"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onClose}
        style={({ pressed }) => [
          styles.closeButton,
          pressed ? styles.pressed : null,
        ]}
      >
        <Ionicons color={colors.textPrimary} name="close" size={24} />
      </Pressable>
      <AppText variant="headingSm" align="center" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.82,
  },
  title: {
    flex: 1,
  },
  spacer: {
    width: 44,
  },
});
