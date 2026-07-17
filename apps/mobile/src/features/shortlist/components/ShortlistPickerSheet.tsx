import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText, BottomSheet, Button, ListItem } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";
import {
  fetchClubShortlists,
  fetchProfileShortlistMemberships,
} from "../shortlist-service";
import { formatListSubtitle } from "../shortlist-display-helpers";
import { ProfileSummaryCard } from "./ProfileSummaryCard";

type ShortlistPickerSheetProfile = {
  avatarUrl?: string | null;
  fullName: string;
  id: string;
  subtitle: string;
};

type ShortlistPickerSheetProps = {
  canCreateLists: boolean;
  clubId: string;
  onClose: () => void;
  onContinue: (listId: string) => void;
  onCreateNewList: () => void;
  onDismiss?: () => void;
  profile: ShortlistPickerSheetProfile;
  visible: boolean;
};

export function ShortlistPickerSheet({
  canCreateLists,
  clubId,
  onClose,
  onContinue,
  onCreateNewList,
  onDismiss,
  profile,
  visible,
}: ShortlistPickerSheetProps) {
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedListId(null);
    }
  }, [visible]);

  const shortlistsQuery = useQuery({
    enabled: visible,
    queryFn: () => fetchClubShortlists(clubId),
    queryKey: ["shortlists", clubId],
  });

  const membershipsQuery = useQuery({
    enabled: visible && !!clubId,
    queryFn: () => fetchProfileShortlistMemberships(profile.id, clubId),
    queryKey: ["shortlist-memberships", profile.id],
  });

  const memberListIds = new Set(
    (membershipsQuery.data ?? []).map((membership) => membership.shortlist_id),
  );

  return (
    <BottomSheet onClose={onClose} onDismiss={onDismiss} title="Aggiungi a shortlist" visible={visible}>
      <ProfileSummaryCard
        avatarUrl={profile.avatarUrl}
        fullName={profile.fullName}
        subtitle={profile.subtitle}
      />

      <AppText color="muted" style={styles.label} variant="caption">
        Scegli lista
      </AppText>

      <View style={styles.list}>
        {(shortlistsQuery.data ?? []).map((list) => {
          const isMember = memberListIds.has(list.id);
          const isSelected = selectedListId === list.id;

          return (
            <ListItem
              key={list.id}
              onPress={isMember ? undefined : () => setSelectedListId(list.id)}
              right={
                isMember ? (
                  <Ionicons color={colors.success} name="checkmark-circle" size={20} />
                ) : isSelected ? (
                  <Ionicons color={colors.accent} name="checkmark-circle" size={20} />
                ) : null
              }
              style={isMember ? styles.disabledRow : undefined}
              subtitle={formatListSubtitle(list)}
              title={list.name}
            />
          );
        })}

        {canCreateLists ? (
          <Pressable
            accessibilityRole="button"
            onPress={onCreateNewList}
            style={({ pressed }) => [styles.createRow, pressed ? styles.createRowPressed : null]}
          >
            <Ionicons color={colors.accent} name="add-circle-outline" size={20} />
            <AppText color="accent" variant="titleSm">
              Crea nuova lista
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <Button
        disabled={!selectedListId}
        fullWidth
        label="Continua"
        onPress={() => {
          if (selectedListId) {
            onContinue(selectedListId);
          }
        }}
        variant="primary"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  createRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    paddingVertical: spacing[14],
  },
  createRowPressed: {
    opacity: 0.7,
  },
  disabledRow: {
    opacity: 0.6,
  },
  label: {
    marginTop: spacing[16],
  },
  list: {
    marginBottom: spacing[16],
    marginTop: spacing[8],
  },
});
