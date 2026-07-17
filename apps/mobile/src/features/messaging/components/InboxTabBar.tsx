import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type InboxTab = "chat" | "comunicazioni";

type InboxTabBarProps = {
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
};

const TABS: { icon: keyof typeof Ionicons.glyphMap; label: string; value: InboxTab }[] = [
  { icon: "chatbubble-outline", label: "Chat", value: "chat" },
  { icon: "megaphone-outline", label: "Comunicazioni", value: "comunicazioni" },
];

export function InboxTabBar({ activeTab, onTabChange }: InboxTabBarProps) {
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
            style={[styles.tab, isActive ? styles.tabActive : null]}
          >
            <Ionicons
              color={isActive ? colors.accent : colors.textMuted}
              name={tab.icon}
              size={16}
            />
            <AppText
              color={isActive ? "accent" : "muted"}
              style={styles.label}
              variant="overline"
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
    borderBottomColor: colors.border,
    flexDirection: "row",
  },
  tab: {
    alignItems: "center",
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    flex: 1,
    flexDirection: "row",
    gap: spacing[6],
    height: 48,
    justifyContent: "center",
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  label: {
    marginTop: 1,
  },
});
