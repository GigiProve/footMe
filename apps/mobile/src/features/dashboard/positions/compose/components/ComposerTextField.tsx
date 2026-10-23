import { StyleSheet, TextInput, View } from "react-native";

import { colors, radius, sizes, spacing, typography } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";

type Props = {
  error?: string | null;
  label: string;
  limit: number;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  optional?: boolean;
  placeholder?: string;
  testID?: string;
  value: string;
};

/**
 * Campo di testo libero del composer (DAS-REV-16 §20, screen 05, 08, 10).
 *
 * «I campi sono plain text: nessun HTML libero, script, rich editor,
 * Markdown eseguibile o embed.» Un `TextInput` nudo è esattamente questo.
 *
 * «Mostra conteggio e limite vicino alla textarea quando utile, soprattutto
 * durante editing e prossimità del limite; non riempire la schermata di
 * contatori decorativi»: il contatore compare oltre il 70% del limite, non
 * su ogni campo vuoto.
 *
 * Il conteggio è su code point (`Array.from`) e non su code unit: §20 chiede
 * «conteggio Unicode coerente», e `value.length` conterebbe due caratteri
 * per un'emoji.
 */
export function ComposerTextField({
  error,
  label,
  limit,
  multiline = true,
  onChangeText,
  optional = true,
  placeholder,
  testID,
  value,
}: Props) {
  const length = Array.from(value).length;
  const showCounter = length > limit * 0.7;

  return (
    <View style={styles.block}>
      <View style={styles.labelRow}>
        <AppText color="neutralMuted" variant="meta">
          {label}
        </AppText>

        {optional ? (
          <AppText color="neutralMuted" variant="meta">
            {" · Opzionale"}
          </AppText>
        ) : null}
      </View>

      <TextInput
        accessibilityLabel={`${label}${optional ? ", opzionale" : ""}`}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textNeutralSoft}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          error ? styles.inputError : null,
        ]}
        testID={testID}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />

      {error ? (
        <AppText accessibilityRole="alert" color="danger" variant="meta">
          {error}
        </AppText>
      ) : showCounter ? (
        <AppText
          align="right"
          color={length > limit ? "danger" : "neutralMuted"}
          variant="meta"
        >
          {`${length}/${limit}`}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[6],
    paddingVertical: spacing[12],
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.textNeutral,
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  inputError: {
    borderColor: colors.danger,
  },
  labelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  multiline: {
    minHeight: sizes.multilineFieldMinHeight,
  },
});
