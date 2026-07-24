import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { BottomSheet, Button, Radio } from "../../../ui";

type SortSheetProps<T extends string> = {
  onApply: (value: T) => void;
  onClose: () => void;
  options: { label: string; value: T }[];
  value: T;
  visible: boolean;
};

export function SortSheet<T extends string>({
  onApply,
  onClose,
  options,
  value,
  visible,
}: SortSheetProps<T>) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) {
      setDraft(value);
    }
  }, [visible, value]);

  return (
    <BottomSheet onClose={onClose} title="Ordina risultati" visible={visible}>
      <View style={styles.options}>
        {options.map((option) => (
          <Radio
            checked={draft === option.value}
            key={option.value}
            label={option.label}
            onPress={() => setDraft(option.value)}
          />
        ))}
      </View>

      <Button
        fullWidth
        label="Applica"
        onPress={() => {
          onApply(draft);
          onClose();
        }}
        style={styles.applyButton}
        variant="primary"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  applyButton: {
    marginTop: spacing[16],
  },
  options: {
    gap: spacing[4],
  },
});
