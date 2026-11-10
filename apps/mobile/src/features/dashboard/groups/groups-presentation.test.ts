import { describe, expect, it } from "vitest";

import {
  addToSelection,
  canContinueInfo,
  canContinuePeople,
  centerBodyOf,
  createFailureOf,
  createSignature,
  exceedsMax,
  groupNameIssue,
  groupRowMeta,
  hasMeaningfulDraft,
  normalizeGroupName,
  peopleSections,
  removeFromSelection,
  selectedCount,
  showSelectAll,
  summaryPeople,
  teamChoiceValid,
  teamFieldOf,
  toggleSelection,
  uniqueById,
} from "./groups-presentation";
import { GroupsError, toGroupsError } from "./groups-service";
import type { EligiblePerson, GroupTeamsLookup } from "./groups-types";

const LIMITS = { maxPeople: 256, nameMax: 80 };
const societyLookup: GroupTeamsLookup = {
  canCreateWithoutTeam: true,
  limits: { avatarMaxBytes: 1, avatarMimeTypes: [], maxPeople: 256, minPeople: 2, nameMax: 80 },
  teams: [
    { teamId: "t-prima", teamName: "Prima squadra" },
    { teamId: "t-prim", teamName: "Primavera" },
  ],
};
const scopedLookup: GroupTeamsLookup = { ...societyLookup, canCreateWithoutTeam: false, teams: [{ teamId: "t-prim", teamName: "Primavera" }] };

const person = (id: string, name: string, inTeam = true): EligiblePerson => ({
  avatarUrl: null,
  fullName: name,
  inTeam,
  profileId: id,
  roleLabel: "Allenatore",
});

describe("nome del gruppo (§14)", () => {
  it("normalizza spazi ai bordi e interni come il server", () => {
    expect(normalizeGroupName("  Staff   Primavera ")).toBe("Staff Primavera");
  });

  it("rifiuta vuoto e solo whitespace (QA-052)", () => {
    expect(groupNameIssue("", LIMITS)).toBe("required");
    expect(groupNameIssue("   \t ", LIMITS)).toBe("required");
  });

  it("applica il limite centrale contando i caratteri, non le unità UTF-16 (QA-054)", () => {
    expect(groupNameIssue("x".repeat(80), LIMITS)).toBeNull();
    expect(groupNameIssue("x".repeat(81), LIMITS)).toBe("too_long");
    expect(groupNameIssue("⚽".repeat(80), LIMITS)).toBeNull();
  });

  it("un carattere di controllo dentro il nome è rifiutato come dal server", () => {
    expect(groupNameIssue("Staff\u0007Primavera", LIMITS)).toBe("invalid");
    expect(groupNameIssue("Staff\tPrimavera", LIMITS)).toBeNull();
  });

  it("non impone unicità e tollera markup come testo (QA-055, QA-056)", () => {
    expect(groupNameIssue("<script>alert(1)</script>", LIMITS)).toBeNull();
  });
});

describe("squadra (§15)", () => {
  it("con scope societario: opzionale, Nessuna squadra ammessa e preimpostata", () => {
    const field = teamFieldOf(societyLookup);
    expect(field.label).toBe("Squadra (opzionale)");
    expect(field.allowNone).toBe(true);
    expect(field.preset).toBeNull();
  });

  it("con scope di squadra: obbligatoria, aiuto, null non valido (QA-032)", () => {
    const field = teamFieldOf(scopedLookup);
    expect(field.label).toBe("Squadra");
    expect(field.help).toBe("Scegli una delle squadre che puoi gestire");
    expect(field.allowNone).toBe(false);
    expect(teamChoiceValid(null, scopedLookup)).toBe(false);
  });

  it("preimposta solo l'unica squadra, mai la prima di più (§15)", () => {
    expect(teamFieldOf(scopedLookup).preset).toBe("t-prim");
    expect(teamFieldOf({ ...scopedLookup, teams: societyLookup.teams }).preset).toBeUndefined();
  });

  it("una squadra non più nel lookup non è valida (QA-035)", () => {
    expect(teamChoiceValid("t-old", societyLookup)).toBe(false);
  });

  it("Continua richiede nome valido e contesto valido, non l'immagine (§14)", () => {
    const base = { limits: LIMITS, lookup: societyLookup, name: "Staff Primavera", team: null as string | null, uploading: false };
    expect(canContinueInfo(base)).toBe(true);
    expect(canContinueInfo({ ...base, name: " " })).toBe(false);
    expect(canContinueInfo({ ...base, lookup: scopedLookup })).toBe(false);
    expect(canContinueInfo({ ...base, uploading: true })).toBe(false);
  });
});

describe("selezione (§18, §19)", () => {
  it("toggle per ID e creator mai contato (QA-076, QA-083)", () => {
    let selected = toggleSelection([], "b");
    selected = toggleSelection(selected, "n");
    selected = toggleSelection(selected, "r");
    expect(selectedCount(selected, "me")).toBe(3);
    expect(selectedCount([...selected, "me"], "me")).toBe(3);
    expect(toggleSelection(selected, "n")).toEqual(["b", "r"]);
  });

  it("Seleziona tutti aggiunge senza duplicare e senza il creator (QA-085, QA-087)", () => {
    expect(addToSelection(["b"], ["b", "n", "me"], "me")).toEqual(["b", "n"]);
  });

  it("rimuove gli ID non più eleggibili conservando gli altri (QA-101)", () => {
    expect(removeFromSelection(["b", "n", "r"], ["r"])).toEqual(["b", "n"]);
  });

  it("Continua con almeno una persona e nessun bulk in corso (QA-081, QA-082)", () => {
    expect(canContinuePeople({ bulkPending: false, count: 0 })).toBe(false);
    expect(canContinuePeople({ bulkPending: false, count: 1 })).toBe(true);
    expect(canContinuePeople({ bulkPending: true, count: 3 })).toBe(false);
  });

  it("massimo centrale incluso il creator (§19)", () => {
    expect(exceedsMax(255, LIMITS)).toBe(false);
    expect(exceedsMax(256, LIMITS)).toBe(true);
  });

  it("sezioni: squadra prima, poi altre persone; nessun duplicato (QA-071)", () => {
    const sections = peopleSections(
      [person("b", "Mister Bianchi"), person("p", "Paolo Riva", false), person("b", "Mister Bianchi")],
      "Primavera",
    );
    expect(sections.map((s) => [s.title, s.people.length])).toEqual([
      ["Primavera", 1],
      ["Altre persone della Società", 1],
    ]);
  });

  it("senza squadra: un elenco senza intestazione fittizia (QA-072)", () => {
    expect(peopleSections([person("p", "Paolo Riva", false)], null)).toEqual([
      { key: "all", people: [person("p", "Paolo Riva", false)], title: null },
    ]);
  });

  it("Seleziona tutti solo con ricerca vuota e squadra (§19)", () => {
    expect(showSelectAll({ query: "", teamId: "t", teamTotal: 3 })).toBe(true);
    expect(showSelectAll({ query: "ri", teamId: "t", teamTotal: 3 })).toBe(false);
    expect(showSelectAll({ query: "", teamId: null, teamTotal: 3 })).toBe(false);
  });
});

describe("riepilogo (§20)", () => {
  it("fixture: 4 persone incluse te, creator una volta sola (QA-089)", () => {
    const known = new Map([
      ["b", person("b", "Mister Bianchi")],
      ["n", person("n", "Andrea Neri")],
      ["r", person("r", "Riccardo Riva")],
    ]);
    const summary = summaryPeople({
      creator: { avatarUrl: null, fullName: "Giuseppe Conti", profileId: "me" },
      known,
      previewMax: 6,
      selected: ["b", "n", "r", "me"],
    });
    expect(summary.total).toBe(4);
    expect(summary.people.map((p) => p.fullName)).toEqual(["Giuseppe Conti", "Mister Bianchi", "Andrea Neri", "Riccardo Riva"]);
    expect(summary.more).toBe(0);
  });

  it("+N dal totale reale (QA-090)", () => {
    const selected = Array.from({ length: 9 }, (_, i) => `p${i}`);
    const known = new Map(selected.map((id) => [id, person(id, id)]));
    const summary = summaryPeople({ creator: { avatarUrl: null, fullName: "Io", profileId: "me" }, known, previewMax: 4, selected });
    expect(summary.total).toBe(10);
    expect(summary.more).toBe(6);
  });
});

describe("esito della create (§23, §24)", () => {
  it("persona non più eleggibile → step 2 con gli ID da togliere (QA-101)", () => {
    const error = toGroupsError({ message: "SOCIETY_GROUP_PEOPLE_UNAVAILABLE:00000000-0000-0000-0000-0000000000b4" });
    expect(createFailureOf(error, LIMITS)).toEqual({
      kind: "people",
      message: "Alcune persone selezionate non sono più disponibili. Controlla e riprova.",
      removeIds: ["00000000-0000-0000-0000-0000000000b4"],
      step: 2,
    });
  });

  it("squadra invalidata → step 1 (QA-036)", () => {
    expect(createFailureOf(new GroupsError("SOCIETY_GROUP_TEAM_UNAVAILABLE"), LIMITS).step).toBe(1);
  });

  it("trasporto → esito incerto, si verifica con la stessa chiave (QA-107)", () => {
    expect(createFailureOf(new GroupsError("TIMEOUT"), LIMITS).kind).toBe("uncertain");
    expect(createFailureOf(new GroupsError("NETWORK"), LIMITS).kind).toBe("uncertain");
  });

  it("capability revocata → blocco (QA-103)", () => {
    expect(createFailureOf(toGroupsError({ message: "SOCIETY_GROUPS_NOT_AUTHORIZED" }), LIMITS).kind).toBe("revoked");
  });

  it("avatar non valido → step 1 con copy immagine (QA-069)", () => {
    expect(createFailureOf(toGroupsError({ message: "SOCIETY_GROUP_INVALID:avatar_invalid" }), LIMITS)).toMatchObject({ kind: "avatar", step: 1 });
  });

  it("firma: ordine e duplicati non cambiano la chiave, il contenuto sì (QA-098, QA-099)", () => {
    const base = { avatarAssetId: null, clubId: "c", creatorId: "me", name: "Staff  Primavera", teamId: "t" };
    expect(createSignature({ ...base, personIds: ["b", "n", "me", "b"] })).toBe(createSignature({ ...base, personIds: ["n", "b"] }));
    expect(createSignature({ ...base, personIds: ["b"] })).not.toBe(createSignature({ ...base, personIds: ["n"] }));
  });
});

describe("Centro (§10, §27)", () => {
  it("meta riga: squadra o Società, persone", () => {
    expect(groupRowMeta({ peopleCount: 24, teamId: "t", teamName: "Prima squadra" })).toBe("Prima squadra · 24 persone");
    expect(groupRowMeta({ peopleCount: 6, teamId: null, teamName: null })).toBe("Società · 6 persone");
  });

  it("vuoto, ricerca senza match ed errore sono distinti (QA-020)", () => {
    expect(centerBodyOf({ error: false, loaded: true, query: "", rows: 0 })).toBe("empty");
    expect(centerBodyOf({ error: false, loaded: true, query: "zz", rows: 0 })).toBe("search_empty");
    expect(centerBodyOf({ error: true, loaded: false, query: "", rows: 0 })).toBe("error");
    expect(centerBodyOf({ error: false, loaded: false, query: "", rows: 0 })).toBe("loading");
  });

  it("righe uniche per ID fra le pagine (QA-018)", () => {
    expect(uniqueById([{ conversationId: "a" }, { conversationId: "a" }, { conversationId: "b" }])).toHaveLength(2);
  });

  it("uscita: conferma solo con modifiche significative (§13)", () => {
    expect(hasMeaningfulDraft({ avatar: false, name: " ", presetTeam: null, selected: 0, team: null })).toBe(false);
    expect(hasMeaningfulDraft({ avatar: false, name: "S", presetTeam: null, selected: 0, team: null })).toBe(true);
  });
});
