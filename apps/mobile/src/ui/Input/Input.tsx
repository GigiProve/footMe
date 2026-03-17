import { ComponentProps, forwardRef, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useKeyboardAwareScroll } from "../../components/ui/keyboard-aware-scroll-view";
import { colors, radius, sizes, spacing, typography } from "../../styles";

type InputProps = {
  label?: string;
} & ComponentProps<typeof TextInput>;

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
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
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
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
          style,
        ]}
        value={value}
        {...props}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[8],
  },
  label: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  input: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[16],
    backgroundColor: colors.background,
  },
  focusedInput: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.surface,
  },
  filledInput: {
    borderColor: colors.accentSoft,
    backgroundColor: colors.accentSoft,
  },
  multiline: {
    minHeight: sizes.multilineFieldMinHeight,
    textAlignVertical: "top",
  },
});
