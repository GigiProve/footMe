import { Text, View } from "react-native";

import { colors, spacing, typography } from "../../../theme/tokens";

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing[32] }}>
      <Text style={{ color: colors.textMuted, fontSize: typography.fontSize[16] }}>
        {message}
      </Text>
    </View>
  );
}
