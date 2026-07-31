import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { colors, radius, spacing } from "../../../theme/tokens";
import { ScreenHeader } from "../../../ui";
import { SegmentedControl } from "../../profiles/career/SegmentedControl";
import { EditSearchModal } from "./EditSearchModal";
import { EsploraTab } from "./EsploraTab";
import { ForYouTab } from "./ForYouTab";
import { GeoSelectorModal } from "./GeoSelectorModal";
import { PositionFiltersModal } from "./PositionFiltersModal";
import { PositionsSortSheet } from "./PositionsSortSheet";
import { SalvateTab } from "./SalvateTab";
import type { DiscoveryTab } from "./positions-search-types";

const TAB_OPTIONS: { label: string; value: DiscoveryTab }[] = [
  { label: "Per te", value: "perte" },
  { label: "Esplora", value: "esplora" },
  { label: "Salvate", value: "salvate" },
];

function resolveInitialTab(params: { saved?: string; tab?: string }): DiscoveryTab {
  if (params.saved === "1" || params.tab === "salvate") {
    return "salvate";
  }
  if (params.tab === "esplora") {
    return "esplora";
  }
  return "perte";
}

export function PositionsDiscoveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ saved?: string; tab?: string }>();

  const [tab, setTab] = useState<DiscoveryTab>(() => resolveInitialTab(params));
  const [editVisible, setEditVisible] = useState(false);
  const [geoVisible, setGeoVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <ScreenHeader
          action={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
            </Pressable>
          }
          title="Posizioni aperte"
        />
      </View>

      <View style={styles.tabs}>
        <SegmentedControl<DiscoveryTab>
          onChange={setTab}
          options={TAB_OPTIONS}
          value={tab}
        />
      </View>

      <View style={styles.body}>
        {tab === "perte" ? <ForYouTab onOpenEdit={() => setEditVisible(true)} /> : null}
        {tab === "esplora" ? (
          <EsploraTab
            onOpenEdit={() => setEditVisible(true)}
            onOpenFilters={() => setFiltersVisible(true)}
            onOpenGeo={() => setGeoVisible(true)}
            onOpenSort={() => setSortVisible(true)}
          />
        ) : null}
        {tab === "salvate" ? <SalvateTab /> : null}
      </View>

      <EditSearchModal
        onClose={() => setEditVisible(false)}
        onOpenFilters={() => setFiltersVisible(true)}
        onOpenGeo={() => setGeoVisible(true)}
        onSubmit={() => {
          setEditVisible(false);
          // Results reflect the full criteria on the Esplora tab.
          setTab("esplora");
        }}
        visible={editVisible}
      />
      <GeoSelectorModal onClose={() => setGeoVisible(false)} visible={geoVisible} />
      <PositionFiltersModal onClose={() => setFiltersVisible(false)} visible={filtersVisible} />
      <PositionsSortSheet onClose={() => setSortVisible(false)} visible={sortVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  body: {
    flex: 1,
  },
  headerRow: {
    marginBottom: spacing[12],
  },
  pressed: {
    opacity: 0.75,
  },
  root: {
    flex: 1,
  },
  tabs: {
    marginBottom: spacing[12],
  },
});
