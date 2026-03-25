import { Pressable, StyleSheet, View } from "react-native";

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
      <Card style={styles.card}>
        <AppText variant="titleSm">{club.name}</AppText>
        <AppText variant="bodySm" color="secondary">
          {club.city}, {club.region}
        </AppText>
        {club.club_email ? (
          <AppText variant="bodySm" color="secondary">
            {club.club_email}
          </AppText>
        ) : null}
        <AppText variant="bodySm" color="secondary">
          Responsabile: {club.owner_full_name ?? "N/D"}
        </AppText>
        <AppText variant="caption" color="muted">
          Registrato il {new Date(club.created_at).toLocaleDateString("it-IT")}
        </AppText>
        <StatusBadge status={club.verification_status} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[4],
    marginBottom: spacing[12],
  },
});
