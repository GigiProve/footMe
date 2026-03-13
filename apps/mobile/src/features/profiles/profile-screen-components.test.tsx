import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { ProfileField, ProfileHeader, ProfileSection } from "./profile-screen-components";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

describe("profile-screen-components", () => {
  it("renders readonly profile fields with a fallback value", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<ProfileField label="Telefono" value="" />);
    });

    expect(tree!.root.findByProps({ children: "Telefono" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Da completare" })).toBeTruthy();
  });

  it("renders editable profile fields with the input value", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <ProfileField
          editable
          label="Nome"
          onChangeText={() => undefined}
          value="Mario Rossi"
        />,
      );
    });

    const input = tree!.root.findByType("TextInput" as never);
    expect(input.props.value).toBe("Mario Rossi");
  });

  it("renders section metadata and header action labels", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <>
          <ProfileHeader
            avatarUrl=""
            badges={["Calciatore"]}
            fullName="Mario Rossi"
            onEditPress={() => undefined}
            primaryMeta="Juventus U17 · Attaccante"
            secondaryMeta="Capitano"
          />
          <ProfileSection description="Dati principali del profilo" title="Informazioni personali">
            <ProfileField label="Nome" value="Mario Rossi" />
          </ProfileSection>
        </>,
      );
    });

    expect(tree!.root.findByProps({ accessibilityLabel: "Modifica profilo" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Informazioni personali" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Dati principali del profilo" })).toBeTruthy();
  });
});
