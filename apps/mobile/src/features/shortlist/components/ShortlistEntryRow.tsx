import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText, Avatar, Badge } from "../../../ui";
import { colors, radius, spacing } from "../../../theme/tokens";
import {
  getPriorityLabel,
  getEvaluationStatusLabel,
  type ShortlistEntry,
} from "../shortlist-service";
import {
  formatEntrySubtitle,
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
} from "../shortlist-display-helpers";

type ShortlistEntryRowProps = {
  entry: ShortlistEntry;
  listId: string;
};

export function ShortlistEntryRow({ entry, listId }: ShortlistEntryRowProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          params: { entryId: entry.id, listId },
          pathname: "/shortlist/entry/[entryId]",
        })
      }
      style={({ pressed }) => [styles.container, pressed ? styles.pressed : null]}
    >
      <Avatar name={entry.full_name ?? undefined} size="md" uri={entry.avatar_url} />
      <View style={styles.body}>
        <AppText numberOfLines={1} variant="titleSm">
          {entry.full_name ?? "Profilo"}
        </AppText>
        <AppText color="muted" numberOfLines={1} variant="bodySm">
          {formatEntrySubtitle(entry)}
        </AppText>
        <View style={styles.badgeRow}>
          <Badge
            label={getPriorityLabel(entry.priority)}
            variant={getPriorityBadgeVariant(entry.priority)}
          />
          <Badge
            label={getEvaluationStatusLabel(entry.evaluation_status)}
            variant={getStatusBadgeVariant(entry.evaluation_status)}
          />
        </View>
        {entry.internal_note ? (
          <View style={styles.notePreview}>
            <Ionicons color={colors.textMuted} name="document-text-outline" size={14} />
            <AppText color="muted" numberOfLines={1} style={styles.noteText} variant="caption">
              {entry.internal_note}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  body: {
    flex: 1,
    gap: spacing[6],
  },
  container: {
    alignItems: "flex-start",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  noteText: {
    flex: 1,
  },
  notePreview: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderRadius: radius[6],
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  pressed: {
    opacity: 0.82,
  },
});
