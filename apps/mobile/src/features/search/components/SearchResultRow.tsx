import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius } from "../../../theme/tokens";
import { Avatar, ListItem } from "../../../ui";

type SearchResultRowProps = {
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  imageUrl?: string | null;
  onPress?: () => void;
  right?: ReactNode;
  showDivider?: boolean;
  squareAvatar?: boolean;
  subtitle?: string | null;
  subtitleNumberOfLines?: number;
  title: string;
};

export function SearchResultRow({
  fallbackIcon,
  imageUrl,
  onPress,
  right,
  showDivider,
  squareAvatar = false,
  subtitle,
  subtitleNumberOfLines = 1,
  title,
}: SearchResultRowProps) {
  const left =
    !imageUrl && fallbackIcon ? (
      <View style={styles.iconWrap}>
        <Ionicons color={colors.textMuted} name={fallbackIcon} size={18} />
      </View>
    ) : (
      <Avatar name={title} size="sm" square={squareAvatar} uri={imageUrl} />
    );

  const rightSlot = right ?? (
    <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
  );

  return (
    <ListItem
      left={left}
      onPress={onPress}
      right={rightSlot}
      showDivider={showDivider}
      subtitle={subtitle ?? undefined}
      subtitleNumberOfLines={subtitleNumberOfLines}
      title={title}
    />
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
});
