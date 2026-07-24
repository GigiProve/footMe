import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { Checkbox, Radio, Toggle } from "../../../../ui";
import { STAFF_ROLE_OPTIONS } from "../../profile-filters/profile-filter-configs";
import type {
  ProfileFiltersState,
  StaffScopeFilter,
} from "../../profile-filters/profile-filter-types";

export type StaffFilterEditorProps = {
  onChange: (next: ProfileFiltersState) => void;
  state: ProfileFiltersState;
};

export function RoleEditor({ onChange, state }: StaffFilterEditorProps) {
  const { roles } = state.staff;

  return (
    <View style={styles.container}>
      {STAFF_ROLE_OPTIONS.map((option) => (
        <Checkbox
          checked={roles.includes(option.value)}
          key={option.value}
          label={option.label}
          onValueChange={(checked) =>
            onChange({
              ...state,
              staff: {
                ...state.staff,
                roles: checked
                  ? [...roles, option.value]
                  : roles.filter((entry) => entry !== option.value),
              },
            })
          }
        />
      ))}
    </View>
  );
}

export function CertificationsEditor({ onChange, state }: StaffFilterEditorProps) {
  return (
    <View style={styles.container}>
      <Toggle
        label="Solo con titoli e certificazioni"
        onValueChange={(value) =>
          onChange({ ...state, staff: { ...state.staff, hasCertifications: value } })
        }
        value={state.staff.hasCertifications}
      />
    </View>
  );
}

export function ScopeEditor({ onChange, state }: StaffFilterEditorProps) {
  const { scope } = state.staff;

  return (
    <View style={styles.container}>
      <Radio
        checked={scope === null}
        label="Qualsiasi"
        onPress={() => onChange({ ...state, staff: { ...state.staff, scope: null } })}
      />
      <Radio
        checked={scope === "prima_squadra"}
        label="Prima squadra"
        onPress={() =>
          onChange({
            ...state,
            staff: { ...state.staff, scope: "prima_squadra" as StaffScopeFilter },
          })
        }
      />
      <Radio
        checked={scope === "settore_giovanile"}
        label="Settore giovanile"
        onPress={() =>
          onChange({
            ...state,
            staff: { ...state.staff, scope: "settore_giovanile" as StaffScopeFilter },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
});
