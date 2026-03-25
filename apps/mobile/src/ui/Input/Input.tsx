import { ComponentProps, forwardRef, useMemo, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useKeyboardAwareScroll } from "../../components/ui/keyboard-aware-scroll-view";
import { colors, radius, spacing, typography } from "../../styles";
import { AppText } from "../AppText/AppText";

type InputProps = {
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  label?: string;
} & ComponentProps<typeof TextInput>;

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    disabled = false,
    error = false,
    helperText,
    label,
    multiline,
    onBlur,
    onContentSizeChange,
    onFocus,
    style,
    value,
    ...props
  },
  forwardedRef,
) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const keyboardAwareScroll = useKeyboardAwareScroll();
  const hasValue = typeof value === "string" && value.trim().length > 0;
  const setRefs = useMemo(
    () => (node: TextInput | null) => {
      inputRef.current = node;

      if (typeof forwardedRef === "function") {
        forwardedRef(node);
        return;
      }

      if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  return (
    <View style={styles.wrapper}>
      {label ? <AppText variant="caption" color="muted" style={styles.label}>{label}</AppText> : null}
      <TextInput
        editable={!disabled}
        multiline={multiline}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        onContentSizeChange={(event) => {
          if (multiline && isFocused) {
            keyboardAwareScroll?.scrollToFocusedInput(inputRef.current, false);
          }

          onContentSizeChange?.(event);
        }}
        onFocus={(event) => {
          setIsFocused(true);
          keyboardAwareScroll?.scrollToFocusedInput(inputRef.current, true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.textMuted}
        ref={setRefs}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          hasValue && !isFocused ? styles.filledInput : null,
          isFocused ? styles.focusedInput : null,
          error ? styles.errorInput : null,
          disabled ? styles.disabledInput : null,
          style,
        ]}
        value={value}
        {...props}
      />
      {helperText ? (
        <AppText
          variant="caption"
          color={error ? "danger" : "muted"}
          style={styles.helperText}
        >
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[8],
  },
  label: {
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.fontSize[13],
  },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[6],
    backgroundColor: colors.inputBackground,
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  focusedInput: {
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  filledInput: {
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  errorInput: {
    borderColor: colors.danger,
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: colors.surfaceMuted,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  helperText: {
    fontSize: typography.fontSize[13],
    lineHeight: 18,
  },
});
