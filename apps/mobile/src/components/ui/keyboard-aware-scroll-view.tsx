import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import type { ScrollViewProps, TextInput as TextInputType } from "react-native";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "../../theme/tokens";

type KeyboardAwareContextValue = {
  scrollToFocusedInput: (input: Measurable | null, animated?: boolean) => void;
};

type KeyboardAwareScrollViewProps = PropsWithChildren<
  Omit<ScrollViewProps, "keyboardShouldPersistTaps"> & {
    dismissKeyboardOnTapOutside?: boolean;
    extraBottomOffset?: number;
    keyboardVerticalOffset?: number;
    scrollToFocusedInput?: boolean;
  }
>;

type Measurable = Pick<TextInputType, "measure">;
type ScrollableContainer = ScrollView &
  Measurable & {
    scrollTo: (options: { animated?: boolean; y?: number }) => void;
  };

type KeyboardPaddingParams = {
  bottomInset: number;
  extraBottomOffset: number;
  keyboardHeight: number;
  paddingBottom: number;
};

type ScrollTargetParams = {
  currentScrollOffset: number;
  inputBottom: number;
  inputTop: number;
  keyboardHeight: number;
  scrollBottom: number;
  scrollTop: number;
  visibleOffset: number;
};

const DEFAULT_VISIBLE_OFFSET = spacing[24];

const KeyboardAwareContext = createContext<KeyboardAwareContextValue | null>(null);

export function getKeyboardAwarePaddingBottom({
  bottomInset,
  extraBottomOffset,
  keyboardHeight,
  paddingBottom,
}: KeyboardPaddingParams) {
  return paddingBottom + bottomInset + extraBottomOffset + keyboardHeight;
}

export function getKeyboardAwareScrollTarget({
  currentScrollOffset,
  inputBottom,
  inputTop,
  keyboardHeight,
  scrollBottom,
  scrollTop,
  visibleOffset,
}: ScrollTargetParams) {
  const visibleTop = scrollTop + visibleOffset;
  const visibleBottom = scrollBottom - keyboardHeight - visibleOffset;

  if (inputBottom > visibleBottom) {
    return Math.max(currentScrollOffset + (inputBottom - visibleBottom), 0);
  }

  if (inputTop < visibleTop) {
    return Math.max(currentScrollOffset - (visibleTop - inputTop), 0);
  }

  return null;
}

export function useKeyboardAwareScroll() {
  return useContext(KeyboardAwareContext);
}

export function KeyboardAwareScrollView({
  children,
  contentContainerStyle,
  dismissKeyboardOnTapOutside = true,
  extraBottomOffset = 0,
  keyboardDismissMode,
  keyboardVerticalOffset = 0,
  onScroll,
  scrollToFocusedInput = true,
  ...props
}: KeyboardAwareScrollViewProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollableContainer | null>(null);
  const scrollOffsetRef = useRef(0);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardHeightRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flattenedContentStyle = useMemo(
    () => StyleSheet.flatten(contentContainerStyle) ?? {},
    [contentContainerStyle],
  );
  const contentPaddingBottom =
    typeof flattenedContentStyle.paddingBottom === "number"
      ? flattenedContentStyle.paddingBottom
      : 0;

  const clearScheduledScroll = useCallback(() => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
  }, []);

  const scrollInputIntoView = useCallback(
    (input: Measurable | null, animated = true) => {
      if (!scrollToFocusedInput || !input?.measure || !scrollViewRef.current?.measure) {
        return;
      }

      input.measure((
        _inputX: number,
        _inputY: number,
        _inputWidth: number,
        inputHeight: number,
        _inputPageX: number,
        inputPageY: number,
      ) => {
        scrollViewRef.current?.measure((
          _scrollX: number,
          _scrollY: number,
          _scrollWidth: number,
          scrollHeight: number,
          _scrollPageX: number,
          scrollPageY: number,
        ) => {
          const nextScrollTarget = getKeyboardAwareScrollTarget({
            currentScrollOffset: scrollOffsetRef.current,
            inputBottom: inputPageY + inputHeight,
            inputTop: inputPageY,
            keyboardHeight: keyboardHeightRef.current,
            scrollBottom: scrollPageY + scrollHeight,
            scrollTop: scrollPageY,
            visibleOffset: DEFAULT_VISIBLE_OFFSET,
          });

          if (nextScrollTarget === null) {
            return;
          }

          scrollViewRef.current?.scrollTo({
            animated,
            y: nextScrollTarget,
          });
        });
      });
    },
    [scrollToFocusedInput],
  );

  const scheduleScrollIntoView = useCallback(
    (input: Measurable | null, animated = true) => {
      clearScheduledScroll();

      scrollTimerRef.current = setTimeout(() => {
        scrollInputIntoView(input, animated);
      }, 48);
    },
    [clearScheduledScroll, scrollInputIntoView],
  );

  useEffect(() => {
    const keyboardShowEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const keyboardHideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const keyboardShowSubscription = Keyboard.addListener(
      keyboardShowEvent,
      (event) => {
        keyboardHeightRef.current = Math.max(
          (event.endCoordinates?.height ?? 0) - keyboardVerticalOffset,
          0,
        );
        setKeyboardHeight(keyboardHeightRef.current);

        const focusedInput =
          (TextInput.State?.currentlyFocusedInput?.() as Measurable | null) ?? null;
        scheduleScrollIntoView(focusedInput, true);
      },
    );
    const keyboardHideSubscription = Keyboard.addListener(keyboardHideEvent, () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      clearScheduledScroll();
    });

    return () => {
      clearScheduledScroll();
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, [clearScheduledScroll, keyboardVerticalOffset, scheduleScrollIntoView]);

  const keyboardAwareContextValue = useMemo<KeyboardAwareContextValue>(
    () => ({
      scrollToFocusedInput: (input, animated = true) =>
        scheduleScrollIntoView(input, animated),
    }),
    [scheduleScrollIntoView],
  );

  const scrollView = (
    <KeyboardAwareContext.Provider value={keyboardAwareContextValue}>
      <ScrollView
        {...props}
        contentContainerStyle={[
          contentContainerStyle,
          {
            paddingBottom: getKeyboardAwarePaddingBottom({
              bottomInset: insets.bottom,
              extraBottomOffset,
              keyboardHeight,
              paddingBottom: contentPaddingBottom,
            }),
          },
        ]}
        keyboardDismissMode={
          keyboardDismissMode ?? (Platform.OS === "ios" ? "interactive" : "on-drag")
        }
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
        ref={scrollViewRef}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </KeyboardAwareContext.Provider>
  );

  if (!dismissKeyboardOnTapOutside) {
    return scrollView;
  }

  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      {scrollView}
    </TouchableWithoutFeedback>
  );
}
