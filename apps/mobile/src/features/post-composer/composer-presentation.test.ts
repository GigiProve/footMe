import { describe, expect, it } from "vitest";

import { baseState, LIMITS, MEDIA_IDENTITY, mediaItem, mention, PERSON, reduce, SOCIETY, tag, uploaded } from "./composer-fixtures";
import {
  applyMention,
  canPublish,
  COMPOSER_EDIT_PERMISSION_LOST_COPY,
  COMPOSER_PERMISSION_LOST_COPY,
  COMPOSER_PUBLISH_ERROR_COPY,
  defaultIdentity,
  errorCopy,
  extractUrls,
  firstEligibleUrl,
  hasIdentityChoice,
  identityAccessibilityLabel,
  isDirty,
  isEmpty,
  isIsolatedUrl,
  linkFetchTarget,
  mediaAccessibilityLabel,
  mentionQueryAt,
  normalizeUrl,
  publishBlockReason,
  reconcileMentions,
  selectPickedAssets,
  shouldShowRichPreview,
  tagSummary,
  toWirePublishArgs,
  toWireUpdateArgs,
} from "./composer-presentation";
import { createEditState } from "./composer-reducer";
import type { ComposerPostForEdit } from "./composer-types";

describe("canPublish (§11–13)", () => {
  it("compositore vuoto → disabilitato", () => {
    expect(canPublish(baseState())).toBe(false);
  });

  it("solo testo, solo media, solo URL → abilitato (§34, §217–219, §228)", () => {
    expect(canPublish(baseState({ body: "Ciao" }))).toBe(true);
    expect(canPublish(baseState({ media: [uploaded("a")] }))).toBe(true);
    expect(canPublish(baseState({ body: "https://example.com/x" }))).toBe(true);
  });

  it("un media in coda o in upload basta, uno fallito no (§13)", () => {
    expect(canPublish(baseState({ media: [mediaItem({ uploadStatus: "pending" })] }))).toBe(true);
    expect(canPublish(baseState({ media: [mediaItem({ uploadStatus: "uploading" })] }))).toBe(true);
    expect(canPublish(baseState({ media: [mediaItem({ uploadStatus: "failed" })] }))).toBe(false);
  });

  it("tag, mention e autore da soli non bastano (§13, §238)", () => {
    expect(canPublish(baseState({ tagged: [tag("Marco")] }))).toBe(false);
    expect(
      canPublish(baseState({ body: "@Marco Bianchi", mentions: [mention("Marco Bianchi", 0)] })),
    ).toBe(false);
  });

  it("mention + altro testo → abilitato", () => {
    expect(
      canPublish(baseState({ body: "@Marco Bianchi bravo", mentions: [mention("Marco Bianchi", 0)] })),
    ).toBe(true);
  });

  it("solo spazi o a capo non sono testo significativo", () => {
    expect(canPublish(baseState({ body: "  \n\n " }))).toBe(false);
  });

  it("con un invio in corso è disabilitato (§119)", () => {
    expect(canPublish(baseState({ body: "Ciao", publish: { status: "publishing" } }))).toBe(false);
  });

  it("un upload fallito accanto al testo blocca Pubblica finché non si rimuove (§70)", () => {
    const state = baseState({ body: "Ciao", media: [mediaItem({ uploadStatus: "failed" })] });
    expect(canPublish(state)).toBe(false);
    expect(publishBlockReason(state)).not.toBeNull();
  });

  it("senza identity autorizzata è disabilitato con la copy §172", () => {
    const state = baseState({ body: "Ciao", identities: [], identity: null });
    expect(canPublish(state)).toBe(false);
    expect(publishBlockReason(state)).toMatch(/Non hai profili/);
  });

  it("identity non più autorizzata → copy §169, contenuto intatto", () => {
    const state = baseState({ body: "Ciao", identities: [SOCIETY] });
    expect(publishBlockReason(state)).toBe(COMPOSER_PERMISSION_LOST_COPY);
    expect(state.body).toBe("Ciao");
  });

  it("dopo un post_permission_denied dal server blocca finché non cambia identity (§169, §171)", () => {
    const failed = reduce(baseState({ body: "Ciao" }), { code: "post_permission_denied", type: "publishFailed" });
    expect(canPublish(failed)).toBe(false);

    const changed = reduce(failed, { identityId: SOCIETY.id, type: "identityChanged" });
    expect(canPublish(changed)).toBe(true);
  });

  it("un errore di rete lascia Pubblica disponibile (§174)", () => {
    const failed = reduce(baseState({ body: "Ciao" }), { code: "network", type: "publishFailed" });
    expect(canPublish(failed)).toBe(true);
  });
});

describe("URL (§73–94)", () => {
  it("accetta solo http/https con host valido", () => {
    expect(normalizeUrl("https://Example.com/")).toBe("https://example.com");
    expect(normalizeUrl("HTTP://example.com/a?b=1#frag")).toBe("http://example.com/a?b=1");
    expect(normalizeUrl("ftp://example.com")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("https://localhost")).toBeNull();
    expect(normalizeUrl("https://user:pw@example.com")).toBeNull();
  });

  it("estrae gli URL in ordine, tagliando la punteggiatura finale", () => {
    const urls = extractUrls("Leggi https://a.com/x, poi (https://b.it/y).");
    expect(urls.map((url) => url.raw)).toEqual(["https://a.com/x", "https://b.it/y"]);
  });

  it("deduplica lo stesso URL normalizzato (§88)", () => {
    expect(extractUrls("https://Example.com/a#x e https://example.com/a.")).toHaveLength(1);
  });

  it("tiene la parentesi finale solo se bilanciata", () => {
    expect(extractUrls("https://it.wikipedia.org/wiki/Como_(città)")[0].raw).toBe(
      "https://it.wikipedia.org/wiki/Como_(città)",
    );
  });

  it("il primo URL idoneo è l'unico candidato (§86–87)", () => {
    expect(firstEligibleUrl("a https://uno.it b https://due.it")?.normalized).toBe("https://uno.it");
    expect(firstEligibleUrl("nessun link")).toBeNull();
  });

  it("URL isolato sulla propria riga vs dentro una frase (§82–84)", () => {
    const isolated = "Testo\nhttps://a.com/x\nfine";
    expect(isIsolatedUrl(isolated, extractUrls(isolated)[0])).toBe(true);

    const inline = "vedi https://a.com/x ora";
    expect(isIsolatedUrl(inline, extractUrls(inline)[0])).toBe(false);

    const only = "https://a.com/x";
    expect(isIsolatedUrl(only, extractUrls(only)[0])).toBe(true);
  });

  it("la preview visuale sparisce con i media e torna se si tolgono (§95–98)", () => {
    const ready = {
      description: null,
      domain: "a.com",
      finalUrl: "https://a.com",
      imageUrl: null,
      snapshotId: "s1",
      status: "ready" as const,
      title: "T",
      url: "https://a.com",
    };
    const withLink = baseState({ body: "https://a.com", link: ready });
    expect(shouldShowRichPreview(withLink)).toBe(true);

    const withMedia = { ...withLink, media: [uploaded("a")] };
    expect(shouldShowRichPreview(withMedia)).toBe(false);
    expect(withMedia.link).toBe(ready); // §97: nessun dato perso
    expect(shouldShowRichPreview({ ...withMedia, media: [] })).toBe(true);
  });

  it("dopo la X la preview di quell'URL non si mostra né si rigenera (§93)", () => {
    const state = baseState({
      body: "https://a.com",
      dismissedUrls: ["https://a.com"],
      link: { status: "idle" },
    });
    expect(linkFetchTarget(state)).toBeNull();
    expect(linkFetchTarget({ ...state, dismissedUrls: [] })).toBe("https://a.com");
    expect(linkFetchTarget({ ...state, dismissedUrls: [], media: [uploaded("a")] })).toBeNull();
  });
});

describe("tagSummary (§107)", () => {
  it("una, due, più persone, misto", () => {
    expect(tagSummary([])).toBeNull();
    expect(tagSummary([tag("Marco Bianchi")])).toBe("Con Marco Bianchi");
    expect(tagSummary([tag("Marco Bianchi"), tag("AC Como", "club")])).toBe("Con Marco Bianchi e AC Como");
    expect(tagSummary([tag("Marco Bianchi"), tag("A"), tag("B"), tag("C")])).toBe(
      "Con Marco Bianchi e altre 3 persone",
    );
    expect(tagSummary([tag("Marco Bianchi"), tag("A"), tag("AC Como", "club")])).toBe(
      "Con Marco Bianchi e altri 2",
    );
  });
});

describe("defaultIdentity (§21–24)", () => {
  const all = [SOCIETY, MEDIA_IDENTITY, PERSON];

  it("Home: persona, poi Media, poi la prima", () => {
    expect(defaultIdentity("HOME_PER_TE", all)).toBe(PERSON);
    expect(defaultIdentity("HOME_SEGUITI", [SOCIETY, MEDIA_IDENTITY])).toBe(MEDIA_IDENTITY);
    expect(defaultIdentity("HOME_PER_TE", [SOCIETY])).toBe(SOCIETY);
  });

  it("Profilo personale → PERSON", () => {
    expect(defaultIdentity("PERSONAL_PROFILE", all)).toBe(PERSON);
  });

  it("Società e Media gestiti → l'identity indicata", () => {
    expect(defaultIdentity("SOCIETY_PROFILE", all, "society-1")).toBe(SOCIETY);
    expect(defaultIdentity("MEDIA_PROFILE", all, "media-1")).toBe(MEDIA_IDENTITY);
  });

  it("senza identity → null", () => {
    expect(defaultIdentity("HOME_PER_TE", [])).toBeNull();
  });
});

describe("mention (§110–113, §209)", () => {
  it("mentionQueryAt trova il token `@` sotto il cursore", () => {
    expect(mentionQueryAt("ciao @Mar", 9)).toEqual({ query: "Mar", range: { end: 9, start: 5 } });
    expect(mentionQueryAt("@", 1)).toEqual({ query: "", range: { end: 1, start: 0 } });
  });

  it("non scatta per e-mail, spazi o dentro una mention", () => {
    expect(mentionQueryAt("mail@x.com", 6)).toBeNull();
    expect(mentionQueryAt("ciao @Marco ok", 14)).toBeNull();
    expect(mentionQueryAt("@Marco", 6, [mention("Marco", 0)])).toBeNull();
  });

  it("applyMention sostituisce il token e registra l'intervallo", () => {
    const result = applyMention("ciao @Mar", [], { end: 9, start: 5 }, {
      displayName: "Marco Bianchi",
      identityId: "p9",
      identityType: "profile",
    });

    expect(result.body).toBe("ciao @Marco Bianchi ");
    expect(result.cursor).toBe(20);
    expect(result.mentions).toEqual([
      { displayName: "Marco Bianchi", end: 19, identityId: "p9", identityType: "profile", start: 5 },
    ]);
    expect(result.body.slice(result.mentions[0].start, result.mentions[0].end)).toBe("@Marco Bianchi");
  });

  it("applyMention fa scorrere le mention successive", () => {
    const result = applyMention("ciao @M xx @Anna", [mention("Anna", 11)], { end: 7, start: 5 }, {
      displayName: "Marco",
      identityId: "m",
      identityType: "profile",
    });
    expect(result.mentions).toHaveLength(2);
    for (const item of result.mentions) {
      expect(result.body.slice(item.start, item.end)).toBe(`@${item.displayName}`);
    }
  });

  describe("reconcileMentions", () => {
    const body = "Ciao @Marco ok";
    const mentions = [mention("Marco", 5)];

    it("testo dopo la mention: invariata", () => {
      expect(reconcileMentions(body, `${body}!`, mentions)).toEqual(mentions);
    });

    it("testo prima della mention: scorre", () => {
      const [moved] = reconcileMentions(body, `X${body}`, mentions);
      expect(moved.start).toBe(6);
      expect(`X${body}`.slice(moved.start, moved.end)).toBe("@Marco");

      const [back] = reconcileMentions(body, "Cia @Marco ok", mentions);
      expect(back.start).toBe(4);
    });

    it("testo dentro la mention: cade (§209)", () => {
      expect(reconcileMentions(body, "Ciao @Mario ok", mentions)).toEqual([]);
      expect(reconcileMentions(body, "Ciao Marco ok", mentions)).toEqual([]);
    });
  });
});

describe("isEmpty / isDirty (§137–138, §158)", () => {
  it("l'identity da sola non rende il composer modificato", () => {
    const state = baseState();
    expect(isEmpty(state)).toBe(true);
    expect(isDirty(state)).toBe(false);
  });

  it("qualunque contenuto lo rende modificato", () => {
    expect(isDirty(baseState({ body: "x" }))).toBe(true);
    expect(isDirty(baseState({ tagged: [tag("Marco")] }))).toBe(true);
    expect(isDirty(baseState({ media: [uploaded("a")] }))).toBe(true);
  });
});

describe("mediaAccessibilityLabel (§198–199)", () => {
  it("video con durata e stato", () => {
    expect(
      mediaAccessibilityLabel(mediaItem({ durationSeconds: 24, type: "video", uploadStatus: "uploaded" })),
    ).toBe("Video, durata 24 secondi, caricamento completato.");
  });

  it("singolare, errore a parole, foto, media pubblicato senza stato", () => {
    expect(mediaAccessibilityLabel(mediaItem({ durationSeconds: 1, type: "video" }))).toContain("durata 1 secondo,");
    expect(mediaAccessibilityLabel(mediaItem({ uploadStatus: "failed" }))).toBe("Foto, caricamento non riuscito.");
    expect(mediaAccessibilityLabel(mediaItem({ uploadProgress: 0.5, uploadStatus: "uploading" }))).toBe(
      "Foto, caricamento in corso, 50 per cento.",
    );
    expect(mediaAccessibilityLabel(mediaItem({ remoteMediaPosition: 0, type: "video", durationSeconds: 5 }))).toBe(
      "Video, durata 5 secondi.",
    );
  });
});

describe("identityAccessibilityLabel (§197)", () => {
  it("persona verificata e non verificata", () => {
    expect(identityAccessibilityLabel(PERSON)).toBe("Pubblica come Matteo Rossi, profilo verificato");
    expect(identityAccessibilityLabel(MEDIA_IDENTITY)).toBe("Pubblica come Como Football News");
  });
});

describe("selectPickedAssets (§39–41, §61–62)", () => {
  const image = { duration: null, type: "image" };
  const video = (seconds: number) => ({ duration: seconds * 1000, type: "video" });

  it("accetta immagini e video insieme dentro il limite", () => {
    const result = selectPickedAssets([image, video(10), image], { maxVideoSeconds: 60, remainingSlots: 5 });
    expect(result.accepted).toHaveLength(3);
    expect(result.limitReached).toBe(false);
  });

  it("oltre gli slot libera il flag del limite", () => {
    const result = selectPickedAssets([image, image, image], { maxVideoSeconds: 60, remainingSlots: 2 });
    expect(result.accepted).toHaveLength(2);
    expect(result.limitReached).toBe(true);
  });

  it("nessuno slot → limite raggiunto", () => {
    expect(selectPickedAssets([image], { maxVideoSeconds: 60, remainingSlots: 0 })).toMatchObject({
      accepted: [],
      limitReached: true,
    });
  });

  it("un video troppo lungo è scartato senza occupare uno slot", () => {
    const result = selectPickedAssets([video(120), image], { maxVideoSeconds: 60, remainingSlots: 1 });
    expect(result.accepted).toEqual([image]);
    expect(result.rejectedVideos).toBe(1);
    expect(result.limitReached).toBe(false);
  });
});

describe("toWirePublishArgs (§117)", () => {
  it("compone body, identity, mention, tag, media in ordine, link e origin", () => {
    const state = reduce(
      baseState({
        body: "@Marco Bianchi guarda https://Example.com/a  ",
        mentions: [mention("Marco Bianchi", 0, "p9")],
        media: [uploaded("b", { type: "video", durationSeconds: 12 }), uploaded("a")],
        tagged: [tag("AC Como", "club", "c1"), tag("AC Como", "club", "c1")],
      }),
    );

    const args = toWirePublishArgs(state, "key-1", "SOCIETY_PROFILE");

    expect(args.p_operation_key).toBe("key-1");
    expect(args.p_origin).toBe("SOCIETY_PROFILE");
    expect(args.p_identity_type).toBe("person");
    expect(args.p_identity_id).toBe("person-1");
    expect(args.p_body).toBe("@Marco Bianchi guarda https://Example.com/a");
    expect(args.p_mentions).toEqual([
      { display_name: "Marco Bianchi", end: 14, identity_id: "p9", identity_type: "profile", start: 0 },
    ]);
    expect(args.p_tagged).toEqual([{ target_id: "c1", target_type: "club" }]);
    expect(args.p_media.map((item) => item.storage_path)).toEqual(["u/posts/b", "u/posts/a"]);
    expect(args.p_media[0]).toMatchObject({ duration_seconds: 12, media_type: "video", thumbnail_path: null });
    expect(args.p_link).toEqual({ snapshot_id: null, url: "https://Example.com/a" });
  });

  it("invia lo snapshot quando la preview è pronta e non rimossa (§80, §207)", () => {
    const base = baseState({ body: "https://a.com" });
    const ready = reduce(
      base,
      { type: "linkLoading", url: "https://a.com" },
      {
        result: {
          description: null,
          domain: "a.com",
          finalUrl: "https://a.com",
          imageUrl: null,
          snapshotId: "snap-1",
          status: "ready",
          title: null,
          url: "https://a.com",
        },
        type: "linkResolved",
        url: "https://a.com",
      },
    );
    expect(toWirePublishArgs(ready, "k", "HOME_PER_TE").p_link).toEqual({
      snapshot_id: "snap-1",
      url: "https://a.com",
    });

    const dismissed = reduce(ready, { type: "linkDismissed" });
    expect(toWirePublishArgs(dismissed, "k", "HOME_PER_TE").p_link).toEqual({
      snapshot_id: null,
      url: "https://a.com",
    });
  });

  it("non invia mai un media non caricato (§70)", () => {
    const state = baseState({
      body: "x",
      media: [uploaded("a"), mediaItem({ localId: "f", uploadStatus: "failed" })],
    });
    expect(toWirePublishArgs(state, "k", "HOME_PER_TE").p_media).toHaveLength(1);
  });

  it("senza identity lancia", () => {
    expect(() => toWirePublishArgs(baseState({ identity: null }), "k", "HOME_PER_TE")).toThrow();
  });
});

describe("Modifica (§144–161)", () => {
  const edit: ComposerPostForEdit = {
    author: SOCIETY,
    body: "Testo originale",
    canEdit: true,
    contentId: "post-1",
    contentType: "club_media",
    link: null,
    media: [mediaItem({ localId: "remote-0", remoteMediaPosition: 0 })],
    mentions: [],
    tagged: [],
    version: "2026-11-13T10:00:00Z",
  };

  it("Salva è disabilitato finché non c'è una modifica (§158)", () => {
    const state = createEditState({ edit, limits: LIMITS, operationKey: "k" });
    expect(canPublish(state)).toBe(false);
    expect(canPublish(reduce(state, { body: "Testo nuovo", type: "bodyChanged" }))).toBe(true);
  });

  it("l'update porta tipo, id, versione e nessun media né autore (§155, §161)", () => {
    const state = reduce(createEditState({ edit, limits: LIMITS, operationKey: "k" }), {
      body: "Testo nuovo",
      type: "bodyChanged",
    });
    const args = toWireUpdateArgs(state);

    expect(args).toEqual({
      p_body: "Testo nuovo",
      p_content_type: "club_media",
      p_expected_version: "2026-11-13T10:00:00Z",
      p_link: null,
      p_mentions: [],
      p_post_id: "post-1",
      p_tagged: [],
    });
    expect(Object.keys(args)).not.toContain("p_media");
  });

  it("senza can_edit o dopo post_edit_denied → copy §173", () => {
    expect(publishBlockReason(createEditState({ edit: { ...edit, canEdit: false }, limits: LIMITS, operationKey: "k" }))).toBe(
      COMPOSER_EDIT_PERMISSION_LOST_COPY,
    );
    const denied = reduce(createEditState({ edit, limits: LIMITS, operationKey: "k" }), {
      code: "post_edit_denied",
      type: "publishFailed",
    });
    expect(publishBlockReason(denied)).toBe(COMPOSER_EDIT_PERMISSION_LOST_COPY);
    expect(denied.body).toBe("Testo originale"); // §173: i dati restano
  });

  it("toWireUpdateArgs fuori da Modifica lancia", () => {
    expect(() => toWireUpdateArgs(baseState())).toThrow();
  });
});

describe("errorCopy (§169–177)", () => {
  it("copy della spec", () => {
    expect(errorCopy("network")).toBe("Non è stato possibile pubblicare il post. Riprova.");
    expect(errorCopy("unknown")).toBe(COMPOSER_PUBLISH_ERROR_COPY);
    expect(errorCopy("post_permission_denied")).toBe("Non hai più i permessi per pubblicare con questo profilo.");
    expect(errorCopy("post_edit_denied", "edit")).toBe("Non hai più i permessi per modificare questo post.");
    expect(errorCopy("post_media_limit")).toBe("Hai raggiunto il numero massimo di contenuti per questo post.");
  });

  it("in Modifica il generico parla di salvataggio", () => {
    expect(errorCopy("network", "edit")).toMatch(/salvare/);
  });

  it("ogni codice ha una copy non vuota", () => {
    for (const code of [
      "post_permission_denied",
      "post_edit_denied",
      "post_version_conflict",
      "post_not_found",
      "post_invalid_content",
      "post_media_limit",
      "post_invalid_media",
      "post_invalid_mention",
      "post_invalid_tag",
      "post_invalid_link",
      "network",
      "unknown",
    ] as const) {
      expect(errorCopy(code).length).toBeGreaterThan(0);
    }
  });
});

describe("HOM-06.1 review: link idoneo e cambio identity", () => {
  it("solo https senza porta e host non IP diventa p_link (§77–78, §89)", () => {
    expect(firstEligibleUrl("vedi http://a.it/x")).toBeNull();
    expect(firstEligibleUrl("vedi https://a.it:8443/x")).toBeNull();
    expect(firstEligibleUrl("vedi https://10.0.0.1/x")).toBeNull();
    expect(firstEligibleUrl("vedi HTTPS://A.it:443/x")?.normalized).toBe("https://a.it:443/x");
    expect(firstEligibleUrl("http://a.it poi https://b.it")?.normalized).toBe("https://b.it");
    expect(toWirePublishArgs(baseState({ body: "testo http://a.it/x" }), "k".repeat(36), "HOME_PER_TE").p_link).toBeNull();
  });

  it("dopo la revoca resta selezionabile l'unica altra identity (§171)", () => {
    expect(hasIdentityChoice(baseState({ identities: [SOCIETY], identity: PERSON }))).toBe(true);
    expect(hasIdentityChoice(baseState({ identities: [PERSON], identity: PERSON }))).toBe(false);
    expect(hasIdentityChoice(baseState({ identities: [PERSON, SOCIETY], identity: PERSON }))).toBe(true);
  });
});
