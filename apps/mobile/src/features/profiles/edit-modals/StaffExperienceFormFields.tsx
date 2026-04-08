import { StyleSheet, TextInput, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type Props = {
  headCoachName: string;
  onHeadCoachNameChange: (value: string) => void;
};

export function StaffExperienceFormFields({
  headCoachName,
  onHeadCoachNameChange,
}: Props) {
  return (
    <View style={styles.container}>
      <AppText variant="caption" color="secondary">
        Con chi ha lavorato (opzionale)
      </AppText>
      <TextInput
        onChangeText={onHeadCoachNameChange}
        placeholder="Nome allenatore..."
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={headCoachName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.textPrimary,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
});
