import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { baseState, LIMITS, mention, SOCIETY, tag, uploaded } from "./composer-fixtures";
import {
  clearRecovery,
  loadRecovery,
  parseRecoverySnapshot,
  RECOVERY_TTL_MS,
  saveRecovery,
  toRecoverySnapshot,
} from "./composer-recovery";
import { createEditState } from "./composer-reducer";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("toRecoverySnapshot (§134–136)", () => {
  it("un composer vuoto non ha nulla da recuperare (§137)", () => {
    expect(toRecoverySnapshot(baseState())).toBeNull();
    expect(toRecoverySnapshot(baseState({ body: "   " }))).toBeNull();
  });

  it("la Modifica non si recupera dal disco (§144)", () => {
    const edit = createEditState({
      edit: {
        author: SOCIETY,
        body: "x",
        canEdit: true,
        contentId: "c",
        contentType: "club_media",
        link: null,
        media: [],
        mentions: [],
        tagged: [],
        version: "v",
      },
      limits: LIMITS,
      operationKey: "k",
    });
    expect(toRecoverySnapshot(edit)).toBeNull();
  });

  it("conserva identity, contenuto, ordine media, chiave e origin; non la preview", () => {
    const state = baseState({
      body: "Ciao @Marco",
      dismissedUrls: ["https://a.com"],
      media: [uploaded("a"), uploaded("b")],
      mentions: [mention("Marco", 5)],
      tagged: [tag("Anna")],
    });

    const snapshot = toRecoverySnapshot(state, new Date("2026-11-13T10:00:00Z"));

    expect(snapshot).toMatchObject({
      body: "Ciao @Marco",
      identityId: "person-1",
      identityType: "person",
      operationKey: "op-1",
      origin: "HOME_PER_TE",
      savedAt: "2026-11-13T10:00:00.000Z",
      version: 1,
    });
    expect(snapshot?.media.map((item) => item.localId)).toEqual(["a", "b"]);
    expect(snapshot).not.toHaveProperty("link");
  });
});

describe("parseRecoverySnapshot", () => {
  const valid = () => toRecoverySnapshot(baseState({ body: "x" }), new Date("2026-11-13T10:00:00Z"))!;
  const now = new Date("2026-11-14T10:00:00Z");

  it("accetta uno snapshot valido", () => {
    // Una sola istanza: lo stato base genera una chiave di bozza casuale a ogni chiamata.
    const snapshot = valid();
    expect(parseRecoverySnapshot(snapshot, now)).toEqual(snapshot);
  });

  it("scarta versione diversa, forma sbagliata e snapshot scaduto", () => {
    expect(parseRecoverySnapshot({ ...valid(), version: 2 }, now)).toBeNull();
    expect(parseRecoverySnapshot({ ...valid(), body: 3 }, now)).toBeNull();
    expect(parseRecoverySnapshot({ ...valid(), origin: "SAVED" }, now)).toBeNull();
    expect(parseRecoverySnapshot({ ...valid(), media: null }, now)).toBeNull();
    expect(parseRecoverySnapshot(null, now)).toBeNull();
    expect(parseRecoverySnapshot(valid(), new Date(Date.parse("2026-11-13T10:00:00Z") + RECOVERY_TTL_MS + 1))).toBeNull();
  });
});

describe("HOM-06.2 — la bozza server nello snapshot (§121, §125–§127)", () => {
  const draft = { ref: { contentId: "d1", contentType: "profile_post" as const }, version: 4 };
  const at = new Date("2026-11-13T10:00:00Z");
  const now = new Date("2026-11-14T10:00:00Z");

  it("ref, versione, chiave di salvataggio e publication viaggiano con lo snapshot: un crash riprende la stessa bozza", () => {
    const state = baseState({
      body: "Ciao",
      publication: { mode: "scheduled", scheduledAt: "2099-01-01T10:00:00.000Z", timezone: "UTC" },
    });
    const snapshot = toRecoverySnapshot(state, at, draft);

    expect(snapshot).toMatchObject({
      draftOperationKey: state.draft.operationKey,
      draftRef: draft.ref,
      draftVersion: 4,
      operationKey: "op-1",
      publication: state.publication,
    });
    // La chiave dell'invio e quella della bozza sono due cose diverse.
    expect(snapshot?.draftOperationKey).not.toBe(snapshot?.operationKey);
  });

  it("senza bozza server (ancora da creare) il ref è null ma la chiave di salvataggio c'è già (§121)", () => {
    const snapshot = toRecoverySnapshot(baseState({ body: "Ciao" }), at);

    expect(snapshot?.draftRef).toBeNull();
    expect(snapshot?.draftVersion).toBeNull();
    expect(snapshot?.draftOperationKey).toBeTruthy();
  });

  it("un programmato non scrive la copia locale: si modifica con «Salva» e si riapre dal server (§167)", () => {
    const scheduled = baseState({ body: "Ciao", draft: { ...baseState().draft, ref: draft.ref, status: "scheduled", version: 4 } });
    expect(toRecoverySnapshot(scheduled, at, draft)).toBeNull();
  });

  it("uno snapshot senza i campi della bozza (HOM-06.1) resta valido", () => {
    const old = { ...toRecoverySnapshot(baseState({ body: "x" }), at)! } as Record<string, unknown>;
    delete old.draftOperationKey;
    delete old.draftRef;
    delete old.draftVersion;
    delete old.publication;

    expect(parseRecoverySnapshot(old, now)).not.toBeNull();
  });

  it("un ref malformato fa cadere solo il legame con la bozza, non il lavoro", () => {
    const broken = { ...toRecoverySnapshot(baseState({ body: "x" }), at, draft)!, draftRef: { contentId: 5 } };
    const parsed = parseRecoverySnapshot(broken, now);

    expect(parsed?.body).toBe("x");
    expect(parsed?.draftRef).toBeNull();
    expect(parsed?.draftVersion).toBeNull();
  });

  it("salva e ricarica con il ref della bozza", async () => {
    await saveRecovery("u1", baseState({ body: "Ciao" }), draft);

    const loaded = await loadRecovery("u1");
    expect(loaded?.draftRef).toEqual(draft.ref);
    expect(loaded?.draftVersion).toBe(4);
  });
});

describe("persistenza per utente (§142, §205)", () => {
  it("salva, ricarica e cancella per utente", async () => {
    await saveRecovery("u1", baseState({ body: "Ciao" }));

    expect((await loadRecovery("u1"))?.body).toBe("Ciao");
    expect(await loadRecovery("u2")).toBeNull();

    await clearRecovery("u1");
    expect(await loadRecovery("u1")).toBeNull();
  });

  it("salvare un composer vuoto rimuove lo snapshot precedente", async () => {
    await saveRecovery("u1", baseState({ body: "Ciao" }));
    await saveRecovery("u1", baseState());
    expect(await loadRecovery("u1")).toBeNull();
  });

  it("un valore illeggibile su disco → nessun recupero, nessun errore", async () => {
    await AsyncStorage.setItem("@footme/post-composer/v1/u1", "{non json");
    expect(await loadRecovery("u1")).toBeNull();
  });
});
