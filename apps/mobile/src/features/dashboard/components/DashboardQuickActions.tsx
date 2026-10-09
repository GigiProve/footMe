import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";

export type QuickAction = {
  icon: keyof typeof Ionicons.glyphMap;
  id: string;
  label: string;
  onPress: () => void;
};

type Props = {
  actions: QuickAction[];
};

/**
 * Azioni rapide (master 01, 02, 03).
 *
 * Pulsanti outlined compatti, mai grandi tile colorate. Il wrap è voluto:
 * §23 chiede che su un device compatto le azioni vadano a capo invece di
 * comprimere la label per restare affiancate.
 *
 * Le azioni arrivano già filtrate dalla composizione: questo componente non
 * conosce le capability e non deve nascondere nulla da solo.
 */
export function DashboardQuickActions({ actions }: Props) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <View style={styles.block}>
      <AppText variant="headingSm">Azioni rapide</AppText>

      <View style={styles.row}>
        {actions.map((action) => (
          <Button
            key={action.id}
            label={action.label}
            leftIcon={
              <Ionicons color={colors.textPrimary} name={action.icon} size={18} />
            }
            onPress={action.onPress}
            size="lg"
            style={styles.action}
            variant="outline"
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[10],
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[10],
  },
  action: {
    flexGrow: 1,
    flexShrink: 1,
    // Due azioni stanno affiancate a 375pt; una label lunga manda la seconda
    // a capo invece di troncarsi.
    minWidth: 150,
  },
});
