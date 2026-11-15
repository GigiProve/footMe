/**
 * La matrice del menu ••• HOM-11: Non mi interessa, Non seguire, Segnala secondo origin,
 * capability, stato Follow, ownership e già segnalato (HOM-11 §1–§13, §19–§27, §54–§57,
 * §126–§131, D2, D4–D6, §229–§236, §246–§247, §284–§285).
 */
import { describe, expect, it } from "vitest";

import {
  FEEDBACK_ACTION_IDS,
  buildFeedbackInput,
  buildViewerFeedbackActions,
  canOfferNotInterested,
  canOfferUnfollow,
  reportActionKind,
  type ContentFeedbackInput,
} from "./content-feedback-actions";
import { makeArticleItem, makePostItem } from "./components/feed-test-helpers";
import type {
  FeedContentItem,
  FeedPostCapabilities,
  FeedPostItem,
  FeedRepostContext,
} from "./feed-types";

const BASE: ContentFeedbackInput = {
  canReport: true,
  contentId: "p1",
  contentType: "club_media",
  hasReported: false,
  isManaged: false,
  origin: "HOME_PER_TE",
  reposter: null,
  serverCanMarkNotInterested: true,
  surface: "feed",
  unfollowSource: { id: "p-9", kind: "profile", name: "Marco Bianchi" },
};

function ids(input: Partial<ContentFeedbackInput> = {}) {
  return buildViewerFeedbackActions({ ...BASE, ...input }).map((action) => action.id);
}

describe("ordine e composizione — §11, Screen 1", () => {
  it("contenuto di terzi, Per te, autore seguito: Non mi interessa, Non seguire, divisore, Segnala", () => {
    const actions = buildViewerFeedbackActions(BASE);

    expect(actions.map((action) => action.id)).toEqual([
      FEEDBACK_ACTION_IDS.notInterested,
      FEEDBACK_ACTION_IDS.unfollow,
      FEEDBACK_ACTION_IDS.report,
    ]);
    expect(actions.map((action) => action.dividerBefore ?? false)).toEqual([false, false, true]);
  });

  it("§57: «Non seguire Marco Bianchi» con il nome della fonte", () => {
    const [, unfollow] = buildViewerFeedbackActions(BASE);

    expect(unfollow.label).toBe("Non seguire Marco Bianchi");
  });

  it("Segnala è l'unica azione distruttiva (rosso con la bandierina), e dice cosa apre (§201, §214)", () => {
    const actions = buildViewerFeedbackActions(BASE);
    const report = actions.find((action) => action.id === FEEDBACK_ACTION_IDS.report);

    expect(report).toMatchObject({
      accessibilityHint: "Apre la segnalazione",
      destructive: true,
      icon: "flag-outline",
      label: "Segnala",
    });
    expect(actions.filter((action) => action.destructive)).toHaveLength(1);
  });

  it("§198: «Non mi interessa» annuncia che nasconde e mostra meno contenuti simili", () => {
    const [notInterested] = buildViewerFeedbackActions(BASE);

    expect(notInterested.accessibilityHint).toBe("Nascondi questo contenuto e mostra meno contenuti simili");
  });
});

describe("Non mi interessa — §19–§27, D2, §233–§236", () => {
  it("Feed: serve la capability del server E un'origin con recommendation (Per te)", () => {
    expect(canOfferNotInterested(BASE)).toBe(true);
    expect(canOfferNotInterested({ ...BASE, serverCanMarkNotInterested: false })).toBe(false);
  });

  it.each(["HOME_SEGUITI", "PROFILE", "SEARCH", "SAVED", "MESSAGE", "DEEP_LINK"] as const)(
    "origin %s: mai, anche se il server dicesse sì (§23–§26)",
    (origin) => {
      expect(canOfferNotInterested({ ...BASE, origin })).toBe(false);
    },
  );

  it("nessuna origin: nessun segnale da dare", () => {
    expect(canOfferNotInterested({ ...BASE, origin: null })).toBe(false);
  });

  it("dettaglio: decide l'origin Per te (§27), non la capability della lista", () => {
    const detail = { ...BASE, serverCanMarkNotInterested: false, surface: "detail" as const };

    expect(canOfferNotInterested({ ...detail, origin: "HOME_PER_TE" })).toBe(true);
    expect(canOfferNotInterested({ ...detail, origin: "PROFILE" })).toBe(false);
    expect(canOfferNotInterested({ ...detail, origin: "SAVED" })).toBe(false);
  });

  it("dettaglio: serve anche can_report (= non gestito dal viewer), il server non emette can_mark_not_interested", () => {
    const detail = { ...BASE, serverCanMarkNotInterested: false, surface: "detail" as const };

    expect(canOfferNotInterested({ ...detail, canReport: false })).toBe(false);
    expect(canOfferNotInterested({ ...detail, canReport: true })).toBe(true);
  });

  it("mai sul contenuto gestito (D5)", () => {
    expect(canOfferNotInterested({ ...BASE, isManaged: true })).toBe(false);
  });
});

describe("Non seguire — §54–§56, §246–§247", () => {
  it("compare solo se c'è una fonte realmente seguita", () => {
    expect(canOfferUnfollow(BASE)).toBe(true);
    expect(canOfferUnfollow({ ...BASE, unfollowSource: null })).toBe(false);
  });

  it("non seguito: la voce non c'è e MAI «Segui» al suo posto (§56)", () => {
    const actions = buildViewerFeedbackActions({ ...BASE, unfollowSource: null });

    expect(actions.map((action) => action.id)).not.toContain(FEEDBACK_ACTION_IDS.unfollow);
    expect(actions.some((action) => /segui/i.test(action.label))).toBe(false);
  });

  it("mai sul contenuto gestito (D5)", () => {
    expect(canOfferUnfollow({ ...BASE, isManaged: true })).toBe(false);
  });
});

describe("Segnala e già segnalato — §126–§131, D6, §276–§277", () => {
  it("segnalabile → «Segnala»", () => {
    expect(reportActionKind(BASE)).toBe("report");
  });

  it("già segnalato → riga non azionabile «Segnalazione inviata ✓» al posto di Segnala", () => {
    const actions = buildViewerFeedbackActions({ ...BASE, hasReported: true });
    const sent = actions.find((action) => action.id === FEEDBACK_ACTION_IDS.reported);

    expect(reportActionKind({ ...BASE, hasReported: true })).toBe("reported");
    expect(actions.map((action) => action.id)).not.toContain(FEEDBACK_ACTION_IDS.report);
    expect(sent).toMatchObject({
      accessibilityLabel: "Segnalazione inviata",
      disabled: true,
      label: "Segnalazione inviata ✓",
    });
  });

  it("il server nega la segnalazione (proprio, gestito): nessuna voce", () => {
    expect(reportActionKind({ ...BASE, canReport: false })).toBeNull();
  });

  it("mai sul contenuto gestito, nemmeno già segnalato (D5)", () => {
    expect(reportActionKind({ ...BASE, hasReported: true, isManaged: true })).toBeNull();
    expect(reportActionKind({ ...BASE, isManaged: true })).toBeNull();
  });
});

describe("proprio o gestito — D5, §4–§7, §230–§231", () => {
  it("con azioni di gestione HOM-04 non compare nessuna delle tre", () => {
    expect(ids({ isManaged: true })).toEqual([]);
  });
});

describe("buildFeedbackInput dall'elemento — §5, §54, §145, §147", () => {
  const options = {
    isManaged: false,
    origin: "HOME_PER_TE" as const,
    reportedInSession: false,
    surface: "feed" as const,
    unfollowedInSession: false,
  };

  function post(
    overrides: Partial<FeedPostItem> = {},
    capabilities: Partial<FeedPostCapabilities> = {},
  ): FeedContentItem {
    const base = makePostItem(overrides);
    return {
      ...base,
      payload: { ...base.payload, capabilities: { ...base.payload.capabilities, ...capabilities } },
    } as FeedContentItem;
  }

  it("autore seguito: la fonte è l'autore con il suo tipo e nome", () => {
    const input = buildFeedbackInput(post({ isFollowingAuthor: true }), options);

    expect(input.unfollowSource).toEqual({ id: "club-1", kind: "club", name: "Como 1907" });
  });

  it("autore non seguito: nessuna fonte", () => {
    expect(buildFeedbackInput(post({ isFollowingAuthor: false }), options).unfollowSource).toBeNull();
  });

  it("fonte appena lasciata in sessione: non si offre di nuovo (§62)", () => {
    const input = buildFeedbackInput(post({ isFollowingAuthor: true }), { ...options, unfollowedInSession: true });

    expect(input.unfollowSource).toBeNull();
  });

  const REPOST: FeedRepostContext = {
    additionalCount: 0,
    reposter: {
      avatarUrl: null,
      identityId: "p-9",
      identityType: "person",
      isVerified: false,
      name: "Marco Bianchi",
    },
  };

  it("Simple Repost: Non seguire si riferisce al reposter, seguito per costruzione (§145, D4, §284)", () => {
    // L'autore dell'originale NON è seguito: conta il reposter.
    const input = buildFeedbackInput(post({ isFollowingAuthor: false, repost: REPOST }), options);

    expect(input.unfollowSource).toEqual({ id: "p-9", kind: "profile", name: "Marco Bianchi" });
  });

  it("Simple Repost: il segnale «Non mi interessa» porta il reposter, il target resta l'originale (§39, §146)", () => {
    const input = buildFeedbackInput(post({ repost: REPOST }), options);

    expect(input.reposter).toEqual({ identityId: "p-9", identityType: "person" });
    expect(input.contentId).toBe("p1");
    expect(input.contentType).toBe("club_media");
  });

  it("Post HOM-10 con testo e reference è un Post autonomo: nessun reposter, target il Post stesso (§147–§149)", () => {
    const base = post({ isFollowingAuthor: true });
    const withReference = {
      ...base,
      payload: {
        ...base.payload,
        reference: { available: true, contentId: "orig-1", contentType: "club_media", snapshot: {} },
      },
    } as FeedContentItem;

    const input = buildFeedbackInput(withReference, options);

    expect(input.reposter).toBeNull();
    expect(input.contentId).toBe("p1");
  });

  it("le capability vengono dal server, non dall'autore (§5)", () => {
    const denied = buildFeedbackInput(post({}, { canMarkNotInterested: false, canReport: false }), options);
    const allowed = buildFeedbackInput(post({}, { canMarkNotInterested: true, canReport: true }), options);

    expect(denied).toMatchObject({ canReport: false, serverCanMarkNotInterested: false });
    expect(allowed).toMatchObject({ canReport: true, serverCanMarkNotInterested: true });
  });

  it("delegato Società (D5): niente capability HOM-04 ma `can_report` falso → gestito, nessuna voce HOM-11, nemmeno Non seguire", () => {
    const delegated = post(
      { isFollowingAuthor: true },
      { canEdit: false, canDelete: false, canViewInsights: false, canMarkNotInterested: false, canReport: false },
    );
    // `isManaged` del menu (capability HOM-04) è falso: decide `can_report`.
    const input = buildFeedbackInput(delegated, options);

    expect(input.isManaged).toBe(true);
    expect(buildViewerFeedbackActions(input)).toEqual([]);
  });

  it("`can_report` vero e nessuna gestione: il menu dei terzi resta intero", () => {
    const input = buildFeedbackInput(post({ isFollowingAuthor: true }, { canMarkNotInterested: true }), options);

    expect(input.isManaged).toBe(false);
    expect(buildViewerFeedbackActions(input).map((action) => action.id)).toEqual([
      FEEDBACK_ACTION_IDS.notInterested,
      FEEDBACK_ACTION_IDS.unfollow,
      FEEDBACK_ACTION_IDS.report,
    ]);
  });

  it("già segnalato dal payload o dalla sessione", () => {
    expect(buildFeedbackInput(post({ viewerHasReported: true }), options).hasReported).toBe(true);
    expect(buildFeedbackInput(post(), { ...options, reportedInSession: true }).hasReported).toBe(true);
    expect(buildFeedbackInput(post(), options).hasReported).toBe(false);
  });

  it("Articolo e video editoriale usano lo stesso engine (§141–§142)", () => {
    const article = makeArticleItem({ isFollowingAuthor: true });
    const input = buildFeedbackInput(article, options);

    expect(input.contentType).toBe("media_profile");
    expect(input.canReport).toBe(true);
    expect(input.unfollowSource).toMatchObject({ id: "club-1" });
  });

  it("senza capability HOM-11 dal server (server vecchio) non compare nulla di nuovo", () => {
    const input = buildFeedbackInput(
      post({}, { canMarkNotInterested: undefined, canReport: false }),
      options,
    );

    expect(buildViewerFeedbackActions(input).map((action) => action.id)).toEqual([]);
  });
});
