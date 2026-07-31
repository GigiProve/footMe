import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SelectField } from "../../../components/ui/select-field";
import { FootballPositionPicker } from "../../profiles/football-position-picker";
import type { PlayerPosition } from "../../profiles/player-sports";
import { SegmentedControl } from "../../profiles/career/SegmentedControl";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, ModalHeader, Toggle } from "../../../ui";
import type { SearchPositionTarget } from "../search-types";
import { TARGET_OPTIONS, areaSummaryLabel, coachStaffRoleOptions } from "./positions-labels";
import { usePositionsSearch } from "./positions-search-context";

type EditSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  /** "Mostra posizioni" — apply and jump to the results (Esplora) tab. */
  onSubmit: () => void;
  onOpenGeo: () => void;
  onOpenFilters: () => void;
};

export function EditSearchModal({
  visible,
  onClose,
  onSubmit,
  onOpenGeo,
  onOpenFilters,
}: EditSearchModalProps) {
  const insets = useSafeAreaInsets();
  const { criteria, patch } = usePositionsSearch();

  const isPlayer = criteria.target === "player";

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ModalHeader onClose={onClose} title="Modifica ricerca" />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.block}>
            <AppText variant="titleSm">Tipo opportunità</AppText>
            <SegmentedControl<SearchPositionTarget>
              onChange={(value) => patch({ target: value })}
              options={TARGET_OPTIONS}
              value={criteria.target}
            />
          </View>

          {isPlayer ? (
            <View style={styles.block}>
              <FootballPositionPicker
                mode="single"
                onSelect={(positions) => patch({ primaryPositions: positions })}
                selectedPositions={criteria.primaryPositions}
                title="Ruolo principale"
              />

              <Toggle
                label="Mostra ruoli compatibili"
                onValueChange={(value) => patch({ useCompatible: value })}
                value={criteria.useCompatible}
              />

              {criteria.useCompatible ? (
                <FootballPositionPicker
                  mode="multiple"
                  onSelect={(positions) =>
                    patch({
                      compatiblePositions: positions.filter(
                        (position) => !criteria.primaryPositions.includes(position),
                      ) as PlayerPosition[],
                    })
                  }
                  selectedPositions={criteria.compatiblePositions}
                  title="Ruoli compatibili"
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.block}>
              <AppText variant="titleSm">Ruolo</AppText>
              <SelectField
                label=""
                onChange={(value) => patch({ coachStaffRole: value })}
                options={coachStaffRoleOptions(criteria.target)}
                placeholder="Seleziona un ruolo"
                searchable
                value={criteria.coachStaffRole ?? ""}
              />
            </View>
          )}

          <View style={styles.block}>
            <AppText variant="titleSm">Dove vuoi cercare?</AppText>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenGeo}
              style={styles.navRow}
            >
              <View style={styles.navText}>
                <AppText numberOfLines={1} variant="bodyLg">
                  {areaSummaryLabel(criteria)}
                </AppText>
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
            </Pressable>
          </View>

          <Button
            label="Altri filtri"
            leftIcon={
              <Ionicons color={colors.textSecondary} name="options-outline" size={16} />
            }
            onPress={onOpenFilters}
            variant="outline"
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[12] }]}>
          <Button fullWidth label="Mostra posizioni" onPress={onSubmit} variant="primary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[12],
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing[24],
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  navRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  navText: {
    flex: 1,
  },
});
