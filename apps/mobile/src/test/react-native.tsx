import type { PropsWithChildren } from "react";

import { createElement, forwardRef } from "react";

const createComponent = (name: string) =>
  function MockComponent({
    children,
    ...props
  }: PropsWithChildren<Record<string, unknown>>) {
    return createElement(name, props, children);
  };

const createRefComponent = (name: string) =>
  forwardRef(function MockRefComponent(
    { children, ...props }: PropsWithChildren<Record<string, unknown>>,
    ref,
  ) {
    return createElement(name, { ...props, ref }, children);
  });

export const SafeAreaView = createComponent("SafeAreaView");
export const ActivityIndicator = createComponent("ActivityIndicator");
export const Modal = createComponent("Modal");
export const Image = createComponent("Image");
export const Pressable = createComponent("Pressable");
export const ScrollView = createRefComponent("ScrollView");
export const Text = createComponent("Text");
export const TextInput = Object.assign(createRefComponent("TextInput"), {
  State: {
    currentlyFocusedInput: () => null,
  },
});
export const TouchableWithoutFeedback = createComponent(
  "TouchableWithoutFeedback",
);
export const View = createComponent("View");
export const Alert = {
  alert: () => undefined,
};
const keyboardListeners = new Map<string, Set<(event: any) => void>>();
export const Keyboard = {
  addListener: (eventName: string, callback: (event: any) => void) => {
    const listeners = keyboardListeners.get(eventName) ?? new Set();
    listeners.add(callback);
    keyboardListeners.set(eventName, listeners);

    return {
      remove: () => {
        listeners.delete(callback);
      },
    };
  },
  dismiss: () => undefined,
  __trigger: (eventName: string, payload: any) => {
    keyboardListeners.get(eventName)?.forEach((callback) => callback(payload));
  },
};
export const Dimensions = {
  get: () => ({
    height: 812,
    width: 390,
  }),
};
export class AnimatedValue {
  value: number;

  constructor(value: number) {
    this.value = value;
  }

  setValue(nextValue: number) {
    this.value = nextValue;
  }

  interpolate({
    inputRange,
    outputRange,
  }: {
    inputRange: number[];
    outputRange: number[];
  }) {
    return {
      __getValue: () => {
        const currentValue = this.value;
        const firstInput = inputRange[0];
        const lastInput = inputRange[inputRange.length - 1];

        if (currentValue <= firstInput) {
          return outputRange[0];
        }

        if (currentValue >= lastInput) {
          return outputRange[outputRange.length - 1];
        }

        for (let index = 0; index < inputRange.length - 1; index += 1) {
          const startInput = inputRange[index];
          const endInput = inputRange[index + 1];

          if (currentValue < startInput || currentValue > endInput) {
            continue;
          }

          const startOutput = outputRange[index];
          const endOutput = outputRange[index + 1];
          const progress =
            (currentValue - startInput) / (endInput - startInput);

          return startOutput + (endOutput - startOutput) * progress;
        }

        return outputRange[outputRange.length - 1];
      },
    };
  }
}

function resolveAnimatedStyleValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map((entry) => resolveAnimatedStyleValue(entry));
  }

  if (value && typeof value === "object") {
    if (typeof value.__getValue === "function") {
      return value.__getValue();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        resolveAnimatedStyleValue(entry),
      ]),
    );
  }

  return value;
}

export const Animated = {
  Value: AnimatedValue,
  ScrollView: createRefComponent("AnimatedScrollView"),
  View: createComponent("AnimatedView"),
  event: (
    mappings: { nativeEvent?: { contentOffset?: { y?: AnimatedValue } } }[],
  ) => {
    return (event: { nativeEvent?: { contentOffset?: { y?: number } } }) => {
      const animatedValue = mappings[0]?.nativeEvent?.contentOffset?.y;
      const nextY = event.nativeEvent?.contentOffset?.y;

      if (animatedValue instanceof AnimatedValue && typeof nextY === "number") {
        animatedValue.setValue(nextY);
      }
    };
  },
  timing: (value: AnimatedValue, config: { toValue: number }) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      value.setValue(config.toValue);
      callback?.({ finished: true });
    },
  }),
};
export const PanResponder = {
  create: () => ({
    panHandlers: {},
  }),
};
export const StyleSheet = {
  create: <T,>(styles: T) => styles,
  flatten: (styles: any) =>
    Array.isArray(styles)
      ? styles.reduce(
          (accumulator, style) => ({
            ...accumulator,
            ...resolveAnimatedStyleValue(style),
          }),
          {},
        )
      : resolveAnimatedStyleValue(styles),
  absoluteFillObject: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
};
export const Platform = {
  OS: "ios",
};
export const findNodeHandle = () => 1;
