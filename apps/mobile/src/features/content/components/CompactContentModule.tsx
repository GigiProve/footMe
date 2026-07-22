import { type ComponentProps } from "react";
import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../styles";
import { AppText } from "../../../ui/AppText/AppText";
import { Avatar } from "../../../ui/Avatar/Avatar";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

const THUMBNAIL_SIZE = 56;
const MAX_AVATARS = 3;

type TaggedAvatar = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type CompactContentModuleProps = {
  thumbnailUrl?: string | null;
  typeLabel: string;
  title: string;
  taggedAvatars?: TaggedAvatar[];
};

function ThumbnailFallback() {
  const icon: IoniconsName = "image-outline";
  return (
    <View style={styles.thumbnailFallback}>
      <Ionicons color={colors.textMuted} name={icon} size={24} />
    </View>
  );
}

export function CompactContentModule({
  thumbnailUrl,
  typeLabel,
  title,
  taggedAvatars,
}: CompactContentModuleProps) {
  const visibleAvatars = taggedAvatars ? taggedAvatars.slice(0, MAX_AVATARS) : [];
  const overflow =
    taggedAvatars && taggedAvatars.length > MAX_AVATARS
      ? taggedAvatars.length - MAX_AVATARS
      : 0;

  return (
    <View style={styles.container}>
      {thumbnailUrl ? (
        <Image
          accessibilityLabel={title}
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
        />
      ) : (
        <ThumbnailFallback />
      )}
      <View style={styles.info}>
        <AppText
          color="secondary"
          variant="caption"
          style={styles.typeLabel}
          numberOfLines={1}
        >
          {typeLabel.toUpperCase()}
        </AppText>
        <AppText
          variant="bodySm"
          numberOfLines={2}
          style={styles.title}
        >
          {title}
        </AppText>
        {visibleAvatars.length > 0 ? (
          <View style={styles.avatarRow}>
            {visibleAvatars.map((av) => (
              <Avatar
                key={av.id}
                name={av.name}
                size="sm"
                uri={av.avatarUrl}
              />
            ))}
            {overflow > 0 ? (
              <AppText color="secondary" variant="caption" style={styles.overflow}>
                +{overflow}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  thumbnail: {
    borderRadius: radius[8],
    height: THUMBNAIL_SIZE,
    width: THUMBNAIL_SIZE,
  },
  thumbnailFallback: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    height: THUMBNAIL_SIZE,
    justifyContent: "center",
    width: THUMBNAIL_SIZE,
  },
  info: {
    flex: 1,
    gap: spacing[4],
  },
  typeLabel: {
    letterSpacing: 0.4,
  },
  title: {
    fontWeight: "600",
  },
  avatarRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    marginTop: spacing[4],
  },
  overflow: {
    marginLeft: spacing[4],
  },
});
