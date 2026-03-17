import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { NationalityAutocompleteInput } from "./nationality-autocomplete-input";

describe("NationalityAutocompleteInput", () => {
  it("shows suggestions and saves the selected country code", () => {
    const onChange = vi.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <NationalityAutocompleteInput onChange={onChange} value="" />,
      );
    });

    const input = tree.root.findByType("TextInput" as never);

    act(() => {
      input.props.onFocus();
      input.props.onChangeText("ita");
    });

    const suggestion = tree.root.findByProps({
      testID: "nationality-autocomplete-suggestion-IT",
    });

    act(() => {
      suggestion.props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith("IT");
  });
});
