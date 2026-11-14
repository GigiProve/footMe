/**
 * Derivazioni pure dei Commenti (HOM-08): riga meta, testo, pubblicabilità,
 * identità, elemento ottimistico, thread, menu e accessibilità.
 */
import { describe, expect, it } from "vitest";

import {
  COMMENT_CONTENT_UNAVAILABLE,
  COMMENT_PERMISSION_LOST,
  COMMENT_TARGET_UNAVAILABLE,
  COMMENTS_DISABLED,
} from "./comment-labels";
import {
  authorHref,
  buildCommentActions,
  buildOptimisticComment,
  commentAccessibilityLabel,
  commentActionContext,
  commentAuthorAccessibilityLabel,
  commentCounter,
  commentIdentityContextLabel,
  commentMetaLine,
  commentMentionsForSubmit,
  commentableIdentities,
  defaultCommentIdentity,
  editErrorCopy,
  extractCommentLinks,
  hasCommentIdentityChoice,
  identityFromAuthor,
  isCommentMeaningful,
  mergeReplyRefs,
  mergeRootRefs,
  placeholderLabel,
  publishBlockReason,
  publishErrorCopy,
  repliesToggleModel,
  replyAccessibilityLabel,
  replyMentionPrefix,
  resolveCommentIdentity,
  segmentCommentBody,
  sortLabel,
  sortSelectionAnnouncement,
  toComposerIdentity,
  truncateUrlMiddle,
} from "./comment-presentation";
import type { Comment, CommentAuthor, CommentIdentity } from "./comment-types";

const NOW = new Date("2026-11-14T12:00:00.000Z");

function ago(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

function author(overrides: Partial<CommentAuthor> = {}): CommentAuthor {
  return {
    avatarUrl: null,
    clubCategory: null,
    clubName: null,
    identityId: "p-1",
    identityType: "person",
    isVerified: false,
    mediaKind: null,
    name: "Marco Bianchi",
    primaryPosition: null,
    role: null,
    teamLabel: null,
    ...overrides,
  };
}

function identity(overrides: Partial<CommentIdentity> = {}): CommentIdentity {
  return {
    avatarUrl: null,
    canComment: true,
    clubCategory: null,
    clubName: null,
    mediaKind: null,
    primaryPosition: null,
    teamLabel: null,
    id: "p-1",
    isVerified: false,
    name: "Matteo Rossi",
    rank: 0,
    role: null,
    type: "person",
    ...overrides,
  };
}

const PERSON = identity();
const SOCIETY = identity({ clubCategory: "Serie D", id: "c-1", name: "AC Como", type: "society" });
const MEDIA = identity({ id: "m-1", name: "Como Football News", type: "media" });

describe("riga meta — §55–§61", () => {
  it("PERSON: «Allenatore · AC Como · 2 h» (§56)", () => {
    const line = commentMetaLine(
      { author: author({ clubName: "AC Como", role: "coach" }), createdAt: ago(120), editedAt: null },
      NOW,
    );

    expect(line).toBe("Allenatore · AC Como · 2\u00a0h");
  });

  it("SOCIETY: «Società · Serie D · 1 h» (§57)", () => {
    const line = commentMetaLine(
      {
        author: author({ clubCategory: "Serie D", identityId: "c-1", identityType: "society", name: "AC Como" }),
        createdAt: ago(60),
        editedAt: null,
      },
      NOW,
    );

    expect(line).toBe("Società · Serie D · 1\u00a0h");
  });

  it("MEDIA: «Media · 30 min» (§58)", () => {
    const line = commentMetaLine(
      { author: author({ identityType: "media", mediaKind: "testata" }), createdAt: ago(30), editedAt: null },
      NOW,
    );

    expect(line).toBe("Media · 30\u00a0min");
  });

  it("«Procuratore», mai «Agente» (§59)", () => {
    const line = commentMetaLine(
      { author: author({ role: "agent" }), createdAt: ago(5), editedAt: null },
      NOW,
    );

    expect(line).toContain("Procuratore");
    expect(line).not.toContain("Agente");
  });

  it("§157: «2 h · Modificato»", () => {
    const line = commentMetaLine(
      { author: author({ clubName: "AC Como", role: "coach" }), createdAt: ago(120), editedAt: ago(10) },
      NOW,
    );

    expect(line).toBe("Allenatore · AC Como · 2\u00a0h · Modificato");
  });

  it("senza metadati resta solo il tempo; mai «ufficiale» (§63)", () => {
    const line = commentMetaLine({ author: author(), createdAt: ago(0), editedAt: null }, NOW);

    expect(line).toBe("ora");
    expect(line.toLowerCase()).not.toContain("ufficiale");
  });
});

describe("testo: mention e link — §108–§115", () => {
  const url = "https://prolink.app/x";
  const body = `@Marco Bianchi guarda ${url}`;
  const mention = {
    displayName: "Marco Bianchi",
    end: 14,
    identityId: "p-2",
    identityType: "profile" as const,
    start: 0,
  };
  const start = body.indexOf(url);

  it("testo | mention | link, in ordine, e il testo si ricompone intero", () => {
    const segments = segmentCommentBody(body, [mention], [{ end: start + url.length, start, url }]);

    expect(segments.map((segment) => segment.kind)).toEqual(["mention", "text", "link"]);
    expect(segments[0]).toMatchObject({ kind: "mention", text: "@Marco Bianchi" });
    expect(segments[1]).toMatchObject({ kind: "text", text: " guarda " });
    expect(segments[2]).toMatchObject({ kind: "link", url });
  });

  it("sono cliccabili SOLO i link restituiti dal server (§115)", () => {
    const segments = segmentCommentBody(body, [mention], []);

    expect(segments.some((segment) => segment.kind === "link")).toBe(false);
    expect(segments.map((segment) => segment.text).join("")).toBe(body);
  });

  it("un link che si sovrappone a una mention o fuori dal testo è ignorato", () => {
    const segments = segmentCommentBody(
      body,
      [mention],
      [
        { end: 10, start: 2, url: "https://x.test" },
        { end: 9999, start: 22, url: "https://y.test" },
      ],
    );

    expect(segments.some((segment) => segment.kind === "link")).toBe(false);
    expect(segments.map((segment) => segment.text).join("")).toBe(body);
  });

  it("il testo del link mostrato è troncato, il target è l'URL intero (§114–§115)", () => {
    const long = `https://www.example.com/${"a".repeat(80)}`;
    const text = `leggi ${long}`;
    const segments = segmentCommentBody(text, [], [{ end: text.length, start: 6, url: long }]);
    const link = segments.find((segment) => segment.kind === "link");

    expect(link?.kind === "link" && link.url).toBe(long);
    expect(link?.text.length).toBeLessThan(long.length);
    expect(link?.text).toContain("…");
  });

  it("truncateUrlMiddle: l'URL corto non cambia, schema omesso", () => {
    expect(truncateUrlMiddle("https://prolink.app/x")).toBe("prolink.app/x");
    expect(truncateUrlMiddle("https://a.test/".concat("b".repeat(100))).length).toBe(36);
  });

  it("extractCommentLinks: solo https idonei, nel limite, con l'intervallo", () => {
    const text = "vedi https://prolink.app/x e http://insecure.it e https://b.test/y";
    const links = extractCommentLinks(text, 10);

    expect(links.map((link) => link.url)).toEqual(["https://prolink.app/x", "https://b.test/y"]);
    expect(links[0].start).toBe(5);
    expect(text.slice(links[0].start, links[0].end)).toBe(links[0].url);
    expect(extractCommentLinks(text, 1)).toHaveLength(1);
  });

  it("commentMentionsForSubmit scarta le mention non più allineate al testo (§109)", () => {
    const stale = { ...mention, end: 14, start: 1 };

    expect(commentMentionsForSubmit(body, [mention, stale], 20)).toEqual([mention]);
    expect(commentMentionsForSubmit("ciao", [mention], 20)).toEqual([]);
    expect(commentMentionsForSubmit(body, [mention], 0)).toEqual([]);
  });
});

describe("risposta con mention automatica — §84–§85", () => {
  const target = author({ name: "Luca Ferri", identityId: "p-3" });

  it("inserisce «@Luca Ferri » come mention strutturata a testo vuoto", () => {
    const prefix = replyMentionPrefix(target, { currentBody: "", maxBodyLength: 1000, self: null });

    expect(prefix?.body).toBe("@Luca Ferri ");
    expect(prefix?.mentions).toEqual([
      { displayName: "Luca Ferri", end: 11, identityId: "p-3", identityType: "profile", start: 0 },
    ]);
  });

  it("una Società diventa mention di tipo club", () => {
    const society = author({ identityId: "c-1", identityType: "society", name: "AC Como" });

    expect(replyMentionPrefix(society, { currentBody: "", maxBodyLength: 1000, self: null })?.mentions[0])
      .toMatchObject({ identityType: "club" });
  });

  it("non scrive sopra al testo già digitato né si auto-menziona", () => {
    expect(replyMentionPrefix(target, { currentBody: "ciao", maxBodyLength: 1000, self: null })).toBeNull();
    expect(
      replyMentionPrefix(target, { currentBody: "", maxBodyLength: 1000, self: { id: "p-3", type: "person" } }),
    ).toBeNull();
  });
});

describe("ordinamento — §117–§119, §233", () => {
  it("solo «Più rilevanti» e «Più recenti»; l'opzione scelta si annuncia", () => {
    expect(sortLabel("relevant")).toBe("Più rilevanti");
    expect(sortLabel("recent")).toBe("Più recenti");
    expect(sortSelectionAnnouncement("recent")).toBe("Ordinamento: Più recenti");
  });
});

describe("pubblicabilità — §24–§25, §46", () => {
  const base = {
    body: "Ottimo progetto.",
    commentsEnabled: true,
    contentAvailable: true,
    hasIdentity: true,
    identityLost: false,
    isSending: false,
    limits: { maxBodyLength: 1000, maxLinks: 10, maxMentions: 20 },
    mentions: [],
  };

  it("testo valido → può pubblicare", () => {
    expect(publishBlockReason(base)).toBeNull();
  });

  it("vuoto, spazi o sole mention → disabled (§24)", () => {
    expect(publishBlockReason({ ...base, body: "" })).toBe("empty");
    expect(publishBlockReason({ ...base, body: "   \n" })).toBe("empty");
    expect(
      publishBlockReason({
        ...base,
        body: "@Marco Bianchi",
        mentions: [{ displayName: "Marco Bianchi", end: 14, identityId: "p-2", identityType: "profile", start: 0 }],
      }),
    ).toBe("empty");
  });

  it("emoji è testo valido (§26, §275)", () => {
    expect(isCommentMeaningful("👏", [])).toBe(true);
  });

  it("nessuna identità o identità persa → disabled, il testo resta (§43–§46)", () => {
    expect(publishBlockReason({ ...base, hasIdentity: false })).toBe("no_identity");
    expect(publishBlockReason({ ...base, identityLost: true })).toBe("identity_lost");
  });

  it("oltre il limite, durante l'invio, contenuto non disponibile, commenti disattivati", () => {
    expect(publishBlockReason({ ...base, body: "a".repeat(1001) })).toBe("too_long");
    expect(publishBlockReason({ ...base, isSending: true })).toBe("busy");
    expect(publishBlockReason({ ...base, contentAvailable: false })).toBe("unavailable");
    expect(publishBlockReason({ ...base, commentsEnabled: false })).toBe("disabled");
  });

  it("contatore «n/1000» (mockup 3)", () => {
    expect(commentCounter(3, 1000)).toBe("3/1000");
  });
});

describe("identità — §30–§46", () => {
  it("solo le identità con can_comment (§34)", () => {
    const list = [PERSON, { ...SOCIETY, canComment: false }, MEDIA];

    expect(commentableIdentities(list).map((entry) => entry.id)).toEqual(["p-1", "m-1"]);
  });

  it("il default è la persona, poi il Media, poi la prima (§36)", () => {
    expect(defaultCommentIdentity([SOCIETY, PERSON, MEDIA])?.id).toBe("p-1");
    expect(defaultCommentIdentity([SOCIETY, MEDIA])?.id).toBe("m-1");
    expect(defaultCommentIdentity([SOCIETY])?.id).toBe("c-1");
    expect(defaultCommentIdentity([])).toBeNull();
  });

  it("l'identità scelta vale finché esiste; persa resta mostrata ma `lost` (§43–§45)", () => {
    expect(resolveCommentIdentity([PERSON, SOCIETY], SOCIETY)).toEqual({ identity: SOCIETY, lost: false });
    expect(resolveCommentIdentity([PERSON], SOCIETY)).toEqual({ identity: SOCIETY, lost: true });
    expect(resolveCommentIdentity([PERSON, SOCIETY], null)).toEqual({ identity: PERSON, lost: false });
    expect(resolveCommentIdentity([], null)).toEqual({ identity: null, lost: false });
  });

  it("selettore solo con più identità, o con l'identità persa e un'altra disponibile (§30–§31)", () => {
    expect(hasCommentIdentityChoice([PERSON], { identity: PERSON, lost: false })).toBe(false);
    expect(hasCommentIdentityChoice([PERSON, SOCIETY], { identity: PERSON, lost: false })).toBe(true);
    expect(hasCommentIdentityChoice([PERSON], { identity: SOCIETY, lost: true })).toBe(true);
    expect(hasCommentIdentityChoice([], { identity: SOCIETY, lost: true })).toBe(false);
  });

  it("un invio fallito ritorna al composer con l'identità con cui era partito", () => {
    const rebuilt = identityFromAuthor(author({ clubCategory: "Serie D", identityId: "c-1", identityType: "society", name: "AC Como" }));

    expect(rebuilt).toMatchObject({ clubCategory: "Serie D", id: "c-1", name: "AC Como", type: "society" });
  });

  it("etichette di contesto del foglio «Commenta come» (mockup 4)", () => {
    expect(commentIdentityContextLabel(PERSON)).toBe("Profilo personale");
    expect(commentIdentityContextLabel(SOCIETY)).toBe("Società · Serie D");
    expect(commentIdentityContextLabel(MEDIA)).toBe("Media");
    expect(toComposerIdentity(SOCIETY)).toMatchObject({ canSchedule: false, contextLabel: "Società · Serie D", type: "society" });
  });
});

describe("copy degli errori — §43, §189, §193", () => {
  it("invio", () => {
    expect(publishErrorCopy("identity_forbidden")).toBe(COMMENT_PERMISSION_LOST);
    expect(publishErrorCopy("target_unavailable")).toBe(COMMENT_TARGET_UNAVAILABLE);
    expect(publishErrorCopy("content_unavailable")).toBe(COMMENT_CONTENT_UNAVAILABLE);
    expect(publishErrorCopy("comments_disabled")).toBe(COMMENTS_DISABLED);
    expect(publishErrorCopy("network")).toBe(publishErrorCopy("operation_conflict"));
  });

  it("modifica: conflitto di versione ≠ errore generico (§155, §159)", () => {
    expect(editErrorCopy("version_conflict")).not.toBe(editErrorCopy("network"));
    expect(editErrorCopy("comment_unavailable")).toBe(COMMENT_TARGET_UNAVAILABLE);
  });
});

describe("elemento ottimistico — §92–§95", () => {
  const target: Pick<Comment, "id" | "rootCommentId" | "author"> = {
    author: author({ identityId: "p-3", name: "Luca Ferri" }),
    id: "c-2",
    rootCommentId: "c-1",
  };

  it("un commento principale: id temporaneo, root = sé stesso, nessuna capability", () => {
    const entity = buildOptimisticComment({
      body: "Ottimo progetto.",
      contentAuthor: null,
      contentId: "post-1",
      contentType: "profile_post",
      identity: PERSON,
      links: [],
      mentions: [],
      now: NOW,
      operationKey: "k-1",
      replyTo: null,
    });

    expect(entity.id).toBe("tmp:k-1");
    expect(entity.rootCommentId).toBe("tmp:k-1");
    expect(entity.replyToCommentId).toBeNull();
    expect(entity.createdAt).toBe(NOW.toISOString());
    expect(entity.send).toMatchObject({ failure: null, operationKey: "k-1", state: "sending" });
    expect(Object.values(entity.capabilities).every((value) => value === false)).toBe(true);
    expect(entity.author?.name).toBe("Matteo Rossi");
  });

  it("una risposta a una risposta: root del thread e target preciso (§49, §53)", () => {
    const entity = buildOptimisticComment({
      body: "@Luca Ferri d'accordo",
      contentAuthor: null,
      contentId: "post-1",
      contentType: "profile_post",
      identity: PERSON,
      links: [],
      mentions: [],
      operationKey: "k-2",
      replyTo: target,
    });

    expect(entity.rootCommentId).toBe("c-1");
    expect(entity.replyToCommentId).toBe("c-2");
    expect(entity.replyTo).toMatchObject({ identityId: "p-3", name: "Luca Ferri" });
    expect(entity.send).toMatchObject({ replyToCommentId: "c-2", rootCommentId: "c-1" });
  });

  it("§64: «Autore» se l'identità coincide con quella del contenuto", () => {
    const entity = buildOptimisticComment({
      body: "Grazie",
      contentAuthor: { identityId: "c-1", identityType: "society" },
      contentId: "post-1",
      contentType: "club_media",
      identity: SOCIETY,
      links: [],
      mentions: [],
      operationKey: "k-3",
      replyTo: null,
    });

    expect(entity.isContentAuthor).toBe(true);
  });
});

describe("liste: proprio + server, senza duplicati (§126, §222–§223)", () => {
  const none = () => false;

  it("principali: i miei in cima (il più recente prima), poi il server nell'ordine ricevuto", () => {
    const refs = mergeRootRefs({
      isRemoved: none,
      own: [{ id: "tmp:2", key: "tmp:2" }, { id: "tmp:1", key: "tmp:1" }],
      pageIds: ["c-1", "c-2"],
    });

    expect(refs.map((ref) => ref.id)).toEqual(["tmp:2", "tmp:1", "c-1", "c-2"]);
  });

  it("un mio commento già riconciliato che torna nella pagina non si duplica e tiene la sua posizione e chiave", () => {
    const refs = mergeRootRefs({
      isRemoved: none,
      own: [{ id: "c-77", key: "tmp:k-1" }],
      pageIds: ["c-1", "c-77", "c-2"],
    });

    expect(refs).toEqual([
      { id: "c-77", key: "tmp:k-1" },
      { id: "c-1", key: "c-1" },
      { id: "c-2", key: "c-2" },
    ]);
  });

  it("i rimossi non si mostrano; i doppioni fra pagine collassano", () => {
    const refs = mergeRootRefs({
      isRemoved: (id) => id === "c-2",
      own: [],
      pageIds: ["c-1", "c-2", "c-1", "c-3"],
    });

    expect(refs.map((ref) => ref.id)).toEqual(["c-1", "c-3"]);
  });

  it("risposte: prima quelle del server (vecchia → recente), le mie in coda", () => {
    const refs = mergeReplyRefs({
      isRemoved: none,
      own: [{ id: "tmp:1", key: "tmp:1" }, { id: "c-9", key: "c-9" }],
      pageIds: ["c-3", "c-4", "c-9"],
    });

    expect(refs.map((ref) => ref.id)).toEqual(["c-3", "c-4", "c-9", "tmp:1"]);
  });

  it("una mia risposta riconciliata e restituita dal server tiene la chiave di quando era ottimistica", () => {
    const refs = mergeReplyRefs({
      isRemoved: none,
      own: [{ id: "c-9", key: "tmp:k-1" }],
      pageIds: ["c-3", "c-9"],
    });

    expect(refs).toEqual([
      { id: "c-3", key: "c-3" },
      { id: "c-9", key: "tmp:k-1" },
    ]);
  });
});

describe("thread — §132–§136", () => {
  it("chiuso: «Visualizza N risposte»; una sola: «Visualizza 1 risposta»", () => {
    expect(repliesToggleModel({ expanded: false, hasMore: false, repliesCount: 8 })).toEqual({
      kind: "expand",
      label: "Visualizza 8 risposte",
    });
    expect(repliesToggleModel({ expanded: false, hasMore: false, repliesCount: 1 })).toEqual({
      kind: "expand",
      label: "Visualizza 1 risposta",
    });
  });

  it("aperto con altre da caricare: «Visualizza altre risposte»; finite: nulla", () => {
    expect(repliesToggleModel({ expanded: true, hasMore: true, repliesCount: 8 })).toEqual({
      kind: "more",
      label: "Visualizza altre risposte",
    });
    expect(repliesToggleModel({ expanded: true, hasMore: false, repliesCount: 8 })).toEqual({ kind: "none" });
  });

  it("nessuna risposta: nessun controllo", () => {
    expect(repliesToggleModel({ expanded: false, hasMore: false, repliesCount: 0 })).toEqual({ kind: "none" });
  });
});

describe("menu ••• — §146–§147, §171–§174", () => {
  const own = { capabilities: { canDelete: true, canEdit: true, canLike: true, canOpenAuthor: true, canReply: true }, status: "active" as const };

  it("il proprio commento: solo Modifica e Elimina, Elimina distruttiva e separata", () => {
    const actions = buildCommentActions(own);

    expect(actions.map((action) => action.id)).toEqual(["edit", "delete"]);
    expect(actions.map((action) => action.label)).toEqual(["Modifica", "Elimina"]);
    expect(actions[1]).toMatchObject({ destructive: true, dividerBefore: true });
    expect(actions[0]).toMatchObject({ destructive: false, dividerBefore: false });
  });

  it("un commento altrui: nessuna azione, quindi nessun •••", () => {
    expect(
      buildCommentActions({
        capabilities: { canDelete: false, canEdit: false, canLike: true, canOpenAuthor: true, canReply: true },
        status: "active",
      }),
    ).toEqual([]);
  });

  it("segnaposto o invio in corso: nessuna azione", () => {
    expect(buildCommentActions({ ...own, status: "deleted" })).toEqual([]);
    expect(buildCommentActions(own, { isSending: true })).toEqual([]);
  });

  it("§174: il contesto per le azioni future (HOM-11)", () => {
    expect(
      commentActionContext(
        { author: author({ identityId: "p-9" }), contentId: "post-1", contentType: "profile_post", id: "c-1" },
        "viewer-1",
      ),
    ).toEqual({
      authorIdentityId: "p-9",
      authorIdentityType: "person",
      commentId: "c-1",
      contentId: "post-1",
      contentType: "profile_post",
      targetType: "COMMENT",
      viewerId: "viewer-1",
    });
  });
});

describe("accessibilità — §228–§229", () => {
  it("annuncia la risposta senza basarsi sull'indentazione", () => {
    const label = commentAccessibilityLabel(
      {
        author: author({ clubName: "AC Como", isVerified: true, role: "coach" }),
        body: "Concordo.",
        createdAt: ago(120),
        editedAt: null,
        isContentAuthor: false,
        replyTo: { identityId: "p-3", identityType: "person", name: "Luca Ferri" },
        replyToCommentId: "c-2",
      },
      { isLiked: true, likesCount: 12, now: NOW },
    );

    expect(label).toContain("Marco Bianchi");
    expect(label).toContain("profilo verificato");
    expect(label).toContain("risposta a Luca Ferri");
    expect(label).toContain("2 ore fa");
    expect(label).toContain("Concordo.");
    expect(label).toContain("12 Mi piace");
    expect(label).toContain("messo da te");
  });

  it("autore del contenuto e zero Mi piace", () => {
    const label = commentAccessibilityLabel(
      {
        author: author(),
        body: "Grazie",
        createdAt: ago(5),
        editedAt: null,
        isContentAuthor: true,
        replyTo: null,
        replyToCommentId: null,
      },
      { isLiked: false, likesCount: 0, now: NOW },
    );

    expect(label).toContain("autore");
    expect(label).toContain("Mi piace");
    expect(label).not.toContain("risposta");
  });

  it("l'intestazione dice chi, contesto e quando senza il testo; l'azione dice a chi risponde", () => {
    const header = commentAuthorAccessibilityLabel(
      {
        author: author({ clubName: "AC Como", role: "coach" }),
        body: "Ottimo progetto.",
        createdAt: ago(120),
        editedAt: null,
        isContentAuthor: false,
        replyTo: null,
        replyToCommentId: null,
      },
      NOW,
    );

    expect(header).toBe("Marco Bianchi, Allenatore AC Como, pubblicato 2 ore fa");
    expect(header).not.toContain("Ottimo progetto.");
    expect(replyAccessibilityLabel(author())).toBe("Rispondi a Marco Bianchi");
    expect(replyAccessibilityLabel(null)).toBe("Rispondi");
  });

  it("segnaposto: «Commento eliminato» / «Commento non disponibile»", () => {
    expect(placeholderLabel("deleted")).toBe("Commento eliminato");
    expect(placeholderLabel("unavailable")).toBe("Commento non disponibile");
  });

  it("destinazione del profilo: persona/Media → profilo, Società → club", () => {
    expect(authorHref(author())).toBe("/profile/p-1");
    expect(authorHref(author({ identityId: "c-1", identityType: "society" }))).toBe("/club/c-1");
  });
});
