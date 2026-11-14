/**
 * Il composer sticky montato sui componenti reali: compatto da inattivo, selettore di
 * identità solo con più identità, «Pubblica» disabilitato se non significativo, banner
 * di risposta, identità persa, nessun campo se i commenti sono disattivati (HOM-08
 * §18–§25, §30–§31, §43–§46, §81–§83, §179).
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { countTestId, hostByTestId, press, pressTestId, render, textOf } from "../../feed/components/feed-test-helpers";
import { createCommentDraftStore, type CommentDraftStore } from "../comment-draft-store";
import type { CommentIdentity } from "../comment-types";
import type { CommentsController } from "../use-comments-controller";
import { CommentComposerBar } from "./CommentComposerBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

const PERSON: CommentIdentity = {
  avatarUrl: null,
  canComment: true,
  clubCategory: null,
  clubName: null,
  mediaKind: null,
  primaryPosition: null,
  teamLabel: null,
  id: "p-1",
  isVerified: true,
  name: "Matteo Rossi",
  rank: 0,
  role: null,
  type: "person",
};

const SOCIETY: CommentIdentity = {
  avatarUrl: null,
  canComment: true,
  clubCategory: "Serie D",
  clubName: null,
  mediaKind: null,
  primaryPosition: null,
  teamLabel: null,
  id: "c-1",
  isVerified: true,
  name: "AC Como",
  rank: 1,
  role: null,
  type: "society",
};

const fns = {
  cancelReply: vi.fn(),
  chooseIdentity: vi.fn(),
  close: vi.fn(),
  onMentionAdded: vi.fn(),
  open: vi.fn(),
  publish: vi.fn(),
  setAsOpen: vi.fn(),
  setBody: vi.fn(),
};

function controllerWith(
  store: CommentDraftStore,
  options: { identities?: CommentIdentity[]; mode?: CommentsController["composer"]["mode"] } = {},
): CommentsController {
  return {
    composer: {
      ...fns,
      identities: options.identities ?? [PERSON],
      mode: options.mode ?? "ready",
      store,
    },
    limits: { maxBodyLength: 1000, maxLinks: 10, maxMentions: 20 },
    overlays: { setAsOpen: fns.setAsOpen },
    viewerId: "viewer-1",
  } as unknown as CommentsController;
}

function mount(controller: CommentsController) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <CommentComposerBar controller={controller} />
    </QueryClientProvider>,
  );
}

function publishButton(tree: ReturnType<typeof mount>) {
  return hostByTestId(tree, "comment-publish")[0];
}

beforeEach(() => {
  Object.values(fns).forEach((mock) => mock.mockReset());
});

describe("CommentComposerBar — inattivo (§18–§20)", () => {
  it("è una riga compatta «Scrivi un commento…»; il tap lo attiva", () => {
    const tree = mount(controllerWith(createCommentDraftStore()));

    expect(countTestId(tree, "comment-composer-inactive")).toBe(1);
    expect(countTestId(tree, "comment-editor-input")).toBe(0);
    expect(countTestId(tree, "comment-publish")).toBe(0);

    press(tree, "Scrivi un commento…");
    expect(fns.open).toHaveBeenCalledTimes(1);
  });

  it("finché il contesto carica la riga c'è ma non è attivabile", () => {
    const tree = mount(controllerWith(createCommentDraftStore(), { mode: "loading" }));

    expect(hostByTestId(tree, "comment-composer-inactive")[0].props.disabled).toBe(true);
  });

  it("commenti disattivati o contenuto non disponibile: nessun campo (§179)", () => {
    const tree = mount(controllerWith(createCommentDraftStore(), { mode: "hidden" }));

    expect(tree.toJSON()).toBeNull();
  });
});

describe("CommentComposerBar — attivo (§21–§25)", () => {
  it("mostra editor, contatore e Pubblica; nessun allegato né media (§27)", () => {
    const store = createCommentDraftStore();
    store.set({ active: true, body: "Ottimo progetto." });
    const tree = mount(controllerWith(store));

    expect(countTestId(tree, "comment-editor-input")).toBe(1);
    expect(textOf(tree)).toContain("16/1000");
    expect(textOf(tree)).toContain("Pubblica");
    expect(textOf(tree).toLowerCase()).not.toContain("foto");
    expect(textOf(tree).toLowerCase()).not.toContain("gif");
  });

  it("§24: Pubblica è disabilitato con testo vuoto, spazi o sole mention", () => {
    const store = createCommentDraftStore();
    store.set({ active: true, body: "   " });
    const empty = mount(controllerWith(store));
    expect(publishButton(empty).props.disabled).toBe(true);

    const onlyMention = createCommentDraftStore();
    onlyMention.set({
      active: true,
      body: "@Marco Bianchi",
      mentions: [{ displayName: "Marco Bianchi", end: 14, identityId: "p-2", identityType: "profile", start: 0 }],
    });
    expect(publishButton(mount(controllerWith(onlyMention))).props.disabled).toBe(true);
  });

  it("§25: con un testo valido Pubblica è abilitato e pubblica", () => {
    const store = createCommentDraftStore();
    store.set({ active: true, body: "Ottimo progetto." });
    const tree = mount(controllerWith(store));

    expect(publishButton(tree).props.disabled).toBeFalsy();
    pressTestId(tree, "comment-publish");
    expect(fns.publish).toHaveBeenCalledTimes(1);
  });

  it("§46: senza identità che possano commentare Pubblica resta disabilitato, il testo resta", () => {
    const store = createCommentDraftStore();
    store.set({ active: true, body: "Ottimo progetto." });
    const tree = mount(controllerWith(store, { identities: [] }));

    expect(publishButton(tree).props.disabled).toBe(true);
    expect(hostByTestId(tree, "comment-editor-input")[0].props.value).toBe("Ottimo progetto.");
  });
});

describe("CommentComposerBar — identità (§30–§31, §40, §43–§45)", () => {
  it("una sola identità: avatar, nome e check, nessuna freccia né «Commenta come» (§30)", () => {
    const store = createCommentDraftStore();
    store.set({ active: true });
    const tree = mount(controllerWith(store, { identities: [PERSON] }));
    const row = hostByTestId(tree, "comment-composer-identity")[0];

    expect(textOf(tree)).toContain("Matteo Rossi");
    expect(row.props.onPress).toBeUndefined();
    expect(JSON.stringify(tree.toJSON())).not.toContain("chevron-down");
    expect(textOf(tree)).not.toContain("Commenta come");
  });

  it("più identità: ⌄ e il tap apre «Commenta come» (§31)", () => {
    const store = createCommentDraftStore();
    store.set({ active: true });
    const tree = mount(controllerWith(store, { identities: [PERSON, SOCIETY] }));

    expect(JSON.stringify(tree.toJSON())).toContain("chevron-down");
    press(tree, "Commenta come Matteo Rossi");
    expect(fns.setAsOpen).toHaveBeenCalledWith(true);
  });

  it("l'identità scelta cambia chi parla senza toccare testo né risposta (§40–§41)", () => {
    const store = createCommentDraftStore();
    store.set({
      active: true,
      body: "Ottimo progetto.",
      identity: SOCIETY,
      replyTo: { commentId: "c-9", identityId: "p-2", identityType: "person", name: "Marco Bianchi", rootCommentId: "c-1" },
    });
    const tree = mount(controllerWith(store, { identities: [PERSON, SOCIETY] }));

    expect(textOf(tree)).toContain("AC Como");
    expect(hostByTestId(tree, "comment-editor-input")[0].props.value).toBe("Ottimo progetto.");
    expect(countTestId(tree, "comment-reply-banner")).toBe(1);
  });

  it("identità persa: il testo resta, si dice perché, Pubblica no, e si può passare a un'altra (§43–§45)", () => {
    const store = createCommentDraftStore();
    store.set({ active: true, body: "Ottimo progetto.", identity: SOCIETY });
    const tree = mount(controllerWith(store, { identities: [PERSON] }));

    expect(textOf(tree)).toContain("Non hai più i permessi per commentare con questo profilo.");
    expect(publishButton(tree).props.disabled).toBe(true);
    expect(hostByTestId(tree, "comment-editor-input")[0].props.value).toBe("Ottimo progetto.");
    // c'è un'altra identità: il selettore è disponibile
    press(tree, "Commenta come AC Como");
    expect(fns.setAsOpen).toHaveBeenCalledWith(true);
  });
});

describe("CommentComposerBar — risposta (§81–§83)", () => {
  it("«Rispondi a Marco Bianchi» con X per tornare al commento principale", () => {
    const store = createCommentDraftStore();
    store.set({
      active: true,
      body: "@Marco Bianchi concordo",
      replyTo: { commentId: "c-9", identityId: "p-2", identityType: "person", name: "Marco Bianchi", rootCommentId: "c-1" },
    });
    const tree = mount(controllerWith(store));

    expect(textOf(tree)).toContain("Rispondi a Marco Bianchi");

    press(tree, "Annulla risposta");
    expect(fns.cancelReply).toHaveBeenCalledTimes(1);
  });

  it("senza risposta niente banner", () => {
    const store = createCommentDraftStore();
    store.set({ active: true });

    expect(countTestId(mount(controllerWith(store)), "comment-reply-banner")).toBe(0);
  });
});

describe("CommentComposerBar — errore d'invio (§44, §193–§194)", () => {
  it("l'avviso resta accanto al testo, che non sparisce", () => {
    const store = createCommentDraftStore();
    store.set({ active: true, body: "Ottimo progetto.", notice: "Questo commento non è più disponibile." });
    const tree = mount(controllerWith(store));

    expect(countTestId(tree, "comment-composer-notice")).toBe(1);
    expect(textOf(tree)).toContain("Questo commento non è più disponibile.");
    expect(hostByTestId(tree, "comment-editor-input")[0].props.value).toBe("Ottimo progetto.");
  });
});
