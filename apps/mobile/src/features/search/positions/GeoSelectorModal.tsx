import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { AvailabilityProvincesSelector } from "../../../components/ui/availability-provinces-selector";
import { AvailabilityRegionsSelector } from "../../../components/ui/availability-regions-selector";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, ChipGroup, ModalHeader } from "../../../ui";
import { GEO_MODE_META, defaultSortFor } from "./positions-labels";
import { usePositionsSearch } from "./positions-search-context";
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS,
  type GeoMode,
  type NearMeSelection,
} from "./positions-search-types";
import { useCurrentLocation } from "./use-current-location";

type GeoSelectorModalProps = {
  visible: boolean;
  onClose: () => void;
};

const APPLY_LABEL: Record<GeoMode, string> = {
  italy: "Usa tutta Italia",
  near_me: "Mostra posizioni vicine",
  profile: "Usa queste aree",
  provinces: "Conferma province",
  regions: "Conferma regioni",
};

export function GeoSelectorModal({ visible, onClose }: GeoSelectorModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { criteria, patch } = usePositionsSearch();
  const location = useCurrentLocation();

  const [mode, setMode] = useState<GeoMode>(criteria.geoMode);
  const [regionsDraft, setRegionsDraft] = useState<string[]>(criteria.regions);
  const [provincesDraft, setProvincesDraft] = useState<string[]>(criteria.provinces);
  const [nearMe, setNearMe] = useState<NearMeSelection | null>(criteria.nearMe);
  const [radiusKm, setRadiusKm] = useState<number>(
    criteria.nearMe?.radiusKm ?? DEFAULT_RADIUS_KM,
  );

  useEffect(() => {
    // Snapshot the criteria into local drafts only when the modal opens.
    // Depending on `criteria` here would reset in-progress drafts if an
    // async criteria change (e.g. a late profile seed) landed while open.
    if (visible) {
      setMode(criteria.geoMode);
      setRegionsDraft(criteria.regions);
      setProvincesDraft(criteria.provinces);
      setNearMe(criteria.nearMe);
      setRadiusKm(criteria.nearMe?.radiusKm ?? DEFAULT_RADIUS_KM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const profileAreas =
    criteria.profileProvinces.length > 0
      ? criteria.profileProvinces
      : criteria.profileRegions;

  async function detectLocation() {
    const result = await location.request();
    if (result) {
      setNearMe({ ...result, radiusKm });
    }
  }

  const canApply =
    mode === "italy" ||
    (mode === "profile" && profileAreas.length > 0) ||
    (mode === "regions" && regionsDraft.length > 0) ||
    (mode === "provinces" && provincesDraft.length > 0) ||
    (mode === "near_me" && !!nearMe);

  function apply() {
    switch (mode) {
      case "regions":
        patch({ geoMode: "regions", regions: regionsDraft, sort: defaultSortFor("regions") });
        break;
      case "provinces":
        patch({
          geoMode: "provinces",
          provinces: provincesDraft,
          sort: defaultSortFor("provinces"),
        });
        break;
      case "near_me":
        patch({
          geoMode: "near_me",
          nearMe: nearMe ? { ...nearMe, radiusKm } : null,
          sort: defaultSortFor("near_me"),
        });
        break;
      case "profile":
        patch({ geoMode: "profile", sort: defaultSortFor("profile") });
        break;
      case "italy":
      default:
        patch({ geoMode: "italy", sort: defaultSortFor("italy") });
        break;
    }
    onClose();
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ModalHeader onClose={onClose} title="Dove vuoi cercare?" />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modeList}>
            {GEO_MODE_META.map((meta) => {
              const selected = mode === meta.mode;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={meta.mode}
                  onPress={() => setMode(meta.mode)}
                  style={[styles.modeRow, selected ? styles.modeRowActive : null]}
                >
                  <Ionicons
                    color={selected ? colors.accent : colors.textMuted}
                    name={meta.icon as never}
                    size={20}
                  />
                  <View style={styles.modeText}>
                    <AppText variant="titleSm">{meta.label}</AppText>
                    <AppText color="muted" variant="caption">
                      {meta.description}
                    </AppText>
                  </View>
                  <Ionicons
                    color={selected ? colors.accent : colors.textMuted}
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={20}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fields}>
            {mode === "profile" ? (
              <View style={styles.fieldBlock}>
                <AppText color="secondary" variant="bodySm">
                  Abbiamo recuperato le zone che hai già indicato nel tuo profilo.
                </AppText>
                {profileAreas.length > 0 ? (
                  <View style={styles.chips}>
                    {profileAreas.map((area) => (
                      <View key={area} style={styles.readonlyChip}>
                        <AppText color="accent" variant="bodySm">
                          {area}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : (
                  <AppText color="muted" variant="bodySm">
                    Nessuna zona indicata nel profilo.
                  </AppText>
                )}
                <Button
                  label="Modifica disponibilità nel profilo"
                  onPress={() => {
                    onClose();
                    router.push("/profile" as never);
                  }}
                  size="sm"
                  variant="link"
                />
              </View>
            ) : null}

            {mode === "near_me" ? (
              <View style={styles.fieldBlock}>
                {nearMe ? (
                  <>
                    <AppText variant="bodySm">
                      Posizione rilevata: {nearMe.label ?? "posizione attuale"}
                    </AppText>
                    <AppText color="muted" variant="caption">
                      Distanza massima
                    </AppText>
                    <ChipGroup
                      onChange={(value) => value && setRadiusKm(Number(value))}
                      options={RADIUS_OPTIONS.map((km) => ({
                        label: `Entro ${km} km`,
                        value: String(km),
                      }))}
                      value={String(radiusKm)}
                    />
                  </>
                ) : location.status === "denied" || location.status === "unavailable" ? (
                  <AppText color="secondary" variant="bodySm">
                    Non è stato possibile usare la posizione. Puoi selezionare
                    province o regioni manualmente.
                  </AppText>
                ) : (
                  <Button
                    label="Rileva la mia posizione"
                    leftIcon={
                      <Ionicons color={colors.inkInvert} name="location" size={16} />
                    }
                    loading={location.status === "requesting"}
                    onPress={detectLocation}
                    variant="primary"
                  />
                )}
              </View>
            ) : null}

            {mode === "provinces" ? (
              <View style={styles.fieldBlock}>
                <AvailabilityProvincesSelector
                  label="Province di ricerca"
                  onChange={setProvincesDraft}
                  placeholder="Cerca provincia"
                  value={provincesDraft}
                />
              </View>
            ) : null}

            {mode === "regions" ? (
              <View style={styles.fieldBlock}>
                <AvailabilityRegionsSelector
                  label="Regioni di ricerca"
                  onChange={setRegionsDraft}
                  placeholder="Cerca regione"
                  value={regionsDraft}
                />
              </View>
            ) : null}

            {mode === "italy" ? (
              <View style={styles.fieldBlock}>
                <AppText color="secondary" variant="bodySm">
                  Mostreremo tutte le opportunità coerenti con il tuo ruolo, senza
                  limiti geografici.
                </AppText>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[12] }]}>
          <Button
            disabled={!canApply}
            fullWidth
            label={APPLY_LABEL[mode]}
            onPress={apply}
            variant="primary"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing[16],
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  fieldBlock: {
    gap: spacing[12],
  },
  fields: {
    gap: spacing[16],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  modeList: {
    gap: spacing[8],
  },
  modeRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[14],
  },
  modeRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  modeText: {
    flex: 1,
    gap: spacing[4],
  },
  readonlyChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
});
