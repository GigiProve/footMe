import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes } from "../../styles";

type AvatarSize = "sm" | "md" | "lg" | "xl";

type AppAvatarProps = {
  /** Fallback icon when no image is available */
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  /** URI of the image to display */
  imageUrl?: string | null;
  /** Rounded-rectangle shape for logos (default: circle) */
  rounded?: boolean;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const sizeMap: Record<AvatarSize, number> = {
  sm: sizes.avatarSm,
  md: sizes.avatarMd,
  lg: sizes.avatarLg,
  xl: sizes.avatarXl,
};

const iconSizeMap: Record<AvatarSize, number> = {
  sm: sizes.iconSm,
  md: sizes.iconMd,
  lg: sizes.iconLg,
  xl: 40,
};

/**
 * Circular (or rounded-square) avatar used for players, clubs, and teams.
 *
 * Usage:
 *   <AppAvatar imageUrl={player.avatarUrl} size="lg" />
 *   <AppAvatar imageUrl={club.logoUrl} size="md" rounded />
 */
export function AppAvatar({
  fallbackIcon = "person-outline",
  imageUrl,
  rounded = false,
  size = "md",
  style,
  testID,
}: AppAvatarProps) {
  const dimension = sizeMap[size];
  const borderRadiusValue = rounded ? radius[24] : radius.full;

  const imageStyle: ImageStyle = {
    width: dimension,
    height: dimension,
    borderRadius: borderRadiusValue,
  };

  const viewStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: borderRadiusValue,
  };

  if (imageUrl) {
    return (
      <Image
        accessibilityLabel="Avatar"
        source={{ uri: imageUrl }}
        style={[styles.image, imageStyle]}
        testID={testID}
      />
    );
  }

  return (
    <View style={[styles.placeholder, viewStyle, style]} testID={testID}>
      <Ionicons color={colors.textMuted} name={fallbackIcon} size={iconSizeMap[size]} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceMuted,
  },
  placeholder: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
  },
});
