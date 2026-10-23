import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { roleRowMeta } from "../roles-presentation";

type Props = {
  adminsCount: number;
  areasEnabled: number;
  name: string;
  onPress: () => void;
  showDivider?: boolean;
  testID?: string;
};

export function RoleListRow({
  adminsCount,
  areasEnabled,
  name,
  onPress,
  showDivider = false,
  testID,
}: Props) {
  const meta = roleRowMeta({ adminsCount, areasEnabled });

  return (
    <Pressable
      accessibilityHint="Apre la configurazione del ruolo"
      accessibilityLabel={`${name}, ${meta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, showDivider ? styles.divider : null]}
      testID={testID}
    >
      <Ionicons color={colors.textNeutral} name="shield-outline" size={20} />
      <View style={styles.content}>
        <AppText color="neutral" numberOfLines={2} variant="bodyLg">
          {name}
        </AppText>
        <AppText color="neutralMuted" variant="meta">
          {meta}
        </AppText>
      </View>
      <Ionicons
        color={colors.textNeutralSoft}
        name="chevron-forward"
        size={18}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  divider: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    gap: spacing[4],
  },
});
