import type { PropsWithChildren } from "react";

import { createElement } from "react";

const createComponent = (name: string) =>
  function MockComponent({
    children,
    ...props
  }: PropsWithChildren<Record<string, unknown>>) {
    return createElement(name, props, children);
  };

export const SafeAreaView = createComponent("SafeAreaView");
export const ActivityIndicator = createComponent("ActivityIndicator");
export const Modal = createComponent("Modal");
export const Image = createComponent("Image");
export const Pressable = createComponent("Pressable");
export const ScrollView = createComponent("ScrollView");
export const Text = createComponent("Text");
export const TextInput = createComponent("TextInput");
export const View = createComponent("View");
export const Alert = {
  alert: () => undefined,
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
