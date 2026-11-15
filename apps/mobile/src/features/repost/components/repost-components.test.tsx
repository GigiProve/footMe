import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../../lib/analytics";
import { countTestId, hostByTestId, textOf } from "../../feed/components/feed-test-helpers";
import type { SharePreview } from "../../share/share-types";
import { embeddedReferenceModel, shareRepostRow } from "../repost-presentation";
import { RepostAlreadyNotice } from "./RepostAlreadyNotice";
import { RepostEmbeddedCard } from "./RepostEmbeddedCard";
import { ReposterRow } from "./ReposterRow";
import { RepostShareRow } from "./RepostShareRow";

const mounted: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  setAnalyticsSink(null);
});

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });
  mounted.push(tree);

  return tree;
}

const POST: SharePreview = {
  authorMeta: "Attaccante · AC Como",
  authorName: "Matteo Rossi",
  durationSeconds: null,
  excerpt: "Grande vittoria oggi!",
  isVerified: true,
  kind: "post",
  showsPlay: false,
  thumbnailUrl: null,
  title: null,
};

const VIDEO: SharePreview = {
  authorMeta: null,
  authorName: "Como Football News",
  durationSeconds: 48,
  excerpt: null,
  isVerified: false,
  kind: "video",
  showsPlay: true,
  thumbnailUrl: "https://cdn.test/v.jpg",
  title: "Highlights",
};

const ARTICLE: SharePreview = {
  authorMeta: null,
  authorName: "AC Como",
  durationSeconds: null,
  excerpt: null,
  isVerified: true,
  kind: "article",
  showsPlay: false,
  thumbnailUrl: "https://cdn.test/cover.jpg",
  title: "Il settore giovanile dell'AC Como",
};

function model(preview: SharePreview | null, available = true) {
  return embeddedReferenceModel({ available, contentId: "c-1", contentType: "club_media", preview });
}

describe("RepostEmbeddedCard (§45–§49, §110–§114, §173–§177, §276)", () => {
  it("Post: autore con check, excerpt e label; nessuna barra di interazione (§48, §110)", () => {
    const tree = render(<RepostEmbeddedCard model={model(POST)} />);
    const text = textOf(tree);

    expect(text).toContain("Matteo Rossi");
    expect(text).toContain("Grande vittoria oggi!");
    expect(text).toContain("Post");
    for (const forbidden of ["Condividi", "Commenta", "Mi piace", "Salva", "likes", "comments"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("l'etichetta d'accessibilità dice «Contenuto originale incorporato» prima dei metadata (§276)", () => {
    const tree = render(<RepostEmbeddedCard model={model(POST)} />);
    const root = hostByTestId(tree, "repost-embedded-card")[0];

    expect(root.props.accessibilityLabel.startsWith("Contenuto originale incorporato. ")).toBe(true);
  });

  it("senza onPress non è un bottone; con onPress apre l'originale (§49, §111)", () => {
    const onPress = vi.fn();
    const readOnly = render(<RepostEmbeddedCard model={model(POST)} />);

    expect(hostByTestId(readOnly, "repost-embedded-card")[0].props.onPress).toBeUndefined();

    const tappable = render(<RepostEmbeddedCard model={model(POST)} onPress={onPress} />);
    const target = hostByTestId(tappable, "repost-embedded-card")[0];

    expect(target.props.accessibilityRole).toBe("button");
    act(() => target.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("Video: thumbnail, Play e durata, nessun player (§112–§113)", () => {
    const tree = render(<RepostEmbeddedCard model={model(VIDEO)} />);

    expect(countTestId(tree, "share-preview-thumbnail")).toBe(1);
    expect(textOf(tree)).toContain("0:48");
    expect(textOf(tree)).toContain("Video");
    expect(textOf(tree)).not.toContain("autoplay");
  });

  it("Articolo: cover, titolo, autore e label «Articolo» (§114)", () => {
    const tree = render(<RepostEmbeddedCard model={model(ARTICLE)} />);
    const text = textOf(tree);

    expect(countTestId(tree, "share-preview-thumbnail")).toBe(1);
    expect(text).toContain("Il settore giovanile dell'AC Como");
    expect(text).toContain("AC Como");
    expect(text).toContain("Articolo");
  });

  it("non disponibile: copy generica, NON tappabile anche se c'è un onPress (§174–§177)", () => {
    const onPress = vi.fn();
    const tree = render(<RepostEmbeddedCard model={model(null, false)} onPress={onPress} />);
    const text = textOf(tree);

    expect(text).toContain("Contenuto originale non disponibile");
    expect(text).toContain("Questo contenuto è stato eliminato o non è più disponibile.");
    expect(countTestId(tree, "repost-embedded-card-unavailable")).toBe(1);
    expect(countTestId(tree, "repost-embedded-card")).toBe(0);
    expect(hostByTestId(tree, "repost-embedded-card-unavailable")[0].props.onPress).toBeUndefined();
    expect(hostByTestId(tree, "repost-embedded-card-unavailable")[0].props.accessibilityLabel).toContain(
      "Contenuto originale incorporato",
    );
    // §174: nessuna informazione tecnica.
    expect(text).not.toMatch(/404|errore|exception/i);
  });
});

describe("ReposterRow (§73–§76, §187–§191, §259–§260, §291)", () => {
  const target = { contentId: "c-1", contentType: "club_media" } as const;
  const reposter = {
    avatarUrl: "https://cdn.test/a.jpg",
    identityId: "p1",
    identityType: "profile",
    isVerified: true,
    name: "Marco Bianchi",
  };

  it("un reposter: «Marco Bianchi ha ripostato» con l'icona Repost, senza avatar (§188)", () => {
    const tree = render(<ReposterRow repost={{ additionalCount: 0, reposter }} target={target} />);
    const row = hostByTestId(tree, "feed-reposter-row")[0];

    expect(row.props.accessibilityLabel).toBe("Marco Bianchi ha ripostato");
    expect(textOf(tree)).toContain("Marco Bianchi ha ripostato");
    expect(tree.root.findAll((node) => (node.type as unknown) === "Ionicons" && node.props.name === "repeat-outline")).toHaveLength(1);
    // Nessun avatar, nemmeno quello del reposter.
    expect(textOf(tree)).not.toContain("cdn.test/a.jpg");
  });

  it("aggregato: «e altre N persone hanno ripostato» e un solo evento di aggregazione (§187, §269)", () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    const tree = render(<ReposterRow repost={{ additionalCount: 3, reposter }} target={target} />);

    expect(textOf(tree)).toContain("Marco Bianchi e altre 3 persone hanno ripostato");
    expect(events.map((event) => event.name)).toEqual(["aggregated_simple_repost_rendered"]);
    expect(events[0].props).toEqual({ additionalCount: 3, contentId: "c-1", contentType: "club_media" });
  });

  it("un reposter solo non emette l'evento di aggregazione e la riga non è tappabile (§190)", () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    const tree = render(<ReposterRow repost={{ additionalCount: 0, reposter }} target={target} />);

    expect(events).toEqual([]);
    expect(hostByTestId(tree, "feed-reposter-row")[0].props.onPress).toBeUndefined();
  });
});

describe("RepostShareRow (§2, §122–§123, §273–§274)", () => {
  const identity = {
    avatarUrl: null,
    canPublishPost: true,
    canRepost: true,
    canSchedule: true,
    contextLabel: "Profilo personale",
    hasSimpleRepost: false,
    id: "me",
    isVerified: false,
    name: "Marco",
    type: "person" as const,
  };

  function rowFor(hasSimpleRepost: boolean) {
    const row = shareRepostRow(
      { identities: [{ ...identity, hasSimpleRepost }], preview: null, repostable: true },
      { id: "me", type: "person" },
    );

    if (!row) {
      throw new Error("riga attesa");
    }

    return row;
  }

  it("stato normale: titolo, sottotitolo e nessun check", () => {
    const onPress = vi.fn();
    const tree = render(<RepostShareRow onPress={onPress} row={rowFor(false)} />);

    expect(textOf(tree)).toContain("Repost");
    expect(textOf(tree)).toContain("Condividi questo contenuto con la tua rete");
    expect(countTestId(tree, "share-repost-active")).toBe(0);

    act(() => hostByTestId(tree, "share-repost")[0].props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("già ripostato: check, sottotitolo dedicato, ancora premibile (§122–§123)", () => {
    const onPress = vi.fn();
    const tree = render(<RepostShareRow onPress={onPress} row={rowFor(true)} />);

    expect(textOf(tree)).toContain("Hai già ripostato questo contenuto");
    expect(countTestId(tree, "share-repost-active")).toBe(1);

    act(() => hostByTestId(tree, "share-repost")[0].props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("RepostAlreadyNotice (§125–§131, §275)", () => {
  it("dice lo stato e offre «Rimuovi repost», rosso e immediato, senza conferma (§129)", () => {
    const onRemove = vi.fn();
    const tree = render(<RepostAlreadyNotice onRemove={onRemove} />);

    expect(textOf(tree)).toContain("Hai già ripostato questo contenuto.");
    expect(textOf(tree)).toContain("Rimuovi repost");

    const button = hostByTestId(tree, "repost-remove")[0];

    expect(button.props.accessibilityLabel).toBe("Rimuovi repost");
    act(() => button.props.onPress());
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("durante la rimozione il bottone è occupato e non parte due volte", () => {
    const tree = render(<RepostAlreadyNotice busy onRemove={vi.fn()} />);
    const button = hostByTestId(tree, "repost-remove")[0];

    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });
});
