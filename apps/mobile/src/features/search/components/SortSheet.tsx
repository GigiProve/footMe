import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { BottomSheet, Button, Radio } from "../../../ui";
import type { ProfileSearchSort } from "../search-types";

type SortSheetProps = {
  onApply: (value: ProfileSearchSort) => void;
  onClose: () => void;
  options: { label: string; value: ProfileSearchSort }[];
  value: ProfileSearchSort;
  visible: boolean;
};

export function SortSheet({ onApply, onClose, options, value, visible }: SortSheetProps) {
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
