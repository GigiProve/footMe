import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";

type JobCardProps = {
  category: string;
  club: string;
  description: string;
  onApply: () => void;
  onDetails: () => void;
  onToggleSave: () => void;
  postedAt: string;
  region: string;
  saved: boolean;
  title: string;
};

export function JobCard({
  category,
  club,
  description,
  onApply,
  onDetails,
  onToggleSave,
  postedAt,
  region,
  saved,
  title,
}: JobCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="titleSm">{title}</AppText>
          <AppText variant="bodySm" color="accent">
            {club}
          </AppText>
        </View>
        <Pressable
          accessibilityLabel={saved ? "Rimuovi dai salvati" : "Salva annuncio"}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onToggleSave}
        >
          <Ionicons
            color={saved ? colors.accent : colors.textMuted}
            name={saved ? "bookmark" : "bookmark-outline"}
            size={22}
          />
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons
            color={colors.textMuted}
            name="location-outline"
            size={13}
          />
          <AppText variant="bodySm" color="muted" style={styles.metaText}>
            {region}
          </AppText>
        </View>
        <AppText variant="bodySm" color="muted" style={styles.metaText}>
          {category}
        </AppText>
        <View style={styles.metaItem}>
          <Ionicons color={colors.textMuted} name="time-outline" size={13} />
          <AppText variant="bodySm" color="muted" style={styles.metaText}>
            {postedAt}
          </AppText>
        </View>
      </View>

      <AppText variant="bodySm" color="secondary" numberOfLines={3}>
        {description}
      </AppText>

      <View style={styles.actions}>
        <Button
          label="Candidati"
          onPress={onApply}
          size="sm"
          variant="primary"
        />
        <Button
          label="Dettagli"
          onPress={onDetails}
          size="sm"
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[16],
    gap: spacing[12],
    ...shadows.subtle,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing[12],
  },
  headerText: {
    flex: 1,
    gap: spacing[4],
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
  },
  metaText: {
    fontSize: typography.fontSize[12],
  },
  actions: {
    flexDirection: "row",
    gap: spacing[8],
  },
});
