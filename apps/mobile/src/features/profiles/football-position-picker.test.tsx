import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { FootballPositionPicker } from "./football-position-picker";

describe("football-position-picker", () => {
  it("supports single selection for the primary role", () => {
    const onSelect = vi.fn();
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <FootballPositionPicker
          mode="single"
          onSelect={onSelect}
          selectedPositions={[]}
          title="Ruolo principale"
        />,
      );
    });

    act(() => {
      tree!.root.findByProps({ testID: "football-position-central_midfielder" }).props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith(["central_midfielder"]);
  });

  it("toggles multiple secondary roles independently", () => {
    const onSelect = vi.fn();
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <FootballPositionPicker
          mode="multiple"
          onSelect={onSelect}
          selectedPositions={["left_back"]}
          title="Ruoli secondari"
        />,
      );
    });

    act(() => {
      tree!.root.findByProps({ testID: "football-position-right_winger" }).props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith(["left_back", "right_winger"]);

    act(() => {
      tree!.root.findByProps({ testID: "football-position-left_back" }).props.onPress();
    });

    expect(onSelect).toHaveBeenCalledWith([]);
  });
});
