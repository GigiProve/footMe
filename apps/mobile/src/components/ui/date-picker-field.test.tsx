import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { DatePickerField } from "./date-picker-field";

vi.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    React.createElement("mock-date-time-picker", props),
}));

function renderDatePickerField(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

describe("DatePickerField", () => {
  it("shows the placeholder until a date is selected", () => {
    const tree = renderDatePickerField(
      <DatePickerField label="Data di nascita" onChange={() => undefined} value="" />,
    );
    const root = tree.root;

    expect(root.findByProps({ testID: "date-picker-trigger" })).toBeTruthy();
    expect(root.findByProps({ children: "Seleziona una data" })).toBeTruthy();
  });

  it("opens the picker surface and formats the current ISO value", () => {
    const tree = renderDatePickerField(
      <DatePickerField
        label="Data di nascita"
        onChange={() => undefined}
        value="2001-03-11"
      />,
    );
    const root = tree.root;

    act(() => {
      root.findByProps({ testID: "date-picker-trigger" }).props.onPress();
    });

    expect(root.findByProps({ testID: "date-picker-surface" })).toBeTruthy();
    expect(root.findByProps({ children: "11/03/2001" })).toBeTruthy();
    expect(
      root.findByProps({ children: "Data selezionata: 11/03/2001" }),
    ).toBeTruthy();
  });
});
