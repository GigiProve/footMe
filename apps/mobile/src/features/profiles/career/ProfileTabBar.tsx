import { TabBar, type TabBarItem } from "../../../ui";

/**
 * REV-PROF-01 §5: le tab del Master Profile sono Carriera, Media e Dettagli,
 * e Carriera è quella iniziale. `details` è la tab del Calciatore; `info`
 * resta perché le altre tipologie di profilo la usano ancora con quel nome.
 */
export type ProfileTab = "career" | "media" | "info" | "details";

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
  { label: "Dettagli", value: "details" },
];

export function ProfileTabBar({
  activeTab,
  onTabChange,
  tabs = TABS,
}: ProfileTabBarProps) {
  return <TabBar active={activeTab} items={tabs} onChange={onTabChange} />;
}
