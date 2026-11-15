import { describe, expect, it } from "vitest";

import type { SharePreview } from "../share/share-types";
import {
  composerIdentitiesFromState,
  composerReferenceFromFeed,
  composerReferenceFromState,
  composerReferenceFromWire,
  embeddedModelFromFeed,
  embeddedReferenceModel,
  repostIdentities,
  reposterRowLabel,
  shareRepostRow,
  simpleRepostFailureCopy,
  REPOST_COPY,
} from "./repost-presentation";
import type { RepostIdentity, RepostState } from "./repost-types";

const PREVIEW: SharePreview = {
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

/** Lo snapshot HOM-09 nella forma del server. */
const SNAPSHOT = {
  author_identity_type: "person",
  author_is_verified: true,
  author_name: "Matteo Rossi",
  excerpt: "Grande vittoria oggi!",
  item_kind: "post",
};

function identity(overrides: Partial<RepostIdentity> = {}): RepostIdentity {
  return {
    avatarUrl: null,
    canPublishPost: true,
    canRepost: true,
    canSchedule: true,
    contextLabel: "Profilo personale",
    hasSimpleRepost: false,
    id: "me",
    isVerified: true,
    name: "Marco Bianchi",
    type: "person",
    ...overrides,
  };
}

function state(overrides: Partial<RepostState> = {}): RepostState {
  return { identities: [identity()], preview: PREVIEW, repostable: true, ...overrides };
}

describe("reposterRowLabel (§73, §187, §291)", () => {
  const reposter = { name: "Marco Bianchi" };

  it("un solo reposter: «Marco Bianchi ha ripostato» (§291)", () => {
    expect(reposterRowLabel({ additionalCount: 0, reposter })).toBe("Marco Bianchi ha ripostato");
  });

  it("aggregato: «Marco Bianchi e altre 3 persone hanno ripostato» (§187)", () => {
    expect(reposterRowLabel({ additionalCount: 3, reposter })).toBe("Marco Bianchi e altre 3 persone hanno ripostato");
  });

  it("un solo altro reposter: forma italiana corretta, non «altre 1 persone»", () => {
    expect(reposterRowLabel({ additionalCount: 1, reposter })).toBe("Marco Bianchi e un'altra persona hanno ripostato");
  });

  it("un conteggio negativo o frazionario non produce frasi strane", () => {
    expect(reposterRowLabel({ additionalCount: -2, reposter })).toBe("Marco Bianchi ha ripostato");
    expect(reposterRowLabel({ additionalCount: 2.9, reposter })).toBe("Marco Bianchi e altre 2 persone hanno ripostato");
  });

  it("nessun contatore pubblico di Repost nella frase (§85)", () => {
    expect(reposterRowLabel({ additionalCount: 24, reposter })).not.toMatch(/\d+ Repost/);
  });
});

describe("shareRepostRow (§2, §120–§123, §273–§274, §296)", () => {
  const home = { id: "me", type: "person" };

  it("non ripostabile o senza stato → nessuna riga", () => {
    expect(shareRepostRow(undefined, home)).toBeNull();
    expect(shareRepostRow(null, home)).toBeNull();
    expect(shareRepostRow(state({ repostable: false }), home)).toBeNull();
  });

  it("nessuna identità con can_repost → nessuna riga", () => {
    expect(shareRepostRow(state({ identities: [identity({ canRepost: false })] }), home)).toBeNull();
    expect(shareRepostRow(state({ identities: [] }), home)).toBeNull();
  });

  it("stato normale: «Repost» + «Condividi questo contenuto con la tua rete»", () => {
    expect(shareRepostRow(state(), home)).toEqual({
      accessibilityLabel: "Repost, condividi pubblicamente questo contenuto con la tua rete",
      active: false,
      identityId: "me",
      subtitle: "Condividi questo contenuto con la tua rete",
      title: "Repost",
    });
  });

  it("l'identità Home ha già ripostato: «Repost ✓» + «Hai già ripostato questo contenuto» (§122, §274)", () => {
    const row = shareRepostRow(state({ identities: [identity({ hasSimpleRepost: true })] }), home);

    expect(row).toMatchObject({
      accessibilityLabel: "Repost. Hai già ripostato questo contenuto",
      active: true,
      subtitle: "Hai già ripostato questo contenuto",
      title: "Repost",
    });
  });

  it("conta l'identità Home, non un'altra dell'utente che ha ripostato", () => {
    const row = shareRepostRow(
      state({
        identities: [
          identity({ hasSimpleRepost: false }),
          identity({ hasSimpleRepost: true, id: "club-1", name: "AC Como", type: "society" }),
        ],
      }),
      home,
    );

    expect(row?.active).toBe(false);
    expect(row?.identityId).toBe("me");
  });

  it("l'identità Home non può ripostare: si ricade sulla prima che può", () => {
    const row = shareRepostRow(
      state({
        identities: [
          identity({ canRepost: false }),
          identity({ id: "club-1", name: "AC Como", type: "society" }),
        ],
      }),
      home,
    );

    expect(row?.identityId).toBe("club-1");
  });

  it("senza identità Home risolta si usa la prima che può ripostare", () => {
    expect(shareRepostRow(state(), null)?.identityId).toBe("me");
  });

  it("nessuna seconda funzione Repost (§4)", () => {
    const text = JSON.stringify(shareRepostRow(state(), home)).toLowerCase();

    expect(text).not.toContain("pensiero");
    expect(text).not.toContain("commento");
    expect(text).not.toContain("quote");
  });
});

describe("repostIdentities / composerIdentitiesFromState (§29–§31)", () => {
  it("solo le identità con can_repost, nell'ordine del server", () => {
    const value = state({
      identities: [
        identity({ id: "a", name: "A" }),
        identity({ canRepost: false, id: "b", name: "B" }),
        identity({ id: "c", name: "C", type: "society" }),
      ],
    });

    expect(repostIdentities(value).map((item) => item.id)).toEqual(["a", "c"]);
    expect(composerIdentitiesFromState(value).map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("porta le capability che il composer rivaluta e non il flag canRepost", () => {
    const [composer] = composerIdentitiesFromState(state({ identities: [identity({ hasSimpleRepost: true })] }));

    expect(composer).toMatchObject({ canPublishPost: true, canSchedule: true, hasSimpleRepost: true, id: "me" });
    expect("canRepost" in composer).toBe(false);
  });
});

describe("embeddedReferenceModel (§45–§49, §173–§177, §276)", () => {
  const available = {
    available: true,
    contentId: "c-1",
    contentType: "club_media",
    preview: PREVIEW,
  } as const;

  it("disponibile: preview e a11y che dice «Contenuto originale incorporato» PRIMA dei metadata (§276)", () => {
    const model = embeddedReferenceModel(available);

    expect(model.kind).toBe("available");
    expect(model.accessibilityLabel.startsWith("Contenuto originale incorporato. ")).toBe(true);
    expect(model.accessibilityLabel).toContain("Matteo Rossi");
    expect(model.accessibilityLabel).toContain("Grande vittoria oggi!");
  });

  it("non disponibile: copy generica e non tecnica, nessun id (§174–§175)", () => {
    const model = embeddedReferenceModel({ ...available, available: false });

    expect(model).toMatchObject({
      body: "Questo contenuto è stato eliminato o non è più disponibile.",
      kind: "unavailable",
      title: "Contenuto originale non disponibile",
    });
    expect(model.accessibilityLabel.startsWith(REPOST_COPY.embeddedLabel)).toBe(true);
    expect(JSON.stringify(model)).not.toContain("c-1");
  });

  it("senza preview una reference «disponibile» vale non disponibile: niente card vuota", () => {
    expect(embeddedReferenceModel({ ...available, preview: null }).kind).toBe("unavailable");
  });

  it("un tipo non apribile (fan_tribuna) non diventa una route rotta (§177)", () => {
    expect(embeddedReferenceModel({ ...available, contentType: "fan_tribuna" }).kind).toBe("unavailable");
  });
});

describe("conversioni della reference", () => {
  const wire = { available: true, content_id: "c-1", content_type: "club_media", snapshot: SNAPSHOT };

  it("da data.reference del Feed: preview dallo snapshot, tipo e id canonici", () => {
    const reference = composerReferenceFromFeed({
      available: true,
      contentId: "c-1",
      contentType: "club_media",
      snapshot: SNAPSHOT,
    });

    expect(reference).toMatchObject({ available: true, contentId: "c-1", contentType: "club_media" });
    expect(reference.preview).toMatchObject({ authorName: "Matteo Rossi", excerpt: "Grande vittoria oggi!", kind: "post" });
  });

  it("senza snapshot la reference non è disponibile anche se il server lo dice (§173)", () => {
    expect(
      composerReferenceFromFeed({ available: true, contentId: "c-1", contentType: "club_media", snapshot: null }),
    ).toMatchObject({ available: false, preview: null });
  });

  it("da jsonb di fetch_post_for_edit / fetch_content_for_editor", () => {
    expect(composerReferenceFromWire(wire)).toMatchObject({ available: true, contentId: "c-1" });
    expect(composerReferenceFromWire({ ...wire, available: false })).toMatchObject({ available: false });
  });

  it("assente, nulla o malformata → nessuna reference", () => {
    expect(composerReferenceFromWire(undefined)).toBeNull();
    expect(composerReferenceFromWire(null)).toBeNull();
    expect(composerReferenceFromWire({ content_id: "c-1" })).toBeNull();
    expect(composerReferenceFromWire({ content_id: "c-1", content_type: "boh" })).toBeNull();
  });

  it("da fetch_repost_state: disponibile solo se ripostabile e con preview (§43, §45)", () => {
    const ref = { contentId: "c-1", contentType: "club_media" } as const;

    expect(composerReferenceFromState(ref, state())).toMatchObject({ available: true, preview: PREVIEW });
    expect(composerReferenceFromState(ref, state({ repostable: false }))).toMatchObject({ available: false });
    expect(composerReferenceFromState(ref, state({ preview: null }))).toMatchObject({ available: false });
  });

  it("embeddedModelFromFeed è la composizione delle due", () => {
    expect(
      embeddedModelFromFeed({ available: true, contentId: "c-1", contentType: "club_media", snapshot: SNAPSHOT }).kind,
    ).toBe("available");
    expect(
      embeddedModelFromFeed({ available: false, contentId: "c-1", contentType: "club_media", snapshot: null }).kind,
    ).toBe("unavailable");
  });

  it("un Video: thumbnail, Play e durata arrivano dalla preview (§112–§113)", () => {
    const reference = composerReferenceFromFeed({
      available: true,
      contentId: "v-1",
      contentType: "media_profile",
      snapshot: {
        author_name: "Como Football News",
        duration_seconds: 48,
        item_kind: "video",
        thumbnail_url: "https://cdn.test/v.jpg",
        title: "Highlights",
      },
    });

    expect(reference.preview).toMatchObject({ durationSeconds: 48, kind: "video", showsPlay: true });
  });

  it("un Articolo: cover, titolo, autore e label (§114)", () => {
    const reference = composerReferenceFromFeed({
      available: true,
      contentId: "a-1",
      contentType: "club_media",
      snapshot: {
        author_is_verified: true,
        author_name: "AC Como",
        item_kind: "article",
        thumbnail_url: "https://cdn.test/cover.jpg",
        title: "Il settore giovanile dell'AC Como",
      },
    });

    expect(reference.preview).toMatchObject({
      authorName: "AC Como",
      kind: "article",
      thumbnailUrl: "https://cdn.test/cover.jpg",
      title: "Il settore giovanile dell'AC Como",
    });
  });
});

describe("simpleRepostFailureCopy (§39, §72, §229)", () => {
  it("una frase per esito, senza codici", () => {
    expect(simpleRepostFailureCopy("error")).toBe("Non è stato possibile effettuare il repost. Riprova.");
    expect(simpleRepostFailureCopy("unavailable")).toBe("Il contenuto originale non è più disponibile.");
    expect(simpleRepostFailureCopy("forbidden")).toBe(
      "Non hai più i permessi per effettuare il repost con questo profilo.",
    );
  });
});
