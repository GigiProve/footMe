import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../styles";
import { AppText, Avatar, BottomSheet } from "../../../ui";
import type { TargetType } from "../content-tag-service";

export type ContentTaggedTarget = {
  avatar_url: string | null;
  display_name: string;
  subtitle?: string | null;
  target_id: string;
  target_type: TargetType;
};

type TaggedProfilesSheetProps = {
  onClose: () => void;
  onOpenTarget: (target: ContentTaggedTarget) => void;
  targets: ContentTaggedTarget[];
  visible: boolean;
};

/**
 * Bottom sheet listing every profile/club/team tagged in a piece of content.
 * Opened from the "e altri N" affordance in ContentAttribution.
 *
 * HOM-15 §249, §252: uno solo sheet nativo PROLINK (`BottomSheet` di src/ui) —
 * stessa chiusura da backdrop, back di sistema e ✕; la lista scorre oltre il tetto.
 */
export function TaggedProfilesSheet({
  onClose,
  onOpenTarget,
  targets,
  visible,
}: TaggedProfilesSheetProps) {
  return (
    <BottomSheet
      onClose={onClose}
      scrollable
      showHandle
      title="Profili taggati"
      visible={visible}
    >
      {targets.map((target) => (
        <Pressable
          accessibilityRole="button"
          key={`${target.target_type}:${target.target_id}`}
          onPress={() => onOpenTarget(target)}
          style={styles.row}
        >
          <Avatar
            name={target.display_name}
            size="sm"
            square={target.target_type !== "profile"}
            uri={target.avatar_url}
          />
          <View style={styles.rowText}>
            <AppText numberOfLines={1} variant="bodySm">
              {target.display_name}
            </AppText>
            {target.subtitle ? (
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {target.subtitle}
              </AppText>
            ) : null}
          </View>
          <Ionicons
            color={colors.textMuted}
            name="chevron-forward"
            size={16}
          />
        </Pressable>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
});
