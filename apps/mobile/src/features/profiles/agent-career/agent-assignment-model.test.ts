/**
 * Regole della carriera da procuratore (REV-PROF-15).
 *
 * I casi qui sotto sono quelli che il modello non può sbagliare senza che
 * l'utente se ne accorga a schermo: due esperienze principali, un'agenzia
 * accorpata a un'altra per somiglianza di nome, un mese inventato sopra un
 * dato annuale, una sovrapposizione scambiata per un duplicato.
 */
import { describe, expect, it } from "vitest";

import type { AgentCareerEntryRecord } from "../agent-profile";
import {
  AGENT_INDEPENDENT_GROUP_ID,
  AGENT_INDEPENDENT_LABEL,
  createAgentAssignment,
  formatAssignmentCount,
  formatAssignmentPeriod,
  getAssignmentGroupId,
  groupAgentAssignments,
  hasOverlappingAssignment,
  isExactDuplicate,
  recordsToAssignments,
  resolvePrimaryAssignment,
  shouldDefaultToPrimary,
  sortAssignments,
  validateAgentAssignment,
  type AgentCareerAssignment,
} from "./agent-assignment-model";

const NOW = new Date("2026-06-15T00:00:00.000Z");

function buildAssignment(
  overrides: Partial<AgentCareerAssignment> = {},
): AgentCareerAssignment {
  return {
    ...createAgentAssignment("agency"),
    id: overrides.id ?? "assignment-1",
    organizationClubId: "club-1",
    organizationName: "MB Football Management",
    role: "Titolare",
    startMonth: "Gennaio",
    startYear: "2021",
    ...overrides,
  };
}

function buildRecord(
  overrides: Partial<AgentCareerEntryRecord> = {},
): AgentCareerEntryRecord {
  return {
    agency_logo_url: null,
    agency_name: "MB Football Management",
    agent_profile_id: "agent-1",
    description: null,
    id: "entry-1",
    is_current: true,
    is_primary: false,
    manual_organization_id: null,
    organization_city: "Milano",
    organization_club_id: "club-1",
    organization_country: null,
    organization_mode: "agency",
    period_end_month: null,
    period_end_precision: "month",
    period_end_year: null,
    period_start_month: "Gennaio",
    period_start_precision: "month",
    period_start_year: 2021,
    role: "Titolare",
    sort_order: 0,
    visibility: "public",
    ...overrides,
  };
}

describe("periodi", () => {
  it("mostra 'Presente' per un incarico in corso", () => {
    expect(
      formatAssignmentPeriod(buildAssignment({ isCurrent: true })),
    ).toBe("Gennaio 2021 — Presente");
  });

  it("mostra il solo anno quando il dato legacy non ha il mese", () => {
    const [assignment] = recordsToAssignments([
      buildRecord({
        is_current: false,
        period_end_precision: "year",
        period_end_year: 2020,
        period_start_month: null,
        period_start_precision: "year",
        period_start_year: 2017,
      }),
    ]);

    // Né "Gennaio 2017" né "Dicembre 2020": il mese non esiste e non si inventa.
    expect(formatAssignmentPeriod(assignment!)).toBe("2017 — 2020");
  });
});

describe("validazione", () => {
  it("richiede la data finale di un incarico concluso", () => {
    expect(
      validateAgentAssignment(buildAssignment({ isCurrent: false }), NOW).endDate,
    ).toBe("Inserisci la data finale.");
  });

  it("rifiuta una data finale precedente a quella iniziale", () => {
    const errors = validateAgentAssignment(
      buildAssignment({
        endMonth: "Gennaio",
        endYear: "2019",
        isCurrent: false,
      }),
      NOW,
    );

    expect(errors.endDate).toBe(
      "La data finale non può precedere quella iniziale.",
    );
  });

  it("rifiuta una data futura", () => {
    const errors = validateAgentAssignment(
      buildAssignment({ isCurrent: true, startYear: "2030" }),
      NOW,
    );

    expect(errors.startDate).toBe(
      "La data non può essere successiva al mese corrente.",
    );
  });

  it("chiede un'organizzazione a un'esperienza in agenzia", () => {
    const errors = validateAgentAssignment(
      buildAssignment({
        isCurrent: true,
        manualOrganizationId: null,
        organizationClubId: null,
      }),
      NOW,
    );

    expect(errors.organization).toBe("Seleziona un'agenzia o uno studio.");
  });

  it("non chiede nessuna organizzazione a un'attività indipendente", () => {
    const errors = validateAgentAssignment(
      {
        ...createAgentAssignment("independent"),
        isCurrent: true,
        role: "Procuratore sportivo",
        startMonth: "Marzo",
        startYear: "2017",
      },
      NOW,
    );

    expect(errors.organization).toBeUndefined();
  });
});

describe("duplicati e sovrapposizioni", () => {
  it("riconosce un duplicato esatto", () => {
    const first = buildAssignment({ id: "a", isCurrent: true });
    const second = buildAssignment({ id: "b", isCurrent: true });

    expect(isExactDuplicate(second, [first])).toBe(true);
  });

  it("non considera duplicato un ruolo diverso nella stessa agenzia", () => {
    const first = buildAssignment({ id: "a", isCurrent: true });
    const second = buildAssignment({
      id: "b",
      isCurrent: true,
      role: "Procuratore sportivo",
    });

    expect(isExactDuplicate(second, [first])).toBe(false);
  });

  it("ignora l'organizzazione nel confronto fra attività indipendenti", () => {
    const base = {
      ...createAgentAssignment("independent"),
      isCurrent: true,
      role: "Agente",
      startMonth: "Marzo",
      startYear: "2017",
    };

    expect(
      isExactDuplicate({ ...base, id: "b" }, [{ ...base, id: "a" }]),
    ).toBe(true);
  });

  it("segnala la sovrapposizione senza considerarla un duplicato", () => {
    const existing = buildAssignment({ id: "a", isCurrent: true });
    const overlapping = buildAssignment({
      id: "b",
      isCurrent: true,
      organizationClubId: "club-2",
      organizationName: "Football Talent Group",
      startMonth: "Giugno",
      startYear: "2023",
    });

    expect(hasOverlappingAssignment(overlapping, [existing], NOW)).toBe(true);
    expect(isExactDuplicate(overlapping, [existing])).toBe(false);
  });
});

describe("raggruppamento", () => {
  it("tiene separate due agenzie con nome simile", () => {
    const groups = groupAgentAssignments([
      buildAssignment({ id: "a", isCurrent: true, organizationClubId: "club-1" }),
      buildAssignment({
        endMonth: "Dicembre",
        endYear: "2020",
        id: "b",
        isCurrent: false,
        organizationClubId: "club-2",
        organizationName: "MB Football Management SRL",
        startMonth: "Marzo",
        startYear: "2017",
      }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("raggruppa per id manuale, non per nome", () => {
    const groups = groupAgentAssignments([
      buildAssignment({
        id: "a",
        isCurrent: true,
        manualOrganizationId: "manual-1",
        organizationClubId: null,
      }),
      buildAssignment({
        endMonth: "Dicembre",
        endYear: "2022",
        id: "b",
        isCurrent: false,
        manualOrganizationId: "manual-1",
        organizationClubId: null,
        role: "Procuratore sportivo",
        startMonth: "Gennaio",
        startYear: "2021",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.countLabel).toBe("2 incarichi");
  });

  it("tiene l'attività indipendente in un gruppo autonomo", () => {
    const independent = {
      ...createAgentAssignment("independent"),
      endMonth: "Dicembre",
      endYear: "2020",
      id: "ind",
      role: "Procuratore sportivo",
      startMonth: "Marzo",
      startYear: "2017",
    };

    expect(getAssignmentGroupId(independent)).toBe(AGENT_INDEPENDENT_GROUP_ID);

    const groups = groupAgentAssignments([
      buildAssignment({ id: "a", isCurrent: true }),
      independent,
    ]);

    const independentGroup = groups.find(
      (group) => group.groupId === AGENT_INDEPENDENT_GROUP_ID,
    );

    expect(independentGroup?.organizationName).toBe(AGENT_INDEPENDENT_LABEL);
    expect(independentGroup?.logoUrl).toBe("");
  });

  it("calcola il periodo complessivo del gruppo dai record contenuti", () => {
    const groups = groupAgentAssignments([
      buildAssignment({
        id: "a",
        isCurrent: true,
        startMonth: "Gennaio",
        startYear: "2023",
      }),
      buildAssignment({
        endMonth: "Dicembre",
        endYear: "2022",
        id: "b",
        isCurrent: false,
        role: "Procuratore sportivo",
        startMonth: "Gennaio",
        startYear: "2021",
      }),
    ]);

    expect(groups[0]?.periodLabel).toBe("2021 — Presente");
    expect(groups[0]?.countLabel).toBe("2 incarichi");
  });

  it("mette per primo il gruppo con l'esperienza principale", () => {
    const groups = groupAgentAssignments([
      buildAssignment({
        endMonth: "Dicembre",
        endYear: "2025",
        id: "old",
        isCurrent: false,
        organizationClubId: "club-2",
        organizationName: "Football Talent Group",
        startMonth: "Gennaio",
        startYear: "2024",
      }),
      buildAssignment({ id: "primary", isCurrent: true, isPrimary: true }),
    ]);

    expect(groups[0]?.hasPrimary).toBe(true);
  });
});

describe("esperienza principale", () => {
  it("sceglie l'incarico marcato come principale", () => {
    const resolved = resolvePrimaryAssignment([
      buildAssignment({ id: "a", isCurrent: true, startYear: "2024" }),
      buildAssignment({ id: "b", isCurrent: true, isPrimary: true }),
    ]);

    expect(resolved?.id).toBe("b");
  });

  it("senza flag ricade sull'incarico in corso iniziato più di recente", () => {
    const resolved = resolvePrimaryAssignment([
      buildAssignment({ id: "a", isCurrent: true, startYear: "2021" }),
      buildAssignment({ id: "b", isCurrent: true, startYear: "2024" }),
    ]);

    expect(resolved?.id).toBe("b");
  });

  it("non promuove mai un'esperienza conclusa a situazione attuale", () => {
    const resolved = resolvePrimaryAssignment([
      buildAssignment({
        endMonth: "Dicembre",
        endYear: "2020",
        id: "a",
        isCurrent: false,
        isPrimary: false,
      }),
    ]);

    expect(resolved).toBeNull();
  });

  it("propone il primo incarico in corso come principale, non il secondo", () => {
    expect(shouldDefaultToPrimary([], null)).toBe(true);
    expect(
      shouldDefaultToPrimary([buildAssignment({ id: "a", isCurrent: true })], null),
    ).toBe(false);
    // Riaprire quello stesso incarico non lo fa contare contro sé stesso.
    expect(
      shouldDefaultToPrimary([buildAssignment({ id: "a", isCurrent: true })], "a"),
    ).toBe(true);
  });
});

describe("ordinamento e conteggi", () => {
  it("mette principale, poi in corso, poi inizio più recente", () => {
    const sorted = sortAssignments([
      buildAssignment({
        endMonth: "Dicembre",
        endYear: "2020",
        id: "closed",
        isCurrent: false,
      }),
      buildAssignment({ id: "current", isCurrent: true, startYear: "2022" }),
      buildAssignment({ id: "primary", isCurrent: true, isPrimary: true }),
    ]);

    expect(sorted.map((assignment) => assignment.id)).toEqual([
      "primary",
      "current",
      "closed",
    ]);
  });

  it("usa il singolare per un solo incarico", () => {
    expect(formatAssignmentCount(1)).toBe("1 incarico");
    expect(formatAssignmentCount(3)).toBe("3 incarichi");
  });
});

describe("lettura dei record", () => {
  it("non porta organizzazione né logo su un'attività indipendente", () => {
    const [assignment] = recordsToAssignments([
      buildRecord({
        agency_logo_url: "https://example.com/logo.png",
        agency_name: "Qualcosa",
        organization_club_id: "club-1",
        organization_mode: "independent",
      }),
    ]);

    expect(assignment?.organizationName).toBe("");
    expect(assignment?.organizationLogoUrl).toBe("");
    expect(assignment?.organizationClubId).toBeNull();
  });
});
