import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { Button, Checkbox, Input, Radio, Toggle } from "../../../../ui";
import {
  AGENT_AREA_SPECIAL_OPTIONS,
  AGENT_MANAGED_BAND_OPTIONS,
  AGENT_PLAYER_TYPE_FILTER_OPTIONS,
  REGION_OPTIONS,
} from "../../profile-filters/profile-filter-configs";
import type { ProfileFiltersState } from "../../profile-filters/profile-filter-types";

export type AgentFilterEditorProps = {
  onChange: (next: ProfileFiltersState) => void;
  state: ProfileFiltersState;
};

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

export function AreaEditor({ onChange, state }: AgentFilterEditorProps) {
  const { operatingAreas } = state.agent;

  function handleToggle(value: string) {
    onChange({
      ...state,
      agent: { ...state.agent, operatingAreas: toggleValue(operatingAreas, value) },
    });
  }

  return (
    <View style={styles.container}>
      <Checkbox
        checked={operatingAreas.includes(AGENT_AREA_SPECIAL_OPTIONS.allItaly)}
        label="Tutta Italia"
        onValueChange={() => handleToggle(AGENT_AREA_SPECIAL_OPTIONS.allItaly)}
      />
      <Checkbox
        checked={operatingAreas.includes(AGENT_AREA_SPECIAL_OPTIONS.abroad)}
        label="Estero"
        onValueChange={() => handleToggle(AGENT_AREA_SPECIAL_OPTIONS.abroad)}
      />

      <View style={styles.chipRow}>
        {REGION_OPTIONS.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            onPress={() => handleToggle(option.value)}
            selected={operatingAreas.includes(option.value)}
            size="sm"
            variant="chipAction"
          />
        ))}
      </View>
    </View>
  );
}

export function CategoriesEditor({ onChange, state }: AgentFilterEditorProps) {
  const { playerTypes } = state.agent;

  return (
    <View style={styles.chipRow}>
      {AGENT_PLAYER_TYPE_FILTER_OPTIONS.map((option) => (
        <Button
          key={option.value}
          label={option.label}
          onPress={() =>
            onChange({
              ...state,
              agent: { ...state.agent, playerTypes: toggleValue(playerTypes, option.value) },
            })
          }
          selected={playerTypes.includes(option.value)}
          size="sm"
          variant="chipAction"
        />
      ))}
    </View>
  );
}

export function AssistedEditor({ onChange, state }: AgentFilterEditorProps) {
  const selected = state.agent.managedBands[0] ?? null;

  return (
    <View style={styles.container}>
      {AGENT_MANAGED_BAND_OPTIONS.map((option) => (
        <Radio
          checked={selected === option.value}
          key={option.value}
          label={option.label}
          onPress={() =>
            onChange({ ...state, agent: { ...state.agent, managedBands: [option.value] } })
          }
        />
      ))}
      <Radio
        checked={selected === null}
        label="Nessuna preferenza"
        onPress={() => onChange({ ...state, agent: { ...state.agent, managedBands: [] } })}
      />
    </View>
  );
}

export function ExperienceEditor({ onChange, state }: AgentFilterEditorProps) {
  const { minYears } = state.agent;

  return (
    <View style={styles.container}>
      <Input
        keyboardType="number-pad"
        label="Anni minimi di esperienza"
        onChangeText={(value) =>
          onChange({
            ...state,
            agent: { ...state.agent, minYears: value ? Number(value.replace(/[^\d]/g, "")) : null },
          })
        }
        placeholder="Es. 5"
        value={minYears != null ? String(minYears) : ""}
      />
    </View>
  );
}

export function LicenseEditor({ onChange, state }: AgentFilterEditorProps) {
  const { hasLicense } = state.agent;

  return (
    <View style={styles.container}>
      <Radio
        checked={hasLicense === true}
        label="Licenza presente"
        onPress={() => onChange({ ...state, agent: { ...state.agent, hasLicense: true } })}
      />
      <Radio
        checked={hasLicense !== true}
        label="Nessuna preferenza"
        onPress={() => onChange({ ...state, agent: { ...state.agent, hasLicense: null } })}
      />
    </View>
  );
}

export function AvailabilityEditor({ onChange, state }: AgentFilterEditorProps) {
  return (
    <View style={styles.container}>
      <Toggle
        label="Valuta nuovi assistiti"
        onValueChange={(value) =>
          onChange({ ...state, agent: { ...state.agent, acceptsNewClients: value } })
        }
        value={state.agent.acceptsNewClients}
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
