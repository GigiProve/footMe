import { StyleSheet, View } from "react-native";

import { SelectField } from "../../../../components/ui/select-field";
import { spacing } from "../../../../theme/tokens";
import { AppText, Button, Toggle } from "../../../../ui";
import {
  COACH_CATEGORY_FILTER_OPTIONS,
  PLAYER_CATEGORY_OPTIONS,
  PROVINCE_OPTIONS,
  REGION_OPTIONS,
} from "../../profile-filters/profile-filter-configs";
import type { ProfileFiltersState } from "../../profile-filters/profile-filter-types";
import type { SearchProfileRole } from "../../search-types";

type CategoryEditorProps = {
  onChange: (next: ProfileFiltersState) => void;
  role: Exclude<SearchProfileRole, "agent">;
  state: ProfileFiltersState;
};

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/**
 * Category chips, shared between player (competitive tiers), coach and
 * staff (club sector categories). No scope Radio is rendered here — coach's
 * ambito is already covered by its own "Esperienza" section and staff's by
 * "Ambito preferito", so a duplicate control was dropped to avoid two
 * controls editing overlapping concepts (deviation from the plan text,
 * documented in the final report).
 */
export function CategoryEditor({ onChange, role, state }: CategoryEditorProps) {
  const options = role === "player" ? PLAYER_CATEGORY_OPTIONS : COACH_CATEGORY_FILTER_OPTIONS;

  const selected =
    role === "player"
      ? state.player.categories
      : role === "coach"
        ? state.coach.coachedCategories
        : state.staff.categories;

  function handleToggle(value: string) {
    const next = toggleValue(selected, value);
    if (role === "player") {
      onChange({ ...state, player: { ...state.player, categories: next } });
    } else if (role === "coach") {
      onChange({ ...state, coach: { ...state.coach, coachedCategories: next } });
    } else {
      onChange({ ...state, staff: { ...state.staff, categories: next } });
    }
  }

  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Button
          key={option.value}
          label={option.label}
          onPress={() => handleToggle(option.value)}
          selected={selected.includes(option.value)}
          size="sm"
          variant="chipAction"
        />
      ))}
    </View>
  );
}

type ZoneEditorProps = {
  onChange: (next: ProfileFiltersState) => void;
  role: Exclude<SearchProfileRole, "agent">;
  state: ProfileFiltersState;
};

export function ZoneEditor({ onChange, role, state }: ZoneEditorProps) {
  if (role === "player") {
    const s = state.player;
    return (
      <View style={styles.container}>
        <SelectField
          label="Regione"
          onChange={(value) => onChange({ ...state, player: { ...s, region: value || null } })}
          options={REGION_OPTIONS}
          placeholder="Seleziona regione"
          value={s.region ?? ""}
          allowClear
          searchable
        />
        <SelectField
          label="Provincia"
          onChange={(value) => onChange({ ...state, player: { ...s, province: value || null } })}
          options={PROVINCE_OPTIONS}
          placeholder="Seleziona provincia"
          value={s.province ?? ""}
          allowClear
          searchable
        />

        <AppText color="muted" variant="caption">
          Aree accettate per il trasferimento
        </AppText>
        <View style={styles.chipRow}>
          {REGION_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              onPress={() =>
                onChange({
                  ...state,
                  player: { ...s, acceptedAreas: toggleValue(s.acceptedAreas, option.value) },
                })
              }
              selected={s.acceptedAreas.includes(option.value)}
              size="sm"
              variant="chipAction"
            />
          ))}
        </View>

        <Toggle
          label="Disponibile al trasferimento"
          onValueChange={(value) => onChange({ ...state, player: { ...s, openToTransfer: value } })}
          value={s.openToTransfer}
        />
        <Toggle
          label="Disponibile a valutare opportunità"
          onValueChange={(value) => onChange({ ...state, player: { ...s, available: value } })}
          value={s.available}
        />
      </View>
    );
  }

  if (role === "coach") {
    const s = state.coach;
    return (
      <View style={styles.container}>
        <SelectField
          label="Regione"
          onChange={(value) => onChange({ ...state, coach: { ...s, region: value || null } })}
          options={REGION_OPTIONS}
          placeholder="Seleziona regione"
          value={s.region ?? ""}
          allowClear
          searchable
        />
        <SelectField
          label="Provincia (aree accettate)"
          onChange={(value) => onChange({ ...state, coach: { ...s, province: value || null } })}
          options={PROVINCE_OPTIONS}
          placeholder="Seleziona provincia"
          value={s.province ?? ""}
          allowClear
          searchable
        />
        <Toggle
          label="Solo disponibili"
          onValueChange={(value) => onChange({ ...state, coach: { ...s, availableNow: value } })}
          value={s.availableNow}
        />
      </View>
    );
  }

  const s = state.staff;
  return (
    <View style={styles.container}>
      <SelectField
        label="Regione"
        onChange={(value) => onChange({ ...state, staff: { ...s, region: value || null } })}
        options={REGION_OPTIONS}
        placeholder="Seleziona regione"
        value={s.region ?? ""}
        allowClear
        searchable
      />
      <SelectField
        label="Provincia (aree accettate)"
        onChange={(value) => onChange({ ...state, staff: { ...s, province: value || null } })}
        options={PROVINCE_OPTIONS}
        placeholder="Seleziona provincia"
        value={s.province ?? ""}
        allowClear
        searchable
      />
      <Toggle
        label="Solo disponibili"
        onValueChange={(value) => onChange({ ...state, staff: { ...s, availableNow: value } })}
        value={s.availableNow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  container: {
    gap: spacing[16],
  },
});
