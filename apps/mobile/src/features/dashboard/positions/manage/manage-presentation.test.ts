/**
 * Le regole di dominio del dettaglio gestionale (DAS-REV-17 §34, §35).
 *
 * «Scrivi test che verifichino contratti e rischi reali, evitando una copia
 * delle condizioni del componente come unica prova.» Qui si verificano la
 * matrice di pubblicabilità dei quattro profili, la derivazione
 * dell'elenco mancante dai blockers reali e la separazione fra conteggio
 * assente e conteggio a zero: tre cose che la specifica rende vincolanti e
 * che non dipendono da come sono disposte sullo schermo.
 *
 * Le fixture sono quelle di §29, con i valori che il mockup mostra.
 */
import { describe, expect, it } from "vitest";

import type { PositionBlocker } from "../compose/compose-types";
import {
  MANAGE_COPY,
  applicationsLine,
  blockerAnchor,
  detailSections,
  draftReadiness,
  firstMissingAnchor,
  lifecycleLabel,
  lockedInfoBody,
  missingItems,
  readinessBody,
  readinessHeadline,
  readinessLinkLabel,
} from "./manage-presentation";
import type { PositionManageDetail } from "./manage-types";

const EMPTY_CATALOGS = {
  categories: [],
  experiences: [],
  qualifications: [],
  roles: [],
  seasons: [],
};

function detail(
  overrides: Partial<PositionManageDetail> = {},
): PositionManageDetail {
  return {
    accessVerifiedAt: 0,
    ageMax: null,
    ageMin: null,
    ageMode: "unset",
    applicationsNew: null,
    applicationsTotal: null,
    blockers: [],
    canClose: false,
    canEdit: true,
    canPublish: true,
    closedAt: null,
    clubCity: "Como",
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    clubRegion: "Lombardia",
    contextLabel: "Settore giovanile",
    countsAvailable: false,
    creationBatchId: null,
    customRoleName: "Responsabile scouting",
    dataRevision: 1,
    deadlineAt: null,
    deadlineDate: null,
    deadlineTimezone: null,
    description: null,
    details: {},
    group: "drafts",
    hasDetails: false,
    id: "pos-a",
    lifecycle: "draft",
    profileType: "director",
    publishedAt: null,
    receivingClosed: false,
    resourceVersion: 3,
    roleId: "other_executive",
    roleIsCustom: true,
    roleLabel: "Altro",
    schemaVersion: 1,
    scope: "team",
    seasonLabel: null,
    secondaryTeams: [],
    status: "draft",
    teamId: "team-primavera",
    teamIsInactive: false,
    teamName: "Primavera",
    title: "Responsabile scouting",
    updatedAt: null,
    ...overrides,
  };
}

/** Fixture A — Dirigente pubblicabile senza dettagli (screen 01). */
const FIXTURE_A = detail();

/** Fixture A arricchita — stesso ID, ancora DRAFT (screen 04). */
const FIXTURE_A_ENRICHED = detail({
  details: {
    availability: { mode: "next_season" },
    experience: ["youth_sector", "society_management"],
    responsibilities:
      "Scouting del settore giovanile e valutazione dei profili per la Primavera.",
  },
  hasDetails: true,
});

/** Fixture B — Calciatore con età non impostata (screen 06). */
const FIXTURE_B = detail({
  blockers: ["AGE_UNSET"],
  customRoleName: null,
  id: "pos-b",
  profileType: "player",
  roleId: "forward",
  roleIsCustom: false,
  roleLabel: "Attaccante",
  title: "Attaccante",
});

/** Fixture C — Staff attivo con candidature (screen 07). */
const FIXTURE_C = detail({
  applicationsNew: 3,
  applicationsTotal: 12,
  canPublish: false,
  contextLabel: "Serie D",
  countsAvailable: true,
  customRoleName: "Data analyst",
  details: {
    availability: { mode: "next_season" },
    experience: ["first_team"],
    staffQualification: "Corso di data analysis sportiva o equivalente",
  },
  group: "active",
  hasDetails: true,
  id: "pos-c",
  lifecycle: "published",
  profileType: "staff",
  publishedAt: "2026-09-01T10:00:00Z",
  roleId: "other_staff",
  roleIsCustom: true,
  roleLabel: "Altro",
  secondaryTeams: [{ isInactive: false, name: "Under 15", teamId: "team-u15" }],
  status: "published",
  teamId: "team-first",
  teamName: "Prima squadra",
  title: "Data analyst",
});

/** Fixture D — Dirigente societario in sola consultazione (screen 12). */
const FIXTURE_D = detail({
  canEdit: false,
  canPublish: false,
  contextLabel: null,
  customRoleName: null,
  details: {
    availability: { mode: "immediate" },
    responsibilities:
      "Coordinamento dello scouting e supporto alla direzione sportiva.",
  },
  group: "active",
  hasDetails: true,
  id: "pos-d",
  lifecycle: "published",
  roleId: "sporting_director",
  roleIsCustom: false,
  roleLabel: "Direttore sportivo",
  scope: "society",
  status: "published",
  teamId: null,
  teamName: null,
  title: "Direttore sportivo",
});

describe("stato e readiness (§4, §7)", () => {
  it("usa le label italiane senza introdurre un lifecycle ACTIVE", () => {
    expect(lifecycleLabel(FIXTURE_A)).toBe("Bozza");
    expect(lifecycleLabel(FIXTURE_C)).toBe("Attiva");
    /* L'enum interno resta quello del dominio. */
    expect(FIXTURE_C.status).toBe("published");
  });

  it("una bozza Dirigente senza dettagli è pubblicabile e invita ad aggiungerli", () => {
    expect(draftReadiness(FIXTURE_A)).toBe("suggest_details");
    expect(readinessHeadline(FIXTURE_A)).toBe(
      "Aggiungi dettagli per completare l'annuncio",
    );
    expect(readinessBody(FIXTURE_A)).toBe(MANAGE_COPY.addDetailsGuidance);
    /* §7: la pubblicazione resta possibile, l'invito non è un blocco. */
    expect(FIXTURE_A.blockers).toHaveLength(0);
    expect(readinessLinkLabel(FIXTURE_A)).toBe(MANAGE_COPY.addDetailsAction);
  });

  it("una bozza Allenatore senza facoltativi è già pronta", () => {
    const coach = detail({ profileType: "coach", roleId: "head_coach" });

    expect(draftReadiness(coach)).toBe("ready_without_details");
    expect(readinessHeadline(coach)).toBe(MANAGE_COPY.readyLabel);
    expect(readinessBody(coach)).toBeNull();
  });

  it("arricchire una bozza la porta a «Pronta» senza cambiare lifecycle", () => {
    expect(draftReadiness(FIXTURE_A_ENRICHED)).toBe("ready");
    expect(readinessHeadline(FIXTURE_A_ENRICHED)).toBe(MANAGE_COPY.readyLabel);
    expect(readinessLinkLabel(FIXTURE_A_ENRICHED)).toBe(
      MANAGE_COPY.editDetailsAction,
    );
    expect(FIXTURE_A_ENRICHED.lifecycle).toBe("draft");
    expect(FIXTURE_A_ENRICHED.id).toBe(FIXTURE_A.id);
  });

  it("rimuovere i dettagli ripristina la guida senza bloccare la pubblicazione", () => {
    const stripped = detail({ details: {}, hasDetails: false });

    expect(draftReadiness(stripped)).toBe("suggest_details");
    expect(stripped.blockers).toHaveLength(0);
  });

  it("una posizione attiva non ha readiness: non è un form da completare", () => {
    expect(readinessHeadline(FIXTURE_C)).toBeNull();
    expect(readinessBody(FIXTURE_C)).toBeNull();
    expect(readinessLinkLabel(FIXTURE_C)).toBeNull();
  });

  it("una bozza incompleta non offre l'invito ai dettagli al posto del comando", () => {
    expect(draftReadiness(FIXTURE_B)).toBe("incomplete");
    expect(readinessHeadline(FIXTURE_B)).toBe(MANAGE_COPY.toComplete);
    expect(readinessBody(FIXTURE_B)).toBe(MANAGE_COPY.completeGuidance);
    expect(readinessLinkLabel(FIXTURE_B)).toBeNull();
  });
});

describe("elenco delle informazioni mancanti (§7, §10)", () => {
  it("deriva dai blockers reali e porta al campo pertinente", () => {
    const items = missingItems(FIXTURE_B);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Fascia d'età");
    expect(items[0].value).toBe(MANAGE_COPY.toSet);
    expect(items[0].hint).toBe(
      "Imposta un intervallo oppure scegli Nessun limite di età.",
    );
    expect(items[0].anchor).toBe("ageRange");
  });

  it("non inventa righe quando la bozza è valida", () => {
    expect(missingItems(FIXTURE_A)).toHaveLength(0);
  });

  it("«Completa posizione» punta al primo campo obbligatorio mancante", () => {
    const multi = detail({
      blockers: ["ROLE_MISSING", "AGE_UNSET"] as PositionBlocker[],
      profileType: "player",
    });

    expect(firstMissingAnchor(multi)).toBe("roleId");
  });

  it("non duplica una riga quando due blocker riguardano lo stesso campo", () => {
    const both = detail({
      blockers: ["AGE_RANGE_INCOMPLETE", "AGE_RANGE_INVALID"] as PositionBlocker[],
      profileType: "player",
    });

    expect(missingItems(both)).toHaveLength(1);
  });

  it("un blocker che non vive nel form non porta a un'ancora inventata", () => {
    expect(blockerAnchor("DEADLINE_PASSED")).toBeNull();
    expect(blockerAnchor("POSITION_NOT_FOUND")).toBeNull();
  });
});

describe("conteggi Application (§5, §18)", () => {
  it("mostra totale e nuove su una sola riga", () => {
    expect(applicationsLine(FIXTURE_C)).toBe("12 candidature · 3 nuove");
  });

  it("omette la riga quando l'actor non è autorizzato, senza mostrare zero", () => {
    expect(applicationsLine(FIXTURE_D)).toBeNull();
    expect(FIXTURE_D.applicationsTotal).toBeNull();
  });

  it("un conteggio non ancora noto non diventa zero", () => {
    expect(
      applicationsLine({
        applicationsNew: null,
        applicationsTotal: null,
        countsAvailable: true,
      }),
    ).toBeNull();
  });

  it("zero nuove non produce il suffisso «0 nuove»", () => {
    expect(
      applicationsLine({
        applicationsNew: 0,
        applicationsTotal: 1,
        countsAvailable: true,
      }),
    ).toBe("1 candidatura");
  });
});

describe("sezioni leggibili (§7, §18)", () => {
  it("omette i facoltativi vuoti invece di scrivere «Non specificato»", () => {
    const sections = detailSections(FIXTURE_A, EMPTY_CATALOGS);

    expect(sections).toHaveLength(0);
  });

  it("mostra solo le sezioni compilate, nell'ordine dello schema", () => {
    const sections = detailSections(FIXTURE_A_ENRICHED, {
      ...EMPTY_CATALOGS,
      experiences: [
        { id: "youth_sector", isCustom: false, label: "Settore giovanile", needsContext: false },
        {
          id: "society_management",
          isCustom: false,
          label: "Gestione societaria",
          needsContext: false,
        },
      ],
    });

    expect(sections.map((section) => section.key)).toEqual([
      "responsibilities",
      "experience",
      "availability",
    ]);
    expect(sections[1].value).toBe("Settore giovanile · Gestione societaria");
    expect(sections[2].value).toBe("Inizio prossima stagione");
  });

  it("le squadre secondarie dell'attiva restano leggibili", () => {
    const sections = detailSections(FIXTURE_C, EMPTY_CATALOGS);

    expect(sections[0]).toMatchObject({
      key: "secondaryTeams",
      value: "Under 15",
    });
    expect(sections.map((section) => section.key)).toContain("staffQualification");
  });
});

describe("informazioni fisse (§19)", () => {
  it("nomina la squadra principale per un incarico di squadra", () => {
    expect(lockedInfoBody(FIXTURE_C)).toContain("squadra principale");
  });

  it("nomina l'ambito, non una squadra inesistente, per un incarico societario", () => {
    expect(lockedInfoBody(FIXTURE_D)).toContain("ambito dell'incarico");
    expect(lockedInfoBody(FIXTURE_D)).not.toContain("squadra");
  });

  it("la spiegazione non contiene un comando di chiusura", () => {
    expect(MANAGE_COPY.lockedInfoTail).toContain("creane una nuova");
    expect(MANAGE_COPY.lockedAck).toBe("Ho capito");
  });
});
