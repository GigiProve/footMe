import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { Input } from "../../../ui";

type SearchBarProps = {
  autoFocus?: boolean;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  value: string;
};

export function SearchBar({
  autoFocus,
  onBlur,
  onChangeText,
  onFocus,
  onSubmitEditing,
  placeholder,
  value,
}: SearchBarProps) {
  return (
    <View style={styles.wrapper}>
      <Ionicons color={colors.textMuted} name="search-outline" size={18} />
      <View style={styles.inputSlot}>
        <Input
          autoFocus={autoFocus}
          onBlur={onBlur}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          returnKeyType="search"
          style={styles.input}
          value={value}
        />
      </View>
      {value.length > 0 ? (
        <Pressable
          accessibilityLabel="Cancella ricerca"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onChangeText("")}
        >
          <Ionicons color={colors.textMuted} name="close-circle" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[14],
  },
  inputSlot: {
    flex: 1,
  },
  input: {
    backgroundColor: "transparent",
    borderWidth: 0,
    minHeight: 44,
    paddingHorizontal: spacing[0],
  },
});
