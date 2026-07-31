import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  FEED_POSITION_CTA,
  FEED_POSITION_HELPER,
  FEED_POSITION_OVERLINE,
} from "../../feed-labels";
import { makePositionItem, render, textOf } from "../feed-test-helpers";
import { SuggestedPositionFeedItem } from "./SuggestedPositionFeedItem";

describe("SuggestedPositionFeedItem", () => {
  it("mostra intestazione, helper e le informazioni richieste", () => {
    const tree = render(
      <SuggestedPositionFeedItem item={makePositionItem() as never} onPress={vi.fn()} />,
    );
    const json = textOf(tree);

    expect(json).toContain(FEED_POSITION_OVERLINE);
    expect(json).toContain(FEED_POSITION_HELPER);
    expect(json).toContain(FEED_POSITION_CTA);
    // ruolo, squadra + categoria, località
    expect(json).toContain("Difensore centrale");
    expect(json).toContain("Prima squadra");
    expect(json).toContain("Serie B");
    expect(json).toContain("Parma");
    expect(json).toContain("Emilia-Romagna");
  });

  /**
   * Guardia di regressione sulle esclusioni del §9. Sono le prime cose che
   * qualcuno aggiungerebbe "per completezza": qui il test si oppone.
   */
  it("NON mostra candidatura, requisiti, scadenza o compatibilità", () => {
    const json = textOf(
      render(
        <SuggestedPositionFeedItem
          item={makePositionItem() as never}
          onPress={vi.fn()}
        />,
      ),
    ).toLowerCase();

    expect(json).not.toContain("candidat");
    expect(json).not.toContain("scadenza");
    expect(json).not.toContain("requisit");
    expect(json).not.toContain("compatibil");
    expect(json).not.toContain("%");
  });

  it("apre il dettaglio dal tocco sull'intero componente", () => {
    const onPress = vi.fn();
    const tree = render(
      <SuggestedPositionFeedItem item={makePositionItem() as never} onPress={onPress} />,
    );

    const card = tree.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props?.testID === "feed-suggested-position",
    )[0];

    card.props.onPress();

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
