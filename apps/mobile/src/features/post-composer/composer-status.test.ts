import { describe, expect, it } from "vitest";

import { COMPOSER_PUBLISHING_COPY, COMPOSER_SAVING_COPY, composerStatus, exitDecision } from "./composer-status";
import { baseState, mediaItem } from "./composer-fixtures";
import {
  COMPOSER_MEDIA_LIMIT_COPY,
  COMPOSER_PERMISSION_LOST_COPY,
  COMPOSER_PUBLISH_ERROR_COPY,
  COMPOSER_UPLOAD_PENDING_BLOCK_COPY,
} from "./composer-presentation";
import { createComposerStore } from "./composer-store";

describe("composerStatus (§68, §120, §169–177)", () => {
  it("nessun messaggio a composer pulito", () => {
    expect(composerStatus(baseState(), null)).toBeNull();
  });

  it("invio in corso: «Pubblicazione in corso…» in Nuovo post, «Salvataggio in corso…» in Modifica", () => {
    expect(composerStatus(baseState({ publish: { status: "publishing" } }), null)).toEqual({
      message: COMPOSER_PUBLISHING_COPY,
      tone: "progress",
    });
    expect(
      composerStatus(
        baseState({
          mode: { contentId: "c", contentType: "profile_post", expectedVersion: "v", kind: "edit" },
          publish: { status: "publishing" },
        }),
        null,
      )?.message,
    ).toBe(COMPOSER_SAVING_COPY);
  });

  it("errore di invio: copy §175 e il blocco permanente ha la precedenza", () => {
    expect(composerStatus(baseState({ publish: { code: "network", status: "failed" } }), null)).toEqual({
      message: COMPOSER_PUBLISH_ERROR_COPY,
      tone: "error",
    });
    expect(composerStatus(baseState({ publish: { code: "post_permission_denied", status: "failed" } }), null)?.message).toBe(
      COMPOSER_PERMISSION_LOST_COPY,
    );
  });

  it("upload fallito: spiega come sbloccare Pubblica (§70)", () => {
    expect(composerStatus(baseState({ media: [mediaItem({ uploadStatus: "failed" })] }), null)?.message).toBe(
      COMPOSER_UPLOAD_PENDING_BLOCK_COPY,
    );
  });

  it("avviso transitorio solo se non c'è altro da dire (§62)", () => {
    expect(composerStatus(baseState(), COMPOSER_MEDIA_LIMIT_COPY)).toEqual({
      message: COMPOSER_MEDIA_LIMIT_COPY,
      tone: "notice",
    });
  });
});

describe("exitDecision (§119, §137–139: Annulla, back hardware, gesture)", () => {
  it("vuoto → si chiude direttamente", () => {
    expect(exitDecision({ isDirty: false, isPublishing: false })).toBe("leave");
  });

  it("con contenuto → conferma", () => {
    expect(exitDecision({ isDirty: true, isPublishing: false })).toBe("confirm");
  });

  it("durante l'invio → blocco, anche se vuoto", () => {
    expect(exitDecision({ isDirty: true, isPublishing: true })).toBe("block");
    expect(exitDecision({ isDirty: false, isPublishing: true })).toBe("block");
  });
});

describe("createComposerStore", () => {
  it("getState è sempre l'ultimo stato e notifica solo quando cambia davvero", () => {
    const store = createComposerStore(baseState());
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });

    store.dispatch({ body: "a", type: "bodyChanged" });
    store.dispatch({ body: "a", type: "bodyChanged" });

    expect(store.getState().body).toBe("a");
    expect(calls).toBe(1);
  });

  it("publishStarted è sincrono e idempotente: il secondo invio non passa (§119)", () => {
    const store = createComposerStore(baseState({ body: "Ciao" }));

    store.dispatch({ type: "publishStarted" });
    const first = store.getState();
    store.dispatch({ type: "publishStarted" });

    expect(first.publish.status).toBe("publishing");
    expect(store.getState()).toBe(first);
  });
});
