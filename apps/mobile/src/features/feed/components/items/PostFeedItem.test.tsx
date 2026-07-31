import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  FEED_ACTION_COMMENT,
  FEED_ACTION_LIKE,
  FEED_ACTION_SHARE,
  FEED_SOON_MESSAGES,
} from "../../feed-labels";
import { makePostItem, press, renderWithToast, textOf } from "../feed-test-helpers";
import { PostFeedItem } from "./PostFeedItem";

function setup(item = makePostItem()) {
  const props = {
    onPress: vi.fn(),
    onPressAuthor: vi.fn(),
    onToggleSaved: vi.fn(),
  };

  return {
    props,
    tree: renderWithToast(<PostFeedItem item={item as never} {...props} />),
  };
}

describe("PostFeedItem", () => {
  it("mostra autore, verifica, testo e riga azioni", () => {
    const { tree } = setup();
    const json = textOf(tree);

    expect(json).toContain("Como 1907");
    expect(json).toContain("Testo del post.");
    expect(json).toContain(FEED_ACTION_LIKE);
    expect(json).toContain(FEED_ACTION_COMMENT);
    expect(json).toContain(FEED_ACTION_SHARE);
  });

  it("non mostra contatori numerici (§10)", () => {
    const json = textOf(setup().tree);

    // Nessun "12 Mi piace" e nessuna reazione multipla in questo blocco.
    expect(json).not.toMatch(/"\d+ (Mi piace|commenti|condivisioni)"/);
  });

  it("il tap su Mi piace risponde con un messaggio, senza inventare nulla", () => {
    const { tree } = setup();

    press(tree, FEED_ACTION_LIKE);

    expect(textOf(tree)).toContain(FEED_SOON_MESSAGES.like);
  });

  it("il tap su Commenta risponde con il proprio messaggio", () => {
    const { tree } = setup();

    press(tree, FEED_ACTION_COMMENT);

    expect(textOf(tree)).toContain(FEED_SOON_MESSAGES.comment);
  });

  it("il tap su Condividi risponde con il proprio messaggio", () => {
    const { tree } = setup();

    press(tree, FEED_ACTION_SHARE);

    expect(textOf(tree)).toContain(FEED_SOON_MESSAGES.share);
  });

  it("il segnalibro invoca davvero il salvataggio", () => {
    const { props, tree } = setup();

    press(tree, "Salva contenuto");

    expect(props.onToggleSaved).toHaveBeenCalledTimes(1);
  });

  it("il segnalibro riflette lo stato salvato", () => {
    const { tree } = setup(makePostItem({ isSaved: true }));

    expect(textOf(tree)).toContain("Rimuovi dai salvati");
  });

  it("apre l'autore dal tocco sull'intestazione", () => {
    const { props, tree } = setup();

    press(tree, "Apri Como 1907");

    expect(props.onPressAuthor).toHaveBeenCalledTimes(1);
  });

  it("espone il menu contestuale (§20)", () => {
    const { tree } = setup();

    expect(() => press(tree, "Altre azioni")).not.toThrow();
  });
});
