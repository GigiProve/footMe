import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Keyboard, ScrollView, Text, TouchableWithoutFeedback } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { KeyboardAwareForm } from "./keyboard-aware-form";

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    bottom: 12,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

function renderForm(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

describe("KeyboardAwareForm", () => {
  it("renders children inside a keyboard-aware scroll view", () => {
    const tree = renderForm(
      <KeyboardAwareForm>
        <Text>Campo 1</Text>
        <Text>Campo 2</Text>
      </KeyboardAwareForm>,
    );
    const root = tree.root;

    expect(root.findAllByType(Text)).toHaveLength(2);
    expect(root.findByType(ScrollView)).toBeTruthy();
  });

  it("wraps content in TouchableWithoutFeedback for tap-to-dismiss by default", () => {
    const tree = renderForm(
      <KeyboardAwareForm>
        <Text>Form</Text>
      </KeyboardAwareForm>,
    );

    expect(tree.root.findByType(TouchableWithoutFeedback)).toBeTruthy();
  });

  it("applies the default extra bottom offset (24) on top of safe area", () => {
    const tree = renderForm(
      <KeyboardAwareForm contentContainerStyle={{ paddingBottom: 10 }}>
        <Text>Form</Text>
      </KeyboardAwareForm>,
    );

    const scrollView = tree.root.findByType(ScrollView);
    // paddingBottom = content(10) + safeArea(12) + extraBottom(24) + keyboard(0) = 46
    expect(scrollView.props.contentContainerStyle[1].paddingBottom).toBe(46);
  });

  it("updates padding when the keyboard opens", () => {
    const tree = renderForm(
      <KeyboardAwareForm contentContainerStyle={{ paddingBottom: 10 }}>
        <Text>Form</Text>
      </KeyboardAwareForm>,
    );

    act(() => {
      (Keyboard as typeof Keyboard & {
        __trigger: (eventName: string, payload: { endCoordinates: { height: number } }) => void;
      }).__trigger("keyboardWillShow", {
        endCoordinates: { height: 300 },
      });
    });

    const scrollView = tree.root.findByType(ScrollView);
    // paddingBottom = content(10) + safeArea(12) + extraBottom(24) + keyboard(300) = 346
    expect(scrollView.props.contentContainerStyle[1].paddingBottom).toBe(346);
  });

  it("resets padding when the keyboard closes", () => {
    const tree = renderForm(
      <KeyboardAwareForm contentContainerStyle={{ paddingBottom: 10 }}>
        <Text>Form</Text>
      </KeyboardAwareForm>,
    );

    act(() => {
      (Keyboard as typeof Keyboard & {
        __trigger: (eventName: string, payload: { endCoordinates: { height: number } }) => void;
      }).__trigger("keyboardWillShow", {
        endCoordinates: { height: 300 },
      });
    });

    act(() => {
      (Keyboard as typeof Keyboard & {
        __trigger: (eventName: string, payload: Record<string, never>) => void;
      }).__trigger("keyboardWillHide", {});
    });

    const scrollView = tree.root.findByType(ScrollView);
    // paddingBottom = content(10) + safeArea(12) + extraBottom(24) + keyboard(0) = 46
    expect(scrollView.props.contentContainerStyle[1].paddingBottom).toBe(46);
  });

  it("allows overriding the extra bottom offset", () => {
    const tree = renderForm(
      <KeyboardAwareForm
        contentContainerStyle={{ paddingBottom: 10 }}
        extraBottomOffset={50}
      >
        <Text>Form</Text>
      </KeyboardAwareForm>,
    );

    const scrollView = tree.root.findByType(ScrollView);
    // paddingBottom = content(10) + safeArea(12) + extraBottom(50) + keyboard(0) = 72
    expect(scrollView.props.contentContainerStyle[1].paddingBottom).toBe(72);
  });

  it("passes keyboardShouldPersistTaps as handled", () => {
    const tree = renderForm(
      <KeyboardAwareForm>
        <Text>Form</Text>
      </KeyboardAwareForm>,
    );

    const scrollView = tree.root.findByType(ScrollView);
    expect(scrollView.props.keyboardShouldPersistTaps).toBe("handled");
  });
});
