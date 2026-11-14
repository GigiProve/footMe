import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { baseState, LIMITS, mediaItem, PERSON, SOCIETY, tag } from "./composer-fixtures";
import { createDraftState, createEditState, type ComposerState } from "./composer-reducer";
import type { ComposerDraftForEditor, ComposerPostForEdit } from "./composer-types";
import { usePostComposer } from "./use-post-composer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: mocks.rpc,
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
        upload: mocks.upload,
      }),
    },
  },
}));

/** `save_content_draft` e `submit_content` (HOM-06.2): la bozza nasce con id `d1`, l'invio produce `c1`. */
const SAVED = {
  content_id: "d1",
  content_type: "profile_post",
  rights_confirmed: null,
  status: "draft",
  updated_at: "2026-11-13T10:00:00Z",
  version: 1,
};
const SUBMITTED = {
  content_id: "c1",
  content_type: "profile_post",
  replayed: false,
  scheduled_at: null,
  status: "published",
  version: 2,
};
const CONTEXT_DATA = {
  identities: [] as unknown[],
  limits: { max_body_length: 5000, max_media: 10, max_mentions: 20, max_tags: 20, max_video_seconds: 600 },
};

const trees: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  vi.stubGlobal("fetch", async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }));
});

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
  setAnalyticsSink(null);
  mocks.rpc.mockReset();
  mocks.upload.mockReset();
  vi.unstubAllGlobals();
});

/** Un esito per nome di RPC; ciò che non è dichiarato risponde come un server sano. */
function routeRpc(overrides: Record<string, () => unknown> = {}) {
  mocks.rpc.mockImplementation(async (name: string) => {
    const override = overrides[name];

    if (override) {
      return override();
    }
    if (name === "save_content_draft") {
      return { data: SAVED, error: null };
    }
    if (name === "submit_content") {
      return { data: SUBMITTED, error: null };
    }

    return { data: null, error: null };
  });
}

function mount(initialState: ComposerState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onPublished = vi.fn();
  const onUpdated = vi.fn();
  let latest!: ReturnType<typeof usePostComposer>;

  function Probe() {
    latest = usePostComposer({ initialState, onPublished, onUpdated, profileId: "me", userId: "u1" });
    return null;
  }

  act(() => {
    trees.push(TestRenderer.create(createElement(QueryClientProvider, { client }, createElement(Probe))));
  });

  return {
    client,
    onPublished,
    onUpdated,
    get api() {
      return latest;
    },
  };
}

const pendingImage = (localId = "m1") => mediaItem({ localId, uploadStatus: "pending" });

/** Lascia girare le catene di promise dell'upload (fetch → upload → dispatch). */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function callsOf(name: string) {
  return mocks.rpc.mock.calls.filter(([called]) => called === name);
}

const submitCalls = () => callsOf("submit_content");

describe("usePostComposer — Pubblica durante upload (§68–70)", () => {
  it("attende l'upload in corso, poi invia con il media caricato e chiama onPublished", async () => {
    let finish!: (value: { error: null }) => void;
    mocks.upload.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    routeRpc();
    const h = mount(baseState({ media: [pendingImage()] }));

    expect(h.api.state.media[0].uploadStatus).toBe("uploading");

    let done!: Promise<void>;
    await act(async () => {
      done = h.api.actions.submit();
      await Promise.resolve();
    });

    // §68: stato «Pubblicazione in corso…», nessuna chiamata finché l'upload non finisce.
    expect(h.api.state.publish.status).toBe("publishing");
    expect(submitCalls()).toHaveLength(0);

    await act(async () => {
      finish({ error: null });
      await done;
    });

    expect(submitCalls()).toHaveLength(1);
    const [, args] = submitCalls()[0];
    expect(args.p_operation_key).toBe("op-1");
    expect(args.p_identity_id).toBe(PERSON.id);
    expect(args.p_format).toBe("post");
    expect(args.p_publication).toEqual({ mode: "now" });
    expect(args.p_payload.media).toHaveLength(1);
    expect(args.p_payload.media[0].storage_path).toMatch(/^u1\/posts\//);
    expect(h.onPublished).toHaveBeenCalledTimes(1);
    expect(h.onPublished.mock.calls[0][0]).toMatchObject({ contentId: "c1", publication: { mode: "now" }, status: "published" });
  });

  it("upload fallito: nessun invio, errore sull'item, il resto intatto; Riprova solo su quell'item (§70–72)", async () => {
    let finish!: (value: { error: { message: string } }) => void;
    mocks.upload.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    routeRpc();
    const h = mount(baseState({ body: "Ciao", media: [pendingImage("m1"), mediaItem({ localId: "m2", storagePath: "u1/posts/m2" })] }));

    let done!: Promise<void>;
    await act(async () => {
      done = h.api.actions.submit();
      await Promise.resolve();
    });
    await act(async () => {
      finish({ error: { message: "boom" } });
      await done;
    });

    expect(submitCalls()).toHaveLength(0);
    expect(h.onPublished).not.toHaveBeenCalled();
    expect(h.api.state.publish.status).toBe("idle");
    expect(h.api.state.media.map((item) => [item.localId, item.uploadStatus])).toEqual([
      ["m1", "failed"],
      ["m2", "uploaded"],
    ]);
    expect(h.api.state.body).toBe("Ciao");

    // Retry: stesso item, senza reinserirlo (§72, §178).
    mocks.upload.mockResolvedValueOnce({ error: null });
    await act(async () => {
      h.api.actions.retryMedia("m1");
      await settle();
    });
    expect(h.api.state.media[0].uploadStatus).toBe("uploaded");
    expect(mocks.upload).toHaveBeenCalledTimes(2);

    await act(async () => {
      await h.api.actions.submit();
    });
    expect(submitCalls()).toHaveLength(1);
    expect(submitCalls()[0][1].p_payload.media).toHaveLength(2);
  });
});

describe("usePostComposer — errori e idempotenza (§118, §174–177)", () => {
  it("errore di rete: composer intatto, Pubblica di nuovo possibile; il retry riusa la stessa chiave e accetta il replay", async () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    let submits = 0;
    routeRpc({
      submit_content: () => {
        submits += 1;
        if (submits === 1) {
          throw new Error("Network request failed");
        }
        return { data: { ...SUBMITTED, replayed: true }, error: null };
      },
    });
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.onPublished).not.toHaveBeenCalled();
    expect(h.api.state.publish).toEqual({ code: "network", status: "failed" });
    expect(h.api.state.body).toBe("Ciao");

    await act(async () => {
      await h.api.actions.submit();
    });

    const [first, second] = submitCalls();
    expect(first[1].p_operation_key).toBe("op-1");
    expect(second[1].p_operation_key).toBe("op-1");
    expect(h.onPublished.mock.calls[0][0].replayed).toBe(true);

    expect(events.map((event) => event.name)).toEqual(
      expect.arrayContaining(["composer_open", "publish_attempt", "publish_failure", "publish_success"]),
    );
    // §201: nessun testo del Post negli analytics.
    expect(JSON.stringify(events)).not.toContain("Ciao");
  });

  it("doppio tap su Pubblica: una sola chiamata (§119, §239)", async () => {
    let release!: (value: unknown) => void;
    const gate = new Promise((done) => (release = done));
    routeRpc({ submit_content: () => gate });
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      const first = h.api.actions.submit();
      const second = h.api.actions.submit();
      release({ data: SUBMITTED, error: null });
      await Promise.all([first, second]);
    });

    expect(submitCalls()).toHaveLength(1);
    expect(h.onPublished).toHaveBeenCalledTimes(1);
  });

  it("permesso perso: il testo resta e il contesto si rilegge, la lista del server è l'autorità (§169–172)", async () => {
    routeRpc({
      fetch_post_composer_context: () => ({ data: CONTEXT_DATA, error: null }),
      submit_content: () => ({ data: null, error: { code: "42501", message: "content_permission_denied" } }),
    });
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.api.state.publish).toEqual({ code: "post_permission_denied", status: "failed" });
    expect(h.api.state.body).toBe("Ciao");
    expect(h.api.state.identities).toEqual([]);
    expect(h.onPublished).not.toHaveBeenCalled();
  });
});

describe("usePostComposer — content_operation_conflict (§118)", () => {
  it("ruota la chiave, lascia il contenuto intatto e il retry usa la chiave nuova", async () => {
    let submits = 0;
    routeRpc({
      submit_content: () => {
        submits += 1;
        return submits === 1
          ? { data: null, error: { code: "40001", message: "content_operation_conflict" } }
          : { data: SUBMITTED, error: null };
      },
    });
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      await h.api.actions.submit();
    });

    const rotated = h.api.state.operationKey;
    expect(h.api.state.publish).toEqual({ code: "content_operation_conflict", status: "failed" });
    expect(rotated).not.toBe("op-1");
    expect(h.api.state.body).toBe("Ciao");
    expect(h.onPublished).not.toHaveBeenCalled();

    // Pubblica è di nuovo possibile (copy generica «Riprova», non un blocco).
    await act(async () => {
      await h.api.actions.submit();
    });

    const [first, second] = submitCalls();
    expect(first[1].p_operation_key).toBe("op-1");
    expect(second[1].p_operation_key).toBe(rotated);
    expect(h.onPublished).toHaveBeenCalledTimes(1);
  });
});

describe("usePostComposer — bozza e programmazione (HOM-06.2 §116–§132, §203–§211)", () => {
  it("la bozza si salva PRIMA dell'invio, con chiavi di operazione separate e lo stesso ref (§117, §121)", async () => {
    routeRpc();
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      await h.api.actions.submit();
    });

    const names = mocks.rpc.mock.calls.map(([name]) => name).filter((name) => name !== "fetch_post_composer_context");
    expect(names).toEqual(["save_content_draft", "submit_content"]);

    const [, save] = callsOf("save_content_draft")[0];
    const [, submit] = submitCalls()[0];
    expect(save.p_ref).toBeNull();
    expect(save.p_operation_key).toBe(h.api.state.draft.operationKey);
    expect(submit.p_operation_key).toBe("op-1");
    expect(save.p_operation_key).not.toBe(submit.p_operation_key);
    // Una bozza in creazione non si duplica: l'invio parte sulla riga appena creata.
    expect(submit.p_ref).toEqual({ content_id: "d1", content_type: "profile_post" });
    expect(submit.p_expected_version).toBe(1);
  });

  it("«Programma»: la data parte come publication e l'esito dice programmato", async () => {
    const publication = { mode: "scheduled", scheduledAt: "2099-01-01T10:00:00.000Z", timezone: "Europe/Rome" } as const;
    routeRpc({
      submit_content: () => ({
        data: { ...SUBMITTED, scheduled_at: publication.scheduledAt, status: "scheduled" },
        error: null,
      }),
    });
    const h = mount(baseState({ body: "Ciao", publication }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(submitCalls()[0][1].p_publication).toEqual({
      mode: "scheduled",
      scheduled_at: publication.scheduledAt,
      timezone: "Europe/Rome",
    });
    expect(h.onPublished.mock.calls[0][0]).toMatchObject({ publication, scheduledAt: publication.scheduledAt, status: "scheduled" });
  });

  it("un'identity senza can_schedule_content pubblica sempre «Ora», anche con una data in stato (§85)", async () => {
    routeRpc();
    const h = mount(
      baseState({
        body: "Ciao",
        identity: SOCIETY,
        publication: { mode: "scheduled", scheduledAt: "2099-01-01T10:00:00.000Z", timezone: "UTC" },
      }),
    );

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(submitCalls()[0][1].p_publication).toEqual({ mode: "now" });
  });

  it("la scelta nel foglio vale solo con la capability; cambiare identity senza capability torna a «Ora» (§84–§85)", async () => {
    routeRpc({ fetch_post_composer_context: () => ({ data: CONTEXT_DATA, error: null }) });
    const h = mount(baseState({ body: "Ciao" }));
    const scheduled = { mode: "scheduled", scheduledAt: "2099-01-01T10:00:00.000Z", timezone: "UTC" } as const;

    await act(async () => {
      h.api.actions.setPublication(scheduled);
    });
    expect(h.api.state.publication).toEqual(scheduled);

    await act(async () => {
      h.api.actions.changeIdentity(SOCIETY);
    });
    expect(h.api.state.identity).toBe(SOCIETY);
    expect(h.api.state.publication).toEqual({ mode: "now" });

    await act(async () => {
      h.api.actions.setPublication(scheduled);
    });
    expect(h.api.state.publication).toEqual({ mode: "now" });
  });

  const scheduledDraft: ComposerDraftForEditor = {
    body: "Programmato",
    canEdit: true,
    failureCode: null,
    hadLinkWithoutPreview: false,
    identity: PERSON,
    link: null,
    media: [],
    mentions: [],
    publication: { mode: "scheduled", scheduledAt: "2099-01-01T10:00:00.000Z", timezone: "Europe/Rome" },
    ref: { contentId: "s1", contentType: "profile_post" },
    status: "scheduled",
    tagged: [],
    updatedAt: "2026-11-13T10:00:00Z",
    version: 4,
  };

  const scheduledState = () =>
    createDraftState({
      draft: scheduledDraft,
      draftOperationKey: "dk",
      identities: [PERSON, SOCIETY],
      limits: LIMITS,
      operationKey: "op-1",
      origin: "DRAFTS",
      schedule: { maxHorizonDays: 365, minLeadMinutes: 5 },
    });

  it("programmato: «Salva» invia `keep` sulla stessa riga e non scrive bozze (§163–§167)", async () => {
    routeRpc({
      submit_content: () => ({
        data: { ...SUBMITTED, content_id: "s1", scheduled_at: "2099-01-01T10:00:00.000Z", status: "scheduled" },
        error: null,
      }),
    });
    const h = mount(scheduledState());

    // §158 per analogia: senza modifiche non si salva.
    await act(async () => {
      await h.api.actions.submit();
    });
    expect(mocks.rpc).not.toHaveBeenCalled();

    await act(async () => {
      h.api.actions.setBody("Programmato, corretto");
    });
    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("save_content_draft")).toHaveLength(0);
    const [, args] = submitCalls()[0];
    expect(args.p_publication).toEqual({ mode: "keep" });
    expect(args.p_ref).toEqual({ content_id: "s1", content_type: "profile_post" });
    expect(args.p_expected_version).toBe(4);
    expect(args.p_payload.body).toBe("Programmato, corretto");
    expect(h.onPublished.mock.calls[0][0]).toMatchObject({ publication: "keep", status: "scheduled" });
  });

  it("programmato: l'identity non si cambia (§85, contratto A5)", async () => {
    routeRpc();
    const h = mount(scheduledState());

    await act(async () => {
      h.api.actions.changeIdentity(SOCIETY);
    });

    expect(h.api.state.identity).toBe(PERSON);
  });

  it("«Esci e conserva bozza»: salva e non elimina; «Elimina bozza» elimina la riga con la versione corrente (§135–§136)", async () => {
    routeRpc({ delete_content_draft: () => ({ data: { status: "deleted" }, error: null }) });
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      await h.api.actions.keepDraft();
    });
    expect(callsOf("save_content_draft")).toHaveLength(1);
    expect(callsOf("delete_content_draft")).toHaveLength(0);

    let outcome: unknown;
    await act(async () => {
      outcome = await h.api.actions.deleteDraft();
    });

    expect(outcome).toEqual({ ok: true });
    expect(callsOf("delete_content_draft")).toHaveLength(1);
    expect(callsOf("delete_content_draft")[0][1]).toEqual({
      p_expected_version: 1,
      p_ref: { content_id: "d1", content_type: "profile_post" },
    });
  });

  it("«Elimina bozza» senza una bozza sul server non fa nessuna chiamata", async () => {
    routeRpc();
    const h = mount(baseState());

    await act(async () => {
      await h.api.actions.deleteDraft();
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("«Elimina bozza» rifiutata dal server: la bozza resta e si dice (§233)", async () => {
    routeRpc({
      delete_content_draft: () => ({ data: null, error: { code: "42501", message: "content_permission_denied" } }),
    });
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      await h.api.actions.keepDraft();
    });

    let outcome: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await h.api.actions.deleteDraft();
    });

    expect(outcome?.ok).toBe(false);
    expect(outcome?.error).toBeTruthy();
  });
});

describe("usePostComposer — selector Tagga (§108)", () => {
  it("a ricerca vuota elenca i tag già scelti all'apertura; si possono togliere e rimettere", async () => {
    const anna = tag("Anna");
    const h = mount(baseState({ tagged: [anna] }));

    await act(async () => {
      h.api.actions.openTagSheet();
    });

    expect(h.api.tag.open).toBe(true);
    expect(h.api.tag.results).toEqual([anna]);
    expect(h.api.tag.draft).toEqual([anna]);

    await act(async () => {
      h.api.actions.toggleTag(anna);
    });

    // Deselezionata ma ancora in lista: si può rimettere.
    expect(h.api.tag.draft).toEqual([]);
    expect(h.api.tag.results).toEqual([anna]);

    await act(async () => {
      h.api.actions.toggleTag(anna);
    });
    expect(h.api.tag.draft).toEqual([anna]);
  });

  it("senza tag all'apertura la lista è vuota finché non si cerca", async () => {
    const h = mount(baseState());

    await act(async () => {
      h.api.actions.openTagSheet();
    });

    expect(h.api.tag.results).toEqual([]);
  });
});

describe("usePostComposer — Modifica (§144–163)", () => {
  const edit: ComposerPostForEdit = {
    author: PERSON,
    body: "Testo",
    canEdit: true,
    contentId: "c1",
    contentType: "profile_post",
    link: null,
    media: [],
    mentions: [],
    tagged: [],
    version: "2026-11-13T10:00:00Z",
  };

  it("Salva invia la versione letta all'apertura e chiama onUpdated; nessuna bozza (HOM-06.1 invariata)", async () => {
    mocks.rpc.mockResolvedValue({
      data: { content_id: "c1", content_type: "profile_post", version: "2026-11-13T11:00:00Z" },
      error: null,
    });
    const h = mount(createEditState({ edit, limits: LIMITS, operationKey: "op-1" }));

    // §158: senza modifiche non si può salvare.
    await act(async () => {
      await h.api.actions.submit();
    });
    expect(mocks.rpc).not.toHaveBeenCalled();

    await act(async () => {
      h.api.actions.setBody("Testo corretto");
    });
    await act(async () => {
      await h.api.actions.submit();
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "update_post",
      expect.objectContaining({
        p_body: "Testo corretto",
        p_expected_version: "2026-11-13T10:00:00Z",
        p_post_id: "c1",
      }),
    );
    expect(callsOf("save_content_draft")).toHaveLength(0);
    expect(h.onUpdated).toHaveBeenCalledTimes(1);
  });

  it("conflitto di versione: nessun overwrite, il lavoro resta (§161)", async () => {
    mocks.rpc.mockRejectedValue({ code: "40001", message: "post_version_conflict" });
    const h = mount(createEditState({ edit, limits: LIMITS, operationKey: "op-1" }));

    await act(async () => {
      h.api.actions.setBody("Testo corretto");
    });
    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.api.state.publish).toEqual({ code: "post_version_conflict", status: "failed" });
    expect(h.api.state.body).toBe("Testo corretto");
    expect(h.onUpdated).not.toHaveBeenCalled();
  });
});
