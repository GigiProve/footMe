import React from "react";
import TestRenderer, { act } from "react-test-renderer";
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
      tree!.root.findByProps({ testID: "wheel-picker-cm" }).props.onMomentumScrollEnd({
        nativeEvent: {
          contentOffset: {
            y: 104,
          },
        },
      });
    });

    expect(onChange).toHaveBeenCalledWith(160);
  });
});
