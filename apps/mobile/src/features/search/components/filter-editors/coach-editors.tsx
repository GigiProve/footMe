import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { Checkbox, Input, Radio } from "../../../../ui";
import {
  COACH_BACKGROUND_OPTIONS,
  COACH_CONTEXT_OPTIONS,
  COACH_FILTER_ROLE_OPTIONS,
  COACH_LICENSE_FILTER_OPTIONS,
} from "../../profile-filters/profile-filter-configs";
import type {
  CoachContextFilter,
  ProfileFiltersState,
} from "../../profile-filters/profile-filter-types";

export type CoachFilterEditorProps = {
  onChange: (next: ProfileFiltersState) => void;
  state: ProfileFiltersState;
};

export function RoleEditor({ onChange, state }: CoachFilterEditorProps) {
  return (
    <View style={styles.container}>
      <Radio
        checked={state.coach.role === null}
        label="Qualsiasi"
        onPress={() => onChange({ ...state, coach: { ...state.coach, role: null } })}
      />
      {COACH_FILTER_ROLE_OPTIONS.map((option) => (
        <Radio
          checked={state.coach.role === option.value}
          key={option.value}
          label={option.label}
          onPress={() => onChange({ ...state, coach: { ...state.coach, role: option.value } })}
        />
      ))}
    </View>
  );
}

export function LicenseEditor({ onChange, state }: CoachFilterEditorProps) {
  const selected = state.coach.licenses[0] ?? null;

  return (
    <View style={styles.container}>
      {COACH_LICENSE_FILTER_OPTIONS.map((option) => (
        <Radio
          checked={selected === option.value}
          key={option.value}
          label={option.label}
          onPress={() =>
            onChange({ ...state, coach: { ...state.coach, licenses: [option.value] } })
          }
        />
      ))}
      <Radio
        checked={selected === null}
        label="Nessuna preferenza"
        onPress={() => onChange({ ...state, coach: { ...state.coach, licenses: [] } })}
      />
    </View>
  );
}

export function ExperienceEditor({ onChange, state }: CoachFilterEditorProps) {
  const { context, minSeasons } = state.coach;

  return (
    <View style={styles.container}>
      <Radio
        checked={context === null}
        label="Qualsiasi ambito"
        onPress={() => onChange({ ...state, coach: { ...state.coach, context: null } })}
      />
      {COACH_CONTEXT_OPTIONS.map((option) => (
        <Radio
          checked={context === option.value}
          key={option.value}
          label={option.label}
          onPress={() =>
            onChange({
              ...state,
              coach: { ...state.coach, context: option.value as CoachContextFilter },
            })
          }
        />
      ))}

      <Input
        keyboardType="number-pad"
        label="Stagioni minime"
        onChangeText={(value) =>
          onChange({
            ...state,
            coach: {
              ...state.coach,
              minSeasons: value ? Number(value.replace(/[^\d]/g, "")) : null,
            },
          })
        }
        placeholder="Es. 3"
        value={minSeasons != null ? String(minSeasons) : ""}
      />
    </View>
  );
}

export function BackgroundEditor({ onChange, state }: CoachFilterEditorProps) {
  const { backgrounds } = state.coach;

  return (
    <View style={styles.container}>
      {COACH_BACKGROUND_OPTIONS.map((option) => (
        <Checkbox
          checked={backgrounds.includes(option.value)}
          key={option.value}
          label={option.label}
          onValueChange={(checked) =>
            onChange({
              ...state,
              coach: {
                ...state.coach,
                backgrounds: checked
                  ? [...backgrounds, option.value]
                  : backgrounds.filter((entry) => entry !== option.value),
              },
            })
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
});
