import { StyleSheet, View } from "react-native";

import { spacing } from "../../styles";
import { Button, type ButtonSize } from "../Button/Button";

type ChipOption<T extends string> = {
  label: string;
  value: T;
};

type ChipGroupProps<T extends string> = {
  onChange: (value: T) => void;
  options: readonly ChipOption<T>[];
  size?: ButtonSize;
  value: T;
};

export function ChipGroup<T extends string>({
  onChange,
  options,
  size = "sm",
  value,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.container}>
      {options.map((option) => (
        <Button
          key={option.value}
          label={option.label}
          onPress={() => onChange(option.value)}
          selected={option.value === value}
          size={size}
          variant="chipAction"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
