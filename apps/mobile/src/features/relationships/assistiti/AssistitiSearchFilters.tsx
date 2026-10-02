/**
 * I quattro filtri della ricerca assistiti: Ruolo, Categoria, Età, Zona.
 *
 * Non è un secondo sistema di filtri: lo stato viene tradotto in `filters`
 * della RPC `search_profiles_page`, la stessa che alimenta Cerca → Profili, e i
 * cataloghi sono quelli canonici (posizioni, categorie e regioni del profilo).
 * Qui vive soltanto la composizione a quattro chip del mockup.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../styles";
import { AppText, BottomSheet, Button } from "../../../ui";
import { ageRangeToClasse } from "../../search/search-filters";
import type { ProfileSearchFilters } from "../../search/search-types";
import {
  PLAYER_CATEGORY_OPTIONS,
  PLAYER_POSITION_OPTIONS,
  type PlayerPosition,
} from "../../profiles/player-sports";
import { REGION_OPTIONS } from "../../profiles/profile-form-utils";

export type AssistitiSearchFiltersState = {
  ageBand: AgeBand | null;
  category: string | null;
  position: PlayerPosition | null;
  region: string | null;
};

export type AgeBand = "u18" | "u21" | "u23" | "over23";

const AGE_BAND_OPTIONS: { label: string; value: AgeBand }[] = [
  { label: "Under 18", value: "u18" },
  { label: "Under 21", value: "u21" },
  { label: "Under 23", value: "u23" },
  { label: "Over 23", value: "over23" },
];

const AGE_BAND_RANGES: Record<AgeBand, { max: number | null; min: number | null }> = {
  over23: { max: null, min: 24 },
  u18: { max: 17, min: null },
  u21: { max: 20, min: null },
  u23: { max: 22, min: null },
};

export const EMPTY_SEARCH_FILTERS: AssistitiSearchFiltersState = {
  ageBand: null,
  category: null,
  position: null,
  region: null,
};

export function countActiveSearchFilters(
  state: AssistitiSearchFiltersState,
): number {
  return [state.position, state.category, state.ageBand, state.region].filter(
    Boolean,
  ).length;
}

/** Traduzione nello stesso payload jsonb che usa Cerca → Profili. */
export function buildAssistitiSearchPayload(
  state: AssistitiSearchFiltersState,
): ProfileSearchFilters | null {
  const payload: ProfileSearchFilters = {};
  const player: NonNullable<ProfileSearchFilters["player"]> = {};

  if (state.position) {
    player.positions = [state.position];
  }

  if (state.category) {
    player.categories = [state.category];
  }

  if (state.ageBand) {
    const { max, min } = AGE_BAND_RANGES[state.ageBand];
    const { classeMax, classeMin } = ageRangeToClasse(min, max);

    if (classeMin != null) {
      player.classe_min = classeMin;
    }

    if (classeMax != null) {
      player.classe_max = classeMax;
    }
  }

  if (state.region) {
    payload.region = state.region;
  }

  if (Object.keys(player).length > 0) {
    payload.player = player;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

type SheetKey = "position" | "category" | "age" | "region";

const SHEET_TITLES: Record<SheetKey, string> = {
  age: "Età",
  category: "Categoria",
  position: "Ruolo",
  region: "Zona",
};

export function AssistitiSearchFilters({
  onChange,
  value,
}: {
  onChange: (next: AssistitiSearchFiltersState) => void;
  value: AssistitiSearchFiltersState;
}) {
  const [openSheet, setOpenSheet] = useState<SheetKey | null>(null);

  const chips: { key: SheetKey; label: string; selected: boolean }[] = [
    {
      key: "position",
      label:
        PLAYER_POSITION_OPTIONS.find((o) => o.value === value.position)?.label ??
        "Ruolo",
      selected: value.position != null,
    },
    {
      key: "category",
      label: value.category ?? "Categoria",
      selected: value.category != null,
    },
    {
      key: "age",
      label:
        AGE_BAND_OPTIONS.find((o) => o.value === value.ageBand)?.label ?? "Età",
      selected: value.ageBand != null,
    },
    {
      key: "region",
      label: value.region ?? "Zona",
      selected: value.region != null,
    },
  ];

  function renderOptions(key: SheetKey) {
    const options: { label: string; value: string }[] =
      key === "position"
        ? PLAYER_POSITION_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          }))
        : key === "category"
          ? PLAYER_CATEGORY_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value,
            }))
          : key === "age"
            ? AGE_BAND_OPTIONS
            : REGION_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              }));

    const current =
      key === "position"
        ? value.position
        : key === "category"
          ? value.category
          : key === "age"
            ? value.ageBand
            : value.region;

    function select(next: string | null) {
      onChange({
        ...value,
        ...(key === "position"
          ? { position: next as PlayerPosition | null }
          : key === "category"
            ? { category: next }
            : key === "age"
              ? { ageBand: next as AgeBand | null }
              : { region: next }),
      });
      setOpenSheet(null);
    }

    return (
      <ScrollView style={styles.sheetList}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: current == null }}
          onPress={() => select(null)}
          style={styles.sheetRow}
        >
          <AppText variant="bodyLg">Tutti</AppText>
          {current == null ? (
            <Ionicons color={colors.accent} name="checkmark" size={18} />
          ) : null}
        </Pressable>
        {options.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: current === option.value }}
            key={option.value}
            onPress={() => select(option.value)}
            style={styles.sheetRow}
          >
            <AppText variant="bodyLg">{option.label}</AppText>
            {current === option.value ? (
              <Ionicons color={colors.accent} name="checkmark" size={18} />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <View>
      <ScrollView
        contentContainerStyle={styles.chipRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {chips.map((chip) => (
          <Button
            accessibilityLabel={`Filtro ${SHEET_TITLES[chip.key]}: ${chip.label}`}
            key={chip.key}
            label={chip.label}
            onPress={() => setOpenSheet(chip.key)}
            rightIcon={
              <Ionicons
                color={chip.selected ? colors.accent : colors.textMuted}
                name="chevron-down"
                size={14}
              />
            }
            selected={chip.selected}
            testID={`assistiti-search-filter-${chip.key}`}
            variant="chipAction"
          />
        ))}
      </ScrollView>

      <BottomSheet
        onClose={() => setOpenSheet(null)}
        title={openSheet ? SHEET_TITLES[openSheet] : ""}
        visible={openSheet != null}
      >
        {openSheet ? renderOptions(openSheet) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    gap: spacing[8],
    paddingVertical: spacing[4],
  },
  sheetList: {
    maxHeight: 360,
  },
  sheetRow: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    borderRadius: radius[8],
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing[4],
  },
});
