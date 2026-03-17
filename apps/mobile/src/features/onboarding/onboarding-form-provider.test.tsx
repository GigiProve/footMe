import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  OnboardingFormProvider,
  useOnboardingForm,
} from "./onboarding-form-provider";

const asyncStorageMock = vi.hoisted(() => ({
  getItem: vi.fn(),
  removeItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorageMock,
}));

function Harness() {
  const { form, isHydrated, resetForm, setFormValue } = useOnboardingForm();

  return (
    <>
      <Text testID="hydrated">{String(isHydrated)}</Text>
      <Text testID="first-name">{form.firstName}</Text>
      <Pressable onPress={() => setFormValue("firstName", "Marco")} testID="update-first-name" />
      <Pressable onPress={() => void resetForm()} testID="reset-form" />
    </>
  );
}

describe("OnboardingFormProvider", () => {
  beforeEach(() => {
    asyncStorageMock.getItem.mockReset();
    asyncStorageMock.removeItem.mockReset();
    asyncStorageMock.setItem.mockReset();
    asyncStorageMock.getItem.mockResolvedValue(null);
    asyncStorageMock.removeItem.mockResolvedValue(undefined);
    asyncStorageMock.setItem.mockResolvedValue(undefined);
  });

  it("hydrates a saved draft and persists subsequent updates", async () => {
    asyncStorageMock.getItem.mockResolvedValue(
      JSON.stringify({
        currentStep: "details",
        firstName: "Luca",
      }),
    );

    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <OnboardingFormProvider>
          <Harness />
        </OnboardingFormProvider>,
      );
    });

    expect(tree.root.findByProps({ testID: "hydrated" }).props.children).toBe("true");
    expect(tree.root.findByProps({ testID: "first-name" }).props.children).toBe("Luca");

    await act(async () => {
      tree.root.findByProps({ testID: "update-first-name" }).props.onPress();
    });

    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      "@footme/onboarding-draft/v1",
      expect.stringContaining('"firstName":"Marco"'),
    );
  });

  it("clears the stored draft when the form is reset", async () => {
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <OnboardingFormProvider>
          <Harness />
        </OnboardingFormProvider>,
      );
    });

    await act(async () => {
      tree.root.findByProps({ testID: "reset-form" }).props.onPress();
    });

    expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(
      "@footme/onboarding-draft/v1",
    );
  });
});
