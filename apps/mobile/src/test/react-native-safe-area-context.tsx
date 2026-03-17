import { createElement } from "react";
import type { ReactNode } from "react";

export function SafeAreaProvider({
  children,
}: {
  children?: ReactNode;
}) {
  return createElement("SafeAreaProvider", null, children);
}

export function SafeAreaView({
  children,
  ...props
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return createElement("SafeAreaView", props, children);
}

export function useSafeAreaInsets() {
  return {
    bottom: 12,
    left: 0,
    right: 0,
    top: 0,
  };
}
