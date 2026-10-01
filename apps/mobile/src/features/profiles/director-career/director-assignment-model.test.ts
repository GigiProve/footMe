/**
 * Persistenza della carriera Dirigente (REV-PROF-10).
 *
 * Il requisito che questi test difendono è uno solo: **una riga per stagione,
 * con ruolo e categoria propri**. Da lì discendono la modificabilità della
 * singola stagione, i ruoli diversi nella stessa società, le stagioni non
 * consecutive e la continuità fra onboarding e profilo.
 *
 * La seconda metà difende la migrazione: le righe scritte dall'onboarding
 * portano N stagioni in un record solo e devono attraversare la lettura
 * diventando N assegnazioni, senza perdere ruolo, categoria, descrizione o
 * identità.
 */
import { describe, expect, it } from "vitest";

import { buildCareerView } from "../career/coach-career-model";
import { parseDirectorCareerEntries } from "../career/director-career-model";
import {
  buildCoachExperienceGroups,
  type CoachAssignment,
} from "../coach-career/coach-assignment-model";
import {
  draftFromAssignments,
  draftToAssignments,
  findDuplicateAssignments,
  hasOverlappingAssignments,
} from "../coach-career/coach-career-draft";
import {
  assignmentsToDirectorEntries,
  collectDirectorHistoricalRoles,
  directorEntriesToAssignments,
} from "./director-assignment-model";

/** Una riga come la scriveva l'onboarding: una sola, con dentro N stagioni. */
function legacyEntry(overrides: Record<string, unknown> = {}) {
  return {
    category: "Serie B",
    clubId: "club-1",
    description: "Gestione mercato e scouting.",
    id: "legacy-1",
    period: null,
    role: "Direttore generale",
    seasonDetails: {
      "2024/2025": { category: "Serie B", role: "Direttore generale" },
      "2025/2026": { category: "Serie A", role: "Responsabile scouting" },
      "2026/2027": { category: "Serie A", role: "Direttore sportivo" },
    },
    seasons: ["2026/2027", "2025/2026", "2024/2025"],
    teamLogoUrl: "https://example.test/logo.png",
    teamName: "ASD Romano Prodi",
    type: "MULTI_SEASON",
    ...overrides,
  };
}

function assignment(
  overrides: Partial<CoachAssignment> & Pick<CoachAssignment, "id" | "groupId">,
): CoachAssignment {
  return {
    category: "Serie A",
    clubId: "club-1",
    description: "",
    isOngoing: false,
    mode: "MULTI_SEASON",
    period: null,
    role: "Direttore sportivo",
    seasonKey: "2026/2027",
    teamLogoUrl: "",
    teamName: "ASD Romano Prodi",
    ...overrides,
  };
}

describe("migrazione delle righe dell'onboarding", () => {
  it("espande una riga multi-stagione in un'assegnazione per stagione", () => {
    const assignments = directorEntriesToAssignments([legacyEntry()], "director");

    expect(assignments).toHaveLength(3);
    expect(
      assignments.map((item) => [item.seasonKey, item.role, item.category]),
    ).toEqual([
      ["2026/2027", "Direttore sportivo", "Serie A"],
      ["2025/2026", "Responsabile scouting", "Serie A"],
      ["2024/2025", "Direttore generale", "Serie B"],
    ]);
  });

  it("tiene le stagioni espanse nello stesso gruppo e non perde la società", () => {
    const groups = buildCoachExperienceGroups(
      directorEntriesToAssignments([legacyEntry()], "director"),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].teamName).toBe("ASD Romano Prodi");
    expect(groups[0].countLabel).toBe("3 stagioni");
    expect(groups[0].roleCountLabel).toBe("3 ruoli");
  });

  it("dà id stabili alle stagioni espanse, così la migrazione è idempotente", () => {
    const first = directorEntriesToAssignments([legacyEntry()], "director");
    const second = directorEntriesToAssignments([legacyEntry()], "director");

    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(new Set(first.map((item) => item.id)).size).toBe(3);
  });

  it("riporta ruolo e categoria di testata sulle stagioni senza dettaglio", () => {
    const assignments = directorEntriesToAssignments(
      [legacyEntry({ seasonDetails: {} })],
      "director",
    );

    expect(assignments.every((item) => item.role === "Direttore generale")).toBe(
      true,
    );
    expect(assignments.every((item) => item.category === "Serie B")).toBe(true);
  });

  it("preserva la descrizione su ogni stagione espansa", () => {
    const assignments = directorEntriesToAssignments([legacyEntry()], "director");

    expect(
      assignments.every(
        (item) => item.description === "Gestione mercato e scouting.",
      ),
    ).toBe(true);
  });

  it("scarta una riga illeggibile invece di far esplodere la carriera", () => {
    const assignments = directorEntriesToAssignments(
      [null, { role: "Presidente" }, legacyEntry()],
      "director",
    );

    expect(assignments).toHaveLength(3);
  });

  it("non converte un periodo personalizzato in stagioni complete", () => {
    const assignments = directorEntriesToAssignments(
      [
        legacyEntry({
          period: {
            endMonth: "Giugno",
            endYear: 2023,
            startMonth: "Agosto",
            startYear: 2022,
          },
          seasonDetails: {},
          seasons: [],
          type: "CUSTOM_PERIOD",
        }),
      ],
      "director",
    );

    expect(assignments).toHaveLength(1);
    expect(assignments[0].mode).toBe("CUSTOM_PERIOD");
    expect(assignments[0].period).toEqual({
      endMonth: "Giugno",
      endYear: "2023",
      startMonth: "Agosto",
      startYear: "2022",
    });
  });
});

describe("scrittura delle assegnazioni", () => {
  it("scrive una riga per stagione, con ruolo e categoria sulla riga", () => {
    const entries = assignmentsToDirectorEntries(
      directorEntriesToAssignments([legacyEntry()], "director"),
    );

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.seasons)).toEqual([
      ["2026/2027"],
      ["2025/2026"],
      ["2024/2025"],
    ]);
    expect(entries.map((entry) => entry.role)).toEqual([
      "Direttore sportivo",
      "Responsabile scouting",
      "Direttore generale",
    ]);
    expect(entries.every((entry) => Object.keys(entry.seasonDetails).length === 0)).toBe(
      true,
    );
  });

  it("marca le righe nate dallo stesso inserimento con lo stesso gruppo", () => {
    const entries = assignmentsToDirectorEntries(
      directorEntriesToAssignments([legacyEntry()], "director"),
    );

    expect(new Set(entries.map((entry) => entry.experienceGroupId)).size).toBe(1);
  });

  it("rilegge le righe scritte come un'esperienza sola", () => {
    const written = assignmentsToDirectorEntries(
      directorEntriesToAssignments([legacyEntry()], "director"),
    );
    const reread = directorEntriesToAssignments(written, "director");

    expect(buildCoachExperienceGroups(reread)).toHaveLength(1);
    expect(reread.map((item) => [item.seasonKey, item.role])).toEqual([
      ["2026/2027", "Direttore sportivo"],
      ["2025/2026", "Responsabile scouting"],
      ["2024/2025", "Direttore generale"],
    ]);
  });

  it("il Master Profile legge le righe espanse come una sola esperienza", () => {
    const written = assignmentsToDirectorEntries(
      directorEntriesToAssignments([legacyEntry()], "director"),
    );
    const view = buildCareerView(
      parseDirectorCareerEntries(written, "director"),
      { now: new Date("2026-10-01T00:00:00Z") },
    );

    expect(view.experiences).toHaveLength(1);
    expect(view.experiences[0].seasons.map((season) => season.role)).toEqual([
      "Direttore sportivo",
      "Responsabile scouting",
      "Direttore generale",
    ]);
    expect(view.experiences[0].seasons.map((season) => season.category)).toEqual([
      "Serie A",
      "Serie A",
      "Serie B",
    ]);
  });

  it("non perde la descrizione nel giro di scrittura e rilettura", () => {
    const written = assignmentsToDirectorEntries([
      assignment({ description: "Subentro a stagione in corso.", groupId: "g1", id: "a1" }),
    ]);

    expect(written[0].description).toBe("Subentro a stagione in corso.");
    expect(directorEntriesToAssignments(written, "director")[0].description).toBe(
      "Subentro a stagione in corso.",
    );
  });
});

describe("regole della carriera dirigenziale", () => {
  it("tiene distinte due esperienze con ruoli diversi nello stesso periodo", () => {
    const incoming = [
      assignment({ groupId: "g2", id: "a2", role: "Team manager" }),
    ];
    const existing = [
      assignment({ groupId: "g1", id: "a1", role: "Direttore sportivo" }),
    ];

    expect(findDuplicateAssignments(incoming, existing)).toHaveLength(0);
    // Sovrapposizione sì, blocco no: il salvataggio resta una scelta dell'utente.
    expect(hasOverlappingAssignments(incoming, existing)).toBe(true);
  });

  it("blocca solo il duplicato esatto", () => {
    const existing = [assignment({ groupId: "g1", id: "a1" })];

    expect(
      findDuplicateAssignments([assignment({ groupId: "g2", id: "a2" })], existing),
    ).toHaveLength(1);
    expect(
      findDuplicateAssignments(
        [assignment({ category: "Serie B", groupId: "g2", id: "a2" })],
        existing,
      ),
    ).toHaveLength(0);
  });

  it("non completa le stagioni mancanti di una selezione non consecutiva", () => {
    const draft = draftFromAssignments([
      assignment({ groupId: "g1", id: "a1", seasonKey: "2026/2027" }),
      assignment({ groupId: "g1", id: "a2", seasonKey: "2024/2025" }),
      assignment({ groupId: "g1", id: "a3", seasonKey: "2021/2022" }),
    ]);

    expect(draft?.seasons).toHaveLength(3);
    expect(draftToAssignments(draft!).map((item) => item.seasonKey)).toEqual([
      "2026/2027",
      "2024/2025",
      "2021/2022",
    ]);
  });

  it("cambiare il ruolo di una stagione non tocca le altre", () => {
    const draft = draftFromAssignments(
      directorEntriesToAssignments([legacyEntry()], "director"),
    );
    const edited = draftToAssignments({
      ...draft!,
      seasonDetails: {
        ...draft!.seasonDetails,
        "2025/2026": { category: "Serie C", role: "Presidente" },
      },
    });

    expect(edited.map((item) => [item.seasonKey, item.role])).toEqual([
      ["2026/2027", "Direttore sportivo"],
      ["2025/2026", "Presidente"],
      ["2024/2025", "Direttore generale"],
    ]);
  });

  it("riapre un gruppo senza replicare la descrizione di una stagione sulle altre", () => {
    const draft = draftFromAssignments([
      assignment({ description: "Solo questa.", groupId: "g1", id: "a1", seasonKey: "2026/2027" }),
      assignment({ groupId: "g1", id: "a2", seasonKey: "2025/2026" }),
    ]);

    expect(draft?.description).toBe("");
    expect(
      draftToAssignments(draft!).map((item) => item.description),
    ).toEqual(["Solo questa.", ""]);
  });

  it("conserva l'id di una stagione già salvata quando il gruppo viene modificato", () => {
    const draft = draftFromAssignments(
      directorEntriesToAssignments([legacyEntry()], "director"),
    );
    const edited = draftToAssignments({
      ...draft!,
      seasons: draft!.seasons.filter((season) => season !== "2024/2025"),
    });

    expect(edited.map((item) => item.id)).toEqual([
      "legacy-1",
      "legacy-1#2025/2026",
    ]);
  });

  it("raccoglie i ruoli storici per non farli sparire dal selettore", () => {
    expect(collectDirectorHistoricalRoles([legacyEntry()], "director")).toEqual([
      "Direttore generale",
      "Responsabile scouting",
      "Direttore sportivo",
    ]);
  });
});
