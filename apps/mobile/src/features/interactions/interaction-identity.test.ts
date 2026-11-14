import { describe, expect, it } from "vitest";

import {
  isLikedBy,
  isLikedForDisplay,
  nextLikeSnapshot,
  parseLikedAs,
  resolveInteractionIdentity,
  sameLikeSnapshot,
  withLikeIdentity,
} from "./interaction-identity";
import type { InteractionIdentity } from "./interaction-types";

function identity(
  type: InteractionIdentity["type"],
  id: string,
  rank: number,
): InteractionIdentity {
  return { avatarUrl: null, id, isVerified: false, name: id, rank, type };
}

const PERSON = identity("person", "p-1", 0);
const SOCIETY = identity("society", "c-1", 1);
const MEDIA = identity("media", "m-1", 2);

describe("resolveInteractionIdentity — HOM-07 §11", () => {
  it("l'ultima identità usata in Dashboard, se autorizzata", () => {
    expect(resolveInteractionIdentity([PERSON, SOCIETY], "c-1")).toBe(SOCIETY);
  });

  it("una preferenza non più autorizzata non prova nulla: ricade sulla personale", () => {
    expect(resolveInteractionIdentity([PERSON, SOCIETY], "club-revocato")).toBe(PERSON);
  });

  it("senza preferenza vale l'identità personale, person o media", () => {
    expect(resolveInteractionIdentity([SOCIETY, PERSON], null)).toBe(PERSON);
    expect(resolveInteractionIdentity([SOCIETY, MEDIA], undefined)).toBe(MEDIA);
  });

  it("senza identità personale vale la prima", () => {
    expect(resolveInteractionIdentity([SOCIETY], null)).toBe(SOCIETY);
  });

  it("nessuna identità: null", () => {
    expect(resolveInteractionIdentity([], "p-1")).toBeNull();
  });
});

describe("parseLikedAs", () => {
  it("tiene solo le voci valide e collassa i doppioni", () => {
    expect(
      parseLikedAs([
        { id: "p-1", type: "person" },
        { id: "p-1", type: "person" },
        { id: "c-1", type: "society" },
        { id: "", type: "media" },
        { id: "x", type: "robot" },
        null,
        "p-2",
      ]),
    ).toEqual([
      { id: "p-1", type: "person" },
      { id: "c-1", type: "society" },
    ]);
  });

  it("un valore che non è un array è nessuna identità", () => {
    expect(parseLikedAs(undefined)).toEqual([]);
    expect(parseLikedAs({ id: "p-1", type: "person" })).toEqual([]);
  });
});

describe("isLikedBy", () => {
  const likedAs = [{ id: "c-1", type: "society" as const }];

  it("conta solo l'identità corrente (§10)", () => {
    expect(isLikedBy(likedAs, SOCIETY)).toBe(true);
    expect(isLikedBy(likedAs, PERSON)).toBe(false);
  });

  it("stesso id con tipo diverso non è la stessa identità", () => {
    expect(isLikedBy(likedAs, { id: "c-1", type: "person" })).toBe(false);
  });

  it("identità non ancora risolta: vale «il viewer ha messo Mi piace» (is_liked)", () => {
    expect(isLikedBy(likedAs, null)).toBe(true);
    expect(isLikedBy([], null)).toBe(false);
  });
});

describe("withLikeIdentity", () => {
  it("aggiunge e toglie solo l'identità indicata", () => {
    const base = [{ id: "c-1", type: "society" as const }];

    expect(withLikeIdentity(base, PERSON, true)).toEqual([
      { id: "c-1", type: "society" },
      { id: "p-1", type: "person" },
    ]);
    expect(withLikeIdentity(withLikeIdentity(base, PERSON, true), PERSON, false)).toEqual(base);
  });

  it("aggiungere due volte la stessa identità non la duplica (unicità, §12)", () => {
    const once = withLikeIdentity([], PERSON, true);

    expect(withLikeIdentity(once, PERSON, true)).toEqual(once);
  });
});

describe("nextLikeSnapshot — HOM-07 §13–§15", () => {
  it("♡ 146 → ♥ 147 → ♡ 146", () => {
    const start = { likedAs: [], likesCount: 146 };
    const liked = nextLikeSnapshot(start, PERSON);

    expect(liked).toEqual({ likedAs: [{ id: "p-1", type: "person" }], likesCount: 147 });
    expect(nextLikeSnapshot(liked, PERSON)).toEqual(start);
  });

  it("il Mi piace di un'altra identità non si toglie: la persona aggiunge il suo", () => {
    const society = { likedAs: [{ id: "c-1", type: "society" as const }], likesCount: 10 };
    const next = nextLikeSnapshot(society, PERSON);

    expect(next.likesCount).toBe(11);
    expect(next.likedAs).toHaveLength(2);
  });

  it("il conteggio non scende mai sotto zero", () => {
    expect(
      nextLikeSnapshot({ likedAs: [{ id: "p-1", type: "person" }], likesCount: 0 }, PERSON)
        .likesCount,
    ).toBe(0);
  });
});

describe("sameLikeSnapshot", () => {
  it("uguaglianza per valore, indipendente dall'ordine delle identità", () => {
    const a = {
      likedAs: [
        { id: "p-1", type: "person" as const },
        { id: "c-1", type: "society" as const },
      ],
      likesCount: 3,
    };
    const b = { likedAs: [...a.likedAs].reverse(), likesCount: 3 };

    expect(sameLikeSnapshot(a, b)).toBe(true);
    expect(sameLikeSnapshot(a, { ...b, likesCount: 4 })).toBe(false);
    expect(sameLikeSnapshot(a, { ...b, likedAs: [] })).toBe(false);
  });
});

describe("isLikedForDisplay — identità non ancora risolta", () => {
  it("un Mi piace della Società non accende il cuore della persona", () => {
    expect(isLikedForDisplay([{ id: "club-1", type: "society" }], null)).toBe(false);
  });

  it("un Mi piace personale (person o media) lo accende", () => {
    expect(isLikedForDisplay([{ id: "p-1", type: "person" }], null)).toBe(true);
    expect(isLikedForDisplay([{ id: "m-1", type: "media" }], null)).toBe(true);
  });

  it("con l'identità risolta vale solo quella", () => {
    const society = { id: "club-1", type: "society" as const };
    expect(isLikedForDisplay([{ id: "p-1", type: "person" }], society)).toBe(false);
    expect(isLikedForDisplay([society], society)).toBe(true);
  });
});
