/**
 * Semantica dell'hub Struttura societaria (DAS-REV-12 §30).
 *
 * «Verifica i comportamenti di dominio e di autorizzazione, non soltanto la
 * presenza di un testo hardcoded.» Qui si controllano le regole che la task
 * rende osservabili senza montare la pagina: differenza fra zero, dato non
 * autorizzato ed errore; composizione per capability e scope; destinazione e
 * eleggibilità dei segnali; nessun side effect sul tap.
 */
import { describe, expect, it } from "vitest";

import type {
  DashboardCapability,
  DashboardIdentity,
} from "../dashboard-types";
import { mapStructureSignals } from "./structure-service";
import {
  STRUCTURE_HREFS,
  adminsSummary,
  domainRows,
  hasStructuralDomain,
  isDomainVisible,
  networkSummary,
  signalActionLabel,
  signalHref,
  teamsSummary,
} from "./structure-presentation";
import type { SocietyStructure, StructureSignal } from "./structure-types";

function identity(
  capabilities: DashboardCapability[],
  isOwner = false,
): DashboardIdentity {
  return {
    avatarUrl: null,
    capabilities,
    id: "club-1",
    isOwner,
    isVerified: true,
    kind: "society",
    name: "AC Como",
    scopeLabel: null,
  };
}

function structure(overrides: Partial<SocietyStructure> = {}): SocietyStructure {
  return {
    accessVerifiedAt: Date.now(),
    adminInvitesPendingCount: 1,
    adminsCount: 4,
    canEditCompanyData: true,
    canOpenAdminCenter: true,
    canViewAdminInvites: true,
    canViewAdmins: true,
    canViewCompanyData: true,
    canViewNetwork: true,
    canViewRequests: true,
    canViewSeasons: true,
    canViewTeams: true,
    city: "Como",
    clubId: "club-1",
    dataRevision: 1,
    isVerified: true,
    logoUrl: null,
    name: "AC Como",
    scopeLabel: null,
    signals: [],
    ...overrides,
  };
}

function signal(overrides: Partial<StructureSignal> = {}): StructureSignal {
  return {
    actionLabel: "Valuta richiesta",
    clubId: "club-1",
    context: "Lario Academy · Partnership",
    count: 1,
    id: "network_request:rel-1",
    kind: "network_request",
    relationshipId: "rel-1",
    seasonTarget: null,
    teamId: null,
    title: "1 richiesta da valutare",
    ...overrides,
  };
}

describe("teamsSummary", () => {
  it("usa il criterio delle squadre attive del master 02", () => {
    expect(teamsSummary(8, false)).toBe("8 squadre attive");
  });

  it("declina il singolare (master 04)", () => {
    expect(teamsSummary(1, false)).toBe("1 squadra attiva");
  });

  it("distingue zero reale da dato non autorizzato (§8, §19)", () => {
    // Zero è una risposta valida e si dice; `null` significa "non ti è dato
    // saperlo" e non produce testo. Scriverlo "0 squadre" sarebbe la bugia
    // che §8 vieta.
    expect(teamsSummary(0, false)).toBe("Nessuna squadra attiva");
    expect(teamsSummary(null, false)).toBeNull();
  });

  it("non suggerisce un totale globale dentro uno scope (master 05)", () => {
    expect(teamsSummary(1, true)).toBe("1 squadra nel tuo ambito");
    expect(teamsSummary(3, true)).toBe("3 squadre nel tuo ambito");
    expect(teamsSummary(0, true)).toBe(
      "Nessuna squadra disponibile nel tuo ambito",
    );
  });
});

describe("networkSummary", () => {
  it("mostra i due valori distinti del master 03", () => {
    expect(networkSummary(2, 2)).toBe("2 collegamenti attivi · 2 richieste in attesa");
  });

  it("omette la parte pending quando vale zero (master 02)", () => {
    expect(networkSummary(2, 0)).toBe("2 collegamenti attivi");
  });

  it("omette il solo dato non autorizzato, senza sostituirlo con zero (§11)", () => {
    // Chi legge le relazioni ma non le richieste vede una frase sola: §10
    // vieta il leakage attraverso i count e §11 vieta lo zero di comodo.
    expect(networkSummary(2, null)).toBe("2 collegamenti attivi");
    expect(networkSummary(null, 2)).toBe("2 richieste in attesa");
    expect(networkSummary(null, null)).toBeNull();
  });

  it("dice lo zero reale dei collegamenti (master 04)", () => {
    expect(networkSummary(0, null)).toBe("Nessun collegamento attivo");
  });
});

describe("adminsSummary", () => {
  it("tiene distinti accessi attivi e inviti (master 02)", () => {
    expect(adminsSummary(4, 1)).toBe("4 amministratori · 1 invito in attesa");
  });

  it("non mostra mai «0 inviti in attesa» (§11)", () => {
    expect(adminsSummary(1, 0)).toBe("1 amministratore");
    expect(adminsSummary(1, null)).toBe("1 amministratore");
  });

  it("omette il summary che non è leggibile", () => {
    expect(adminsSummary(null, null)).toBeNull();
  });
});

describe("isDomainVisible", () => {
  it("compone i quattro domini con accesso completo (master 02)", () => {
    const full = structure();

    expect(
      (["teams", "network", "admins", "company"] as const).filter((domain) =>
        isDomainVisible(domain, full),
      ),
    ).toEqual(["teams", "network", "admins", "company"]);
  });

  it("lascia il solo dominio Squadre nello scope del master 05", () => {
    const scoped = structure({
      adminInvitesPendingCount: null,
      adminsCount: null,
      canEditCompanyData: false,
      canOpenAdminCenter: false,
      canViewAdminInvites: false,
      canViewAdmins: false,
      // Nel master 05 la fixture autorizza soltanto il dominio Squadre.
      canViewCompanyData: false,
      canViewNetwork: false,
      canViewRequests: false,
      scopeLabel: "Primavera",
    });

    expect(
      (["teams", "network", "admins", "company"] as const).filter((domain) =>
        isDomainVisible(domain, scoped),
      ),
    ).toEqual(["teams"]);
  });
});

describe("domainRows", () => {
  it("espone le cinque righe del master 02", () => {
    const full = structure();

    expect(
      (["teams", "network", "admins", "company"] as const).flatMap((domain) =>
        domainRows(domain, full).map((row) => row.id),
      ),
    ).toEqual(["teams", "seasons", "network", "admins", "company_edit"]);
  });

  it("apre Stagioni senza passare dal Centro Squadre (§9)", () => {
    const rows = domainRows("teams", structure());

    expect(rows.find((row) => row.id === "seasons")?.href).toBe(
      STRUCTURE_HREFS.seasons,
    );
  });

  it("rivalida i due accessi delle Squadre in modo indipendente (§9)", () => {
    const seasonsOnly = structure({ canViewTeams: false });

    expect(domainRows("teams", seasonsOnly).map((row) => row.id)).toEqual([
      "seasons",
    ]);
  });

  it("usa un solo centro per la rete, sulla tab leggibile (§10)", () => {
    expect(domainRows("network", structure())[0].href).toBe(
      STRUCTURE_HREFS.network,
    );

    // Chi non può leggere Collegate ma può leggere Richieste apre la tab
    // autorizzata dello **stesso** centro, non una seconda pagina.
    const requestsOnly = structure({ canViewNetwork: false });

    expect(domainRows("network", requestsOnly)).toHaveLength(1);
    expect(domainRows("network", requestsOnly)[0].href).toBe(
      STRUCTURE_HREFS.networkRequests,
    );
  });

  it("omette Modifica dati società a chi può solo leggere (QA-31)", () => {
    const readOnly = structure({ canEditCompanyData: false });

    // Assente, non disabilitata: §12 vieta «un pulsante disabled per mancanza
    // di permesso».
    expect(domainRows("company", readOnly)).toEqual([]);
    expect(isDomainVisible("company", readOnly)).toBe(true);
  });

  it("apre il form della Società, non quello della persona (QA-35)", () => {
    expect(domainRows("company", structure())[0].href).toBe(
      "/profile/society-edit?clubId=club-1",
    );
  });
});

describe("signalHref", () => {
  it("apre la revisione della richiesta ricevuta (QA-37)", () => {
    // Apre, non accetta: la destinazione è la revisione canonica con gli ID
    // corretti.
    expect(signalHref(signal())).toBe(
      "/society-link/review?clubId=club-1&relationshipId=rel-1",
    );
  });

  it("manda il gruppo alla lista Richieste, non a una controparte (QA-38)", () => {
    expect(
      signalHref(
        signal({
          context: null,
          count: 3,
          id: "network_requests",
          kind: "network_requests",
          relationshipId: null,
        }),
      ),
    ).toBe(STRUCTURE_HREFS.networkRequests);
  });

  it("porta il segnale stagionale sul percorso Team–Season (QA-39)", () => {
    expect(
      signalHref(
        signal({
          id: "season_prepare:team-9",
          kind: "team_season",
          relationshipId: null,
          seasonTarget: "next",
          teamId: "team-9",
        }),
      ),
    ).toBe("/team-seasons/config?teamId=team-9&target=next");
  });

  it("non instrada un segnale privo del proprio riferimento", () => {
    expect(signalHref(signal({ relationshipId: null }))).toBeNull();
  });

  it("dà alla primaria un nome accessibile con il contesto (§28)", () => {
    expect(signalActionLabel(signal())).toBe(
      "Valuta richiesta: Lario Academy · Partnership",
    );
  });
});

describe("mapStructureSignals", () => {
  const base = {
    action_label: "Valuta richiesta",
    club_id: "club-1",
    context: "Lario Academy · Partnership",
    count: 1,
    id: "network_request:rel-1",
    kind: "network_request",
    relationship_id: "rel-1",
    season_target: null,
    team_id: null,
    title: "1 richiesta da valutare",
  };

  it("mappa il segnale del master 03", () => {
    const [mapped] = mapStructureSignals([base]);

    expect(mapped).toMatchObject({
      actionLabel: "Valuta richiesta",
      context: "Lario Academy · Partnership",
      kind: "network_request",
      relationshipId: "rel-1",
      title: "1 richiesta da valutare",
    });
  });

  it("scarta un kind che questa build non sa instradare (§14)", () => {
    expect(mapStructureSignals([{ ...base, kind: "quantum_alert" }])).toEqual([]);
  });

  it("scarta un segnale senza il riferimento della sua destinazione", () => {
    expect(
      mapStructureSignals([{ ...base, relationship_id: null }]),
    ).toEqual([]);

    expect(
      mapStructureSignals([
        { ...base, kind: "team_season", relationship_id: null, team_id: null },
      ]),
    ).toEqual([]);
  });

  it("scarta un segnale che non rappresenta nessuna attività", () => {
    expect(mapStructureSignals([{ ...base, count: 0 }])).toEqual([]);
  });

  it("tollera un payload non previsto senza far cadere la pagina", () => {
    expect(mapStructureSignals(null)).toEqual([]);
    expect(mapStructureSignals([null, 42, "x"])).toEqual([]);
  });
});

describe("hasStructuralDomain", () => {
  it("mostra l'ingresso a chi gestisce le squadre", () => {
    expect(hasStructuralDomain(identity(["dashboard_view", "teams_view"]))).toBe(
      true,
    );
  });

  it("mostra l'ingresso a chi legge la rete societaria", () => {
    expect(
      hasStructuralDomain(identity(["dashboard_view", "network_view"])),
    ).toBe(true);
  });

  it("omette l'ingresso senza alcun dominio strutturale (QA-04)", () => {
    // I soli dati master non sono un dominio da gestire: sono già leggibili
    // sul profilo pubblico della Società.
    expect(
      hasStructuralDomain(identity(["dashboard_view", "shortlist_view"])),
    ).toBe(false);
  });

  it("non esiste per un'identità che non è una Società", () => {
    const person: DashboardIdentity = {
      ...identity([], true),
      kind: "person",
    };

    expect(hasStructuralDomain(person)).toBe(false);
  });
});
