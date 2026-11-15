import { describe, expect, it } from "vitest";

import {
  makeArticleItem,
  makeMediaItem,
  makePostItem,
  makeVideoItem,
  makeVideoMedia,
} from "../feed/components/feed-test-helpers";
import type { InboxConversation } from "../messaging/messaging-service";
import {
  buildExternalShareMessage,
  buildShareTarget,
  buildSharePreviewFromDetail,
  buildSharePreviewFromFeedItem,
  clampShareText,
  externalShareTitle,
  failedCountLabel,
  mergeRecipientPages,
  nextLabel,
  partialTitle,
  readContentReference,
  recipientAccessibilityLabel,
  recipientMetaLine,
  recipientsSummary,
  retryLabel,
  selectRecentRecipients,
  sendAccessibilityLabel,
  sendLabel,
  shareKindLabel,
  sharedMessagePreview,
  shareTextCounter,
  sharePreviewAccessibilityLabel,
  sharePreviewDuration,
  shortText,
  snapshotToPreview,
  successMessage,
  toggleRecipient,
  SHARE_MAX_DESTINATIONS,
  SHARE_RECENTS_MAX,
} from "./share-presentation";
import type { ShareRecipient } from "./share-types";

function recipient(overrides: Partial<ShareRecipient> = {}): ShareRecipient {
  return {
    available: true,
    avatarUrl: null,
    clubId: null,
    contextLabel: null,
    conversationId: "c1",
    displayName: "Marco Bianchi",
    groupAvatarPath: null,
    isVerified: false,
    key: "conv:c1",
    kind: "direct",
    participantCount: null,
    profileId: "p1",
    role: null,
    ...overrides,
  };
}

function conversation(overrides: Partial<InboxConversation> = {}): InboxConversation {
  return {
    archived: false,
    avatar_url: null,
    blocked_by_me: false,
    conversation_id: "c1",
    conversation_type: "direct",
    display_title: "Marco Bianchi",
    group_avatar_path: null,
    last_message_body: null,
    last_message_kind: null,
    last_message_sender_name: null,
    last_message_sender_profile_id: null,
    last_message_sent_at: null,
    other_profile_id: "p1",
    participant_count: 2,
    unread_count: 0,
    ...overrides,
  };
}

describe("preview del contenuto (§13–§21)", () => {
  it("Post con immagine: thumbnail, autore, verifica, excerpt, label Post (§14)", () => {
    const item = makePostItem(
      {},
      {
        authorIdentityType: "person",
        authorMeta: {
          clubCategory: null,
          clubName: "AC Como",
          mediaKind: null,
          primaryPosition: null,
          role: "coach",
          teamLabel: null,
        },
        body: "Grande vittoria oggi! Continuiamo su questa strada, testa alla prossima.",
        media: [makeMediaItem(0)],
      },
    );
    const preview = buildSharePreviewFromFeedItem(item);

    expect(preview).toMatchObject({
      authorMeta: "Allenatore · AC Como",
      authorName: "Como 1907",
      isVerified: true,
      kind: "post",
      showsPlay: false,
      thumbnailUrl: "https://cdn.test/0-thumb.jpg",
      title: null,
    });
    expect(preview.excerpt).toContain("Grande vittoria oggi!");
    expect(shareKindLabel(preview.kind)).toBe("Post");
  });

  it("Post di solo testo: nessuna thumbnail né segnaposto (§16)", () => {
    const preview = buildSharePreviewFromFeedItem(makePostItem({}, { media: [] }));

    expect(preview.thumbnailUrl).toBeNull();
    expect(preview.showsPlay).toBe(false);
  });

  it("l'excerpt è breve e mai il body intero (§13, §169)", () => {
    const long = "parola ".repeat(200);
    const preview = buildSharePreviewFromFeedItem(makePostItem({}, { body: long }));

    expect((preview.excerpt ?? "").length).toBeLessThanOrEqual(121);
    expect(preview.excerpt?.endsWith("…")).toBe(true);
  });

  it("Post con video in prima posizione: thumbnail e Play", () => {
    const preview = buildSharePreviewFromFeedItem(
      makePostItem({}, { media: [makeVideoMedia(0, { durationSeconds: 75 })] }),
    );

    expect(preview.showsPlay).toBe(true);
    expect(sharePreviewDuration(preview)).toBe("1:15");
  });

  it("Articolo: titolo prioritario, cover se c'è, nessun excerpt (§17–§18)", () => {
    const withCover = buildSharePreviewFromFeedItem(
      makeArticleItem({}, { media: [makeMediaItem(0)] }),
    );
    const withoutCover = buildSharePreviewFromFeedItem(makeArticleItem({}, { media: [] }));

    expect(withCover).toMatchObject({
      excerpt: null,
      kind: "article",
      title: "Il calcio italiano e i giovani talenti",
    });
    expect(withCover.thumbnailUrl).toBe("https://cdn.test/0-thumb.jpg");
    expect(withoutCover.thumbnailUrl).toBeNull();
    expect(shareKindLabel("article")).toBe("Articolo");
  });

  it("Video: thumbnail, Play e durata (§19)", () => {
    const preview = buildSharePreviewFromFeedItem(
      makeVideoItem({}, { media: [makeVideoMedia(0)] }),
    );

    expect(preview).toMatchObject({ kind: "video", showsPlay: true, title: "Gli highlights della partita" });
    expect(preview.thumbnailUrl).toBe("https://cdn.test/0-thumb.jpg");
    expect(sharePreviewDuration(preview)).toBe("0:48");
  });

  it("la reference porta tipo e id canonici (§2)", () => {
    const target = buildShareTarget(makePostItem());

    expect(target.contentId).toBe("p1");
    expect(target.contentType).toBe("club_media");
  });

  it("dal dettaglio storico: Articolo, Video o Post secondo ciò che la vista conosce", () => {
    const base = {
      authorName: "Como",
      durationSeconds: 30,
      excerpt: "Testo",
      thumbnailUrl: null,
      title: "Titolo",
    };

    expect(buildSharePreviewFromDetail({ ...base, hasVideo: false, isArticle: true }).kind).toBe("article");
    expect(buildSharePreviewFromDetail({ ...base, hasVideo: true, isArticle: false }).kind).toBe("video");
    expect(buildSharePreviewFromDetail({ ...base, hasVideo: false, isArticle: false })).toMatchObject({
      excerpt: "Testo",
      kind: "post",
      title: null,
    });
  });

  it("l'etichetta per lo screen reader è una sola frase", () => {
    const preview = buildSharePreviewFromFeedItem(makePostItem({}, { body: "Ciao a tutti" }));

    expect(sharePreviewAccessibilityLabel(preview)).toBe(
      "Post di Como 1907 profilo verificato. Ciao a tutti",
    );
  });
});

describe("shortText", () => {
  it("collassa gli spazi e non spezza le emoji", () => {
    expect(shortText("  a   b\n c ", 10)).toBe("a b c");
    expect(shortText("😀".repeat(10), 4)).toBe("😀😀😀😀…");
    expect(shortText("   ", 5)).toBeNull();
    expect(shortText(null, 5)).toBeNull();
  });
});

describe("snapshot della chat (§98–§102, §114–§118, §122)", () => {
  const snapshot = {
    author_identity_type: "person",
    author_is_verified: true,
    author_meta: { club_name: "AC Como", role: "agent" },
    author_name: "Matteo Rossi",
    duration_seconds: 48,
    excerpt: "Grande vittoria oggi!",
    item_kind: "post",
    thumbnail_url: "https://cdn.test/t.jpg",
  };
  const ID = "11111111-2222-4333-8444-555555555555";

  it("mappa lo snapshot in preview; il ruolo agent si legge «Procuratore» (§61)", () => {
    expect(snapshotToPreview(snapshot)).toMatchObject({
      authorMeta: "Procuratore · AC Como",
      authorName: "Matteo Rossi",
      excerpt: "Grande vittoria oggi!",
      isVerified: true,
      kind: "post",
      thumbnailUrl: "https://cdn.test/t.jpg",
    });
  });

  it("per Articolo e Video il titolo è quello dello snapshot, senza excerpt", () => {
    expect(snapshotToPreview({ ...snapshot, item_kind: "article", title: "Titolo" })).toMatchObject({
      excerpt: null,
      kind: "article",
      title: "Titolo",
    });
    expect(snapshotToPreview({ ...snapshot, item_kind: "video", title: "Clip" })).toMatchObject({
      durationSeconds: 48,
      kind: "video",
      showsPlay: true,
    });
  });

  it("un Post con video mostra Play e durata; uno con sola immagine no", () => {
    const withVideo = snapshotToPreview({ ...snapshot, duration_seconds: 48, media_type: "video" });
    const withImage = snapshotToPreview({ ...snapshot, duration_seconds: null, media_type: "image" });

    expect(withVideo).toMatchObject({ kind: "post", showsPlay: true });
    expect(sharePreviewDuration(withVideo as never)).toBe("0:48");
    expect(withImage?.showsPlay).toBe(false);
  });

  it("uno snapshot che non è un oggetto non produce una preview", () => {
    expect(snapshotToPreview(null)).toBeNull();
    expect(snapshotToPreview("x")).toBeNull();
    expect(snapshotToPreview([])).toBeNull();
  });

  it("disponibile solo se il server conferma, con snapshot e reference apribile", () => {
    const view = readContentReference({
      content_available: true,
      content_ref_id: ID,
      content_ref_type: "club_media",
      content_snapshot: snapshot,
    });

    expect(view).toMatchObject({ available: true, contentId: ID, contentType: "club_media" });
  });

  it("tutto ciò che non è confermato per questo viewer è «non disponibile» (§117, §122)", () => {
    const ok = {
      content_available: true,
      content_ref_id: ID,
      content_ref_type: "club_media",
      content_snapshot: snapshot,
    };

    expect(readContentReference({ ...ok, content_available: false })).toEqual({ available: false });
    expect(readContentReference({ ...ok, content_snapshot: null })).toEqual({ available: false });
    expect(readContentReference({ ...ok, content_ref_type: "boh" })).toEqual({ available: false });
    expect(readContentReference({ ...ok, content_ref_type: "fan_tribuna" })).toEqual({
      available: false,
    });
    expect(readContentReference({ ...ok, content_ref_id: null })).toEqual({ available: false });
  });
});

describe("Recenti (§24–§33)", () => {
  it("solo DIRECT e GROUP attivi, non archiviati né bloccati da me", () => {
    const list = [
      conversation({ conversation_id: "d1" }),
      conversation({ conversation_id: "g1", conversation_type: "group", group_status: "active" }),
      conversation({ conversation_id: "g2", conversation_type: "group", group_status: "archived" }),
      conversation({ blocked_by_me: true, conversation_id: "b1" }),
      conversation({ archived: true, conversation_id: "a1" }),
    ];

    expect(selectRecentRecipients(list).map((r) => r.key)).toEqual(["conv:d1", "conv:g1"]);
  });

  it("un gruppo senza group_status (legacy) resta ammesso", () => {
    expect(
      selectRecentRecipients([
        conversation({ conversation_id: "g", conversation_type: "group", group_status: undefined }),
      ]),
    ).toHaveLength(1);
  });

  it("chi mi ha bloccato resta selezionabile: il blocco non si rivela (D3)", () => {
    // Il client non lo sa nemmeno: nessun campo lo espone, la riga è una normale DIRECT.
    expect(selectRecentRecipients([conversation()])[0].available).toBe(true);
  });

  it("un numero limitato, con il tipo corretto e l'avatar del gruppo", () => {
    const list = Array.from({ length: 12 }, (_, index) =>
      conversation({ conversation_id: `c${index}` }),
    );
    const [first] = selectRecentRecipients([
      conversation({
        conversation_type: "group",
        display_title: "Staff Prima Squadra",
        group_avatar_path: "g/1.png",
        participant_count: 8,
      }),
    ]);

    expect(selectRecentRecipients(list)).toHaveLength(SHARE_RECENTS_MAX);
    expect(first).toMatchObject({
      groupAvatarPath: "g/1.png",
      kind: "group",
      participantCount: 8,
    });
  });
});

describe("righe destinatario (§59–§65, §228–§230)", () => {
  it("PERSON: ruolo e contesto («Allenatore · AC Como»)", () => {
    expect(
      recipientMetaLine(recipient({ contextLabel: "AC Como", kind: "person", role: "coach" })),
    ).toBe("Allenatore · AC Como");
  });

  it("usa «Procuratore», mai «Agente» (§61)", () => {
    const line = recipientMetaLine(recipient({ kind: "person", role: "agent" }));

    expect(line).toBe("Procuratore");
    expect(line).not.toContain("Agente");
  });

  it("GROUP: numero di partecipanti (§64–§65)", () => {
    expect(recipientMetaLine(recipient({ kind: "group", participantCount: 8 }))).toBe("8 partecipanti");
    expect(recipientMetaLine(recipient({ kind: "group", participantCount: 1 }))).toBe("1 partecipante");
  });

  it("Società e Media: il contesto del server, con un fallback sobrio (§62–§63)", () => {
    expect(recipientMetaLine(recipient({ contextLabel: "Serie D", kind: "club" }))).toBe("Serie D");
    expect(recipientMetaLine(recipient({ kind: "club" }))).toBe("Società");
    expect(recipientMetaLine(recipient({ kind: "media" }))).toBe("Media");
  });

  it("non disponibile: «Non disponibile per i messaggi», nessun codice (§57–§58)", () => {
    const line = recipientMetaLine(recipient({ available: false }));

    expect(line).toBe("Non disponibile per i messaggi");
    expect(line).not.toMatch(/can_message|permission|policy/i);
  });

  it("a11y: nome, tipo e stato — «selezionato» / «non selezionato» (§228–§230)", () => {
    expect(recipientAccessibilityLabel(recipient(), true)).toBe("Marco Bianchi, selezionato");
    expect(recipientAccessibilityLabel(recipient(), false)).toBe("Marco Bianchi, non selezionato");
    expect(
      recipientAccessibilityLabel(
        recipient({ displayName: "Staff Prima Squadra", kind: "group", participantCount: 8 }),
        true,
      ),
    ).toBe("Staff Prima Squadra, gruppo, 8 partecipanti, selezionato");
    expect(
      recipientAccessibilityLabel(
        recipient({ displayName: "Staff Prima Squadra", kind: "group", participantCount: 8 }),
        false,
      ),
    ).toBe("Staff Prima Squadra, gruppo, 8 partecipanti, non selezionato");
    expect(recipientAccessibilityLabel(recipient({ kind: "club" }), false)).toBe(
      "Marco Bianchi, società, non selezionato",
    );
  });

  it("senza selezione (i Recenti) lo stato non si dice", () => {
    expect(recipientAccessibilityLabel(recipient(), null)).toBe("Marco Bianchi");
  });

  it("dedup delle pagine per recipient_key (§74)", () => {
    const merged = mergeRecipientPages([
      { items: [recipient({ key: "a" }), recipient({ key: "b" })] },
      { items: [recipient({ key: "b" }), recipient({ key: "c" })] },
    ]);

    expect(merged.map((r) => r.key)).toEqual(["a", "b", "c"]);
  });
});

describe("selezione (§66–§73)", () => {
  it("aggiunge e toglie, mantenendo l'ordine di selezione", () => {
    const a = recipient({ key: "a" });
    const b = recipient({ key: "b" });

    expect(toggleRecipient([], a)).toEqual([a]);
    expect(toggleRecipient([a], b)).toEqual([a, b]);
    expect(toggleRecipient([a, b], a)).toEqual([b]);
  });

  it("un destinatario non disponibile non si seleziona (§56)", () => {
    expect(toggleRecipient([], recipient({ available: false }))).toEqual([]);
  });

  it("si ferma al massimo di destinazioni del server", () => {
    const full = Array.from({ length: SHARE_MAX_DESTINATIONS }, (_, i) => recipient({ key: `k${i}` }));

    expect(toggleRecipient(full, recipient({ key: "extra" }))).toHaveLength(SHARE_MAX_DESTINATIONS);
    // ...ma una selezione esistente si può sempre togliere.
    expect(toggleRecipient(full, full[0])).toHaveLength(SHARE_MAX_DESTINATIONS - 1);
  });
});

describe("CTA e feedback (§69, §84–§85, §93–§94, §130–§131, §139, §233)", () => {
  it("«Avanti» a zero, poi «Avanti (N)»", () => {
    expect(nextLabel(0)).toBe("Avanti");
    expect(nextLabel(1)).toBe("Avanti (1)");
    expect(nextLabel(3)).toBe("Avanti (3)");
  });

  it("«Invia» per uno, «Invia a N» per più; a11y «Invia a 3 conversazioni»", () => {
    expect(sendLabel(1)).toBe("Invia");
    expect(sendLabel(3)).toBe("Invia a 3");
    expect(sendAccessibilityLabel(3)).toBe("Invia a 3 conversazioni");
    expect(sendAccessibilityLabel(1)).toBe("Invia");
  });

  it("riepilogo destinatari: il nome se uno, la sintesi se più (§84–§85)", () => {
    expect(recipientsSummary([recipient()])).toBe("Marco Bianchi");
    expect(recipientsSummary([recipient(), recipient({ key: "b" }), recipient({ key: "c" })])).toBe(
      "3 conversazioni selezionate",
    );
    // Due righe che sono una sola consegna (persona P + Società di P): il nome, non «2».
    expect(recipientsSummary([recipient(), recipient({ key: "b" })], 1)).toBe("Marco Bianchi");
    expect(recipientsSummary([recipient(), recipient({ key: "b" }), recipient({ key: "c" })], 2)).toBe(
      "2 conversazioni selezionate",
    );
  });

  it("successo: «Inviato» / «Inviato a N conversazioni»", () => {
    expect(successMessage(1)).toBe("Inviato");
    expect(successMessage(3)).toBe("Inviato a 3 conversazioni");
  });

  it("parziale: «Inviato a 2 di 3 conversazioni», «1 invio non riuscito», «Riprova 1 invio»", () => {
    expect(partialTitle(2, 3)).toBe("Inviato a 2 di 3 conversazioni");
    expect(failedCountLabel(1)).toBe("1 invio non riuscito");
    expect(failedCountLabel(2)).toBe("2 invii non riusciti");
    expect(retryLabel(1)).toBe("Riprova 1 invio");
    expect(retryLabel(3)).toBe("Riprova 3 invii");
  });

  it("il testo è limitato a 500 caratteri, con contatore", () => {
    expect(clampShareText("a".repeat(600))).toHaveLength(500);
    expect(clampShareText("ciao")).toBe("ciao");
    expect(shareTextCounter("ciao")).toBe("4/500");
    expect(shareTextCounter("")).toBe("0/500");
  });

  it("l'anteprima Inbox di una condivisione senza testo è «Contenuto condiviso»", () => {
    expect(sharedMessagePreview("")).toBe("Contenuto condiviso");
    expect(sharedMessagePreview(null)).toBe("Contenuto condiviso");
    expect(sharedMessagePreview("Guarda")).toBe("Guarda");
  });
});

describe("payload per lo share sheet di sistema (§165–§172)", () => {
  const URL = "https://prolink.app/content/club_media/abc12345";

  it("Post: «Autore su PROLINK», excerpt breve, URL (§166)", () => {
    const preview = buildSharePreviewFromFeedItem(
      makePostItem({}, { body: "Grande vittoria oggi! Continuiamo" }),
    );

    expect(buildExternalShareMessage(preview, URL)).toBe(
      `Como 1907 su PROLINK\nGrande vittoria oggi! Continuiamo\n${URL}`,
    );
  });

  it("Post molto lungo: mai il body completo (§169)", () => {
    const preview = buildSharePreviewFromFeedItem(makePostItem({}, { body: "x ".repeat(500) }));
    const message = buildExternalShareMessage(preview, URL);

    expect(message.length).toBeLessThan(200);
  });

  it("Articolo: «Titolo — Autore», URL (§167)", () => {
    const preview = buildSharePreviewFromFeedItem(makeArticleItem());

    expect(buildExternalShareMessage(preview, URL)).toBe(
      `Il calcio italiano e i giovani talenti — Como 1907\n${URL}`,
    );
  });

  it("Video: titolo, autore, URL (§168)", () => {
    const preview = buildSharePreviewFromFeedItem(makeVideoItem());

    expect(buildExternalShareMessage(preview, URL)).toBe(
      `Gli highlights della partita\nComo 1907\n${URL}`,
    );
  });

  it("nessun JSON, id grezzo o URL tecnico: solo testo e l'URL canonico (§171)", () => {
    const preview = buildSharePreviewFromFeedItem(
      makePostItem({}, { media: [makeMediaItem(0)] }),
    );
    const message = buildExternalShareMessage(preview, URL);

    expect(message).not.toContain("cdn.test");
    expect(message).not.toContain("{");
    expect(message).not.toContain("club_media:p1");
  });

  it("senza autore ripiega su «Su PROLINK»", () => {
    const preview = buildSharePreviewFromFeedItem(makePostItem({ author: null }, { body: "" }));

    expect(buildExternalShareMessage(preview, URL)).toBe(`Su PROLINK\n${URL}`);
    expect(externalShareTitle(preview)).toBe("PROLINK");
  });
});
