import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { WheelPicker } from "./wheel-picker";

describe("wheel-picker", () => {
  it("emits the snapped value when scrolling ends", () => {
    const onChange = vi.fn();
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <WheelPicker
          label="Altezza (cm)"
          max={170}
          min={140}
          onChange={onChange}
          step={10}
          unit="cm"
          value={150}
        />,
      );
    });

    act(() => {
      tree!.root
        .findByProps({ testID: "wheel-picker-cm" })
        .props.onMomentumScrollEnd({
          nativeEvent: {
            contentOffset: {
              y: 104,
            },
          },
        });
    });

    expect(onChange).toHaveBeenCalledWith(160);
  });

  it("updates the visual emphasis while scrolling and keeps the unit hint subtle", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <WheelPicker
          label="Peso (kg)"
          max={80}
          min={70}
          onChange={() => undefined}
          unit="kg"
          value={75}
        />,
      );
    });

    act(() => {
      tree!.root.findByProps({ testID: "wheel-picker-kg" }).props.onScroll({
        nativeEvent: {
          contentOffset: {
            y: 52,
          },
        },
      });
    });

    const emphasizedValueStyle = StyleSheet.flatten(
      tree!.root.findByProps({ testID: "wheel-picker-value-kg-71" }).parent
        ?.props.style,
    );
    const unitHintStyle = StyleSheet.flatten(
      tree!.root.findByProps({ testID: "wheel-picker-unit-kg" }).props.style,
    );

    expect(emphasizedValueStyle.opacity).toBe(1);
    expect(emphasizedValueStyle.transform).toEqual([{ scale: 1.06 }]);
    expect(unitHintStyle.backgroundColor).toBe("rgba(255,255,255,0.86)");
    expect(unitHintStyle.paddingVertical).toBe(4);
  });
});
