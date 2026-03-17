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
export const TouchableWithoutFeedback = createComponent("TouchableWithoutFeedback");
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
}
export const Animated = {
  Value: AnimatedValue,
  View: createComponent("AnimatedView"),
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
      ? styles.reduce((accumulator, style) => ({ ...accumulator, ...style }), {})
      : styles,
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
