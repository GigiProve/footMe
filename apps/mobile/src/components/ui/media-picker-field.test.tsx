import React from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { colors, radius } from "../../theme/tokens";
import { MediaPickerField } from "./media-picker-field";

vi.mock("../../ui", () => ({
  Button: (props: Record<string, unknown>) => React.createElement("mock-button", props),
  Card: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement("mock-card", props, children),
}));

describe("MediaPickerField", () => {
  it("clips the preview inside a rounded frame", () => {
    const tree = TestRenderer.create(
      <MediaPickerField
        buttonLabel="Carica foto profilo"
        label="Foto profilo"
        onPick={() => undefined}
        previewUrl="data:image/svg+xml;base64,test"
      />,
    );
    const root = tree.root;
    const previewFrame = root.findByProps({ testID: "media-picker-preview-frame" });
    const previewStyle = previewFrame.props.style;

    expect(previewStyle.width).toBe(96);
    expect(previewStyle.height).toBe(96);
    expect(previewStyle.borderRadius).toBe(radius[20]);
    expect(previewStyle.overflow).toBe("hidden");
    expect(previewStyle.backgroundColor).toBe(colors.surfaceMuted);
  });
});
