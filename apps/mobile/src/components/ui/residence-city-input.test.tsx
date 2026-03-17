import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { ResidenceCityInput } from "./residence-city-input";

describe("ResidenceCityInput", () => {
  it("shows italian city suggestions and propagates the selected city", () => {
    const onSelectCity = vi.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <ResidenceCityInput
          onChangeText={() => undefined}
          onSelectCity={onSelectCity}
          value="Mil"
        />,
      );
    });

    const suggestion = tree.root.findByProps({
      testID: "residence-city-suggestion-Milano-Lombardia",
    });

    act(() => {
      suggestion.props.onPress();
    });

    expect(onSelectCity).toHaveBeenCalledWith({
      name: "Milano",
      region: "Lombardia",
    });
  });
});
