import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type ScreenHeaderProps = {
  action?: ReactNode;
  subtitle?: string;
  title: string;
};

export function ScreenHeader({ action, subtitle, title }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <AppText variant="displaySm">{title}</AppText>
        {subtitle ? (
          <AppText variant="bodySm" color="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[12],
  },
  textBlock: {
    flex: 1,
    gap: spacing[4],
  },
});
