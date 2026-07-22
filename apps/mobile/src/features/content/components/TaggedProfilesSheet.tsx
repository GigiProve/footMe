import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../styles";
import { AppText, Avatar } from "../../../ui";
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
 * Opened from the "e altri N" affordance in ContentTaggedHeader.
 */
export function TaggedProfilesSheet({
  onClose,
  onOpenTarget,
  targets,
  visible,
}: TaggedProfilesSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Chiudi"
        onPress={onClose}
        style={styles.overlay}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <AppText style={styles.heading} variant="titleSm">
          Profili taggati
        </AppText>
        <ScrollView style={styles.list}>
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
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  handle: {
    alignSelf: "center",
    backgroundColor: colors.border,
    borderRadius: radius.full,
    height: 4,
    marginBottom: spacing[16],
    width: 40,
  },
  heading: {
    marginBottom: spacing[12],
  },
  list: {
    maxHeight: 360,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
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
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius[16],
    borderTopRightRadius: radius[16],
    bottom: 0,
    left: 0,
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
    position: "absolute",
    right: 0,
  },
});
