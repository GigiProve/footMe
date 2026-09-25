import { type ComponentProps, type ReactNode, forwardRef, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useKeyboardAwareScroll } from "../../../components/ui/keyboard-aware-scroll-view";
import { colors, typography } from "../../../styles";
import { FieldShell } from "./FieldShell";
import {
  onboardingBorderWidth,
  onboardingLayout,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

type OnboardingTextFieldProps = {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  optional?: boolean;
  disabled?: boolean;
  /**
   * Azione in coda al campo (es. il calendario di una data). Solo azioni
   * reali: nessuna icona decorativa (§J).
   */
  trailing?: ReactNode;
  onTrailingPress?: () => void;
  trailingAccessibilityLabel?: string;
} & Omit<ComponentProps<typeof TextInput>, "editable" | "style">;

/**
 * Campo di testo comune a tutti gli onboarding (§J). Più compatto del
 * vecchio input, senza icone decorative, con stati default / focus / filled /
 * error / disabled.
 */
export const OnboardingTextField = forwardRef<TextInput, OnboardingTextFieldProps>(
  function OnboardingTextField(
    {
      disabled = false,
      errorMessage,
      helperText,
      label,
      multiline,
      onBlur,
      onFocus,
      optional,
      trailing,
      trailingAccessibilityLabel,
      onTrailingPress,
      ...props
    },
    forwardedRef,
  ) {
    const [isFocused, setIsFocused] = useState(false);
    const innerRef = useRef<TextInput | null>(null);
    const keyboardAwareScroll = useKeyboardAwareScroll();
    const hasError = Boolean(errorMessage);

    function setRefs(node: TextInput | null) {
      innerRef.current = node;

      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    }

    return (
      <FieldShell
        errorMessage={errorMessage}
        helperText={helperText}
        label={label}
        optional={optional}
      >
        <View
          style={[
            styles.control,
            multiline ? styles.multilineControl : null,
            isFocused ? styles.focused : null,
            hasError ? styles.error : null,
            disabled ? styles.disabled : null,
          ]}
        >
          <TextInput
            accessibilityLabel={label}
            editable={!disabled}
            multiline={multiline}
            onBlur={(event) => {
              setIsFocused(false);
              onBlur?.(event);
            }}
            onFocus={(event) => {
              setIsFocused(true);
              keyboardAwareScroll?.scrollToFocusedInput(innerRef.current, true);
              onFocus?.(event);
            }}
            placeholderTextColor={colors.textMuted}
            ref={setRefs}
            style={[styles.input, multiline ? styles.multilineInput : null]}
            {...props}
          />

          {trailing ? (
            onTrailingPress ? (
              <Pressable
                accessibilityLabel={trailingAccessibilityLabel}
                accessibilityRole="button"
                hitSlop={8}
                onPress={onTrailingPress}
                style={styles.trailing}
              >
                {trailing}
              </Pressable>
            ) : (
              <View style={styles.trailing}>{trailing}</View>
            )
          ) : null}
        </View>
      </FieldShell>
    );
  },
);

const styles = StyleSheet.create({
  control: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: onboardingRadius.control,
    borderWidth: onboardingBorderWidth.hairline,
    flexDirection: "row",
    minHeight: onboardingLayout.controlHeight,
    paddingHorizontal: onboardingSpacing.m - 2,
  },
  multilineControl: {
    alignItems: "flex-start",
    minHeight: 104,
    paddingVertical: onboardingSpacing.s + 2,
  },
  focused: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: onboardingBorderWidth.selected,
  },
  error: {
    borderColor: colors.danger,
    borderWidth: onboardingBorderWidth.selected,
  },
  disabled: {
    opacity: 0.55,
  },
  input: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: typography.fontSize[15],
    fontWeight: typography.fontWeight.medium,
    paddingVertical: onboardingSpacing.s + 2,
  },
  multilineInput: {
    lineHeight: typography.lineHeight[22],
    paddingVertical: 0,
    textAlignVertical: "top",
  },
  trailing: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: onboardingSpacing.s,
    minHeight: onboardingSpacing.l,
    minWidth: onboardingSpacing.l,
  },
});
