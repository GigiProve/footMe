/*
  Chat di gruppo senza messaggi (DAS-REV-32 §25, PNG 13).

  È uno stato UI, non un messaggio: non entra nella lista, non conta come
  unread e non ha timestamp. I nomi lunghi vanno a capo.
*/
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { GROUPS_COPY } from "../../dashboard/groups/groups-copy";

type GroupChatEmptyStateProps = {
  title: string;
};

export function GroupChatEmptyState({ title }: GroupChatEmptyStateProps) {
  return (
    <View style={styles.root}>
      <Ionicons color={colors.textMuted} name="chatbubbles-outline" size={40} />
      <AppText align="center" variant="titleMd">
        {GROUPS_COPY.chatReadyTitle(title)}
      </AppText>
      <AppText align="center" color="muted" variant="bodySm">
        {GROUPS_COPY.chatReadyBody}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flex: 1,
    gap: spacing[8],
    justifyContent: "center",
    paddingHorizontal: spacing[32],
  },
});
