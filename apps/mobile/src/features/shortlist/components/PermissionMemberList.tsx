import { FlatList, StyleSheet, View } from "react-native";

import { Avatar, Badge, EmptyState, ListItem } from "../../../ui";
import { spacing } from "../../../theme/tokens";
import type { ClubPermissionMember } from "../shortlist-permissions-service";

const MEMBER_ROLE_LABELS: Record<string, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Giocatore",
  staff: "Staff",
};

export function formatMemberRole(role: string): string {
  return MEMBER_ROLE_LABELS[role] ?? role;
}

type PermissionMemberListProps = {
  members: ClubPermissionMember[];
  onSelectMember: (member: ClubPermissionMember) => void;
};

export function PermissionMemberList({
  members,
  onSelectMember,
}: PermissionMemberListProps) {
  if (members.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="Nessun membro con account collegato"
        description="Collega un account allo staff per assegnare permessi su Shortlist / Scouting."
      />
    );
  }

  return (
    <FlatList
      data={members}
      keyExtractor={(item) => item.profile_id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const displayName = item.full_name ?? "Membro senza nome";
        const activeCount = item.permissions.length;
        const badgeLabel =
          activeCount === 0
            ? "Nessun permesso"
            : `${activeCount} ${activeCount === 1 ? "permesso" : "permessi"}`;

        return (
          <ListItem
            left={<Avatar name={displayName} size="md" uri={item.avatar_url} />}
            onPress={() => onSelectMember(item)}
            right={
              <Badge
                label={badgeLabel}
                variant={activeCount === 0 ? "default" : "accent"}
              />
            }
            subtitle={formatMemberRole(item.member_role)}
            title={displayName}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing[24],
  },
  separator: {
    height: spacing[4],
  },
});
