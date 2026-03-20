import { Pressable, Text, View } from "react-native";

import { colors, spacing, typography } from "../../../theme/tokens";
import { Card } from "../../../ui";
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
        <Text style={styles.name}>{club.name}</Text>
        <Text style={styles.detail}>
          {club.city}, {club.region}
        </Text>
        {club.club_email ? (
          <Text style={styles.detail}>{club.club_email}</Text>
        ) : null}
        <Text style={styles.detail}>
          Responsabile: {club.owner_full_name ?? "N/D"}
        </Text>
        <Text style={styles.meta}>
          Registrato il {new Date(club.created_at).toLocaleDateString("it-IT")}
        </Text>
        <StatusBadge status={club.verification_status} />
      </Card>
    </Pressable>
  );
}

const styles = {
  name: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.heavy,
  },
  detail: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[14],
    lineHeight: 20,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.fontSize[12],
  },
} as const;
