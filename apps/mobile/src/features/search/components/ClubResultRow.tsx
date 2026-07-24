import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../theme/tokens";
import { Avatar, ListItem } from "../../../ui";
import { formatLocation } from "../../profiles/profile-display-helpers";
import { formatClubKindLabel } from "../search-format";
import type { ClubSearchRow } from "../search-types";

type ClubResultRowProps = {
  onPress?: () => void;
  row: ClubSearchRow;
};

export function ClubResultRow({ onPress, row }: ClubResultRowProps) {
  const subtitle =
    row.kind === "team"
      ? ["Squadra interna", row.parent_club_name, row.category]
          .filter(Boolean)
          .join(" • ")
      : [
          formatClubKindLabel(row.is_affiliate),
          row.category,
          formatLocation(row.city, row.region),
        ]
          .filter(Boolean)
          .join(" • ");

  return (
    <ListItem
      left={<Avatar name={row.name} size="sm" square uri={row.logo_url} />}
      onPress={onPress}
      right={
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      }
      subtitle={subtitle}
      title={row.name}
    />
  );
}
