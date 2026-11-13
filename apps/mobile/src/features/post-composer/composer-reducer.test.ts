import { describe, expect, it } from "vitest";

import { baseState, LIMITS, mediaItem, mention, PERSON, reduce, SOCIETY, tag, uploaded } from "./composer-fixtures";
import { createEditState, type ComposerState } from "./composer-reducer";
import { canPublish, linkFetchTarget, toWireUpdateArgs } from "./composer-presentation";
import type { ComposerLinkPreviewState, ComposerPostForEdit, ComposerRecoverySnapshot } from "./composer-types";

const ids = (state: ComposerState) => state.media.map((item) => item.localId);

function ready(url: string): Extract<ComposerLinkPreviewState, { status: "ready" }> {
  return {
    description: null,
    domain: "a.com",
    finalUrl: url,
    imageUrl: null,
    snapshotId: "snap",
    status: "ready",
    title: null,
    url,
  };
}

describe("identity (§26–28)", () => {
  it("il cambio identity non tocca testo, mention, tag, media, link", () => {
    const before = baseState({
      body: "Ciao @Marco https://a.com",
      link: ready("https://a.com"),
      media: [uploaded("a"), uploaded("b")],
      mentions: [mention("Marco", 5)],
      tagged: [tag("Anna")],
    });

    const after = reduce(before, { identityId: SOCIETY.id, type: "identityChanged" });

    expect(after.identity).toBe(SOCIETY);
    expect({ ...after, identity: before.identity }).toEqual(before);
  });

  it("ignora un'identity non autorizzata", () => {
    const after = reduce(baseState(), { identityId: "altro", type: "identityChanged" });
    expect(after.identity).toBe(PERSON);
  });

  it("la rivalidazione aggiorna solo l'elenco, non sostituisce l'identity corrente", () => {
    const after = reduce(baseState(), { identities: [SOCIETY], limits: LIMITS, type: "contextRefreshed" });
    expect(after.identity).toBe(PERSON);
    expect(after.identities).toEqual([SOCIETY]);
  });
});

describe("testo e mention (§209)", () => {
  it("scrivere dopo la mention la conserva; dentro la fa cadere", () => {
    const state = baseState({ body: "Ciao @Marco ok", mentions: [mention("Marco", 5)] });

    expect(reduce(state, { body: "Ciao @Marco ok!", type: "bodyChanged" }).mentions).toHaveLength(1);
    expect(reduce(state, { body: "Ciao @Mario ok", type: "bodyChanged" }).mentions).toHaveLength(0);
  });

  it("mentionApplied inserisce il token e la mention strutturata", () => {
    const after = reduce(baseState({ body: "Ciao @Ma" }), {
      candidate: { displayName: "Marco", identityId: "p9", identityType: "profile" },
      range: { end: 8, start: 5 },
      type: "mentionApplied",
    });

    expect(after.body).toBe("Ciao @Marco ");
    expect(after.mentions).toEqual([
      { displayName: "Marco", end: 11, identityId: "p9", identityType: "profile", start: 5 },
    ]);
  });

  it("rispetta il tetto delle mention", () => {
    const state = baseState({ body: "@", limits: { ...LIMITS, maxMentions: 0 } });
    const after = reduce(state, {
      candidate: { displayName: "Marco", identityId: "p9", identityType: "profile" },
      range: { end: 1, start: 0 },
      type: "mentionApplied",
    });
    expect(after).toBe(state);
  });

  it("il testo non supera il limite del server", () => {
    const state = baseState({ limits: { ...LIMITS, maxBodyLength: 5 } });
    expect(reduce(state, { body: "123456789", type: "bodyChanged" }).body).toBe("12345");
  });
});

describe("tag (§104, §210)", () => {
  it("sostituisce la selezione e deduplica", () => {
    const after = reduce(baseState(), {
      tagged: [tag("Marco"), tag("Marco"), tag("AC Como", "club")],
      type: "taggedChanged",
    });
    expect(after.tagged.map((item) => item.displayName)).toEqual(["Marco", "AC Como"]);
  });

  it("rispetta il tetto dei tag", () => {
    const after = reduce(baseState({ limits: { ...LIMITS, maxTags: 2 } }), {
      tagged: [tag("A"), tag("B"), tag("C")],
      type: "taggedChanged",
    });
    expect(after.tagged).toHaveLength(2);
  });
});

describe("media (§55–60, §72)", () => {
  const three = () => baseState({ media: [uploaded("a"), uploaded("b"), uploaded("c")] });

  it("aggiunge in coda e rispetta il limite centralizzato (§61)", () => {
    const state = baseState({ limits: { ...LIMITS, maxMedia: 2 }, media: [uploaded("a")] });
    const after = reduce(state, { items: [uploaded("b"), uploaded("c")], type: "mediaAdded" });
    expect(ids(after)).toEqual(["a", "b"]);
  });

  it("sposta prima / dopo e ai bordi non esce dalla lista (§58)", () => {
    expect(ids(reduce(three(), { by: -1, localId: "b", type: "mediaMoved" }))).toEqual(["b", "a", "c"]);
    expect(ids(reduce(three(), { by: 1, localId: "b", type: "mediaMoved" }))).toEqual(["a", "c", "b"]);
    expect(ids(reduce(three(), { by: -1, localId: "a", type: "mediaMoved" }))).toEqual(["a", "b", "c"]);
    expect(ids(reduce(three(), { by: 1, localId: "c", type: "mediaMoved" }))).toEqual(["a", "b", "c"]);
  });

  it("sposta a un indice (drag, §55)", () => {
    expect(ids(reduce(three(), { localId: "a", toIndex: 2, type: "mediaMovedTo" }))).toEqual(["b", "c", "a"]);
    expect(ids(reduce(three(), { localId: "c", toIndex: 0, type: "mediaMovedTo" }))).toEqual(["c", "a", "b"]);
    expect(ids(reduce(three(), { localId: "a", toIndex: 99, type: "mediaMovedTo" }))).toEqual(["b", "c", "a"]);
  });

  it("la rimozione non chiede conferma e non tocca gli altri (§60, §224)", () => {
    const after = reduce(three(), { localId: "b", type: "mediaRemoved" });
    expect(after.media).toEqual([uploaded("a"), uploaded("c")]);
  });

  it("stato di upload per item: gli altri non cambiano (§67)", () => {
    const state = baseState({
      media: [mediaItem({ localId: "a", uploadStatus: "pending" }), mediaItem({ localId: "b", uploadStatus: "pending" })],
    });
    const after = reduce(
      state,
      { localId: "a", patch: { uploadStatus: "uploading" }, type: "mediaUploadUpdated" },
      { localId: "a", patch: { storagePath: "u/posts/a", uploadStatus: "uploaded" }, type: "mediaUploadUpdated" },
      { localId: "b", patch: { errorCode: "upload_failed", uploadStatus: "failed" }, type: "mediaUploadUpdated" },
    );

    expect(after.media.map((item) => item.uploadStatus)).toEqual(["uploaded", "failed"]);
    expect(after.media[0].storagePath).toBe("u/posts/a");
  });

  it("il retry agisce solo sul fallito e conserva il resto (§71–72)", () => {
    const state = baseState({
      body: "Testo",
      media: [
        mediaItem({ errorCode: "upload_failed", localId: "f", uploadStatus: "failed" }),
        uploaded("ok"),
      ],
    });
    const after = reduce(
      state,
      { localId: "f", type: "mediaRetried" },
      { localId: "ok", type: "mediaRetried" },
    );

    expect(after.media[0]).toMatchObject({ errorCode: null, uploadStatus: "pending" });
    expect(after.media[1].uploadStatus).toBe("uploaded");
    expect(after.body).toBe("Testo");
  });

  it("un upload fallito ora si rimuove e Pubblica torna disponibile", () => {
    const state = baseState({ body: "Ciao", media: [mediaItem({ localId: "f", uploadStatus: "failed" })] });
    expect(canPublish(state)).toBe(false);
    expect(canPublish(reduce(state, { localId: "f", type: "mediaRemoved" }))).toBe(true);
  });
});

describe("link (§93, §156–157)", () => {
  it("una risposta in ritardo per un URL non più corrente è scartata", () => {
    const loading = reduce(baseState({ body: "https://b.com" }), { type: "linkLoading", url: "https://b.com" });
    expect(reduce(loading, { result: ready("https://a.com"), type: "linkResolved", url: "https://a.com" })).toBe(loading);
  });

  it("cambiare URL invalida la preview vecchia, toglierlo la azzera", () => {
    const state = baseState({ body: "https://a.com", link: ready("https://a.com") });

    expect(reduce(state, { body: "https://a.com e altro", type: "bodyChanged" }).link.status).toBe("ready");
    expect(reduce(state, { body: "https://b.com", type: "bodyChanged" }).link.status).toBe("idle");
    expect(reduce(state, { body: "nessun link", type: "bodyChanged" }).link.status).toBe("idle");
  });

  it("la X ricorda l'URL e non si rigenera finché non cambia (§93–94)", () => {
    const state = baseState({ body: "https://a.com", link: ready("https://a.com") });
    const dismissed = reduce(state, { type: "linkDismissed" });

    expect(dismissed.dismissedUrls).toEqual(["https://a.com"]);
    expect(dismissed.body).toBe("https://a.com"); // §92: il testo non si cancella
    expect(linkFetchTarget(dismissed)).toBeNull();

    const edited = reduce(dismissed, { body: "https://a.com altro testo", type: "bodyChanged" });
    expect(linkFetchTarget(edited)).toBeNull();

    const changed = reduce(dismissed, { body: "https://b.com", type: "bodyChanged" });
    expect(linkFetchTarget(changed)).toBe("https://b.com");
  });

  it("il retry vale solo per un fallimento ritentabile (§91)", () => {
    const retryable = baseState({ link: { domain: "a.com", retryable: true, status: "failed", url: "https://a.com" } });
    const blocked = baseState({ link: { domain: "a.com", retryable: false, status: "failed", url: "https://a.com" } });

    expect(reduce(retryable, { type: "linkRetried" }).link.status).toBe("loading");
    expect(reduce(blocked, { type: "linkRetried" })).toBe(blocked);
  });

  it("l'aggiunta di un media non cancella la preview (§97)", () => {
    const state = baseState({ body: "https://a.com", link: ready("https://a.com") });
    const after = reduce(state, { items: [uploaded("a")], type: "mediaAdded" });
    expect(after.link).toBe(state.link);
  });
});

describe("pubblicazione (§119, §174, §176)", () => {
  it("il secondo invio non esiste e la chiave resta la stessa", () => {
    const first = reduce(baseState({ body: "Ciao" }), { type: "publishStarted" });
    expect(first.publish.status).toBe("publishing");
    expect(reduce(first, { type: "publishStarted" })).toBe(first);
    expect(first.operationKey).toBe("op-1");
  });

  it("non parte se non si può pubblicare", () => {
    const empty = baseState();
    expect(reduce(empty, { type: "publishStarted" })).toBe(empty);
  });

  it("il fallimento lascia il contenuto intatto e la chiave invariata", () => {
    const state = baseState({
      body: "Ciao",
      media: [uploaded("a")],
      mentions: [],
      tagged: [tag("Marco")],
    });
    const failed = reduce(state, { type: "publishStarted" }, { code: "network", type: "publishFailed" });

    expect(failed.publish).toEqual({ code: "network", status: "failed" });
    expect({ ...failed, publish: state.publish }).toEqual(state);
    expect(canPublish(failed)).toBe(true);
  });

  it("modificare il testo dopo un errore rimette lo stato a idle", () => {
    const failed = reduce(baseState({ body: "Ciao" }), { code: "unknown", type: "publishFailed" });
    expect(reduce(failed, { body: "Ciao!", type: "bodyChanged" }).publish.status).toBe("idle");
  });
});

describe("Modifica (§147–153)", () => {
  const edit: ComposerPostForEdit = {
    author: SOCIETY,
    body: "Originale",
    canEdit: true,
    contentId: "post-1",
    contentType: "club_media",
    link: null,
    media: [mediaItem({ localId: "remote-0", remoteMediaPosition: 0 }), mediaItem({ localId: "remote-1", remoteMediaPosition: 1 })],
    mentions: [],
    tagged: [],
    version: "v1",
  };
  const state = () => createEditState({ edit, limits: LIMITS, operationKey: "k" });

  it("precarica tutto e fissa identity e versione", () => {
    expect(state().identity).toBe(SOCIETY);
    expect(state().mode).toEqual({ contentId: "post-1", contentType: "club_media", expectedVersion: "v1", kind: "edit" });
  });

  it("i media non si aggiungono, rimuovono, riordinano né sostituiscono", () => {
    const initial = state();
    const after = reduce(
      initial,
      { items: [uploaded("x")], type: "mediaAdded" },
      { localId: "remote-0", type: "mediaRemoved" },
      { by: 1, localId: "remote-0", type: "mediaMoved" },
      { localId: "remote-0", toIndex: 1, type: "mediaMovedTo" },
      { localId: "remote-0", patch: { uploadStatus: "failed" }, type: "mediaUploadUpdated" },
    );
    expect(after.media).toEqual(initial.media);
  });

  it("l'identity non cambia", () => {
    const after = reduce(state(), { identityId: PERSON.id, type: "identityChanged" });
    expect(after.identity).toBe(SOCIETY);
  });

  it("testo e tag sono modificabili", () => {
    const after = reduce(state(), { body: "Nuovo", type: "bodyChanged" }, { tagged: [tag("Marco")], type: "taggedChanged" });
    expect(after.body).toBe("Nuovo");
    expect(after.tagged).toHaveLength(1);
  });

  describe("link già nel Post (§93, §156–157)", () => {
    const withUrl = (overrides: Partial<ComposerPostForEdit>) =>
      createEditState({
        edit: { ...edit, body: "Guarda https://a.com/x", media: [], ...overrides },
        limits: LIMITS,
        operationKey: "k",
      });

    it("senza anteprima salvata l'URL parte come già rimosso: nessun fetch all'apertura, Salva resta spento", () => {
      const opened = withUrl({ link: null });

      expect(opened.dismissedUrls).toEqual(["https://a.com/x"]);
      expect(linkFetchTarget(opened)).toBeNull();
      expect(canPublish(opened)).toBe(false);
    });

    it("con anteprima salvata e URL invariato non si rigenera nulla", () => {
      const opened = withUrl({ link: { ...ready("https://a.com/x"), snapshotId: "snap" } });

      expect(opened.dismissedUrls).toEqual([]);
      expect(opened.link.status).toBe("ready");
      expect(linkFetchTarget(opened)).toBeNull();
      expect(canPublish(opened)).toBe(false);
    });

    it("anteprima salvata senza snapshot: X su URL invariato è una modifica e invia dismiss_preview (§92, §157)", () => {
      const stored = { ...ready("https://a.com/x"), snapshotId: null };
      const opened = withUrl({ link: stored });

      expect(canPublish(opened)).toBe(false);
      expect(toWireUpdateArgs(opened).p_link).toEqual({ snapshot_id: null, url: "https://a.com/x" });

      const removed = reduce(opened, { type: "linkDismissed" });

      expect(canPublish(removed)).toBe(true);
      expect(toWireUpdateArgs(removed).p_link).toEqual({
        dismiss_preview: true,
        snapshot_id: null,
        url: "https://a.com/x",
      });
    });

    it("URL cambiato dopo la X: nessun dismiss_preview, vale la nuova anteprima", () => {
      const opened = withUrl({ link: { ...ready("https://a.com/x"), snapshotId: "s1" } });
      const changed = reduce(
        opened,
        { type: "linkDismissed" },
        { body: "Guarda https://b.com", type: "bodyChanged" },
      );

      expect(toWireUpdateArgs(changed).p_link).toEqual({ snapshot_id: null, url: "https://b.com" });
    });

    it("senza anteprima salvata non c'è nulla da rimuovere: niente dismiss_preview", () => {
      const opened = withUrl({ link: null });

      expect(toWireUpdateArgs(reduce(opened, { body: "Guarda https://a.com/x ancora", type: "bodyChanged" })).p_link).toEqual({
        snapshot_id: null,
        url: "https://a.com/x",
      });
    });

    it("un URL diverso, scritto dopo, può generare una nuova anteprima", () => {
      const opened = withUrl({ link: null });
      const changed = reduce(opened, { body: "Guarda https://b.com", type: "bodyChanged" });

      expect(linkFetchTarget(changed)).toBe("https://b.com");
    });

    it("senza URL nel testo non c'è nulla da escludere", () => {
      expect(createEditState({ edit, limits: LIMITS, operationKey: "k" }).dismissedUrls).toEqual([]);
    });
  });
});

describe("rotazione della chiave (§118, post_operation_conflict)", () => {
  it("cambia solo la chiave in creazione; il contenuto resta intatto", () => {
    const state = baseState({ body: "Ciao", tagged: [tag("Anna")] });
    const after = reduce(state, { operationKey: "op-2", type: "operationKeyRotated" });

    expect(after.operationKey).toBe("op-2");
    expect({ ...after, operationKey: state.operationKey }).toEqual(state);
  });
});

describe("recovery (§135)", () => {
  const snapshot: ComposerRecoverySnapshot = {
    body: "Ciao @Marco",
    dismissedUrls: ["https://a.com"],
    identityId: SOCIETY.id,
    identityType: "society",
    media: [mediaItem({ localId: "u", uploadStatus: "uploading" }), uploaded("done")],
    mentions: [mention("Marco", 5), mention("Fantasma", 0)],
    operationKey: "op-old",
    origin: "HOME_PER_TE",
    savedAt: "2026-11-13T10:00:00.000Z",
    tagged: [tag("Anna")],
    version: 1,
  };

  it("ripristina contenuto, identity e chiave; gli upload a metà tornano in coda", () => {
    const after = reduce(baseState(), { snapshot, type: "restored" });

    expect(after.body).toBe("Ciao @Marco");
    expect(after.identity).toBe(SOCIETY);
    expect(after.operationKey).toBe("op-old");
    expect(after.media.map((item) => item.uploadStatus)).toEqual(["pending", "uploaded"]);
    expect(after.mentions.map((item) => item.displayName)).toEqual(["Marco"]); // la mention incoerente col testo cade
    expect(after.dismissedUrls).toEqual(["https://a.com"]);
  });

  it("se l'identity salvata non è più autorizzata resta quella corrente", () => {
    const after = reduce(baseState({ identities: [PERSON] }), { snapshot, type: "restored" });
    expect(after.identity).toBe(PERSON);
  });
});
