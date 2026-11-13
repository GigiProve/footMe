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
    expect(parseRecoverySnapshot(valid(), now)).toEqual(valid());
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
