import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type ProfileTab = "career" | "media" | "info";

type ProfileTabBarProps = {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
};

const TABS: { label: string; value: ProfileTab }[] = [
  { label: "Carriera", value: "career" },
  { label: "Media", value: "media" },
  { label: "Info", value: "info" },
];

export function ProfileTabBar({ activeTab, onTabChange }: ProfileTabBarProps) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={tab.value}
            onPress={() => onTabChange(tab.value)}
            style={[styles.tab, isActive ? styles.tabActive : styles.tabInactive]}
          >
            <AppText
              color={isActive ? "accent" : "muted"}
              style={styles.tabText}
              variant="titleSm"
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  tab: {
    alignItems: "center",
    flex: 1,
    height: 58,
    justifyContent: "center",
  },
  tabActive: {
    borderBottomColor: colors.accent,
    borderBottomWidth: 2,
  },
  tabInactive: {
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
  },
  tabText: {
    paddingHorizontal: spacing[4],
  },
});
