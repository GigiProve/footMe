import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { PhoneInputWithCountryCode } from "./phone-input-with-country-code";

describe("PhoneInputWithCountryCode", () => {
  it("updates the dial code and keeps the local number numeric only", () => {
    const onChangeCountryCode = vi.fn();
    const onChangePhoneNumber = vi.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <PhoneInputWithCountryCode
          countryCode="+39"
          onChangeCountryCode={onChangeCountryCode}
          onChangePhoneNumber={onChangePhoneNumber}
          phoneNumber=""
        />,
      );
    });

    act(() => {
      tree.root.findByProps({ testID: "phone-country-code-trigger" }).props.onPress();
    });

    act(() => {
      tree.root.findByProps({ testID: "phone-country-code-option-FR" }).props.onPress();
    });

    const input = tree.root.findByType("TextInput" as never);

    act(() => {
      input.props.onChangeText("333 12a34");
    });

    expect(onChangeCountryCode).toHaveBeenCalledWith("+33");
    expect(onChangePhoneNumber).toHaveBeenCalledWith("3331234");
  });
});
