import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { baseState, LIMITS, mediaItem, PERSON, tag } from "./composer-fixtures";
import { createEditState, type ComposerState } from "./composer-reducer";
import type { ComposerPostForEdit } from "./composer-types";
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

const PUBLISHED = { content_id: "c1", content_type: "profile_post", replayed: false };

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

function publishCalls() {
  return mocks.rpc.mock.calls.filter(([name]) => name === "publish_post");
}

describe("usePostComposer — Pubblica durante upload (§68–70)", () => {
  it("attende l'upload in corso, poi pubblica con il media caricato e chiama onPublished", async () => {
    let finish!: (value: { error: null }) => void;
    mocks.upload.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    mocks.rpc.mockResolvedValue({ data: PUBLISHED, error: null });
    const h = mount(baseState({ media: [pendingImage()] }));

    expect(h.api.state.media[0].uploadStatus).toBe("uploading");

    let done!: Promise<void>;
    await act(async () => {
      done = h.api.actions.submit();
      await Promise.resolve();
    });

    // §68: stato «Pubblicazione in corso…», nessuna chiamata finché l'upload non finisce.
    expect(h.api.state.publish.status).toBe("publishing");
    expect(publishCalls()).toHaveLength(0);

    await act(async () => {
      finish({ error: null });
      await done;
    });

    expect(publishCalls()).toHaveLength(1);
    const [, args] = publishCalls()[0];
    expect(args.p_operation_key).toBe("op-1");
    expect(args.p_identity_id).toBe(PERSON.id);
    expect(args.p_media).toHaveLength(1);
    expect(args.p_media[0].storage_path).toMatch(/^u1\/posts\//);
    expect(h.onPublished).toHaveBeenCalledTimes(1);
    expect(h.onPublished.mock.calls[0][0]).toEqual(PUBLISHED);
  });

  it("upload fallito: nessun Post, errore sull'item, il resto intatto; Riprova solo su quell'item (§70–72)", async () => {
    let finish!: (value: { error: { message: string } }) => void;
    mocks.upload.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    mocks.rpc.mockResolvedValue({ data: PUBLISHED, error: null });
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

    expect(publishCalls()).toHaveLength(0);
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
    expect(publishCalls()).toHaveLength(1);
    expect(publishCalls()[0][1].p_media).toHaveLength(2);
  });
});

describe("usePostComposer — errori e idempotenza (§118, §174–177)", () => {
  it("errore di rete: composer intatto, Pubblica di nuovo possibile; il retry riusa la stessa chiave e accetta il replay", async () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    mocks.rpc
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockResolvedValueOnce({ data: { ...PUBLISHED, replayed: true }, error: null });
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

    const [first, second] = publishCalls();
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
    let resolve!: (value: unknown) => void;
    mocks.rpc.mockReturnValue(new Promise((done) => (resolve = done)));
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      const first = h.api.actions.submit();
      const second = h.api.actions.submit();
      resolve({ data: PUBLISHED, error: null });
      await Promise.all([first, second]);
    });

    expect(publishCalls()).toHaveLength(1);
    expect(h.onPublished).toHaveBeenCalledTimes(1);
  });

  it("permesso perso: il testo resta e il contesto si rilegge, la lista del server è l'autorità (§169–172)", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "publish_post") {
        throw { code: "42501", message: "denied" };
      }
      return {
        data: {
          identities: [],
          limits: {
            max_body_length: 5000,
            max_media: 10,
            max_mentions: 20,
            max_tags: 20,
            max_video_seconds: 600,
          },
        },
        error: null,
      };
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

describe("usePostComposer — post_operation_conflict (§118)", () => {
  it("ruota la chiave, lascia il contenuto intatto e il retry usa la chiave nuova", async () => {
    mocks.rpc
      .mockRejectedValueOnce({ code: "40001", message: "post_operation_conflict" })
      .mockResolvedValueOnce({ data: PUBLISHED, error: null });
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      await h.api.actions.submit();
    });

    const rotated = h.api.state.operationKey;
    expect(h.api.state.publish).toEqual({ code: "post_operation_conflict", status: "failed" });
    expect(rotated).not.toBe("op-1");
    expect(h.api.state.body).toBe("Ciao");
    expect(h.onPublished).not.toHaveBeenCalled();

    // Pubblica è di nuovo possibile (copy generica «Riprova», non un blocco).
    await act(async () => {
      await h.api.actions.submit();
    });

    const [first, second] = publishCalls();
    expect(first[1].p_operation_key).toBe("op-1");
    expect(second[1].p_operation_key).toBe(rotated);
    expect(h.onPublished).toHaveBeenCalledTimes(1);
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

  it("Salva invia la versione letta all'apertura e chiama onUpdated", async () => {
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
