import React from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, it } from "vitest";

import { colors } from "../../styles";
import { Button } from "./Button";

describe("Button", () => {
  it("uses the primary palette by default", () => {
    const tree = TestRenderer.create(<Button label="Salva" onPress={() => undefined} />);
    const pressable = tree.root.findByProps({ accessibilityRole: "button" });
    const styles = pressable.props.style({ focused: false, pressed: false });
    const label = tree.root.findByProps({ children: "Salva" });

    expect(styles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: colors.accent,
          borderColor: colors.accent,
        }),
      ]),
    );
    expect(label.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: colors.inkInvert })]),
    );
  });

  it("renders chip actions with a selected accent treatment", () => {
    const tree = TestRenderer.create(
      <Button
        label="Calciatori"
        onPress={() => undefined}
        selected
        size="sm"
        variant="chipAction"
      />,
    );
    const pressable = tree.root.findByProps({ accessibilityRole: "button" });
    const styles = pressable.props.style({ focused: false, pressed: false });

    expect(styles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: colors.accentStrong,
          borderColor: colors.accentStrong,
        }),
      ]),
    );
    expect(pressable.props.accessibilityState.selected).toBe(true);
  });

  it("shows a spinner and disables presses while loading", () => {
    const tree = TestRenderer.create(
      <Button label="Invio candidatura" loading onPress={() => undefined} testID="apply-action" />,
    );
    const pressable = tree.root.findByProps({ accessibilityRole: "button" });

    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState.busy).toBe(true);
    expect(tree.root.findByProps({ testID: "apply-action-spinner" })).toBeTruthy();
  });

  it("supports destructive secondary buttons without promoting them to filled danger", () => {
    const tree = TestRenderer.create(
      <Button
        destructive
        label="Rimuovi"
        onPress={() => undefined}
        variant="secondary"
      />,
    );
    const pressable = tree.root.findByProps({ accessibilityRole: "button" });
    const styles = pressable.props.style({ focused: false, pressed: false });
    const label = tree.root.findByProps({ children: "Rimuovi" });

    expect(styles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: colors.dangerSoft,
          borderColor: colors.danger,
        }),
      ]),
    );
    expect(label.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: colors.dangerStrong })]),
    );
  });
});
