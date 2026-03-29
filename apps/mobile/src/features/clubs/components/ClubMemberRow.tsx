import { Alert, StyleSheet, View } from "react-native";

import { useRouter } from "expo-router";

import { spacing } from "../../../theme/tokens";
import { Avatar, Badge, Button, ListItem } from "../../../ui";
import type { ClubMember } from "../membership-types";

type ClubMemberRowProps = {
  member: ClubMember;
  onRemove: (memberId: string) => void;
  onReject: (memberId: string) => void;
};

const roleLabelMap: Record<string, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Giocatore",
  staff: "Staff",
};

export function ClubMemberRow({
  member,
  onRemove,
  onReject,
}: ClubMemberRowProps) {
  const router = useRouter();
  const isLinked = member.profile_id !== null;
  const displayName = isLinked
    ? (member.full_name ?? "Profilo collegato")
    : (member.manual_name ?? "Senza nome");
  const roleLabel = roleLabelMap[member.member_role] ?? member.member_role;
  const subtitle = member.staff_title
    ? `${roleLabel} · ${member.staff_title}`
    : roleLabel;

  function handlePress() {
    if (isLinked && member.profile_id) {
      router.push(`/profile/${member.profile_id}` as never);
    }
  }

  function handleActions() {
    const buttons = [];

    if (member.added_by === "self_request" && member.status === "active") {
      buttons.push({
        onPress: () => onReject(member.id),
        style: "destructive" as const,
        text: "Rifiuta collegamento",
      });
    }

    buttons.push({
      onPress: () => onRemove(member.id),
      style: "destructive" as const,
      text: "Rimuovi dalla rosa",
    });

    buttons.push({ style: "cancel" as const, text: "Annulla" });

    Alert.alert("Gestisci membro", displayName, buttons);
  }

  return (
    <ListItem
      left={<Avatar name={displayName} size="md" uri={member.avatar_url} />}
      onPress={isLinked ? handlePress : undefined}
      right={
        <View style={styles.rightSlot}>
          {!isLinked ? <Badge label="Non collegato" variant="default" /> : null}
          {member.added_by === "self_request" ? (
            <Badge label="Auto" variant="accent" />
          ) : null}
          <Button
            label="..."
            onPress={handleActions}
            size="sm"
            variant="tertiary"
          />
        </View>
      }
      subtitle={subtitle}
      title={displayName}
    />
  );
}

const styles = StyleSheet.create({
  rightSlot: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
});
