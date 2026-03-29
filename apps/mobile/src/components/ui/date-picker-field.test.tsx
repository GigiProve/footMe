import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { DatePickerField } from "./date-picker-field";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    React.createElement("mock-ionicons", props),
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
      <DatePickerField
        label="Data di nascita"
        onChange={() => undefined}
        value=""
      />,
    );
    const root = tree.root;

    expect(root.findByProps({ testID: "date-picker-trigger" })).toBeTruthy();
  });

  it("opens the calendar surface when pressed", () => {
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

  it("closes the calendar and fires onChange when a day is tapped", () => {
    const onChange = vi.fn();
    const tree = renderDatePickerField(
      <DatePickerField
        label="Data di nascita"
        onChange={onChange}
        value="2001-03-11"
      />,
    );
    const root = tree.root;

    // Open the calendar
    act(() => {
      root.findByProps({ testID: "date-picker-trigger" }).props.onPress();
    });

    expect(root.findByProps({ testID: "date-picker-surface" })).toBeTruthy();

    // Find a day cell showing "15" in the current month and tap it
    const dayCells = root.findAllByProps({ children: 15 });
    const dayCell = dayCells.find((node) => {
      // Walk up to find the pressable parent
      try {
        return node.parent?.parent?.props?.accessibilityRole === "button";
      } catch {
        return false;
      }
    });

    if (dayCell?.parent?.parent) {
      act(() => {
        dayCell.parent!.parent!.props.onPress();
      });

      expect(onChange).toHaveBeenCalledWith("2001-03-15");
      expect(
        root.findAllByProps({ testID: "date-picker-surface" }),
      ).toHaveLength(0);
    }
  });
});
