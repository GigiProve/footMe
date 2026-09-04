import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing, typography } from "../../styles";
import { AppText } from "../AppText/AppText";

/**
 * Campo di ricerca in testa a Cerca, Annunci e Messaggi (§1d, §1e, §1f):
 * 44px, fondo canvas dentro una testata bianca, bordo hairline, raggio 12.
 *
 * Con `onPress` diventa una superficie di navigazione (porta alla ricerca
 * vera); con `onChangeText` è un campo editabile.
 */
type SearchFieldProps = {
  autoFocus?: boolean;
  onChangeText?: (value: string) => void;
  onPress?: () => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  value?: string;
};

export function SearchField({
  autoFocus,
  onChangeText,
  onPress,
  onSubmitEditing,
  placeholder,
  style,
  testID,
  value,
}: SearchFieldProps) {
  const icon = (
    <Ionicons color={colors.textMuted} name="search-outline" size={18} />
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={placeholder}
        accessibilityRole="search"
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          pressed ? styles.pressed : null,
          style,
        ]}
        testID={testID}
      >
        {icon}
        <AppText color="muted" numberOfLines={1} style={styles.placeholder}>
          {value || placeholder}
        </AppText>
      </Pressable>
    );
  }

  return (
    <View style={[styles.field, style]}>
      {icon}
      <TextInput
        accessibilityLabel={placeholder}
        autoCorrect={false}
        autoFocus={autoFocus}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        style={styles.input}
        testID={testID}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[10],
    height: sizes.searchFieldHeight,
    paddingHorizontal: spacing[14],
  },
  input: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: typography.fontSize[14.5],
    padding: 0,
  },
  placeholder: {
    flex: 1,
    fontSize: typography.fontSize[14.5],
  },
  pressed: {
    opacity: 0.75,
  },
});

export type { SearchFieldProps };
