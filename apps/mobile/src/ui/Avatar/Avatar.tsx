import { Image, StyleSheet, Text, View } from "react-native";

import { colors, radius, typography } from "../../styles";

type AvatarSize = "sm" | "md" | "lg" | "xl";

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 104,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: typography.fontSize[12],
  md: typography.fontSize[14],
  lg: typography.fontSize[20],
  xl: typography.fontSize[34],
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (
    (parts[0][0]?.toUpperCase() ?? "") +
    (parts[parts.length - 1][0]?.toUpperCase() ?? "")
  );
}

type AvatarProps = {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  square?: boolean;
};

export function Avatar({
  uri,
  name,
  size = "md",
  square = false,
}: AvatarProps) {
  const dimension = sizeMap[size];
  const borderRadius = square ? radius[12] : dimension / 2;

  const containerStyle = {
    width: dimension,
    height: dimension,
    borderRadius,
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, containerStyle]}
        accessibilityLabel={name ?? "Avatar"}
      />
    );
  }

  const initials = name ? getInitials(name) : "";

  return (
    <View
      style={[styles.fallback, containerStyle]}
      accessibilityLabel={name ?? "Avatar"}
    >
      {initials ? (
        <Text style={[styles.initials, { fontSize: fontSizeMap[size] }]}>
          {initials}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surfaceMuted,
  },
  fallback: {
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: colors.accent,
    fontWeight: typography.fontWeight.bold,
  },
});

export type { AvatarProps, AvatarSize };
