/**
 * Intestazione persona per il dettaglio di un accesso amministrativo
 * (screen 06/09): avatar, nome e stato.
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";

type AccessPersonHeaderProps = {
  avatarUrl: string | null;
  name: string;
  status: string | null;
};

export function AccessPersonHeader(props: AccessPersonHeaderProps) {
  const { avatarUrl, name, status } = props;

  return (
    <View
      accessible
      accessibilityLabel={status ? `${name}, ${status}` : name}
      style={styles.row}
    >
      <Avatar name={name} size="md" uri={avatarUrl ?? undefined} />
      <View style={styles.column}>
        <AppText color="neutral" variant="titleMd">
          {name}
        </AppText>
        {status ? (
          <AppText color="neutralMuted" variant="meta">
            {status}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flexShrink: 1,
    gap: spacing[4],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
});
