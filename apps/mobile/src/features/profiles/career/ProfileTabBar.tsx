import { TabBar, type TabBarItem } from "../../../ui";

export type ProfileTab = "career" | "media" | "info";

/**
 * Tab del profilo. Delega alla `TabBar` condivisa: nel design ProLink (§1a) le
 * tab hanno un solo aspetto in tutta l'app — testo blu con indicatore 2px —
 * quindi qui non c'è più nessuna personalizzazione di colore.
 */
type ProfileTabBarProps = {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  tabs?: readonly TabBarItem<ProfileTab>[];
};

const TABS: readonly TabBarItem<ProfileTab>[] = [
  { label: "Carriera", value: "career" },
  { label: "Media", value: "media" },
  { label: "Info", value: "info" },
];

export function ProfileTabBar({
  activeTab,
  onTabChange,
  tabs = TABS,
}: ProfileTabBarProps) {
  return <TabBar active={activeTab} items={tabs} onChange={onTabChange} />;
}
