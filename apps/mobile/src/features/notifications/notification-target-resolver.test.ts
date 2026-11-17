import { describe, expect, it } from "vitest";

import { notificationUnavailableMessage, resolveNotificationTarget } from "./notification-target-resolver";
import type { NotificationTargetSource } from "./notification-types";

const PERSON_ACTOR = { available: true, avatarUrl: null, id: "p1", name: "Marco", type: "person", verified: false } as const;

function source(overrides: Partial<NotificationTargetSource> = {}): NotificationTargetSource {
  return { actor: PERSON_ACTOR, data: {}, target: null, type: "content_liked", ...overrides };
}

const route = (href: string) => ({ href, kind: "route" });

describe("target strutturato (§146–§156)", () => {
  it("Follow apre il profilo dell'attore (§148)", () => {
    expect(
      resolveNotificationTarget(
        source({ target: { id: "p1", params: {}, type: "profile" }, type: "new_follower" }),
      ),
    ).toEqual(route("/profile/p1"));
  });

  it("un attore Media apre ancora il profilo; una Società la sua pagina", () => {
    const media = { ...PERSON_ACTOR, type: "media" } as const;
    const society = { ...PERSON_ACTOR, id: "club-1", type: "society" } as const;
    const target = { id: "club-1", params: {}, type: "profile" } as const;

    expect(resolveNotificationTarget(source({ actor: media, target: { ...target, id: "p1" } }))).toEqual(
      route("/profile/p1"),
    );
    expect(resolveNotificationTarget(source({ actor: society, target }))).toEqual(route("/club/club-1"));
  });

  it("Mi piace e Simple Repost aprono il contenuto (§149, §153)", () => {
    expect(
      resolveNotificationTarget(
        source({ target: { id: "c1", params: { content_type: "profile_post" }, type: "content" } }),
      ),
    ).toEqual(route("/content/profile_post/c1?origin=NOTIFICATION"));
    expect(
      resolveNotificationTarget(
        source({
          target: { id: "c2", params: { content_type: "club_media", repost_id: "r1" }, type: "content" },
          type: "simple_reposted",
        }),
      ),
    ).toEqual(route("/content/club_media/c2?origin=NOTIFICATION"));
  });

  it("Post con testo apre il NUOVO post, non l'originale (§154, §67)", () => {
    expect(
      resolveNotificationTarget(
        source({
          target: {
            id: "new-post",
            params: {
              content_type: "profile_post",
              referenced_content_id: "original",
              referenced_content_type: "club_media",
            },
            type: "content",
          },
          type: "post_reposted_with_text",
        }),
      ),
    ).toEqual(route("/content/profile_post/new-post?origin=NOTIFICATION"));
  });

  it("Commento: dettaglio sulla sezione Commenti con il commento raggiungibile (§47, §150)", () => {
    expect(
      resolveNotificationTarget(
        source({
          target: {
            id: "cm1",
            params: { comment_id: "cm1", content_id: "c1", content_type: "profile_post", root_comment_id: "cm1" },
            type: "comment",
          },
          type: "content_commented",
        }),
      ),
    ).toEqual(route("/content/profile_post/c1?focus=comments&comment=cm1&root=cm1&origin=NOTIFICATION"));
  });

  it("Risposta: porta anche il commento principale del thread (§51, §151)", () => {
    expect(
      resolveNotificationTarget(
        source({
          target: {
            id: "reply1",
            params: {
              comment_id: "reply1",
              content_id: "c1",
              content_type: "media_profile",
              root_comment_id: "root1",
              reply_to_comment_id: "root1",
            },
            type: "comment",
          },
          type: "comment_replied",
        }),
      ),
    ).toEqual(route("/content/media_profile/c1?focus=comments&comment=reply1&root=root1&origin=NOTIFICATION"));
  });

  it("Menzione in un post apre il post che la contiene (§57, §152)", () => {
    expect(
      resolveNotificationTarget(
        source({
          target: { id: "c1", params: { content_type: "profile_post" }, type: "content" },
          type: "identity_mentioned",
        }),
      ),
    ).toEqual(route("/content/profile_post/c1?origin=NOTIFICATION"));
  });

  it("Programmato fallito apre Programmati; riuscito il contenuto (§87, §89, §155–§156)", () => {
    expect(
      resolveNotificationTarget(
        source({
          actor: null,
          target: { id: "c1", params: { content_type: "club_media" }, type: "scheduled_content" },
          type: "scheduled_content_failed",
        }),
      ),
    ).toEqual(route("/drafts?tab=scheduled"));
    expect(
      resolveNotificationTarget(
        source({
          actor: null,
          target: { id: "c1", params: { content_type: "club_media" }, type: "content" },
          type: "scheduled_content_published",
        }),
      ),
    ).toEqual(route("/content/club_media/c1?origin=NOTIFICATION"));
  });

  it("parametri mancanti o tipo sconosciuto: «unavailable», mai un href inventato (§157)", () => {
    expect(
      resolveNotificationTarget(source({ target: { id: "c1", params: {}, type: "content" } })),
    ).toEqual({ kind: "unavailable" });
    expect(
      resolveNotificationTarget(
        source({ target: { id: "c1", params: { content_type: "ghost" }, type: "content" } }),
      ),
    ).toEqual({ kind: "unavailable" });
    expect(
      resolveNotificationTarget(
        source({
          target: { id: "cm1", params: { content_type: "profile_post" }, type: "comment" },
          type: "content_commented",
        }),
      ),
    ).toEqual({ kind: "unavailable" });
  });

  it("la destinazione non dipende dal copy: il titolo non entra nella firma", () => {
    // Il resolver riceve solo tipo, payload, attore e target: nessun testo mostrato.
    const keys = Object.keys(source({ target: { id: "c1", params: { content_type: "profile_post" }, type: "content" } }));

    expect(keys).not.toContain("title");
    expect(keys).not.toContain("body");
  });
});

describe("tipi operativi esistenti (logica del Centro precedente)", () => {
  const operational = (type: string, data: Record<string, unknown>) =>
    resolveNotificationTarget({ actor: null, data, target: null, type });

  it("content_tag apre il contenuto taggato", () => {
    expect(operational("content_tag", { content_type: "fan_tribuna", post_id: "p9" })).toEqual(
      route("/content/fan_tribuna/p9?origin=NOTIFICATION"),
    );
    expect(operational("content_tag", {})).toEqual({ kind: "unavailable" });
  });

  it("rappresentanza: richiesta, esito, invito riconciliato, visibilità", () => {
    expect(operational("agent_representation_request", { representation_id: "r1" })).toEqual(
      route("/representation/r1"),
    );
    expect(operational("agent_representation_responded", { representation_id: "r1" })).toEqual(
      route("/representation/assistito/r1"),
    );
    expect(operational("agent_invite_reconciled", { representation_id: "r1" })).toEqual(
      route("/representation/assistito/r1"),
    );
    expect(operational("agent_representation_visibility_proposed", { representation_id: "r1" })).toEqual(
      route("/representation/manage/r1"),
    );
  });

  it("rappresentanza rimossa: si apre e basta, nessuna navigazione", () => {
    expect(operational("agent_representation_removed", { representation_id: "r1" })).toEqual({ kind: "none" });
  });

  it("candidature aprono la tab annunci", () => {
    expect(operational("application_received", {})).toEqual(route("/(tabs)/announcements"));
    expect(operational("application_status", {})).toEqual(route("/(tabs)/announcements"));
  });

  it("eventi di selezione: filtro Partecipanti, dettaglio, banner (DAS-REV-31 §25)", () => {
    expect(operational("selection_event_invitation_accepted", { club_id: "k1", event_id: "e1" })).toEqual(
      route("/(tabs)/dashboard/events/participants/e1?filter=confirmed&asSociety=k1"),
    );
    expect(operational("selection_event_updated", { event_id: "e1" })).toEqual(
      route("/(tabs)/dashboard/events/e1?updated=1"),
    );
    expect(operational("selection_event_cancelled", {})).toEqual({ kind: "unavailable" });
  });

  it("invito Società e richieste di ruolo portano il proprio id", () => {
    expect(operational("society_invitation_created", { invite_id: "i1" })).toEqual(route("/invitation/i1"));
    expect(operational("society_invitation_created", {})).toEqual({ kind: "unavailable" });
    expect(operational("role_request_created", {}).kind).toBe("unavailable");
    expect(operational("role_request_created", { request_id: "q1" }).kind).toBe("route");
    expect(operational("role_request_approved", { request_id: "q1" }).kind).toBe("route");
  });

  it("incarichi e terminazioni: lato giusto in base al tipo", () => {
    expect(operational("role_assignment_changed_by_person", { club_id: "k1", profile_id: "p1" }).kind).toBe("route");
    expect(operational("role_assignment_changed", { assignment_id: "a1" }).kind).toBe("route");
    expect(operational("role_assignment_changed", {})).toEqual({ kind: "unavailable" });
    expect(operational("role_link_ended", {}).kind).toBe("route");
    expect(operational("role_link_left", { club_id: "k1", profile_id: "p1" }).kind).toBe("route");
  });

  it("riga storica di follow senza target: usa il follower del payload", () => {
    expect(operational("new_follower", { follower_profile_id: "p5" })).toEqual(route("/profile/p5"));
    expect(operational("new_follower", {})).toEqual({ kind: "unavailable" });
  });

  it("tipo sconosciuto: si apre e basta", () => {
    expect(operational("qualcosa_di_nuovo", {})).toEqual({ kind: "none" });
  });
});

describe("copy del target non disponibile (HOM-15 §149–§150, §295)", () => {
  it("un follower senza id è un profilo, ogni altro target un contenuto", () => {
    expect(notificationUnavailableMessage({ actor: null, data: {}, target: null, type: "new_follower" })).toBe(
      "Profilo non disponibile",
    );
    expect(notificationUnavailableMessage({ actor: null, data: {}, target: null, type: "content_tag" })).toBe(
      "Contenuto non disponibile",
    );
    expect(
      notificationUnavailableMessage(
        source({ target: { id: "c1", params: {}, type: "content" }, type: "content_liked" }),
      ),
    ).toBe("Contenuto non disponibile");
  });
});
