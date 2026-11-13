/**
 * Campo testo del composer (HOM-06.1 §31–33, §179–180).
 *
 * Area editoriale aperta: nessun bordo, nessun fondo, nessuna card (§32).
 * Multilinea, cresce con il contenuto (`scrollEnabled={false}`: scorre la
 * schermata genitore, §38), supporta newline, emoji, link e Dynamic Type
 * (`allowFontScaling`, §33). Il `TextInput` nativo è l'unico punto in cui il
 * testo non passa da `AppText`: un input non può esserlo.
 *
 * `onSelectionChange` consegna `{ start, end }` già estratto dall'evento: serve
 * al chiamante per riconoscere il token `@` sotto il cursore (§110) senza
 * conoscere `NativeSyntheticEvent`. Le mention già inserite non sono evidenziate
 * nell'input: un `TextInput` controllato non tollera figli stilizzati senza
 * perdere il cursore; la resa accent della mention appartiene al Post
 * pubblicato (HOM-02).
 */

import type { Ref } from "react";
import { StyleSheet, TextInput } from "react-native";

import { colors, spacing, textVariants } from "../../../theme/tokens";

export const COMPOSER_BODY_PLACEHOLDER = "Di cosa vuoi parlare?";

type ComposerBodyInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  inputRef?: Ref<TextInput>;
  autoFocus?: boolean;
  maxLength?: number;
  /** false durante la pubblicazione (§119). */
  editable?: boolean;
  placeholder?: string;
};

export function ComposerBodyInput({
  value,
  onChangeText,
  onSelectionChange,
  inputRef,
  autoFocus = false,
  maxLength,
  editable = true,
  placeholder = COMPOSER_BODY_PLACEHOLDER,
}: ComposerBodyInputProps) {
  return (
    <TextInput
      accessibilityLabel={placeholder}
      allowFontScaling
      autoCapitalize="sentences"
      autoFocus={autoFocus}
      editable={editable}
      maxLength={maxLength}
      multiline
      onChangeText={onChangeText}
      onSelectionChange={(event) => onSelectionChange?.(event.nativeEvent.selection)}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      ref={inputRef}
      scrollEnabled={false}
      selectionColor={colors.accent}
      style={styles.input}
      testID="composer-body-input"
      textAlignVertical="top"
      underlineColorAndroid="transparent"
      value={value}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...textVariants.feedBody,
    color: colors.textPrimary,
    // Il testo del Post si scrive nella stessa misura (`feedBody`) con cui si legge
    // nel Feed; due righe di altezza minima bastano come area da toccare quando è
    // vuoto, senza lasciare un vuoto prima della griglia media con poche parole.
    minHeight: 64,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
});
