import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type ProfileTab = "career" | "media" | "info";

type ProfileTabBarProps = {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  activeColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  inactiveColor?: string;
  indicatorColor?: string;
  tabs?: { label: string; value: ProfileTab }[];
};

const TABS: { label: string; value: ProfileTab }[] = [
  { label: "Carriera", value: "career" },
  { label: "Media", value: "media" },
  { label: "Info", value: "info" },
];

export function ProfileTabBar({
  activeTab,
  activeColor = colors.accent,
  backgroundColor = colors.surface,
  borderColor = colors.border,
  inactiveColor = colors.textMuted,
  indicatorColor = colors.accent,
  onTabChange,
  tabs = TABS,
}: ProfileTabBarProps) {
  return (
    <View style={[styles.container, { backgroundColor, borderBottomColor: borderColor }]}>
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={tab.value}
            onPress={() => onTabChange(tab.value)}
            style={[
              styles.tab,
              {
                borderBottomColor: isActive ? indicatorColor : "transparent",
              },
            ]}
          >
            <AppText
              style={[
                styles.tabText,
                { color: isActive ? activeColor : inactiveColor },
              ]}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  tab: {
    alignItems: "center",
    flex: 1,
    height: 58,
    justifyContent: "center",
    borderBottomWidth: 2,
  },
  tabText: {
    paddingHorizontal: spacing[4],
  },
});
