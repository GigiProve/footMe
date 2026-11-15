/**
 * Il composer Repost è il composer Post con una reference (HOM-10 §16): questi test
 * provano ciò che cambia nello stato, nel payload e nelle regole, senza duplicare
 * quelli di HOM-06.1/06.2 (che devono restare verdi invariati).
 */

import { describe, expect, it, vi } from "vitest";

import {
  canPublish,
  composerCtaLabel,
  isDirty,
  isEmpty,
  toDraftContent,
  toDraftPayload,
  toWireUpdateArgs,
} from "./composer-presentation";
import { baseState, LIMITS, mention, PERSON, reduce, SOCIETY } from "./composer-fixtures";
import {
  composerReducer,
  createComposerState,
  createDraftState,
  createEditState,
  type ComposerState,
} from "./composer-reducer";
import {
  composerOriginForContent,
  parseComposerReference,
  repostComposerHref,
} from "./composer-routes";
import { composerStatus, exitDecision } from "./composer-status";
import type { ComposerDraftForEditor, ComposerPostForEdit, ComposerReference } from "./composer-types";
import { isRepostComposer } from "../repost/repost-composer-presentation";
import { mapDraftForEditor, mapPostForEdit } from "./composer-service";

// Il mapper di servizio importa il client Supabase, che non si carica nell'ambiente di test.
vi.mock("../../lib/supabase", () => ({ supabase: { functions: { invoke: vi.fn() }, rpc: vi.fn() } }));

const REFERENCE: ComposerReference = {
  available: true,
  contentId: "c-1",
  contentType: "club_media",
  preview: {
    authorMeta: null,
    authorName: "Matteo Rossi",
    durationSeconds: null,
    excerpt: "Grande vittoria oggi!",
    isVerified: true,
    kind: "post",
    showsPlay: false,
    thumbnailUrl: null,
    title: null,
  },
};

const ME = { ...PERSON, canPublishPost: true, hasSimpleRepost: false };
const CLUB = { ...SOCIETY, canPublishPost: true, hasSimpleRepost: false };

function repost(overrides: Partial<ComposerState> = {}): ComposerState {
  return baseState({ identities: [ME, CLUB], identity: ME, reference: REFERENCE, ...overrides });
}

describe("stato: la reference non è contenuto (§47, §137, §342)", () => {
  it("createComposerState senza reference resta un Post normale", () => {
    expect(baseState().reference).toBeNull();
    expect(isRepostComposer(baseState())).toBe(false);
  });

  it("con reference e body vuoto il composer è «vuoto»: Annulla chiude senza dialog (§137)", () => {
    const state = repost();

    expect(isRepostComposer(state)).toBe(true);
    expect(isEmpty(state)).toBe(true);
    expect(isDirty(state)).toBe(false);
    expect(exitDecision({ isDirty: isDirty(state), isPublishing: false })).toBe("leave");
  });

  it.each([["​​"], ["@"], ["@ https://"], ["  \n"]])(
    "body «%s» = vuoto per la UI: Annulla chiude senza dialog, come l'autosave non salva (QA #1, §137)",
    (body) => {
      expect(isDirty(repost({ body }))).toBe(false);
      expect(exitDecision({ isDirty: isDirty(repost({ body })), isPublishing: false })).toBe("leave");
    },
  );

  it("con del testo c'è lavoro da non perdere: Annulla chiede conferma (§138)", () => {
    const state = repost({ body: "Bravo" });

    expect(exitDecision({ isDirty: isDirty(state), isPublishing: false })).toBe("confirm");
  });

  it("cambiare identità conserva testo, mention e reference (§36)", () => {
    const state = repost({ body: "Ottimo @Luca", mentions: [mention("Luca", 7)] });
    const next = reduce(state, { identityId: CLUB.id, type: "identityChanged" });

    expect(next.identity?.id).toBe(CLUB.id);
    expect(next.body).toBe("Ottimo @Luca");
    expect(next.mentions).toHaveLength(1);
    expect(next.reference).toEqual(REFERENCE);
  });

  it("la reference è immutabile: referenceRefreshed aggiorna solo la STESSA (§47, §160)", () => {
    const state = repost();

    expect(reduce(state, { reference: { ...REFERENCE, available: false }, type: "referenceRefreshed" }).reference).toMatchObject({
      available: false,
    });
    expect(
      reduce(state, { reference: { ...REFERENCE, contentId: "altro" }, type: "referenceRefreshed" }).reference,
    ).toEqual(REFERENCE);
    expect(reduce(baseState(), { reference: REFERENCE, type: "referenceRefreshed" }).reference).toBeNull();
  });

  it("simpleRepostChanged cambia solo il flag dell'identità indicata, senza toccare il testo (§128–§130)", () => {
    const state = repost({ body: "Testo", identity: { ...ME, hasSimpleRepost: true }, identities: [{ ...ME, hasSimpleRepost: true }, CLUB] });
    const next = reduce(state, {
      identityId: ME.id,
      identityType: "person",
      type: "simpleRepostChanged",
      value: false,
    });

    expect(next.identity?.hasSimpleRepost).toBe(false);
    expect(next.identities.map((identity) => identity.hasSimpleRepost)).toEqual([false, false]);
    expect(next.body).toBe("Testo");
  });

  it("contextRefreshed: l'identità che perde can_repost esce dalla lista e blocca senza cancellare il testo (§38–§39)", () => {
    const state = repost({ body: "Il mio testo" });
    const next = composerReducer(state, {
      identities: [CLUB],
      limits: LIMITS,
      type: "contextRefreshed",
    });

    expect(next.identity?.id).toBe(ME.id);
    expect(next.body).toBe("Il mio testo");
    expect(canPublish(next)).toBe(false);
    expect(composerStatus(next, null)).toEqual({
      message: "Non hai più i permessi per effettuare il repost con questo profilo.",
      tone: "error",
    });
  });
});

describe("pubblicabilità e CTA (§61–§64, §126–§127, §146–§148)", () => {
  it("un Post normale vuoto non è pubblicabile; il Repost vuoto sì (Simple Repost)", () => {
    expect(canPublish(baseState())).toBe(false);
    expect(canPublish(repost())).toBe(true);
  });

  it("whitespace e invisibili nel Repost = vuoto: resta un Simple Repost, non un Post vuoto (§300)", () => {
    expect(canPublish(repost({ body: " \n​ " }))).toBe(true);
  });

  it("publishStarted passa dal body vuoto del Repost (fast path §21)", () => {
    const next = reduce(repost(), { type: "publishStarted" });

    expect(next.publish.status).toBe("publishing");
    // Il secondo tap non parte (§119).
    expect(reduce(next, { type: "publishStarted" })).toBe(next);
  });

  it("CTA: Reposta · Già ripostato · Programma, mai «Pubblica» (§15, §127, §148)", () => {
    expect(composerCtaLabel(repost())).toBe("Reposta");
    expect(composerCtaLabel(repost({ identity: { ...ME, hasSimpleRepost: true } }))).toBe("Già ripostato");
    expect(
      composerCtaLabel(
        repost({
          body: "Da vedere",
          publication: { mode: "scheduled", scheduledAt: "2030-08-30T16:30:00Z", timezone: "Europe/Rome" },
        }),
      ),
    ).toBe("Programma");
    expect(composerCtaLabel(baseState())).toBe("Pubblica");
  });

  it("originale non disponibile: la CTA è chiusa ma il testo resta (§155, §229–§231)", () => {
    const state = repost({ body: "Testo", reference: { ...REFERENCE, available: false } });

    expect(canPublish(state)).toBe(false);
    expect(composerStatus(state, null)).toEqual({
      message: "Il contenuto originale non è più disponibile.",
      tone: "error",
    });
    expect(state.body).toBe("Testo");
  });

  it("errore di invio non specifico: «Pubblicazione non riuscita. Riprova.» (§288)", () => {
    const failed = reduce(repost({ body: "Testo" }), { code: "network", type: "publishFailed" });

    expect(composerStatus(failed, null)).toEqual({ message: "Pubblicazione non riuscita. Riprova.", tone: "error" });
  });

  it("invio in corso: «Pubblicazione in corso…» (§283)", () => {
    expect(composerStatus(repost({ publish: { status: "publishing" } }), null)?.tone).toBe("progress");
  });
});

describe("payload (§88, §139, §235)", () => {
  it("Post con testo: `reference` nel contenuto e nella bozza, con solo tipo e id", () => {
    const state = repost({ body: "Bravo" });

    expect(toDraftContent(state).reference).toEqual({ content_id: "c-1", content_type: "club_media" });
    expect(toDraftPayload(state).reference).toEqual({ content_id: "c-1", content_type: "club_media" });
  });

  it("un Post normale non porta nessuna chiave `reference`", () => {
    expect("reference" in toDraftContent(baseState({ body: "Ciao" }))).toBe(false);
    expect("reference" in toDraftPayload(baseState({ body: "Ciao" }))).toBe(false);
  });

  it("il body viaggia senza lo snapshot dell'originale: l'originale non si copia (§89)", () => {
    const content = toDraftContent(repost({ body: "Bravo" }));

    expect(JSON.stringify(content)).not.toContain("Grande vittoria oggi!");
    expect(content.media).toEqual([]);
  });

  it("nessun media e nessun tag nel payload di un Repost (§18)", () => {
    const content = toDraftContent(repost({ body: "Bravo" }));

    expect(content.media).toEqual([]);
    expect(content.tagged).toEqual([]);
  });
});

describe("bozza e Modifica (§139–§142, §158–§162)", () => {
  const draft: ComposerDraftForEditor = {
    body: "Il mio commento",
    canEdit: true,
    failureCode: null,
    hadLinkWithoutPreview: false,
    identity: ME,
    link: null,
    media: [],
    mentions: [],
    publication: { mode: "now" },
    reference: REFERENCE,
    ref: { contentId: "d1", contentType: "club_media" },
    status: "draft",
    tagged: [],
    updatedAt: "2026-11-13T10:00:00Z",
    version: 3,
  };

  it("riaprire una bozza con reference è di nuovo un Repost, stessa riga (§140)", () => {
    const state = createDraftState({
      draft,
      identities: [ME, CLUB],
      limits: LIMITS,
      operationKey: "op",
      origin: "DRAFTS",
      schedule: { maxHorizonDays: 365, minLeadMinutes: 5 },
    });

    expect(isRepostComposer(state)).toBe(true);
    expect(state.reference).toEqual(REFERENCE);
    expect(state.draft.ref).toEqual({ contentId: "d1", contentType: "club_media" });
    expect(toDraftContent(state).reference).toEqual({ content_id: "c-1", content_type: "club_media" });
  });

  it("una bozza senza reference resta un Post normale", () => {
    const { reference, ...plain } = draft;
    void reference;
    const state = createDraftState({
      draft: plain,
      identities: [ME],
      limits: LIMITS,
      operationKey: "op",
      origin: "DRAFTS",
      schedule: { maxHorizonDays: 365, minLeadMinutes: 5 },
    });

    expect(state.reference).toBeNull();
    expect(isRepostComposer(state)).toBe(false);
  });

  const edit: ComposerPostForEdit = {
    author: ME,
    body: "Il mio commento",
    canEdit: true,
    contentId: "p-9",
    contentType: "profile_post",
    link: null,
    media: [],
    mentions: [],
    reference: REFERENCE,
    tagged: [],
    version: "2026-11-13T10:00:00Z",
  };

  it("Modifica di un Post con reference: card in sola lettura, NON è il composer Repost (§158–§162)", () => {
    const state = createEditState({ edit, limits: LIMITS, operationKey: "op" });

    expect(state.reference).toEqual(REFERENCE);
    expect(isRepostComposer(state)).toBe(false);
    expect(composerCtaLabel(state)).toBe("Salva");
  });

  it("in Modifica la reference non viaggia e non si sostituisce: update_post invia solo body, mention, tag, link (§160, §163)", () => {
    const state = createEditState({ edit, limits: LIMITS, operationKey: "op" });
    const args = toWireUpdateArgs({ ...state, body: "Testo cambiato" });

    expect(Object.keys(args).sort()).toEqual([
      "p_body",
      "p_content_type",
      "p_expected_version",
      "p_link",
      "p_mentions",
      "p_post_id",
      "p_tagged",
    ]);
    expect(reduce(state, { reference: { ...REFERENCE, contentId: "altro" }, type: "referenceRefreshed" }).reference).toEqual(
      REFERENCE,
    );
  });

  it("un Post modificato senza reference non ne guadagna una", () => {
    const { reference, ...plain } = edit;
    void reference;

    expect(createEditState({ edit: plain, limits: LIMITS, operationKey: "op" }).reference).toBeNull();
  });
});

describe("mapper di servizio (§139, §161)", () => {
  it("mapPostForEdit legge la reference solo se c'è", () => {
    const wire = {
      author: { avatar_url: null, context_label: "Profilo personale", identity_id: "p1", identity_type: "person", is_verified: false, name: "M" },
      body: "x",
      can_edit: true,
      content_id: "p-9",
      content_type: "profile_post",
      link: null,
      media: [],
      mentions: [],
      reference: { available: true, content_id: "c-1", content_type: "club_media", snapshot: { author_name: "Matteo", item_kind: "post" } },
      tagged: [],
      version: "v",
    } as const;

    expect(mapPostForEdit(wire as never).reference).toMatchObject({ available: true, contentId: "c-1" });
    expect("reference" in mapPostForEdit({ ...wire, reference: null } as never)).toBe(false);
    expect("reference" in mapPostForEdit({ ...wire, reference: undefined } as never)).toBe(false);
  });

  it("mapDraftForEditor legge la reference dal ramo post", () => {
    const wire = {
      capabilities: { can_delete: true, can_edit: true, can_schedule: true },
      content_id: "d1",
      content_type: "profile_post",
      failure_code: null,
      format: "post",
      identity: { avatar_url: null, context_label: "Profilo personale", identity_id: "p1", identity_type: "person", is_verified: false, name: "M" },
      post: {
        body: "ciao",
        link: null,
        media: [],
        mentions: [],
        reference: { available: false, content_id: "c-1", content_type: "club_media", snapshot: null },
        tagged: [],
      },
      publication: null,
      status: "draft",
      updated_at: "2026-11-13T10:00:00Z",
      version: 1,
    } as const;

    expect(mapDraftForEditor(wire as never)?.reference).toMatchObject({ available: false, contentId: "c-1" });
    expect(
      "reference" in (mapDraftForEditor({ ...wire, post: { ...wire.post, reference: undefined } } as never) ?? {}),
    ).toBe(false);
  });
});

describe("route (§14, §16, §243–§247)", () => {
  it("repostComposerHref apre lo STESSO composer con reference, origin e identità suggerita", () => {
    expect(
      repostComposerHref({ identityId: "me", origin: "HOME_SEGUITI", ref: { contentId: "c-1", contentType: "club_media" } }),
    ).toBe("/post-compose?mode=repost&refType=club_media&refId=c-1&origin=HOME_SEGUITI&identity=me");
    expect(repostComposerHref({ origin: "CONTENT_DETAIL", ref: { contentId: "c-1", contentType: "profile_post" } })).toBe(
      "/post-compose?mode=repost&refType=profile_post&refId=c-1&origin=CONTENT_DETAIL",
    );
  });

  it("parseComposerReference: solo i quattro tipi ripostabili e solo con mode=repost", () => {
    expect(parseComposerReference({ mode: "repost", refId: "c-1", refType: "club_media" })).toEqual({
      contentId: "c-1",
      contentType: "club_media",
    });
    expect(parseComposerReference({ mode: "repost", refId: "c-1", refType: ["media_profile", "x"] })).toEqual({
      contentId: "c-1",
      contentType: "media_profile",
    });
    expect(parseComposerReference({ refId: "c-1", refType: "club_media" })).toBeNull();
    expect(parseComposerReference({ mode: "repost", refType: "club_media" })).toBeNull();
    expect(parseComposerReference({ mode: "repost", refId: "c-1", refType: "fan_tribuna" })).toBeNull();
    expect(parseComposerReference({ mode: "repost", refId: "c-1", refType: "boh" })).toBeNull();
    expect(parseComposerReference({})).toBeNull();
  });

  it("l'origine della superficie diventa quella del composer, senza forzare Home → Per te (§247)", () => {
    expect(composerOriginForContent("HOME_SEGUITI")).toBe("HOME_SEGUITI");
    expect(composerOriginForContent("HOME_PER_TE")).toBe("HOME_PER_TE");
    expect(composerOriginForContent("PROFILE")).toBe("PERSONAL_PROFILE");
    expect(composerOriginForContent("SEARCH")).toBe("CONTENT_DETAIL");
    expect(composerOriginForContent("SAVED")).toBe("CONTENT_DETAIL");
    expect(composerOriginForContent(null)).toBe("CONTENT_DETAIL");
  });

  it("il composer normale non cambia: createComposerState senza reference", () => {
    const state = createComposerState({
      identities: [PERSON],
      identity: PERSON,
      limits: LIMITS,
      operationKey: "op",
      origin: "HOME_PER_TE",
    });

    expect(state.reference).toBeNull();
  });
});
