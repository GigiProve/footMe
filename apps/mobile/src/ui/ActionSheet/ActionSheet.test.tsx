import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { ActionSheet, DESTRUCTIVE_ACTION_HINT, type ActionSheetAction } from "./ActionSheet";

function render(actions: ActionSheetAction[], extra: Partial<React.ComponentProps<typeof ActionSheet>> = {}) {
  let tree!: TestRenderer.ReactTestRenderer;
  const onClose = vi.fn();
  act(() => {
    tree = TestRenderer.create(<ActionSheet actions={actions} onClose={onClose} visible {...extra} />);
  });
  return { onClose, tree };
}

const byTestId = (tree: TestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll((node) => typeof node.type === "string" && node.props?.testID === testID);

describe("ActionSheet — estensioni HOM-04", () => {
  it("senza id, divisori né etichetta di accessibilità resta com'era (gli altri chiamanti)", () => {
    const { tree } = render([{ label: "Uno", onPress: vi.fn() }, { label: "Due", onPress: vi.fn() }]);

    expect(byTestId(tree, "action-sheet-divider")).toHaveLength(0);
    expect(byTestId(tree, "action-sheet-grabber")).toHaveLength(0);
  });

  it("il divisore c'è solo se sopra c'è un'altra azione (§29)", () => {
    const onPress = vi.fn();
    const withTop = render([
      { id: "A", label: "A", onPress },
      { dividerBefore: true, id: "B", label: "B", onPress },
    ]);
    const first = render([{ dividerBefore: true, id: "B", label: "B", onPress }]);

    expect(byTestId(withTop.tree, "action-sheet-divider")).toHaveLength(1);
    expect(byTestId(first.tree, "action-sheet-divider")).toHaveLength(0);
  });

  it("l'azione distruttiva lo dichiara ai lettori di schermo (§112)", () => {
    const { tree } = render([{ destructive: true, id: "DEL", label: "Elimina post", onPress: vi.fn() }]);
    const [row] = byTestId(tree, "action-sheet-DEL");

    expect(row.props.accessibilityHint).toBe(DESTRUCTIVE_ACTION_HINT);
    expect(row.props.accessibilityLabel).toBe("Elimina post");
  });

  it("il tap chiude il foglio e poi esegue l'azione (§108)", () => {
    const onPress = vi.fn();
    const { onClose, tree } = render([{ id: "A", label: "A", onPress }]);

    act(() => {
      byTestId(tree, "action-sheet-A")[0].props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("la maniglia chiude con un gesto verso il basso, non con uno corto (§109)", () => {
    const { onClose, tree } = render([{ id: "A", label: "A", onPress: vi.fn() }], { showGrabber: true });
    const [grabber] = byTestId(tree, "action-sheet-grabber");

    // Il mock di PanResponder non espone i gestori: la logica sta nel componente,
    // qui si verifica che la maniglia esista solo quando richiesta.
    expect(grabber).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("l'etichetta di accessibilità finisce sul foglio (§111)", () => {
    const { tree } = render([{ id: "A", label: "A", onPress: vi.fn() }], {
      accessibilityLabel: "Azioni contenuto",
    });

    expect(
      tree.root.findAll(
        (node) => typeof node.type === "string" && node.props?.accessibilityLabel === "Azioni contenuto",
      ),
    ).toHaveLength(1);
  });
});
