import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input, ModalHeader, Radio } from "../../../ui";
import { usePositionsSearch } from "./positions-search-context";

type PositionFiltersModalProps = {
  visible: boolean;
  onClose: () => void;
};

const TEAM_TYPE_OPTIONS: { label: string; value: "senior" | "youth" | null }[] = [
  { label: "Tutte le squadre", value: null },
  { label: "Prima squadra", value: "senior" },
  { label: "Settore giovanile", value: "youth" },
];

export function PositionFiltersModal({ visible, onClose }: PositionFiltersModalProps) {
  const insets = useSafeAreaInsets();
  const { criteria, patch } = usePositionsSearch();
  const [categoryInput, setCategoryInput] = useState("");

  function addCategory() {
    const value = categoryInput.trim();
    if (value.length === 0 || criteria.categories.includes(value)) {
      setCategoryInput("");
      return;
    }
    patch({ categories: [...criteria.categories, value] });
    setCategoryInput("");
  }

  function removeCategory(value: string) {
    patch({ categories: criteria.categories.filter((item) => item !== value) });
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ModalHeader onClose={onClose} title="Altri filtri" />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.block}>
            <AppText variant="titleSm">Tipo squadra</AppText>
            {TEAM_TYPE_OPTIONS.map((option) => (
              <Radio
                checked={criteria.teamType === option.value}
                key={option.label}
                label={option.label}
                onPress={() => patch({ teamType: option.value })}
              />
            ))}
          </View>

          <View style={styles.block}>
            <AppText variant="titleSm">Categoria</AppText>
            <Input
              onChangeText={setCategoryInput}
              onSubmitEditing={addCategory}
              placeholder="Es. Serie D, Eccellenza"
              returnKeyType="done"
              value={categoryInput}
            />
            {criteria.categories.length > 0 ? (
              <View style={styles.chips}>
                {criteria.categories.map((category) => (
                  <Pressable
                    accessibilityLabel={`Rimuovi ${category}`}
                    accessibilityRole="button"
                    key={category}
                    onPress={() => removeCategory(category)}
                    style={styles.chip}
                  >
                    <AppText color="accent" variant="bodySm">
                      {category}
                    </AppText>
                    <Ionicons color={colors.accent} name="close" size={14} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[12] }]}>
          <Button fullWidth label="Mostra posizioni" onPress={onClose} variant="primary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[10],
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
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
});
