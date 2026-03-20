import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../styles";
import { AppText } from "../Text/AppText";

type AppEmptyStateProps = {
  action?: React.ReactNode;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title: string;
};

/**
 * Standardised empty-state placeholder for lists, search results, and cards.
 *
 * Usage:
 *   <AppEmptyState
 *     icon="football-outline"
 *     title="Nessuna esperienza"
 *     description="Aggiungi la tua prima esperienza calcistica."
 *     action={<Button label="Aggiungi" onPress={…} />}
 *   />
 */
export function AppEmptyState({
  action,
  description,
  icon = "albums-outline",
  style,
  testID,
  title,
}: AppEmptyStateProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <Ionicons color={colors.textMuted} name={icon} size={40} />
      <AppText align="center" preset="title">
        {title}
      </AppText>
      {description ? (
        <AppText align="center" color="textSecondary" preset="bodySmall">
          {description}
        </AppText>
      ) : null}
      {action ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[32],
  },
});
