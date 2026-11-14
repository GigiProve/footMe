import { describe, expect, it } from "vitest";

import {
  canFollowActor,
  classifyLikesError,
  followAccessibilityLabel,
  likeActorAccessibilityLabel,
  likeActorFollowType,
  likeActorHref,
  likeActorMetaLine,
  keepLikerOrder,
  mergeLikerPages,
  patchLikerFollowing,
  type LikesData,
} from "./likes-presentation";
import type { LikeActor } from "./likes-types";

function actor(overrides: Partial<LikeActor> = {}): LikeActor {
  const base: LikeActor = {
    actorId: "p-1",
    actorType: "person",
    avatarUrl: null,
    clubCategory: null,
    clubName: null,
    isFollowing: false,
    isSelf: false,
    isVerified: false,
    key: "person:p-1",
    mediaKind: null,
    name: "Marco Bianchi",
    primaryPosition: null,
    role: null,
    teamLabel: null,
  };
  return { ...base, ...overrides, key: `${overrides.actorType ?? base.actorType}:${overrides.actorId ?? base.actorId}` };
}

describe("likeActorMetaLine — HOM-07 §48–§52", () => {
  it("PERSON: ruolo · Società, sintetico", () => {
    expect(
      likeActorMetaLine(actor({ clubName: "AC Como", role: "coach" })),
    ).toBe("Allenatore · AC Como");
  });

  it("PERSON calciatore: la posizione al posto del ruolo generico", () => {
    expect(
      likeActorMetaLine(actor({ clubName: "AC Como", primaryPosition: "striker", role: "player" })),
    ).toBe("Attaccante · AC Como");
  });

  it("§51: il ruolo agent si legge «Procuratore», mai «Agente»", () => {
    const line = likeActorMetaLine(actor({ role: "agent" }));

    expect(line).toBe("Procuratore");
    expect(line).not.toMatch(/agente/i);
  });

  it("SOCIETY: «Società · categoria»", () => {
    expect(
      likeActorMetaLine(actor({ actorId: "c-1", actorType: "society", clubCategory: "Serie D" })),
    ).toBe("Società · Serie D");
    expect(likeActorMetaLine(actor({ actorId: "c-1", actorType: "society" }))).toBe("Società");
  });

  it("MEDIA: «Media · tipologia»", () => {
    expect(
      likeActorMetaLine(actor({ actorId: "m-1", actorType: "media", mediaKind: "testata" })),
    ).toBe("Media · Testata sportiva");
    expect(likeActorMetaLine(actor({ actorId: "m-1", actorType: "media" }))).toBe("Media");
  });

  it("nessuna città, regione, follower o storico nella riga (§52): solo le parti sintetiche", () => {
    const line = likeActorMetaLine(actor({ clubName: "AC Como", role: "coach", teamLabel: "Primavera" }));

    expect(line.split(" · ")).toHaveLength(2);
  });
});

describe("accessibilità e navigazione", () => {
  it("la riga è un'unità: nome, verifica, metadata (§179)", () => {
    expect(
      likeActorAccessibilityLabel(actor({ clubName: "AC Como", isVerified: true, role: "coach" })),
    ).toBe("Marco Bianchi, profilo verificato, Allenatore · AC Como");
  });

  it("stato e azione del Follow nell'etichetta (§180)", () => {
    expect(followAccessibilityLabel(actor(), false)).toBe("Segui Marco Bianchi");
    expect(followAccessibilityLabel(actor(), true)).toBe("Smetti di seguire Marco Bianchi");
  });

  it("apre profilo o Società per id (§53)", () => {
    expect(likeActorHref(actor())).toBe("/profile/p-1");
    expect(likeActorHref(actor({ actorId: "m-1", actorType: "media" }))).toBe("/profile/m-1");
    expect(likeActorHref(actor({ actorId: "c-1", actorType: "society" }))).toBe("/club/c-1");
  });
});

describe("Follow dalla lista — §55–§57", () => {
  it("Società su club_follows, persone e Media su profile_follows", () => {
    expect(likeActorFollowType(actor({ actorId: "c-1", actorType: "society" }))).toBe("club");
    expect(likeActorFollowType(actor())).toBe("media_profile");
    expect(likeActorFollowType(actor({ actorId: "m-1", actorType: "media" }))).toBe("media_profile");
  });

  it("nessuna CTA per l'identità del viewer", () => {
    expect(canFollowActor(actor({ isSelf: true }))).toBe(false);
    expect(canFollowActor(actor())).toBe(true);
  });

  it("la patch tocca un solo attore e lascia identico il resto", () => {
    const other = actor({ actorId: "p-2" });
    const data: LikesData = {
      pageParams: [null],
      pages: [{ items: [actor(), other], nextCursor: null }],
    };

    const patched = patchLikerFollowing(data, "person:p-1", true);

    expect(patched?.pages[0].items[0].isFollowing).toBe(true);
    expect(patched?.pages[0].items[1]).toBe(other);
    expect(patchLikerFollowing(undefined, "person:p-1", true)).toBeUndefined();
  });
});

describe("keepLikerOrder — §54", () => {
  const actor = (key: string) => ({ key }) as LikeActor;

  it("al rientro le righe viste restano al loro posto; nuove in coda; sparite fuori", () => {
    const refetched = [actor("c"), actor("a"), actor("d")];
    expect(keepLikerOrder(["a", "b", "c"], refetched).map((entry) => entry.key)).toEqual(["a", "c", "d"]);
  });

  it("la prima lettura usa l'ordine del server", () => {
    expect(keepLikerOrder([], [actor("b"), actor("a")]).map((entry) => entry.key)).toEqual(["b", "a"]);
  });
});

describe("mergeLikerPages — §60, §229", () => {
  it("unisce le pagine senza duplicati, ordine del server", () => {
    const a = actor({ actorId: "p-1" });
    const b = actor({ actorId: "p-2" });
    const c = actor({ actorId: "p-3" });

    expect(
      mergeLikerPages([{ items: [a, b] }, { items: [b, c] }]).map((entry) => entry.actorId),
    ).toEqual(["p-1", "p-2", "p-3"]);
  });

  it("lo stesso id con tipo diverso sono due identità", () => {
    const person = actor({ actorId: "x-1", actorType: "person" });
    const society = actor({ actorId: "x-1", actorType: "society" });

    expect(mergeLikerPages([{ items: [person, society] }])).toHaveLength(2);
  });
});

describe("classifyLikesError — §62, §67", () => {
  it("contenuto non più leggibile: risposta definitiva", () => {
    expect(classifyLikesError({ message: "content_unavailable" })).toBe("unavailable");
    expect(classifyLikesError({ code: "42501", message: "denied" })).toBe("unavailable");
  });

  it("rete e simili: temporaneo, ammette Riprova", () => {
    expect(classifyLikesError(new Error("Network request failed"))).toBe("error");
    expect(classifyLikesError(undefined)).toBe("error");
  });
});
