import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchComposerContext,
  fetchLinkPreview,
  fetchPostDraftForEditor,
  fetchPostForEdit,
  linkStateFromResult,
  mapComposerContext,
  mapDraftForEditor,
  mapPostForEdit,
  parseComposerError,
  publishPost,
  searchTagCandidates,
  updatePost,
} from "./composer-service";
import type {
  WireComposerContext,
  WireDraftPostEditor,
  WirePostForEdit,
  WirePublishPostArgs,
} from "./composer-types";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  supabase: { functions: { invoke: mocks.invoke }, rpc: mocks.rpc },
}));

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.invoke.mockReset();
});

const CONTEXT: WireComposerContext = {
  identities: [
    {
      avatar_url: null,
      context_label: "Profilo personale",
      identity_id: "p1",
      identity_type: "person",
      is_verified: true,
      name: "Matteo Rossi",
    },
  ],
  limits: { max_body_length: 5000, max_media: 10, max_mentions: 20, max_tags: 20, max_video_seconds: 600 },
};

describe("fetchComposerContext (§18, §61)", () => {
  it("mappa identity e limiti in camelCase", async () => {
    mocks.rpc.mockResolvedValue({ data: CONTEXT, error: null });

    const context = await fetchComposerContext();

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_post_composer_context");
    expect(context.identities[0]).toEqual({
      avatarUrl: null,
      // HOM-06.2: il server di HOM-06.1 non manda `can_schedule_content` → niente scheduling.
      canSchedule: false,
      contextLabel: "Profilo personale",
      id: "p1",
      isVerified: true,
      name: "Matteo Rossi",
      type: "person",
    });
    expect(context.limits).toEqual({
      maxBodyLength: 5000,
      maxMedia: 10,
      maxMentions: 20,
      maxTags: 20,
      maxVideoSeconds: 600,
    });
  });

  it("senza limiti non è un contesto", async () => {
    mocks.rpc.mockResolvedValue({ data: { identities: [] }, error: null });
    await expect(fetchComposerContext()).rejects.toThrow();
  });

  it("propaga l'errore della RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(fetchComposerContext()).rejects.toEqual({ message: "boom" });
  });

  it("mapComposerContext tollera identities mancanti", () => {
    expect(mapComposerContext({ ...CONTEXT, identities: undefined as never }).identities).toEqual([]);
  });
});

describe("HOM-06.2 — scheduling nel contesto e riapertura di una bozza", () => {
  it("can_schedule_content e schedule arrivano dal server; senza, default prudenti (§84–§85, §96)", () => {
    const context = mapComposerContext({
      ...CONTEXT,
      identities: [{ ...CONTEXT.identities[0], can_schedule_content: true }],
      schedule: { max_horizon_days: 90, min_lead_minutes: 15 },
    });

    expect(context.identities[0].canSchedule).toBe(true);
    expect(context.schedule).toEqual({ maxHorizonDays: 90, minLeadMinutes: 15 });
    expect(mapComposerContext(CONTEXT).identities[0].canSchedule).toBe(false);
    expect(mapComposerContext(CONTEXT).schedule).toEqual({ maxHorizonDays: 365, minLeadMinutes: 5 });
  });

  const draft: WireDraftPostEditor = {
    capabilities: { can_delete: true, can_edit: true, can_schedule: true },
    content_id: "d1",
    content_type: "profile_post",
    failure_code: null,
    format: "post",
    identity: { ...CONTEXT.identities[0] },
    post: {
      body: "Ciao",
      link: null,
      media: [
        {
          alt_text: null,
          duration_seconds: 12,
          height: 10,
          media_type: "video",
          position: 1,
          processing_state: "processing",
          storage_path: "u/posts/b",
          thumbnail_url: null,
          url: null,
          width: 10,
        },
        {
          alt_text: null,
          duration_seconds: null,
          height: 10,
          media_type: "image",
          position: 0,
          processing_state: "ready",
          storage_path: "u/posts/a",
          thumbnail_url: null,
          url: "https://cdn.test/a",
          width: 10,
        },
      ],
      mentions: [],
      tagged: [],
    },
    publication: { mode: "scheduled", scheduled_at: "2026-11-20T18:30:00Z", timezone: "Europe/Rome" },
    status: "draft",
    updated_at: "2026-11-13T10:00:00Z",
    version: 3,
  };

  it("i media di una bozza restano editabili e conservano il path (§112–§114)", () => {
    const mapped = mapDraftForEditor(draft, new Date("2026-11-13T12:00:00Z"));

    expect(mapped?.media.map((item) => [item.storagePath, item.uploadStatus, item.remoteMediaPosition])).toEqual([
      ["u/posts/a", "uploaded", null],
      ["u/posts/b", "uploaded", null],
    ]);
    expect(mapped?.media[1].processingState).toBe("processing");
    expect(mapped?.identity.canSchedule).toBe(true);
    expect(mapped?.publication).toEqual({
      mode: "scheduled",
      scheduledAt: "2026-11-20T18:30:00Z",
      timezone: "Europe/Rome",
    });
  });

  it("una data già passata riparte da Ora", () => {
    expect(mapDraftForEditor(draft, new Date("2026-12-01T00:00:00Z"))?.publication).toEqual({ mode: "now" });
  });

  it("un Articolo (o un ramo post vuoto) non è un Post da riaprire", () => {
    expect(mapDraftForEditor({ ...draft, format: "article" })).toBeNull();
    expect(mapDraftForEditor({ ...draft, post: null })).toBeNull();
  });

  it("fetchPostDraftForEditor: contenuto non Post → content_not_found", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...draft, post: null }, error: null });

    await expect(fetchPostDraftForEditor({ contentId: "d1", contentType: "profile_post" })).rejects.toMatchObject({
      parsed: { kind: "content_not_found" },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_content_for_editor", {
      p_content_id: "d1",
      p_content_type: "profile_post",
    });
  });
});

describe("publishPost (§117–118)", () => {
  const args: WirePublishPostArgs = {
    p_body: "Ciao",
    p_identity_id: "p1",
    p_identity_type: "person",
    p_link: null,
    p_media: [],
    p_mentions: [],
    p_operation_key: "key-1",
    p_origin: "HOME_PER_TE",
    p_tagged: [],
  };

  it("passa gli argomenti così come sono, chiave compresa", async () => {
    mocks.rpc.mockResolvedValue({
      data: { content_id: "c1", content_type: "profile_post", replayed: true },
      error: null,
    });

    await expect(publishPost(args)).resolves.toEqual({
      content_id: "c1",
      content_type: "profile_post",
      replayed: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("publish_post", args);
  });

  it("una risposta senza contenuto non è un successo (§177)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(publishPost(args)).rejects.toThrow();
  });

  it("l'errore resta intatto per parseComposerError", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "post_permission_denied" } });
    const error = await publishPost(args).catch((caught: unknown) => caught);
    expect(parseComposerError(error)).toBe("post_permission_denied");
  });
});

describe("parseComposerError (§169–177)", () => {
  it("riconosce il codice nel messaggio", () => {
    expect(parseComposerError({ message: "ERROR: post_media_limit" })).toBe("post_media_limit");
    expect(parseComposerError(new Error("post_version_conflict"))).toBe("post_version_conflict");
  });

  it("42501 senza codice dipende dal contesto", () => {
    expect(parseComposerError({ code: "42501", message: "denied" })).toBe("post_permission_denied");
    expect(parseComposerError({ code: "42501", message: "denied" }, "edit")).toBe("post_edit_denied");
  });

  it("40001 e P0002", () => {
    expect(parseComposerError({ code: "40001", message: "x" })).toBe("post_version_conflict");
    expect(parseComposerError({ code: "P0002", message: "x" })).toBe("post_not_found");
  });

  it("errori di trasporto → network, il resto → unknown", () => {
    expect(parseComposerError(new TypeError("Network request failed"))).toBe("network");
    expect(parseComposerError({ message: "Failed to fetch" })).toBe("network");
    expect(parseComposerError({ message: "qualcosa di strano" })).toBe("unknown");
    expect(parseComposerError(null)).toBe("unknown");
  });
});

describe("fetchPostForEdit / updatePost (§146, §155–161)", () => {
  const wire: WirePostForEdit = {
    author: CONTEXT.identities[0],
    body: "Testo",
    can_edit: true,
    content_id: "c1",
    content_type: "profile_post",
    link: {
      description: "d",
      domain: "a.com",
      has_preview: true,
      image_url: null,
      snapshot_id: "s1",
      title: "T",
      url: "https://A.com/",
    },
    media: [
      { duration_seconds: null, height: 1, media_type: "image", position: 1, thumbnail_url: null, url: "u1", width: 1 },
      { duration_seconds: 24, height: 2, media_type: "video", position: 0, thumbnail_url: "t0", url: "u0", width: 2 },
    ],
    mentions: [{ display_name: "Marco", end: 6, identity_id: "m1", identity_type: "profile", start: 0 }],
    tagged: [
      { avatar_url: null, display_name: "AC Como", is_verified: true, subtitle: "Serie B", target_id: "c9", target_type: "club" },
    ],
    version: "v1",
  };

  it("mappa a dominio: media ordinati e di sola lettura, link normalizzato", async () => {
    mocks.rpc.mockResolvedValue({ data: wire, error: null });

    const post = await fetchPostForEdit("profile_post", "c1");

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_post_for_edit", { p_content_type: "profile_post", p_post_id: "c1" });
    expect(post.media.map((item) => item.remoteMediaPosition)).toEqual([0, 1]);
    expect(post.media.every((item) => item.uploadStatus === "uploaded" && item.localUri === null)).toBe(true);
    expect(post.media[0]).toMatchObject({ durationSeconds: 24, type: "video", thumbnailUri: "t0" });
    expect(post.link).toMatchObject({ snapshotId: "s1", status: "ready", url: "https://a.com" });
    expect(post.mentions[0]).toEqual({ displayName: "Marco", end: 6, identityId: "m1", identityType: "profile", start: 0 });
    expect(post.tagged[0]).toMatchObject({ identityId: "c9", identityType: "club", subtitle: "Serie B" });
    expect(post.version).toBe("v1");
  });

  it("un link senza anteprima salvata (has_preview false) non diventa una preview", () => {
    expect(mapPostForEdit({ ...wire, link: { ...wire.link!, has_preview: false, snapshot_id: null } }).link).toBeNull();
    expect(mapPostForEdit({ ...wire, link: { ...wire.link!, has_preview: false } }).link).toBeNull();
  });

  it("un'anteprima salvata senza snapshot_id resta pronta: il server la conserva", () => {
    expect(mapPostForEdit({ ...wire, link: { ...wire.link!, snapshot_id: null } }).link).toMatchObject({
      snapshotId: null,
      status: "ready",
    });
  });

  it("updatePost passa la versione attesa e ritorna la nuova", async () => {
    mocks.rpc.mockResolvedValue({ data: { content_id: "c1", content_type: "profile_post", version: "v2" }, error: null });

    const args = {
      p_body: "x",
      p_content_type: "profile_post" as const,
      p_expected_version: "v1",
      p_link: null,
      p_mentions: [],
      p_post_id: "c1",
      p_tagged: [],
    };

    await expect(updatePost(args)).resolves.toMatchObject({ version: "v2" });
    expect(mocks.rpc).toHaveBeenCalledWith("update_post", args);
  });
});

describe("fetchLinkPreview (§75–91)", () => {
  it("chiama la Edge Function con il solo URL", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        description: "d",
        domain: "a.com",
        favicon_url: null,
        final_url: "https://a.com/x",
        image_url: "i",
        original_url: "https://a.com",
        site_name: null,
        snapshot_id: "s1",
        status: "ok",
        title: "T",
      },
      error: null,
    });

    const state = await fetchLinkPreview("https://a.com");

    expect(mocks.invoke).toHaveBeenCalledWith("link-preview", { body: { url: "https://a.com" } });
    expect(state).toMatchObject({ finalUrl: "https://a.com/x", snapshotId: "s1", status: "ready", url: "https://a.com" });
  });

  it("non lancia mai: errore o eccezione diventano un fallimento ritentabile (§89, §91)", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: { message: "500" } });
    await expect(fetchLinkPreview("https://a.com")).resolves.toMatchObject({ retryable: true, status: "failed" });

    mocks.invoke.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchLinkPreview("https://a.com")).resolves.toMatchObject({ retryable: true, status: "failed" });
  });

  it("unavailable è ritentabile, blocked e invalid no", () => {
    expect(linkStateFromResult("u", { domain: "a.com", original_url: "u", status: "unavailable" })).toMatchObject({
      retryable: true,
    });
    expect(linkStateFromResult("u", { domain: null, original_url: "u", status: "blocked" })).toMatchObject({
      domain: null,
      retryable: false,
    });
    expect(linkStateFromResult("u", { domain: null, original_url: "u", status: "invalid" })).toMatchObject({
      retryable: false,
    });
  });
});

describe("searchTagCandidates (§99–104, §101)", () => {
  it("riusa search_tag_targets e tiene solo profili e Società", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { avatar_url: null, display_name: "Marco Bianchi", role_label: "player", subtitle: "Como", target_id: "p1", target_type: "profile" },
        { avatar_url: "l", display_name: "AC Como", role_label: "", subtitle: "Serie B", target_id: "c1", target_type: "club" },
        { avatar_url: null, display_name: "Primavera", role_label: "", subtitle: "AC Como", target_id: "t1", target_type: "team" },
      ],
      error: null,
    });

    const results = await searchTagCandidates("com");

    expect(mocks.rpc).toHaveBeenCalledWith("search_tag_targets", { p_limit: 20, p_query: "com" });
    expect(results).toEqual([
      { avatarUrl: null, displayName: "Marco Bianchi", identityId: "p1", identityType: "profile", isVerified: false, subtitle: "Calciatore · Como" },
      { avatarUrl: "l", displayName: "AC Como", identityId: "c1", identityType: "club", isVerified: false, subtitle: "Serie B" },
    ]);
  });

  it("sotto i due caratteri non interroga il server", async () => {
    await expect(searchTagCandidates("a")).resolves.toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
