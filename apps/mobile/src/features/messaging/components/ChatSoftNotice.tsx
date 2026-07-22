import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type ChatSoftNoticeProps = {
  body: string;
  title: string;
};

export function ChatSoftNotice({ body, title }: ChatSoftNoticeProps) {
  return (
    <View style={styles.card}>
      <AppText color="warning" style={styles.title} variant="caption">
        {title}
      </AppText>
      <AppText color="warning" style={styles.body} variant="caption">
        {body}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.noticeWarnSurface,
    borderColor: colors.noticeWarnBorder,
    borderRadius: radius[8],
    borderWidth: 1,
    gap: spacing[4],
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    padding: spacing[10],
  },
  body: {
    color: colors.noticeWarnText,
    fontSize: 11,
    fontWeight: "400",
  },
  title: {
    color: colors.noticeWarnText,
    fontSize: 12,
  },
});
