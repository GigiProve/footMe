import { StyleSheet, View } from "react-native";

import { PREFERRED_FOOT_OPTIONS } from "../../../profiles/player-sports";
import { FootballPositionPicker } from "../../../profiles/football-position-picker";
import { spacing } from "../../../../theme/tokens";
import { AppText, ChipGroup, Input, Radio, Toggle } from "../../../../ui";
import { PLAYER_SITUATION_OPTIONS } from "../../profile-filters/profile-filter-configs";
import { ageRangeToClasse } from "../../search-filters";
import type {
  PlayerSituationFilter,
  ProfileFiltersState,
} from "../../profile-filters/profile-filter-types";

export type PlayerFilterEditorProps = {
  onChange: (next: ProfileFiltersState) => void;
  state: ProfileFiltersState;
};

export function RoleEditor({ onChange, state }: PlayerFilterEditorProps) {
  return (
    <View style={styles.container}>
      <AppText color="secondary" variant="bodySm">
        Seleziona il ruolo principale e gli eventuali ruoli compatibili.
      </AppText>
      <FootballPositionPicker
        mode="multiple"
        onSelect={(positions) =>
          onChange({ ...state, player: { ...state.player, positions } })
        }
        selectedPositions={state.player.positions}
        title="Ruolo"
      />
    </View>
  );
}

const AGE_SHORTCUTS: { ageMin?: number; ageMax?: number; label: string; value: string }[] = [
  { ageMax: 19, label: "Under 19", value: "u19" },
  { ageMax: 21, label: "Under 21", value: "u21" },
  { ageMin: 23, label: "Over 23", value: "o23" },
];

export function AgeEditor({ onChange, state }: PlayerFilterEditorProps) {
  const { classeMin, classeMax } = state.player;

  function applyShortcut(value: string | null) {
    const shortcut = AGE_SHORTCUTS.find((entry) => entry.value === value);
    if (!shortcut) {
      onChange({ ...state, player: { ...state.player, classeMin: null, classeMax: null } });
      return;
    }
    const range = ageRangeToClasse(shortcut.ageMin, shortcut.ageMax);
    onChange({
      ...state,
      player: {
        ...state.player,
        classeMin: range.classeMin ?? null,
        classeMax: range.classeMax ?? null,
      },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Input
            keyboardType="number-pad"
            label="Classe minima"
            onChangeText={(value) =>
              onChange({
                ...state,
                player: {
                  ...state.player,
                  classeMin: value ? Number(value.replace(/[^\d]/g, "")) : null,
                },
              })
            }
            placeholder="Es. 2004"
            value={classeMin != null ? String(classeMin) : ""}
          />
        </View>
        <View style={styles.rowItem}>
          <Input
            keyboardType="number-pad"
            label="Classe massima"
            onChangeText={(value) =>
              onChange({
                ...state,
                player: {
                  ...state.player,
                  classeMax: value ? Number(value.replace(/[^\d]/g, "")) : null,
                },
              })
            }
            placeholder="Es. 2007"
            value={classeMax != null ? String(classeMax) : ""}
          />
        </View>
      </View>

      <ChipGroup
        onChange={applyShortcut}
        options={AGE_SHORTCUTS.map((entry) => ({ label: entry.label, value: entry.value }))}
        value={null}
      />
    </View>
  );
}

export function SituationEditor({ onChange, state }: PlayerFilterEditorProps) {
  return (
    <View style={styles.container}>
      {PLAYER_SITUATION_OPTIONS.map((option) => (
        <Radio
          checked={state.player.situation === option.value}
          key={option.value}
          label={option.label}
          onPress={() =>
            onChange({
              ...state,
              player: { ...state.player, situation: option.value as PlayerSituationFilter },
            })
          }
        />
      ))}
    </View>
  );
}

export function TraitsEditor({ onChange, state }: PlayerFilterEditorProps) {
  const { heightMax, heightMin, preferredFoot, hasVideo } = state.player;

  return (
    <View style={styles.container}>
      <AppText color="muted" variant="caption">
        Piede preferito
      </AppText>
      <ChipGroup
        onChange={(value) =>
          onChange({ ...state, player: { ...state.player, preferredFoot: value } })
        }
        options={PREFERRED_FOOT_OPTIONS}
        value={preferredFoot}
      />

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Input
            keyboardType="number-pad"
            label="Altezza minima (cm)"
            onChangeText={(value) =>
              onChange({
                ...state,
                player: {
                  ...state.player,
                  heightMin: value ? Number(value.replace(/[^\d]/g, "")) : null,
                },
              })
            }
            placeholder="Es. 170"
            value={heightMin != null ? String(heightMin) : ""}
          />
        </View>
        <View style={styles.rowItem}>
          <Input
            keyboardType="number-pad"
            label="Altezza massima (cm)"
            onChangeText={(value) =>
              onChange({
                ...state,
                player: {
                  ...state.player,
                  heightMax: value ? Number(value.replace(/[^\d]/g, "")) : null,
                },
              })
            }
            placeholder="Es. 195"
            value={heightMax != null ? String(heightMax) : ""}
          />
        </View>
      </View>

      <Toggle
        label="Solo profili con video"
        onValueChange={(value) =>
          onChange({ ...state, player: { ...state.player, hasVideo: value } })
        }
        value={hasVideo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  row: {
    flexDirection: "row",
    gap: spacing[12],
  },
  rowItem: {
    flex: 1,
  },
});
