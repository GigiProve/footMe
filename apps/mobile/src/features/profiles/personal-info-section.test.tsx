import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { type ItalianCityOption } from "./profile-form-utils";
import {
  BirthDateInput,
  CityAutocompleteInput,
  PersonalInfoSection,
} from "./personal-info-section";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

const citySuggestions: ItalianCityOption[] = [
  { name: "Milano", region: "Lombardia" },
  { name: "Milazzo", region: "Sicilia" },
];

describe("personal-info-section", () => {
  it("renders the personal information card in view mode", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <PersonalInfoSection
          birthDate="15/08/2000"
          city="Milano"
          citySuggestions={citySuggestions}
          fullName="Mario Rossi"
          nationality="IT"
          nationalityOptions={[{ label: "Italia", value: "IT" }]}
          region="Lombardia"
          regionOptions={[{ label: "Lombardia", value: "Lombardia" }]}
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Informazioni personali" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Mario Rossi" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "15/08/2000" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Italia" })).toBeTruthy();
  });

  it("renders the birth date input as a numeric field in edit mode", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <BirthDateInput
          editable
          label="Data di nascita"
          onChange={() => undefined}
          value="15/08/2000"
        />,
      );
    });

    const input = tree!.root.findByType("TextInput" as never);
    expect(input.props.keyboardType).toBe("number-pad");
    expect(input.props.value).toBe("15/08/2000");
  });

  it("shows city suggestions and propagates the selected city", () => {
    const onSelectSuggestion = vi.fn();

    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CityAutocompleteInput
          editable
          label="Città"
          onChangeText={() => undefined}
          onSelectSuggestion={onSelectSuggestion}
          suggestions={citySuggestions}
          value="Mil"
        />,
      );
    });

    const suggestion = tree!.root.findByProps({
      testID: "city-autocomplete-suggestion-Milano-Lombardia",
    });

    act(() => {
      suggestion.props.onPress();
    });

    expect(onSelectSuggestion).toHaveBeenCalledWith({
      name: "Milano",
      region: "Lombardia",
    });
  });
});
