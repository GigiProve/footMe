import { describe, expect, it } from "vitest";

import type { EligiblePerson, GroupCreateContext } from "../groups-types";
import { avatarErrorMessage, mergeKnownPeople, resolveComposeSociety } from "./group-compose-model";

const como: GroupCreateContext = { clubId: "c1", clubName: "AC Como", isVerified: true, logoUrl: null };
const lecco: GroupCreateContext = { clubId: "c2", clubName: "Lecco", isVerified: false, logoUrl: null };
const society = { avatarUrl: null, id: "c9", isVerified: true, kind: "society", name: "AC Monza" };

const base = {
  clubIdParam: null,
  contexts: null,
  contextsFailed: false,
  identity: null,
  identityLoading: false,
  origin: "messages" as const,
  picked: null,
};

describe("resolveComposeSociety", () => {
  it("usa la Società dell'identity da Dashboard", () => {
    const result = resolveComposeSociety({ ...base, identity: society, origin: "dashboard" });

    expect(result).toMatchObject({ society: { clubId: "c9" }, status: "ready" });
  });

  it("non accetta PERSON o MEDIA da Dashboard", () => {
    const result = resolveComposeSociety({ ...base, identity: { ...society, kind: "person" }, origin: "dashboard" });

    expect(result.status).toBe("unavailable");
  });

  it("aspetta l'identity prima di dichiarare l'assenza", () => {
    expect(resolveComposeSociety({ ...base, identityLoading: true, origin: "dashboard" }).status).toBe("loading");
  });

  it("da Messaggi: nessun contesto, uno, più di uno", () => {
    expect(resolveComposeSociety({ ...base, contexts: [] }).status).toBe("unavailable");
    expect(resolveComposeSociety({ ...base, contexts: [como] })).toMatchObject({ status: "ready" });
    expect(resolveComposeSociety({ ...base, contexts: [como, lecco] }).status).toBe("choose");
  });

  it("un clubId fuori dai contesti non si usa", () => {
    expect(resolveComposeSociety({ ...base, clubIdParam: "zzz", contexts: [como, lecco] }).status).toBe("unavailable");
  });

  it("la scelta nel selector risolve la Società", () => {
    const result = resolveComposeSociety({ ...base, contexts: [como, lecco], picked: "c2" });

    expect(result).toMatchObject({ society: { name: "Lecco" }, status: "ready" });
  });

  it("un errore nel caricare i contesti non è un caricamento infinito", () => {
    expect(resolveComposeSociety({ ...base, contextsFailed: true }).status).toBe("unavailable");
  });
});

describe("mergeKnownPeople", () => {
  const person = (id: string): EligiblePerson => ({
    avatarUrl: null,
    fullName: id,
    inTeam: false,
    profileId: id,
    roleLabel: null,
  });

  it("accumula per ID e restituisce lo stesso oggetto se non c'è nulla di nuovo", () => {
    const first = mergeKnownPeople({}, [person("a"), person("b")]);

    expect(Object.keys(first)).toEqual(["a", "b"]);
    expect(mergeKnownPeople(first, [person("a")])).toBe(first);
    expect(Object.keys(mergeKnownPeople(first, [person("c")]))).toEqual(["a", "b", "c"]);
  });
});

describe("avatarErrorMessage", () => {
  it("distingue i motivi noti dal generico", () => {
    expect(avatarErrorMessage("avatar_format")).not.toBe(avatarErrorMessage("upload_failed"));
    expect(avatarErrorMessage(null)).toBe(avatarErrorMessage("upload_failed"));
  });
});
