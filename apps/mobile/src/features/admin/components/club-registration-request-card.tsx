import { Pressable } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText, Card } from "../../../ui";
import type { AdminClubEntry } from "../admin-service";
import { StatusBadge } from "./status-badge";

type Props = {
  club: AdminClubEntry;
  onPress: (clubId: string) => void;
};

export function ClubRegistrationRequestCard({ club, onPress }: Props) {
  return (
    <Pressable onPress={() => onPress(club.id)}>
      <Card style={{ gap: spacing[4], marginBottom: spacing[12] }}>
        <AppText preset="title">{club.name}</AppText>
        <AppText preset="bodySmall">
          {club.city}, {club.region}
        </AppText>
        {club.club_email ? (
          <AppText preset="bodySmall">{club.club_email}</AppText>
        ) : null}
        <AppText preset="bodySmall">
          Responsabile: {club.owner_full_name ?? "N/D"}
        </AppText>
        <AppText preset="caption">
          Registrato il {new Date(club.created_at).toLocaleDateString("it-IT")}
        </AppText>
        <StatusBadge status={club.verification_status} />
      </Card>
    </Pressable>
  );
}
