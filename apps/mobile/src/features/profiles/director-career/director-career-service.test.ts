/**
 * Scritture della carriera Dirigente (REV-PROF-10).
 *
 * Due garanzie, e sono quelle che tengono in piedi il resto della task:
 *
 * 1. **I percorsi restano separati.** Ogni corsia ha la sua colonna e
 *    salvarne una non può toccare le altre. È l'errore che
 *    `buildFullUpdatePayload` ha già fatto una volta sullo Staff tecnico, e
 *    qui non deve ripetersi.
 * 2. **Il salvataggio è atomico perché è una riga sola.** Le cinque colonne
 *    partono insieme in un solo `upsert`, quindi un gruppo multi-stagione non
 *    può entrare a metà, e un retry riscrive lo stesso insieme invece di
 *    aggiungerne una copia.
 */
import { describe, expect, it } from "vitest";

import {
  formsToPlayerEntries,
  playerEntriesToForms,
} from "../../onboarding/career/player-career-utils";
import { parseDirectorPlayerForms } from "../career/director-career-model";
import type { CoachAssignment } from "../coach-career/coach-assignment-model";
import type { CompleteProfessionalProfile } from "../profile-service";
import { buildDirectorCareerColumns } from "./director-career-service";

function assignment(
  overrides: Partial<CoachAssignment> & Pick<CoachAssignment, "id" | "groupId">,
): CoachAssignment {
  return {
    category: "Serie A",
    clubId: "club-1",
    description: "",
    isOngoing: false,
    mode: "SINGLE_SEASON",
    period: null,
    role: "Direttore sportivo",
    seasonKey: "2026/2027",
    teamLogoUrl: "",
    teamName: "ASD Romano Prodi",
    ...overrides,
  };
}

/** Un profilo con tutte e cinque le corsie già popolate. */
function profile(): CompleteProfessionalProfile {
  return {
    directorProfile: {
      career_entries: [{ id: "director-1", teamName: "Fiorentina" }],
      coach_career_entries: [{ id: "coach-1", teamName: "Empoli" }],
      other_career_entries: [{ id: "other-1", teamName: "Lucchese" }],
      player_career_entries: [{ clubName: "Pisa", id: "player-1" }],
      staff_career_entries: [{ id: "staff-1", teamName: "Siena" }],
    },
    profile: { id: "profile-1" },
  } as unknown as CompleteProfessionalProfile;
}

describe("separazione delle corsie", () => {
  it("scrive la carriera dirigenziale senza toccare gli altri percorsi", () => {
    const data = profile();
    const columns = buildDirectorCareerColumns(data, {
      assignments: [assignment({ groupId: "g1", id: "a1" })],
      lane: "primary",
    });

    expect(columns.career_entries).toHaveLength(1);
    expect(columns.career_entries[0]).toMatchObject({
      teamName: "ASD Romano Prodi",
    });
    expect(columns.coach_career_entries).toEqual(
      data.directorProfile?.coach_career_entries,
    );
    expect(columns.staff_career_entries).toEqual(
      data.directorProfile?.staff_career_entries,
    );
    expect(columns.other_career_entries).toEqual(
      data.directorProfile?.other_career_entries,
    );
    expect(columns.player_career_entries).toEqual(
      data.directorProfile?.player_career_entries,
    );
  });

  it.each([
    ["coach", "coach_career_entries"],
    ["staff", "staff_career_entries"],
    ["other", "other_career_entries"],
  ] as const)(
    "il percorso %s scrive solo sulla propria colonna",
    (lane, column) => {
      const data = profile();
      const columns = buildDirectorCareerColumns(data, {
        assignments: [assignment({ groupId: "g1", id: "a1" })],
        lane,
      });

      expect(columns[column]).toHaveLength(1);
      expect(columns[column][0]).toMatchObject({
        teamName: "ASD Romano Prodi",
      });
      // La carriera dirigenziale non si muove quando si salva un percorso.
      expect(columns.career_entries).toEqual(
        data.directorProfile?.career_entries,
      );
    },
  );

  it("il percorso da calciatore non entra nella carriera dirigenziale", () => {
    const data = profile();
    const columns = buildDirectorCareerColumns(data, {
      playerCareerEntries: [{ clubName: "Livorno", seasonLabel: "2010/2011" }],
    });

    expect(columns.player_career_entries).toHaveLength(1);
    expect(columns.career_entries).toEqual(data.directorProfile?.career_entries);
  });

  it("eliminare l'ultima esperienza svuota la corsia invece di lasciarla com'era", () => {
    const columns = buildDirectorCareerColumns(profile(), {
      assignments: [],
      lane: "primary",
    });

    expect(columns.career_entries).toEqual([]);
  });
});

describe("atomicità e retry", () => {
  it("un gruppo multi-stagione parte come un insieme unico, mai riga per riga", () => {
    const columns = buildDirectorCareerColumns(profile(), {
      assignments: [
        assignment({ groupId: "g1", id: "a1", seasonKey: "2026/2027" }),
        assignment({ groupId: "g1", id: "a2", seasonKey: "2025/2026" }),
        assignment({ groupId: "g1", id: "a3", seasonKey: "2024/2025" }),
      ],
      lane: "primary",
    });

    expect(columns.career_entries).toHaveLength(3);
    expect(
      new Set(
        columns.career_entries.map(
          (entry) => (entry as { experienceGroupId: string }).experienceGroupId,
        ),
      ).size,
    ).toBe(1);
  });

  it("ripetere lo stesso salvataggio non duplica le righe", () => {
    const data = profile();
    const patch = {
      assignments: [
        assignment({ groupId: "g1", id: "a1", seasonKey: "2026/2027" }),
        assignment({ groupId: "g1", id: "a2", seasonKey: "2025/2026" }),
      ],
      lane: "primary" as const,
    };

    expect(buildDirectorCareerColumns(data, patch).career_entries).toEqual(
      buildDirectorCareerColumns(data, patch).career_entries,
    );
    expect(buildDirectorCareerColumns(data, patch).career_entries).toHaveLength(
      2,
    );
  });
});

describe("percorso da calciatore", () => {
  it("sopravvive al giro di lettura e scrittura mantenendo l'esperienza unita", () => {
    const stored = [
      {
        appearances: "30",
        careerType: "MULTI_SEASON",
        category: "Serie C",
        clubName: "Pisa",
        goals: "4",
        groupId: "player-group-1",
        seasonLabel: "2009/2010",
        seasonPeriod: "full",
      },
      {
        appearances: "28",
        careerType: "MULTI_SEASON",
        category: "Serie C",
        clubName: "Pisa",
        goals: "6",
        groupId: "player-group-1",
        seasonLabel: "2010/2011",
        seasonPeriod: "full",
      },
    ];

    const entries = formsToPlayerEntries(parseDirectorPlayerForms(stored));

    // Due stagioni della stessa esperienza, non due esperienze.
    expect(entries).toHaveLength(1);
    expect(entries[0].seasons).toHaveLength(2);

    const written = buildDirectorCareerColumns(profile(), {
      playerCareerEntries: playerEntriesToForms(entries),
    }).player_career_entries;

    expect(written).toHaveLength(2);
    expect(
      formsToPlayerEntries(parseDirectorPlayerForms(written)),
    ).toHaveLength(1);
    // Le statistiche restano, e restano solo qui.
    expect(
      written.map((form) => (form as { goals: string }).goals),
    ).toEqual(["4", "6"]);
  });
});
