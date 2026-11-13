import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { ConfirmModal, shouldStackConfirmActions } from "./ConfirmModal";

describe("ConfirmModal — etichette lunghe", () => {
  it("le azioni si impilano solo con etichette che non stanno in mezza riga", () => {
    expect(shouldStackConfirmActions("Annulla", "Conferma")).toBe(false);
    expect(shouldStackConfirmActions("Annulla", "Elimina")).toBe(false);
    expect(shouldStackConfirmActions("Continua a modificare", "Elimina")).toBe(true);
    expect(shouldStackConfirmActions("Continua a modificare", "Annulla modifiche")).toBe(true);
  });
});

function render(isBusy: boolean) {
  const onCancel = vi.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ConfirmModal
        confirmLabel="Elimina"
        isBusy={isBusy}
        message="Testo"
        onCancel={onCancel}
        onConfirm={vi.fn()}
        title="Titolo"
        visible
      />,
    );
  });
  const modal = tree.root.find((node) => String(node.type) === "Modal");
  const backdrop = tree.root.find(
    (node) => typeof node.type === "string" && node.props?.accessibilityLabel === "Chiudi",
  );
  return { backdrop, modal, onCancel, tree };
}

describe("ConfirmModal — HOM-04 §110, §113", () => {
  it("a riposo, fondale e Back annullano", () => {
    const { backdrop, modal, onCancel } = render(false);

    act(() => {
      backdrop.props.onPress();
      modal.props.onRequestClose();
    });

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("con una richiesta in corso, fondale e Back sono ignorati", () => {
    const { backdrop, modal, onCancel } = render(true);

    expect(backdrop.props.onPress).toBeUndefined();
    expect(modal.props.onRequestClose).toBeUndefined();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("il dialogo tiene il focus dei lettori di schermo al suo interno", () => {
    const { tree } = render(false);

    expect(
      tree.root.findAll((node) => typeof node.type === "string" && node.props?.accessibilityViewIsModal === true)
        .length,
    ).toBeGreaterThan(0);
  });
});
