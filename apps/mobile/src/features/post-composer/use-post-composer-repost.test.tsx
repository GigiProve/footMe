/**
 * `usePostComposer` in modalità Repost (HOM-10 §61–§72, §120–§133, §137, §225–§238,
 * §283–§286). Stesso hook del composer Post: qui si provano solo i due esiti tecnici
 * del tap su «Reposta» e le azioni proprie del Repost.
 */

import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { baseState, PERSON, SOCIETY } from "./composer-fixtures";
import type { ComposerState } from "./composer-reducer";
import type { ComposerReference } from "./composer-types";
import { usePostComposer } from "./use-post-composer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
}));

vi.mock("../../lib/supabase", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: mocks.rpc,
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }), upload: vi.fn() }) },
  },
}));

const REFERENCE: ComposerReference = {
  available: true,
  contentId: "c-1",
  contentType: "club_media",
  preview: null,
};

const ME = { ...PERSON, canPublishPost: true, hasSimpleRepost: false };
const CLUB = { ...SOCIETY, canPublishPost: true, hasSimpleRepost: false };

const CONTEXT_DATA = {
  identities: [] as unknown[],
  limits: { max_body_length: 5000, max_media: 10, max_mentions: 20, max_tags: 20, max_video_seconds: 600 },
};

const SUBMITTED = {
  content_id: "new-1",
  content_type: "profile_post",
  replayed: false,
  scheduled_at: null,
  status: "published",
  version: 1,
};

const wireIdentity = (id: string, type: "person" | "society", overrides: Record<string, unknown> = {}) => ({
  avatar_url: null,
  can_publish_post: true,
  can_repost: true,
  can_schedule_content: type === "person",
  context_label: type === "person" ? "Profilo personale" : "Società",
  display_name: type === "person" ? "Matteo Rossi" : "AC Como",
  has_simple_repost: false,
  identity_id: id,
  identity_type: type,
  is_verified: true,
  ...overrides,
});

const trees: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
  setAnalyticsSink(null);
  mocks.rpc.mockReset();
});

function routeRpc(overrides: Record<string, (args: Record<string, unknown>) => unknown> = {}) {
  mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    const override = overrides[name];

    if (override) {
      return override(args);
    }
    if (name === "fetch_post_composer_context") {
      return { data: CONTEXT_DATA, error: null };
    }
    if (name === "submit_content") {
      return { data: SUBMITTED, error: null };
    }
    if (name === "save_content_draft") {
      // Un Post con testo salva la bozza al primo contenuto significativo (HOM-06.2 §117).
      return {
        data: {
          content_id: "d1",
          content_type: "profile_post",
          rights_confirmed: null,
          status: "draft",
          updated_at: "2026-11-13T10:00:00Z",
          version: 1,
        },
        error: null,
      };
    }
    if (name === "repost_content") {
      return { data: { repost_id: "r1", status: "created" }, error: null };
    }
    if (name === "remove_repost") {
      return { data: { status: "removed" }, error: null };
    }

    return { data: null, error: null };
  });
}

function repostState(overrides: Partial<ComposerState> = {}): ComposerState {
  return baseState({ identities: [ME, CLUB], identity: ME, reference: REFERENCE, ...overrides });
}

function mount(initialState: ComposerState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const callbacks = {
    onPublished: vi.fn(),
    onRepostRemoved: vi.fn(),
    onSimpleReposted: vi.fn(),
    onSimpleRepostFailed: vi.fn(),
    onUpdated: vi.fn(),
  };
  let latest!: ReturnType<typeof usePostComposer>;

  function Probe() {
    latest = usePostComposer({ ...callbacks, initialState, profileId: "me", userId: "me" });
    return null;
  }

  act(() => {
    trees.push(TestRenderer.create(createElement(QueryClientProvider, { client }, createElement(Probe))));
  });

  return {
    ...callbacks,
    client,
    get api() {
      return latest;
    },
  };
}

function callsOf(name: string) {
  return mocks.rpc.mock.calls.filter(([called]) => called === name);
}

const settle = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

describe("Simple Repost: body vuoto (§63, §70–§72, §137)", () => {
  it("chiude subito (ottimistico) e poi chiama repost_content con la chiave stabile e senza bozza", async () => {
    let resolveRpc!: (value: unknown) => void;
    routeRpc({ repost_content: () => new Promise((resolve) => (resolveRpc = resolve)) });
    const h = mount(repostState());

    let done!: Promise<void>;
    await act(async () => {
      done = h.api.actions.submit();
      await Promise.resolve();
    });

    // §70: feedback e chiusura PRIMA della risposta del server.
    expect(h.onSimpleReposted).toHaveBeenCalledTimes(1);
    expect(h.onSimpleRepostFailed).not.toHaveBeenCalled();
    expect(callsOf("repost_content")).toHaveLength(1);

    const [, args] = callsOf("repost_content")[0];
    expect(args).toMatchObject({
      p_content_id: "c-1",
      p_content_type: "club_media",
      p_identity_id: PERSON.id,
      p_identity_type: "person",
    });
    // La chiave è dell'azione, non quella del submit_content della sessione (§234).
    expect(args.p_operation_key).toEqual(expect.any(String));
    expect(args.p_operation_key).not.toBe("op-1");

    await act(async () => {
      resolveRpc({ data: { repost_id: "r1", status: "created" }, error: null });
      await done;
    });

    expect(h.onSimpleRepostFailed).not.toHaveBeenCalled();
    // Un Simple Repost non è un Post: nessun submit_content, nessuna bozza (§67, §137, §312).
    expect(callsOf("submit_content")).toHaveLength(0);
    expect(callsOf("save_content_draft")).toHaveLength(0);
    expect(h.onPublished).not.toHaveBeenCalled();
  });

  it("solo whitespace e invisibili: ancora un Simple Repost, mai un nuovo Post (§62, §300)", async () => {
    routeRpc();
    const h = mount(repostState({ body: "  \n​ " }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("repost_content")).toHaveLength(1);
    expect(callsOf("submit_content")).toHaveLength(0);
  });

  it("doppio tap: una sola chiamata (§69, §366)", async () => {
    let resolveRpc!: (value: unknown) => void;
    routeRpc({ repost_content: () => new Promise((resolve) => (resolveRpc = resolve)) });
    const h = mount(repostState());

    let first!: Promise<void>;
    await act(async () => {
      first = h.api.actions.submit();
      void h.api.actions.submit();
      await Promise.resolve();
    });

    expect(callsOf("repost_content")).toHaveLength(1);
    expect(h.onSimpleReposted).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRpc({ data: { repost_id: "r1", status: "created" }, error: null });
      await first;
    });
  });

  it("già ripostato + body vuoto: nessun secondo Repost, la CTA non parte (§126, §313, §334)", async () => {
    routeRpc();
    const h = mount(repostState({ identity: { ...ME, hasSimpleRepost: true } }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("repost_content")).toHaveLength(0);
    expect(h.onSimpleReposted).not.toHaveBeenCalled();
  });

  it("errore di rete: rollback, messaggio d'errore e composer di nuovo azionabile (§72)", async () => {
    routeRpc({
      repost_content: () => {
        throw new Error("Network request failed");
      },
    });
    const h = mount(repostState());

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.onSimpleRepostFailed).toHaveBeenCalledWith("error");
    expect(h.api.state.publish.status).toBe("idle");
  });

  it("originale sparito prima del Repost: «unavailable» (§228–§229)", async () => {
    routeRpc({ repost_content: () => ({ data: { repost_id: null, status: "content_unavailable" }, error: null }) });
    const h = mount(repostState());

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.onSimpleRepostFailed).toHaveBeenCalledWith("unavailable");
  });

  it("identità senza permesso: «forbidden» (§225)", async () => {
    routeRpc({ repost_content: () => ({ data: { repost_id: null, status: "forbidden" }, error: null }) });
    const h = mount(repostState());

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.onSimpleRepostFailed).toHaveBeenCalledWith("forbidden");
  });

  it("già ripostato su un altro device: già_reposted vale successo, nessun errore (§236)", async () => {
    routeRpc({ repost_content: () => ({ data: { repost_id: "r0", status: "already_reposted" }, error: null }) });
    const h = mount(repostState());

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.onSimpleRepostFailed).not.toHaveBeenCalled();
  });

  it("nessuna bozza né recovery per un Simple Repost vuoto, nemmeno dopo l'attesa dell'autosave (§137, §338)", async () => {
    routeRpc();
    mount(repostState());

    await act(async () => {
      await settle();
    });

    expect(callsOf("save_content_draft")).toHaveLength(0);
  });
});

describe("Post con testo e reference (§64, §86–§88, §235)", () => {
  it("body valido → submit_content con `reference`, non repost_content; idempotenza di HOM-06.1", async () => {
    routeRpc();
    const h = mount(repostState({ body: "Un ragazzo davvero interessante" }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("repost_content")).toHaveLength(0);
    expect(callsOf("submit_content")).toHaveLength(1);

    const [, args] = callsOf("submit_content")[0];
    expect(args.p_operation_key).toBe("op-1");
    expect(args.p_format).toBe("post");
    expect(args.p_publication).toEqual({ mode: "now" });
    expect(args.p_payload.body).toBe("Un ragazzo davvero interessante");
    expect(args.p_payload.reference).toEqual({ content_id: "c-1", content_type: "club_media" });
    expect(args.p_payload.media).toEqual([]);
    expect(h.onPublished).toHaveBeenCalledTimes(1);
    expect(h.onSimpleReposted).not.toHaveBeenCalled();
  });

  it("originale non più disponibile al submit: testo preservato, nessuna pubblicazione (§229–§230)", async () => {
    routeRpc({
      submit_content: () => ({ data: null, error: { code: "22023", message: "repost_reference_unavailable" } }),
    });
    const h = mount(repostState({ body: "Il mio testo" }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.onPublished).not.toHaveBeenCalled();
    expect(h.api.state.body).toBe("Il mio testo");
    expect(h.api.state.publish).toEqual({ code: "repost_reference_unavailable", status: "failed" });
  });

  it("errore di rete: stessa chiave al retry, il replay non duplica (§286)", async () => {
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
    const h = mount(repostState({ body: "Testo" }));

    await act(async () => {
      await h.api.actions.submit();
    });
    expect(h.api.state.publish).toEqual({ code: "network", status: "failed" });
    expect(h.api.state.body).toBe("Testo");

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(submitKeys()).toEqual(["op-1", "op-1"]);
    expect(h.onPublished).toHaveBeenCalledTimes(1);

    function submitKeys() {
      return callsOf("submit_content").map(([, args]) => args.p_operation_key);
    }
  });

  it("eventi distinti dal Simple Repost: referenced_post_* e nessun testo (§269–§271)", async () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    routeRpc();
    const h = mount(repostState({ body: "Testo riservato" }));

    await act(async () => {
      await h.api.actions.submit();
    });

    const names = events.map((event) => event.name);
    expect(names).toContain("repost_composer_open");
    expect(names).toContain("referenced_post_publish_attempt");
    expect(names).toContain("referenced_post_publish_success");
    expect(names).not.toContain("simple_repost_attempt");
    // Nessun «composer_open»/«publish_attempt» generici per un Repost (§269).
    expect(names).not.toContain("composer_open");
    expect(names).not.toContain("publish_attempt");
    expect(JSON.stringify(events)).not.toContain("Testo riservato");
  });
});

describe("Rimuovi repost (§125, §128–§131, §238)", () => {
  const reposted = () =>
    repostState({
      body: "Testo ancora usabile",
      identities: [{ ...ME, hasSimpleRepost: true }, CLUB],
      identity: { ...ME, hasSimpleRepost: true },
    });

  it("immediato: chiama remove_repost, il flag torna a «non ripostato», il testo resta", async () => {
    routeRpc();
    const h = mount(reposted());

    await act(async () => {
      await h.api.actions.removeSimpleRepost();
    });

    expect(callsOf("remove_repost")).toHaveLength(1);
    expect(callsOf("remove_repost")[0][1]).toMatchObject({
      p_content_id: "c-1",
      p_identity_id: PERSON.id,
      p_identity_type: "person",
    });
    expect(h.api.state.identity?.hasSimpleRepost).toBe(false);
    expect(h.api.state.body).toBe("Testo ancora usabile");
    expect(h.onRepostRemoved).toHaveBeenCalledTimes(1);
    // Il composer non si chiude (§125): niente Simple Repost né uscita.
    expect(h.onSimpleReposted).not.toHaveBeenCalled();
  });

  it("già rimosso da un altro device (not_found): converge, nessun errore (§238)", async () => {
    routeRpc({ remove_repost: () => ({ data: { status: "not_found" }, error: null }) });
    const h = mount(reposted());

    await act(async () => {
      await h.api.actions.removeSimpleRepost();
    });

    expect(h.onRepostRemoved).toHaveBeenCalledTimes(1);
    expect(h.api.state.identity?.hasSimpleRepost).toBe(false);
  });

  it("errore: rollback del flag e una riga di stato, niente toast di successo", async () => {
    routeRpc({
      remove_repost: () => {
        throw new Error("Network request failed");
      },
    });
    const h = mount(reposted());

    await act(async () => {
      await h.api.actions.removeSimpleRepost();
    });

    expect(h.onRepostRemoved).not.toHaveBeenCalled();
    expect(h.api.state.identity?.hasSimpleRepost).toBe(true);
    expect(h.api.notice).toBe("Non è stato possibile rimuovere il repost. Riprova.");
  });

  it("doppio tap: una sola rimozione", async () => {
    let resolveRpc!: (value: unknown) => void;
    routeRpc({ remove_repost: () => new Promise((resolve) => (resolveRpc = resolve)) });
    const h = mount(reposted());

    let first!: Promise<void>;
    await act(async () => {
      first = h.api.actions.removeSimpleRepost();
      void h.api.actions.removeSimpleRepost();
      await Promise.resolve();
    });

    expect(callsOf("remove_repost")).toHaveLength(1);

    await act(async () => {
      resolveRpc({ data: { status: "removed" }, error: null });
      await first;
    });
  });
});

describe("cambio identità e rivalidazione (§36–§39, §155)", () => {
  it("rilegge lo stato Repost: l'identità nuova porta le sue capability e lo stato «già ripostato»", async () => {
    routeRpc({
      fetch_repost_state: () => ({
        data: {
          identities: [wireIdentity(PERSON.id, "person"), wireIdentity(SOCIETY.id, "society", { has_simple_repost: true })],
          repostable: true,
          snapshot: { author_name: "Matteo", item_kind: "post" },
        },
        error: null,
      }),
    });
    const h = mount(repostState({ body: "Testo" }));

    await act(async () => {
      h.api.actions.changeIdentity(CLUB);
      await settle();
    });

    expect(callsOf("fetch_repost_state").length).toBeGreaterThan(0);
    expect(h.api.state.identity?.id).toBe(SOCIETY.id);
    expect(h.api.state.identity?.hasSimpleRepost).toBe(true);
    expect(h.api.state.body).toBe("Testo");
    expect(h.api.state.reference?.available).toBe(true);
  });

  it("l'identità perde can_repost: esce dalla lista, il testo resta (§38)", async () => {
    routeRpc({
      fetch_repost_state: () => ({
        data: {
          identities: [wireIdentity(PERSON.id, "person"), wireIdentity(SOCIETY.id, "society", { can_repost: false })],
          repostable: true,
        },
        error: null,
      }),
    });
    const h = mount(repostState({ body: "Testo" }));

    await act(async () => {
      h.api.actions.changeIdentity(CLUB);
      await settle();
    });

    expect(h.api.state.identities.map((identity) => identity.id)).toEqual([PERSON.id]);
    expect(h.api.state.body).toBe("Testo");
  });

  it("l'originale non è più ripostabile: la reference diventa non disponibile e il testo resta (§155, §231)", async () => {
    routeRpc({
      fetch_repost_state: () => ({
        data: { identities: [wireIdentity(PERSON.id, "person")], repostable: false },
        error: null,
      }),
    });
    const h = mount(repostState({ body: "Testo" }));

    await act(async () => {
      h.api.actions.changeIdentity(CLUB);
      await settle();
    });

    expect(h.api.state.reference?.available).toBe(false);
    expect(h.api.state.body).toBe("Testo");
  });

  it("un Post normale NON legge lo stato Repost", async () => {
    routeRpc();
    const h = mount(baseState({ body: "Ciao" }));

    await act(async () => {
      h.api.actions.changeIdentity(SOCIETY);
      await settle();
    });

    expect(callsOf("fetch_repost_state")).toHaveLength(0);
  });
});

describe("bozza orfana (§137, §338)", () => {
  const draftInfo = (status: "draft" | "scheduled") => ({
    baselineKey: null,
    initialPublication: null,
    operationKey: "dk-1",
    ref: { contentId: "d1", contentType: "profile_post" as const },
    status,
    version: 2,
  });

  it("bozza riaperta e svuotata: dopo il Simple Repost la bozza server viene eliminata", async () => {
    routeRpc({ delete_content_draft: () => ({ data: { status: "deleted" }, error: null }) });
    const h = mount(repostState({ draft: draftInfo("draft") }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("repost_content")).toHaveLength(1);
    expect(callsOf("delete_content_draft")).toHaveLength(1);
    expect(callsOf("delete_content_draft")[0][1]).toMatchObject({
      p_expected_version: 2,
      p_ref: { content_id: "d1", content_type: "profile_post" },
    });
    expect(h.onSimpleReposted).toHaveBeenCalledTimes(1);
  });

  it("se il Repost fallisce la bozza NON si elimina", async () => {
    routeRpc({
      delete_content_draft: () => ({ data: { status: "deleted" }, error: null }),
      repost_content: () => {
        throw new Error("Network request failed");
      },
    });
    const h = mount(repostState({ draft: draftInfo("draft") }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.onSimpleRepostFailed).toHaveBeenCalledWith("error");
    expect(callsOf("delete_content_draft")).toHaveLength(0);
  });

  it("un errore nell'eliminazione non rompe il Repost già fatto", async () => {
    routeRpc({
      delete_content_draft: () => {
        throw new Error("Network request failed");
      },
    });
    const h = mount(repostState({ draft: draftInfo("draft") }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(h.onSimpleRepostFailed).not.toHaveBeenCalled();
  });

  it("senza bozza server nessuna eliminazione", async () => {
    routeRpc();
    const h = mount(repostState());

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("delete_content_draft")).toHaveLength(0);
  });

  it("testo tolto dopo che la bozza era stata salvata: uscendo la bozza si elimina (§142)", async () => {
    routeRpc({ delete_content_draft: () => ({ data: { status: "deleted" }, error: null }) });
    const h = mount(repostState({ draft: draftInfo("draft") }));

    await act(async () => {
      h.api.actions.discard();
      await settle();
    });

    expect(callsOf("delete_content_draft")).toHaveLength(1);
    expect(callsOf("delete_content_draft")[0][1]).toMatchObject({ p_expected_version: 2 });
    // Una sola volta, anche se l'uscita passa da più punti (Annulla + beforeRemove).
    await act(async () => {
      h.api.actions.discard();
      await settle();
    });
    expect(callsOf("delete_content_draft")).toHaveLength(1);
  });

  it("un «@» solo conta come testo tolto: la bozza si elimina; con testo vero NO", async () => {
    routeRpc({ delete_content_draft: () => ({ data: { status: "deleted" }, error: null }) });
    const lone = mount(repostState({ body: "@", draft: draftInfo("draft") }));

    await act(async () => {
      lone.api.actions.discard();
      await settle();
    });
    expect(callsOf("delete_content_draft")).toHaveLength(1);

    mocks.rpc.mockClear();
    routeRpc({ delete_content_draft: () => ({ data: { status: "deleted" }, error: null }) });
    const typed = mount(repostState({ body: "Bravo", draft: draftInfo("draft") }));

    await act(async () => {
      typed.api.actions.discard();
      await settle();
    });
    expect(callsOf("delete_content_draft")).toHaveLength(0);
  });

  it("programmato riaperto con body vuoto: niente Simple Repost, il programmato resta intatto", async () => {
    routeRpc();
    const h = mount(repostState({ draft: draftInfo("scheduled") }));

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("repost_content")).toHaveLength(0);
    expect(callsOf("delete_content_draft")).toHaveLength(0);
    expect(h.onSimpleReposted).not.toHaveBeenCalled();
    expect(h.api.state.publish.status).toBe("idle");
  });
});

describe("«@» o link inseriti per sbaglio (revisione #3)", () => {
  it("un «@» da solo + Reposta = Simple Repost, non un Post che dice «@»", async () => {
    routeRpc();
    const h = mount(repostState());

    await act(async () => {
      h.api.actions.insertToken("@");
    });
    expect(h.api.state.body).toBe("@");

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("repost_content")).toHaveLength(1);
    expect(callsOf("submit_content")).toHaveLength(0);
  });
});

describe("Rimuovi repost → Reposta (revisione #4)", () => {
  it("finché la rimozione è in volo «Reposta» non parte", async () => {
    let resolveRemove!: (value: unknown) => void;
    routeRpc({ remove_repost: () => new Promise((resolve) => (resolveRemove = resolve)) });
    const h = mount(
      repostState({ identities: [{ ...ME, hasSimpleRepost: true }, CLUB], identity: { ...ME, hasSimpleRepost: true } }),
    );

    let removal!: Promise<void>;
    await act(async () => {
      removal = h.api.actions.removeSimpleRepost();
      await Promise.resolve();
    });

    // Dopo il flip ottimistico «Reposta» sarebbe azionabile: la CTA lo sa e il submit è rifiutato.
    expect(h.api.removingRepost).toBe(true);
    expect(h.api.state.identity?.hasSimpleRepost).toBe(false);

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("repost_content")).toHaveLength(0);
    expect(h.onSimpleReposted).not.toHaveBeenCalled();

    await act(async () => {
      resolveRemove({ data: { status: "removed" }, error: null });
      await removal;
    });

    expect(h.api.removingRepost).toBe(false);

    await act(async () => {
      await h.api.actions.submit();
    });

    expect(callsOf("repost_content")).toHaveLength(1);
  });
});

describe("toolbar ristretta (§17, §94, §96)", () => {
  it("«@» e link inseriscono il token alla selezione e attivano l'autocomplete", async () => {
    routeRpc();
    const h = mount(repostState({ body: "Bravo" }));

    await act(async () => {
      h.api.actions.setSelection({ end: 5, start: 5 });
    });
    await act(async () => {
      h.api.actions.insertToken("@");
    });

    expect(h.api.state.body).toBe("Bravo @");

    // Il cursore è dopo «@»: il link non si attacca alla mention, la separa con uno spazio.
    await act(async () => {
      h.api.actions.insertToken("https://");
    });

    expect(h.api.state.body).toBe("Bravo @ https://");
  });
});
