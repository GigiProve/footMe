/**
 * Regole pure del Dettaglio operativo Squadra (DAS-REV-09).
 *
 * Qui stanno le distinzioni che la task verifica e che un test a schermo
 * dimostrerebbe peggio: assenza ≠ zero ≠ errore, il totale che non dipende
 * dalle preview, la composizione che non si riordina e i moduli che si
 * omettono invece di mostrare uno zero decorativo.
 */
import { describe, expect, it } from "vitest";

import {
  applicationsSummaryLine,
  invitesSummaryLine,
  isRosterEmpty,
  positionRoleLabel,
  positionsCountLabel,
  rosterSummaryAccessibilityLabel,
  rosterSummaryLine,
  teamDetailClassification,
  teamDetailComposition,
  teamHeaderAccessibilityLabel,
  teamParentLine,
  teamPlaceSeasonLine,
} from "./team-detail-presentation";
import type {
  TeamDetailPayload,
  TeamPositionsPayload,
} from "./team-detail-service";

function team(overrides: Partial<TeamDetailPayload> = {}): TeamDetailPayload {
  return {
    accessVerifiedAt: Date.now(),
    applicationsCount: 7,
    applicationsNewCount: 3,
    canCreatePositions: true,
    canEdit: true,
    canManageInvites: true,
    canManageRoster: true,
    canViewApplications: true,
    canViewInvites: true,
    canViewPositions: true,
    canViewRoster: true,
    city: "Cantù",
    cityInherited: false,
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    crestInherited: true,
    crestUrl: null,
    dataRevision: 1,
    groupConversationId: null,
    groupMemberCount: null,
    groupSupported: false,
    groupTitle: null,
    hasSeasonConfig: true,
    invitesPendingCount: 2,
    isArchived: false,
    isOwner: true,
    levelId: "elite",
    levelLabel: "Élite",
    name: "Comashi",
    rosterAvatars: [],
    rosterPlayersCount: 19,
    rosterStaffCount: 4,
    seasonId: "2026/27",
    seasonLabel: "2026/27",
    teamId: "team-1",
    typeId: "u18",
    typeLabel: "Under 18",
    ...overrides,
  };
}

function positions(
  overrides: Partial<TeamPositionsPayload> = {},
): TeamPositionsPayload {
  return {
    activeCount: 2,
    canCreate: true,
    canView: true,
    items: [
      { id: "p1", targetRole: "player", title: "Terzino destro" },
      { id: "p2", targetRole: "staff", title: "Preparatore atletico" },
    ],
    ...overrides,
  };
}

describe("header — §8, §23", () => {
  it("master 01: Tipo e Livello sono due cose diverse e restano entrambi", () => {
    expect(teamDetailClassification(team())).toBe("Under 18 · Élite");
  });

  it("master 04: il nome contiene il Tipo ma il Livello non lo esprime", () => {
    expect(
      teamDetailClassification(
        team({ levelLabel: "Regionale", name: "Under 17 B", typeLabel: "Under 17" }),
      ),
    ).toBe("Under 17 · Regionale");
  });

  it("master 05: il Livello contiene già il Tipo, che non va ripetuto", () => {
    expect(
      teamDetailClassification(
        team({ levelLabel: "Primavera 2", name: "Primavera", typeLabel: "Primavera" }),
      ),
    ).toBe("Primavera 2");
  });

  it("Livello assente: resta il solo Tipo, mai N/A o un valore inventato", () => {
    expect(
      teamDetailClassification(team({ levelId: null, levelLabel: null })),
    ).toBe("Under 18");
  });

  it("stagione non configurata: non presenta lo storico come corrente", () => {
    expect(teamDetailClassification(team({ hasSeasonConfig: false }))).toBe(
      "Stagione da configurare",
    );
  });

  it("il nome reale non viene ricostruito concatenando club e Tipo", () => {
    // "Comashi" è valido anche se non contiene "AC Como" (§8).
    expect(teamParentLine("AC Como")).toBe("Squadra di AC Como");
    expect(team().name).toBe("Comashi");
  });

  it("città assente: nessun separatore pendente, la stagione resta leggibile", () => {
    expect(teamPlaceSeasonLine(team())).toBe("Cantù · 2026/27");
    expect(teamPlaceSeasonLine(team({ city: null }))).toBe("2026/27");
    expect(
      teamPlaceSeasonLine(team({ city: null, seasonLabel: null })),
    ).toBeNull();
  });

  it("la verifica è annunciata sulla Società, non sulla squadra", () => {
    const label = teamHeaderAccessibilityLabel(team());

    expect(label).toContain("Squadra di AC Como, società verificata");
    expect(label.startsWith("Comashi,")).toBe(true);
    expect(label).not.toContain("Comashi verificata");
  });
});

describe("Organico — §11, §12", () => {
  it("riassume i conteggi reali", () => {
    expect(rosterSummaryLine(team())).toBe("19 calciatori · 4 staff");
  });

  it("un conteggio non consultabile viene omesso, non reso zero", () => {
    expect(
      rosterSummaryLine(team({ rosterPlayersCount: null })),
    ).toBe("4 staff");
    expect(
      rosterSummaryLine(
        team({ rosterPlayersCount: null, rosterStaffCount: null }),
      ),
    ).toBeNull();
  });

  it("lo screen reader legge «staff» per esteso", () => {
    expect(rosterSummaryAccessibilityLabel(team())).toBe(
      "19 calciatori e 4 membri dello staff",
    );
  });

  it("vuoto reale solo con entrambi i conteggi noti e a zero", () => {
    expect(
      isRosterEmpty({ rosterPlayersCount: 0, rosterStaffCount: 0 }),
    ).toBe(true);
    // Non consultabile non è vuoto: §12 non autorizza qui "Nessuna persona".
    expect(
      isRosterEmpty({ rosterPlayersCount: null, rosterStaffCount: 0 }),
    ).toBe(false);
  });
});

describe("Posizioni — §13", () => {
  it("il conteggio è grigio e plurale corretto", () => {
    expect(positionsCountLabel(2)).toBe("2 attive");
    expect(positionsCountLabel(1)).toBe("1 attiva");
  });

  it("zero confermato e assenza restano due casi, entrambi senza metadato", () => {
    // Master 04: accanto a "Nessuna posizione aperta" il mockup non mostra
    // nessun conteggio. Resta comunque vero che i due casi sono distinti —
    // lo prova la composizione, dove uno rende il modulo e l'altro no.
    expect(positionsCountLabel(0)).toBeNull();
    expect(positionsCountLabel(null)).toBeNull();
  });

  it("master 03: il totale non dipende dal numero di preview", () => {
    const intense = positions({ activeCount: 4 });

    expect(positionsCountLabel(intense.activeCount)).toBe("4 attive");
    expect(intense.items).toHaveLength(2);
  });

  it("traduce il tipo di profilo e ignora i valori sconosciuti", () => {
    expect(positionRoleLabel("player")).toBe("Calciatore");
    expect(positionRoleLabel("staff")).toBe("Staff");
    expect(positionRoleLabel("coach")).toBe("Allenatore");
    expect(positionRoleLabel("qualcosaltro")).toBeNull();
  });
});

describe("Candidature e Inviti — §15, §16", () => {
  it("riassume totale e nuove come due valori separati", () => {
    expect(applicationsSummaryLine(team())).toBe("7 candidature · 3 nuove");
    expect(
      applicationsSummaryLine(
        team({ applicationsCount: 18, applicationsNewCount: 8 }),
      ),
    ).toBe("18 candidature · 8 nuove");
  });

  it("senza nuove resta il solo totale: niente zero decorativo", () => {
    expect(
      applicationsSummaryLine(team({ applicationsNewCount: 0 })),
    ).toBe("7 candidature");
  });

  it("singolari corretti", () => {
    expect(
      applicationsSummaryLine(
        team({ applicationsCount: 1, applicationsNewCount: 1 }),
      ),
    ).toBe("1 candidatura · 1 nuova");
    expect(invitesSummaryLine(1)).toBe("1 in attesa");
  });

  it("non consultabile resta assente", () => {
    expect(
      applicationsSummaryLine(team({ applicationsCount: null })),
    ).toBeNull();
    expect(invitesSummaryLine(null)).toBeNull();
  });
});

describe("composizione dei moduli — §10", () => {
  const base = { positions: positions(), positionsFailed: false };

  it("master 01/02: ordine stabile dei moduli autorizzati", () => {
    expect(teamDetailComposition({ ...base, team: team() })).toEqual([
      "roster",
      "positions",
      "applications",
      "invites",
    ]);
  });

  it("master 03: più dati non riordinano nulla", () => {
    expect(
      teamDetailComposition({
        positions: positions({ activeCount: 4 }),
        positionsFailed: false,
        team: team({ applicationsCount: 18, applicationsNewCount: 8 }),
      }),
    ).toEqual(["roster", "positions", "applications", "invites"]);
  });

  it("master 04: squadra appena creata, nessun empty duplicato di Inviti", () => {
    const composition = teamDetailComposition({
      positions: positions({ activeCount: 0, items: [] }),
      positionsFailed: false,
      team: team({
        applicationsCount: 0,
        applicationsNewCount: 0,
        invitesPendingCount: 0,
        rosterPlayersCount: 0,
        rosterStaffCount: 0,
      }),
    });

    expect(composition).toEqual(["roster", "positions"]);
    expect(composition).not.toContain("invites");
    expect(composition).not.toContain("applications");
  });

  it("master 05: i moduli non autorizzati sono assenti, non disabilitati", () => {
    expect(
      teamDetailComposition({
        positions: null,
        positionsFailed: false,
        team: team({
          canCreatePositions: false,
          canViewApplications: false,
          canViewInvites: false,
          canViewPositions: false,
        }),
      }),
    ).toEqual(["roster"]);
  });

  it("master 06: un modulo autorizzato in errore resta nella composizione", () => {
    expect(
      teamDetailComposition({
        positions: null,
        positionsFailed: true,
        team: team(),
      }),
    ).toContain("positions");
  });

  it("il Gruppo non viene composto finché il dominio non esiste (§17)", () => {
    expect(teamDetailComposition({ ...base, team: team() })).not.toContain(
      "group",
    );

    expect(
      teamDetailComposition({
        ...base,
        team: team({
          groupConversationId: "conv-1",
          groupMemberCount: 23,
          groupSupported: true,
          groupTitle: "Comashi",
        }),
      }),
    ).toContain("group");
  });
});
