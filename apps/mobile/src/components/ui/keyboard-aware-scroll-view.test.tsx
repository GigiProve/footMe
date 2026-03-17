import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Keyboard, ScrollView, TouchableWithoutFeedback } from "react-native";
import { describe, expect, it, vi } from "vitest";

import {
  KeyboardAwareScrollView,
  getKeyboardAwarePaddingBottom,
  getKeyboardAwareScrollTarget,
} from "./keyboard-aware-scroll-view";

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    bottom: 12,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

function renderKeyboardAwareScrollView(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

describe("keyboard-aware-scroll-view helpers", () => {
  it("adds keyboard height, safe area and extra spacing to the bottom padding", () => {
    expect(
      getKeyboardAwarePaddingBottom({
        bottomInset: 12,
        extraBottomOffset: 20,
        keyboardHeight: 280,
        paddingBottom: 24,
      }),
    ).toBe(336);
  });

  it("returns a new scroll target only when the focused field is outside the visible area", () => {
    expect(
      getKeyboardAwareScrollTarget({
        currentScrollOffset: 120,
        inputBottom: 720,
        inputTop: 640,
        keyboardHeight: 250,
        scrollBottom: 800,
        scrollTop: 100,
        visibleOffset: 24,
      }),
    ).toBe(314);

    expect(
      getKeyboardAwareScrollTarget({
        currentScrollOffset: 120,
        inputBottom: 420,
        inputTop: 360,
        keyboardHeight: 180,
        scrollBottom: 800,
        scrollTop: 100,
        visibleOffset: 24,
      }),
    ).toBeNull();
  });
});

describe("KeyboardAwareScrollView", () => {
  it("keeps handled taps, exposes dismiss-on-tap wrapper and updates bottom padding on keyboard open", () => {
    const tree = renderKeyboardAwareScrollView(
      <KeyboardAwareScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        {React.createElement("mock-text", null, "Campo")}
      </KeyboardAwareScrollView>,
    );
    const root = tree.root;

    expect(root.findByType(TouchableWithoutFeedback)).toBeTruthy();

    const scrollViewBeforeOpen = root.findByType(ScrollView);
    expect(scrollViewBeforeOpen.props.keyboardShouldPersistTaps).toBe("handled");
    expect(scrollViewBeforeOpen.props.keyboardDismissMode).toBe("interactive");
    expect(scrollViewBeforeOpen.props.contentContainerStyle[1].paddingBottom).toBe(36);

    act(() => {
      (Keyboard as typeof Keyboard & {
        __trigger: (eventName: string, payload: { endCoordinates: { height: number } }) => void;
      }).__trigger("keyboardWillShow", {
        endCoordinates: { height: 280 },
      });
    });

    const scrollViewAfterOpen = root.findByType(ScrollView);
    expect(scrollViewAfterOpen.props.contentContainerStyle[1].paddingBottom).toBe(316);
  });
});
