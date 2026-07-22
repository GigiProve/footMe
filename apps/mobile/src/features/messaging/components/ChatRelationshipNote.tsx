import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type ChatRelationshipNoteProps = {
  icon: "people-outline" | "briefcase-outline";
  label: string;
};

export function ChatRelationshipNote({ icon, label }: ChatRelationshipNoteProps) {
  return (
    <View style={styles.card}>
      <Ionicons color={colors.noticeSuccessText} name={icon} size={16} />
      <AppText style={styles.label} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.noticeSuccessSurface,
    borderColor: colors.noticeSuccessBorder,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  label: {
    color: colors.noticeSuccessText,
    fontSize: 12,
    fontWeight: "600",
  },
});
