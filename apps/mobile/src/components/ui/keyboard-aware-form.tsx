import type { PropsWithChildren } from "react";
import type { ScrollViewProps } from "react-native";

import { spacing } from "../../theme/tokens";
import { KeyboardAwareScrollView } from "./keyboard-aware-scroll-view";

/**
 * Extra bottom space added by default so CTA buttons
 * (Salva / Continua / Conferma) remain visible above the keyboard.
 */
const DEFAULT_FORM_EXTRA_BOTTOM_OFFSET = spacing[24];

type KeyboardAwareFormProps = PropsWithChildren<
  Omit<ScrollViewProps, "keyboardShouldPersistTaps"> & {
    /** Whether tapping outside an input dismisses the keyboard. Defaults to true. */
    dismissKeyboardOnTapOutside?: boolean;
    /** Additional bottom offset to ensure CTA buttons remain visible. Defaults to 24. */
    extraBottomOffset?: number;
    /** Offset for keyboard vertical position adjustments. */
    keyboardVerticalOffset?: number;
    /** Whether the view automatically scrolls to the focused input. Defaults to true. */
    scrollToFocusedInput?: boolean;
  }
>;

/**
 * Global, reusable form wrapper that guarantees inputs are never hidden
 * by the on-screen keyboard.
 *
 * Built on top of `KeyboardAwareScrollView` with form-specific defaults:
 * - extra bottom padding so CTA buttons stay visible
 * - tap-outside-to-dismiss enabled by default
 * - auto-scroll to the focused field
 *
 * Use this component to wrap every screen that contains form inputs.
 *
 * @example
 * ```tsx
 * <Screen>
 *   <KeyboardAwareForm contentContainerStyle={styles.container}>
 *     <Input label="Nome" value={name} onChangeText={setName} />
 *     <Input label="Bio" multiline value={bio} onChangeText={setBio} />
 *     <Button label="Salva" onPress={handleSave} />
 *   </KeyboardAwareForm>
 * </Screen>
 * ```
 */
export function KeyboardAwareForm({
  children,
  extraBottomOffset = DEFAULT_FORM_EXTRA_BOTTOM_OFFSET,
  ...props
}: KeyboardAwareFormProps) {
  return (
    <KeyboardAwareScrollView extraBottomOffset={extraBottomOffset} {...props}>
      {children}
    </KeyboardAwareScrollView>
  );
}
