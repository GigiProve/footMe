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
export const Pressable = createComponent("Pressable");
export const Text = createComponent("Text");
export const View = createComponent("View");
export const Platform = {
  OS: "ios",
};
