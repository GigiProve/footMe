import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../styles";
import { Avatar, Button, ListItem } from "../../../ui";
import type { SavedItem, SavedKind } from "../saved-service";

type SavedItemRowProps = {
  item: SavedItem;
  onPress?: () => void;
  onRemove?: () => void;
};

function kindLabel(kind: SavedKind): string {
  switch (kind) {
    case "profile":
      return "Profilo";
    case "club":
      return "Società";
    case "position":
      return "Posizione";
    case "content":
      return "Contenuto";
    default:
      return "Elemento";
  }
}

function kindIcon(
  kind: SavedKind,
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (kind) {
    case "profile":
      return "person-outline";
    case "club":
      return "shield-outline";
    case "position":
      return "megaphone-outline";
    case "content":
      return "newspaper-outline";
    default:
      return "bookmark-outline";
  }
}

export function SavedItemRow({ item, onPress, onRemove }: SavedItemRowProps) {
  const typeTag = kindLabel(item.kind);
  const subtitle = [typeTag, item.subtitle].filter(Boolean).join(" • ");

  const left =
    item.thumbnail_url ? (
      <Avatar uri={item.thumbnail_url} name={item.title} size="sm" />
    ) : (
      <View style={styles.iconWrap}>
        <Ionicons
          color={colors.textMuted}
          name={kindIcon(item.kind)}
          size={18}
        />
      </View>
    );

  const right = onRemove ? (
    <Button
      label="Rimuovi"
      onPress={onRemove}
      size="sm"
      variant="outline"
    />
  ) : undefined;

  return (
    <ListItem
      left={left}
      onPress={onPress}
      right={right}
      showDivider={false}
      style={styles.row}
      subtitle={subtitle}
      title={item.title}
    />
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[14],
  },
});
