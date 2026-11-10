/*
  Launcher «Nuova conversazione» (DAS-REV-32 §12, PNG 05).

  Mostra «Nuovo messaggio» sempre e «Crea gruppo» solo se l'actor ha almeno un
  contesto Società in cui la create è consentita: l'azione non consentita è
  nascosta, mai disabilitata. «Crea comunicazione» non è una scorciatoia chat.
*/
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet } from "../../../ui";
import { GROUPS_COPY } from "../../dashboard/groups/groups-copy";

type NewConversationSheetProps = {
  canCreateGroup: boolean;
  onClose: () => void;
  onCreateGroup: () => void;
  onNewMessage: () => void;
  visible: boolean;
};

export function NewConversationSheet({
  canCreateGroup,
  onClose,
  onCreateGroup,
  onNewMessage,
  visible,
}: NewConversationSheetProps) {
  // Il sheet si chiude prima di navigare: la route successiva non deve
  // trovare un Modal ancora aperto.
  function choose(action: () => void) {
    onClose();
    action();
  }

  return (
    <BottomSheet onClose={onClose} title={GROUPS_COPY.newConversation} visible={visible}>
      <LauncherRow
        icon="chatbubble-outline"
        label={GROUPS_COPY.newMessage}
        onPress={() => choose(onNewMessage)}
      />
      {canCreateGroup ? (
        <LauncherRow
          icon="people-outline"
          label={GROUPS_COPY.createGroup}
          onPress={() => choose(onCreateGroup)}
        />
      ) : null}
    </BottomSheet>
  );
}

function LauncherRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <Ionicons color={colors.textPrimary} name={icon} size={20} />
      <View style={styles.rowText}>
        <AppText variant="bodyLg">{label}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[14],
    paddingVertical: spacing[14],
  },
  rowText: {
    flex: 1,
  },
});
