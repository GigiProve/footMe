import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  countTestId,
  pressTestId,
  render,
  textOf,
} from "../../feed/components/feed-test-helpers";
import type { ConversationMessage } from "../messaging-service";
import { ContentReferenceCard } from "./ContentReferenceCard";

const pushMock = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const CONTENT_ID = "11111111-2222-4333-8444-555555555555";

function makeMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    body: "",
    content_available: true,
    content_ref_id: CONTENT_ID,
    content_ref_type: "club_media",
    content_snapshot: {
      author_identity_type: "person",
      author_is_verified: true,
      author_meta: { club_name: "AC Como", role: "player" },
      author_name: "Matteo Rossi",
      excerpt: "Grande vittoria oggi! Continuiamo su questa strada.",
      item_kind: "post",
      thumbnail_url: "https://cdn.test/thumb.jpg",
    },
    media_url: null,
    message_id: "m1",
    message_kind: "content_reference",
    read_at: null,
    sender_full_name: "Marco Bianchi",
    sender_profile_id: "profile-1",
    sent_at: "2026-11-14T09:40:00.000Z",
    shared_contact_name: null,
    shared_contact_phone: null,
    ...overrides,
  };
}

function setup(message: ConversationMessage, isOwnMessage = false) {
  return render(
    <ContentReferenceCard isOwnMessage={isOwnMessage} message={message} timestamp="09:40" />,
  );
}

beforeEach(() => {
  pushMock.mockClear();
});

describe("ContentReferenceCard (HOM-09 §104–§118)", () => {
  it("mostra la card del Post: autore, verifica, meta, excerpt e label (§105)", () => {
    const tree = setup(makeMessage());
    const json = textOf(tree);

    expect(json).toContain("Matteo Rossi");
    expect(json).toContain("Profilo verificato");
    expect(json).toContain("Calciatore");
    expect(json).toContain("AC Como");
    expect(json).toContain("Grande vittoria oggi!");
    expect(json).toContain("Post");
    expect(countTestId(tree, "share-preview-thumbnail")).toBe(1);
  });

  it("un Post di solo testo non ha thumbnail né segnaposto (§106)", () => {
    const tree = setup(
      makeMessage({
        content_snapshot: {
          author_name: "Matteo Rossi",
          excerpt: "Solo testo",
          item_kind: "post",
          thumbnail_url: null,
        },
      }),
    );

    expect(countTestId(tree, "share-preview-thumbnail")).toBe(0);
    expect(countTestId(tree, "share-preview-video-tile")).toBe(0);
  });

  it("l'Articolo mette il titolo in primo piano e non inventa una cover (§107)", () => {
    const tree = setup(
      makeMessage({
        content_snapshot: {
          author_name: "Gazzetta",
          item_kind: "article",
          thumbnail_url: null,
          title: "Il nuovo progetto tecnico della Prima squadra",
        },
      }),
    );
    const json = textOf(tree);

    expect(json).toContain("Il nuovo progetto tecnico della Prima squadra");
    expect(json).toContain("Articolo");
    expect(countTestId(tree, "share-preview-thumbnail")).toBe(0);
  });

  it("il Video mostra thumbnail, Play e durata, senza avviare nulla (§108–§109)", () => {
    const tree = setup(
      makeMessage({
        content_snapshot: {
          author_name: "Como TV",
          duration_seconds: 48,
          item_kind: "video",
          thumbnail_url: "https://cdn.test/v.jpg",
          title: "Gli highlights",
        },
      }),
    );
    const json = textOf(tree);

    expect(json).toContain("0:48");
    expect(json).toContain("Video");
    expect(countTestId(tree, "share-preview-thumbnail")).toBe(1);
    // Nessun player: né un nodo Video né un Ionicons-play oltre al segno sulla thumbnail.
    expect(tree.root.findAll((node) => String(node.type) === "Video")).toHaveLength(0);
  });

  it("il testo opzionale e la card stanno nella stessa unità (§95–§97)", () => {
    const tree = setup(makeMessage({ body: "Guarda questo giocatore" }));

    expect(countTestId(tree, "content-reference-card")).toBe(1);
    expect(countTestId(tree, "content-reference-text")).toBe(1);
    expect(textOf(tree)).toContain("Guarda questo giocatore");
  });

  it("senza testo non c'è la fascia del testo (§88)", () => {
    const tree = setup(makeMessage({ body: "   " }));

    expect(countTestId(tree, "content-reference-text")).toBe(0);
    expect(countTestId(tree, "content-reference-open")).toBe(1);
  });

  it("il tap apre il contenuto canonico con origin MESSAGE (§103)", () => {
    const tree = setup(makeMessage());

    pressTestId(tree, "content-reference-open");

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(`/content/club_media/${CONTENT_ID}?origin=MESSAGE`);
  });

  it("un contenuto non più disponibile diventa «Contenuto non disponibile» e conserva il testo (§114–§116)", () => {
    const tree = setup(
      makeMessage({
        body: "Ti giro questo articolo, interessante da leggere.",
        content_available: false,
        content_snapshot: null,
      }),
    );
    const json = textOf(tree);

    expect(json).toContain("Contenuto non disponibile");
    expect(json).toContain("Questo contenuto è stato eliminato o non è più disponibile.");
    expect(json).toContain("Ti giro questo articolo");
    expect(countTestId(tree, "content-reference-open")).toBe(0);
  });

  it("non mostra id, motivo né stato tecnico (§118)", () => {
    const json = textOf(
      setup(makeMessage({ content_available: false, content_snapshot: null })),
    );

    expect(json).not.toContain(CONTENT_ID);
    expect(json).not.toContain("club_media");
    expect(json).not.toContain("content_");
  });

  it("uno snapshot presente ma accesso negato dal server vale non disponibile (§122)", () => {
    const tree = setup(makeMessage({ content_available: false }));

    expect(countTestId(tree, "content-reference-unavailable")).toBe(1);
    expect(textOf(tree)).not.toContain("Matteo Rossi");
  });

  it("un tipo di contenuto sconosciuto non diventa una href", () => {
    const tree = setup(makeMessage({ content_ref_type: "qualcosa_di_strano" }));

    expect(countTestId(tree, "content-reference-unavailable")).toBe(1);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
