/**
 * Post nel Feed con Repost (HOM-10 §73–§86, §100–§114, §173–§177, §276). Il componente
 * è lo stesso di sempre: qui si prova solo ciò che il Repost vi aggiunge.
 */

import React from "react";
import { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { videoMock } from "../../../../test/expo-video";
import type { FeedContentType, FeedPostItem, FeedReference } from "../../feed-types";
import {
  countTestId,
  findByLabel,
  hostByTestId,
  makePostItem,
  renderWithToast,
  textOf,
} from "../feed-test-helpers";
import { PostFeedItem } from "./PostFeedItem";

vi.mock("expo-video", () => import("../../../../test/expo-video"));
vi.mock("expo-router", () => ({ useFocusEffect: () => undefined }));

beforeEach(() => {
  videoMock.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-31T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const SNAPSHOT = {
  author_identity_type: "person",
  author_is_verified: true,
  author_name: "Matteo Rossi",
  excerpt: "Grande vittoria oggi! Orgoglioso della squadra.",
  item_kind: "post",
};

const AVAILABLE: FeedReference = {
  available: true,
  contentId: "orig-1",
  contentType: "profile_post",
  snapshot: SNAPSHOT,
};

function setup(item: FeedPostItem, onOpenReference?: (ref: { contentType: FeedContentType; contentId: string }) => void) {
  const props = {
    onComment: vi.fn(),
    onOpenIdentity: vi.fn(),
    onOpenLikes: vi.fn(),
    onOpenLink: vi.fn(),
    onOpenMedia: vi.fn(),
    onPress: vi.fn(),
    onPressAuthor: vi.fn(),
    onShare: vi.fn(),
    onToggleLike: vi.fn(),
    onToggleSaved: vi.fn(),
  };

  return { props, tree: renderWithToast(<PostFeedItem item={item} {...props} onOpenReference={onOpenReference} />) };
}

function withReference(reference: FeedReference | null, payload: Partial<FeedPostItem["payload"]> = {}) {
  return makePostItem({}, { body: "Un ragazzo che sta facendo una stagione davvero interessante.", reference, ...payload });
}

describe("Simple Repost: la riga del reposter (§73–§76, §259–§260, §291)", () => {
  const repost = {
    additionalCount: 0,
    reposter: { avatarUrl: null, identityId: "p-1", identityType: "profile", isVerified: true, name: "Marco Bianchi" },
  };

  it("sopra l'originale: «Marco Bianchi ha ripostato», poi l'header dell'AUTORE dell'originale (§73, §75)", () => {
    const { tree } = setup(makePostItem({ repost }));
    const json = textOf(tree);

    expect(countTestId(tree, "feed-reposter-row")).toBe(1);
    expect(json).toContain("Marco Bianchi ha ripostato");
    // L'autore dominante è quello dell'originale, e viene DOPO la riga del reposter.
    expect(json.indexOf("Marco Bianchi ha ripostato")).toBeLessThan(json.indexOf("Como 1907"));
  });

  it("aggregato: «e altre 3 persone hanno ripostato», senza avatar stack (§187–§188)", () => {
    const { tree } = setup(makePostItem({ repost: { ...repost, additionalCount: 3 } }));

    expect(textOf(tree)).toContain("Marco Bianchi e altre 3 persone hanno ripostato");
    expect(countTestId(tree, "feed-reposter-row")).toBe(1);
  });

  it("una sola action row, quella dell'originale: nessun contatore Repost e nessuna quarta azione (§76–§85, §318)", () => {
    const { tree } = setup(makePostItem({ repost: { ...repost, additionalCount: 3 } }));
    const json = textOf(tree);

    expect(countTestId(tree, "feed-post-action-like")).toBe(1);
    expect(json).not.toMatch(/\d+ Repost/);
    expect(findByLabel(tree, "Repost")).toHaveLength(0);
    expect(json).not.toContain("hanno ripostato 3");
  });

  it("senza `repost` non c'è nessuna riga", () => {
    const { tree } = setup(makePostItem());

    expect(countTestId(tree, "feed-reposter-row")).toBe(0);
  });
});

describe("Post con reference: la card dell'originale (§100–§114, §173–§177)", () => {
  it("sotto il testo e sopra la action row del NUOVO Post, senza azioni proprie (§100–§101, §110)", () => {
    const { tree } = setup(withReference(AVAILABLE));
    const json = textOf(tree);

    expect(countTestId(tree, "repost-embedded-card")).toBe(1);
    expect(json).toContain("Matteo Rossi");
    expect(json).toContain("Grande vittoria oggi!");
    expect(json.indexOf("Un ragazzo che sta facendo")).toBeLessThan(json.indexOf("repost-embedded-card"));
    expect(json.indexOf("repost-embedded-card")).toBeLessThan(json.indexOf("feed-post-action-like"));
    // Una sola barra di interazione: quella del Post (§110, §326).
    expect(countTestId(tree, "feed-post-action-like")).toBe(1);
  });

  it("tappabile: apre l'originale con tipo e id canonici (§111, §327)", () => {
    const onOpenReference = vi.fn();
    const { props, tree } = setup(withReference(AVAILABLE), onOpenReference);
    const card = hostByTestId(tree, "repost-embedded-card")[0];

    act(() => card.props.onPress());

    expect(onOpenReference).toHaveBeenCalledWith({ contentId: "orig-1", contentType: "profile_post" });
    // Il tap sulla card non apre il Post che la contiene.
    expect(props.onPress).not.toHaveBeenCalled();
  });

  it("senza handler la card non è un bottone", () => {
    const { tree } = setup(withReference(AVAILABLE));

    expect(hostByTestId(tree, "repost-embedded-card")[0].props.onPress).toBeUndefined();
  });

  it("l'a11y della card dice «Contenuto originale incorporato» prima dei metadata (§276)", () => {
    const { tree } = setup(withReference(AVAILABLE), vi.fn());

    expect(hostByTestId(tree, "repost-embedded-card")[0].props.accessibilityLabel).toMatch(
      /^Contenuto originale incorporato\. /,
    );
  });

  it("originale non disponibile: card generica NON tappabile, il Post e la sua action row restano (§173–§177)", () => {
    const onOpenReference = vi.fn();
    const { tree } = setup(withReference({ ...AVAILABLE, available: false, snapshot: null }), onOpenReference);
    const json = textOf(tree);

    expect(countTestId(tree, "repost-embedded-card-unavailable")).toBe(1);
    expect(countTestId(tree, "repost-embedded-card")).toBe(0);
    expect(json).toContain("Contenuto originale non disponibile");
    expect(json).toContain("Questo contenuto è stato eliminato o non è più disponibile.");
    expect(json).toContain("Un ragazzo che sta facendo");
    expect(countTestId(tree, "feed-post-action-like")).toBe(1);
    expect(hostByTestId(tree, "repost-embedded-card-unavailable")[0].props.onPress).toBeUndefined();
    expect(onOpenReference).not.toHaveBeenCalled();
  });

  it("senza reference non c'è nessuna card", () => {
    const { tree } = setup(makePostItem());

    expect(countTestId(tree, "repost-embedded-card")).toBe(0);
    expect(countTestId(tree, "repost-embedded-card-unavailable")).toBe(0);
  });

  it("le azioni del Post sono SUE: Mi piace e Condividi agiscono sul nuovo post_id (§101–§105)", () => {
    const { props, tree } = setup(withReference(AVAILABLE, { likesCount: 57 }));

    expect(textOf(tree)).toContain('"57"');

    const like = hostByTestId(tree, "feed-post-action-like").find((node) => typeof node.props.onPress === "function");

    act(() => like?.props.onPress());
    expect(props.onToggleLike).toHaveBeenCalledTimes(1);
  });
});
