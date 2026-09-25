import { StyleSheet, View } from "react-native";

import { OnboardingSelectField } from "../ui";

type PlayerMeasureFieldProps = {
  label: string;
  min: number;
  max: number;
  unit: "cm" | "kg";
  value: string;
  onChange: (value: string) => void;
};

function buildOptions(min: number, max: number, unit: string) {
  return Array.from({ length: max - min + 1 }, (_, index) => {
    const measure = String(min + index);

    return { label: `${measure} ${unit}`, value: measure };
  });
}

/**
 * Altezza e peso: una misura scelta da una lista, non digitata a mano.
 * Usa il bottom sheet condiviso invece della vecchia ruota (REV-ONB-01 §X).
 */
export function PlayerMeasureField({
  label,
  max,
  min,
  onChange,
  unit,
  value,
}: PlayerMeasureFieldProps) {
  return (
    <View style={styles.container}>
      <OnboardingSelectField
        label={label}
        onChange={onChange}
        options={buildOptions(min, max, unit)}
        placeholder={`— ${unit}`}
        searchable
        sheetTitle={label}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
