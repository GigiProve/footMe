import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../theme/tokens";
import { Avatar, ListItem } from "../../../ui";
import {
  formatLocation,
  formatPosition,
  formatRole,
} from "../../profiles/profile-display-helpers";
import type { ProfileSearchRow } from "../search-types";

type ProfileResultRowProps = {
  onPress?: () => void;
  row: ProfileSearchRow;
};

export function ProfileResultRow({ onPress, row }: ProfileResultRowProps) {
  const line1Parts =
    row.role === "player"
      ? [formatPosition(row.primary_position), row.current_club_name]
      : [formatRole(row.role), row.current_club_name];
  const line1 = line1Parts.filter(Boolean).join(" • ");

  const line2Parts = [formatLocation(row.city, row.region)];
  if (row.is_available) {
    line2Parts.push("Disponibile");
  }
  const line2 = line2Parts.filter(Boolean).join(" • ");

  const subtitle = [line1, line2].filter(Boolean).join("\n");

  return (
    <ListItem
      left={<Avatar name={row.full_name} size="sm" uri={row.avatar_url} />}
      onPress={onPress}
      right={
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      }
      subtitle={subtitle}
      subtitleNumberOfLines={2}
      title={row.full_name}
    />
  );
}
