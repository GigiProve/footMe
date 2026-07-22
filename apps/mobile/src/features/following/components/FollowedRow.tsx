import { StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../styles";
import { Avatar, Button, ListItem } from "../../../ui";
import type { FollowedEntity } from "../following-service";

type FollowedRowProps = {
  item: FollowedEntity;
  onPress?: () => void;
  onUnfollow?: () => void;
};

function roleLabel(role: FollowedEntity["role"]): string {
  switch (role) {
    case "player":
      return "Calciatore";
    case "coach":
      return "Allenatore";
    case "agent":
      return "Agente";
    case "staff":
      return "Staff";
    case "director":
      return "Dirigente";
    case "media":
      return "Media";
    case "fan":
      return "Tifoso";
    case "club_admin":
      return "Club Admin";
    case "club":
      return "Società";
    default:
      return "Utente";
  }
}

export function FollowedRow({ item, onPress, onUnfollow }: FollowedRowProps) {
  const typeTag = roleLabel(item.role);
  const subtitle = [typeTag, item.subtitle].filter(Boolean).join(" • ");

  const left = (
    <Avatar uri={item.avatar_url} name={item.name} size="sm" />
  );

  const right = onUnfollow ? (
    <Button
      label="Seguito"
      leftIcon={
        <Ionicons color={colors.accent} name="checkmark" size={15} />
      }
      onPress={onUnfollow}
      size="sm"
      variant="secondary"
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
      title={item.name}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[14],
  },
});
