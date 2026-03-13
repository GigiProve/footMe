import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { ContactSection } from "./contact-section";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

describe("ContactSection", () => {
  it("shows only public non-empty contacts in view mode", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <ContactSection
          contacts={{
            email: "mario@example.com",
            facebook: "https://facebook.com/mario.rossi",
            instagram: "https://instagram.com/mario.rossi",
            phone: "+393331234567",
            showEmail: false,
            showFacebook: true,
            showInstagram: true,
          }}
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Instagram" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Facebook" })).toBeTruthy();
    expect(tree!.root.findAllByProps({ children: "Email" })).toHaveLength(0);
    expect(tree!.root.findAllByProps({ children: "Numero di cellulare" })).toHaveLength(0);
    expect(tree!.root.findByProps({ children: "@mario.rossi" })).toBeTruthy();
  });

  it("shows all editable fields and visibility toggles in edit mode", () => {
    let tree: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <ContactSection
          contacts={{
            email: "",
            facebook: "",
            instagram: "",
            phone: "",
            showEmail: false,
            showFacebook: false,
            showInstagram: false,
          }}
          editable
          onEmailChange={() => undefined}
          onFacebookChange={() => undefined}
          onInstagramChange={() => undefined}
          onPhoneChange={() => undefined}
          onShowEmailChange={() => undefined}
          onShowFacebookChange={() => undefined}
          onShowInstagramChange={() => undefined}
        />,
      );
    });

    expect(tree!.root.findByProps({ children: "Instagram" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Facebook" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Email" })).toBeTruthy();
    expect(tree!.root.findByProps({ children: "Numero di cellulare" })).toBeTruthy();
    expect(
      tree!.root.findByProps({ children: "Mostra Instagram nel profilo pubblico" }),
    ).toBeTruthy();
    expect(tree!.root.findAllByType("TextInput" as never)).toHaveLength(4);
  });
});
