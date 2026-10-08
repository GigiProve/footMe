/**
 * Scenari QA del Master Profile Procuratore (REV-PROF-13).
 *
 * Coprono ciò che distingue questa tipologia dagli altri Master Profile: la
 * carriera a periodi datati invece che a stagioni, l'incarico attuale derivato
 * dalla carriera e non da un campo separato, il portfolio assistiti ridotto
 * alle sole relazioni pubbliche, le informazioni rapide che spariscono invece
 * di mostrare un trattino, le macroaree dei Dettagli nell'ordine della task e
 * la separazione fra azioni Owner e Visitor.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import type { AgentCareerEntryRecord } from "../agent-profile";
import type { AgentPublicAssistito } from "../../relationships/agent-representation-service";
import { buildAgentProfileHeaderDetails } from "../profile-edit-helpers";
import { AgentCareerTab } from "./AgentCareerTab";
import { AgentDetailsTab } from "./AgentDetailsTab";
import { AgentProfileTabView, resolveAgentInitialTab } from "./AgentProfileTabView";
import {
  buildAgentProfileCareer,
  computeAgentActivityYears,
  getAvailableAgentPaths,
  isManualEntryPubliclyVisible,
} from "./agent-career-model";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

vi.mock("../../../components/ui/video-player-modal", () => ({
  VideoPlayerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-video-player-modal", props),
}));

vi.mock("../../content/use-tagged-content", () => ({
  useTaggedMediaItems: () => ({ onOpenTaggedItem: () => undefined, taggedItems: [] }),
}));

const fetchPublicAssistiti = vi.fn();

vi.mock("../../relationships/agent-representation-service", () => ({
  fetchAgentPublicAssistiti: (...args: unknown[]) => fetchPublicAssistiti(...args),
  getRelationshipTypeLabel: (type: string) =>
    type === "intermediario"
      ? "Intermediario"
      : type === "referente_sportivo"
        ? "Referente sportivo"
        : "Procuratore",
}));

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

/** Le tab del design system sono nodi host con `accessibilityRole="tab"`. */
function pressTab(tree: TestRenderer.ReactTestRenderer, label: string) {
  const tab = tree.root.find(
    (node) =>
      typeof node.type === "string" &&
      node.props?.accessibilityRole === "tab" &&
      node.props?.accessibilityLabel === label,
  );

  act(() => {
    tab.props.onPress();
  });
}

function textOf(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

const CURRENT_YEAR = new Date().getFullYear();

function buildCareerEntry(
  overrides: Partial<AgentCareerEntryRecord> = {},
): AgentCareerEntryRecord {
  return {
    agency_logo_url: null,
    agency_name: "MB Football Management",
    agent_profile_id: "agent-1",
    description: null,
    id: "exp-current",
    is_current: true,
    is_primary: true,
    manual_organization_id: null,
    organization_city: null,
    organization_club_id: null,
    organization_country: null,
    organization_mode: "agency",
    period_end_month: null,
    period_end_precision: "year",
    period_end_year: null,
    period_start_month: null,
    period_start_precision: "year",
    period_start_year: CURRENT_YEAR - 4,
    role: "Titolare",
    sort_order: 0,
    visibility: "public",
    ...overrides,
  };
}

const PREVIOUS_ENTRY = buildCareerEntry({
  agency_name: "Roma Sports Agency",
  id: "exp-previous",
  is_current: false,
  is_primary: false,
  period_end_year: CURRENT_YEAR - 4,
  period_start_year: CURRENT_YEAR - 8,
  role: "Procuratore",
  sort_order: 1,
});

function buildAgentProfileRecord(overrides: Record<string, unknown> = {}) {
  return {
    activity_scopes: ["professional", "youth"],
    agency_logo_url: null,
    agency_name: "MB Football Management",
    agency_role: "Titolare",
    federation: "FIGC",
    is_federation_licensed: true,
    license_number: "FIGC-99887",
    media_items: [],
    open_to_clubs: true,
    open_to_players: true,
    operating_area_type: null,
    operating_countries: [],
    operating_provinces: [],
    operating_regions: [],
    operational_focuses: ["Valorizzazione giovani", "Mercato internazionale"],
    period_start_year: CURRENT_YEAR - 4,
    player_career_entries: [],
    previous_roles: [],
    professional_mode: "agency",
    profile_id: "agent-1",
  } as unknown as CompleteProfessionalProfile["agentProfile"];
}

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    agentCareerEntries: [buildCareerEntry(), PREVIOUS_ENTRY],
    agentManagedPlayerEntries: [],
    agentProfile: buildAgentProfileRecord(),
    profile: {
      age: 38,
      avatar_url: null,
      birth_date: `${CURRENT_YEAR - 38}-04-11`,
      city: "Milano",
      cover_url: null,
      full_name: "Luca Rinaldi",
      id: "agent-1",
      languages: ["Italiano", "Inglese", "Spagnolo"],
      region: "Lombardia",
      role: "agent",
    },
    userContacts: {
      email: "luca@example.com",
      facebook: "",
      instagram: "",
      phone: "+39 333 1112223",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
      showPhone: false,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

function buildCareer(entries: AgentCareerEntryRecord[] = [buildCareerEntry(), PREVIOUS_ENTRY]) {
  return buildAgentProfileCareer({
    agentCareerEntries: entries,
    agentProfile: buildAgentProfileRecord(),
  });
}

const ASSISTITI: AgentPublicAssistito[] = [
  {
    created_at: "2026-01-01T00:00:00Z",
    featured_rank: null,
    current_team: "Serie A",
    id: "rel-1",
    player_avatar_url: null,
    player_full_name: "Luca Bianchi",
    player_profile_id: "player-1",
    primary_position: "forward",
    relationship_type: "procuratore",
  },
  {
    created_at: "2026-01-02T00:00:00Z",
    featured_rank: null,
    current_team: "Serie B",
    id: "rel-2",
    player_avatar_url: null,
    player_full_name: "Marco Verdi",
    player_profile_id: "player-2",
    primary_position: "goalkeeper",
    relationship_type: "intermediario",
  },
];

// ---------------------------------------------------------------------------
// Modello di carriera
// ---------------------------------------------------------------------------

describe("Master Profile Procuratore — carriera", () => {
  it("deriva l'incarico attuale dalla carriera, non dalle colonne legacy", () => {
    const career = buildCareer();

    expect(career.currentExperience?.id).toBe("exp-current");
    expect(career.currentExperience?.agencyName).toBe("MB Football Management");
    expect(career.previousExperiences.map((item) => item.id)).toEqual([
      "exp-previous",
    ]);
  });

  it("non promuove un'esperienza conclusa a incarico attuale", () => {
    const career = buildCareer([PREVIOUS_ENTRY]);

    expect(career.currentExperience).toBeNull();
    expect(career.experiences).toHaveLength(1);
  });

  it("sceglie l'esperienza principale, e in sua assenza la più recente", () => {
    const olderActive = buildCareerEntry({
      agency_name: "Prima agenzia",
      id: "exp-old-active",
      is_primary: false,
      period_start_year: CURRENT_YEAR - 9,
    });
    const newerActive = buildCareerEntry({
      agency_name: "Seconda agenzia",
      id: "exp-new-active",
      is_primary: false,
      period_start_year: CURRENT_YEAR - 2,
    });

    // Due incarichi in corso, nessuno principale: vince il più recente...
    expect(
      buildCareer([olderActive, newerActive]).currentExperience?.id,
    ).toBe("exp-new-active");

    // ...ma entrambi restano in carriera.
    expect(buildCareer([olderActive, newerActive]).experiences).toHaveLength(2);

    // Il flag esplicito batte la data.
    expect(
      buildCareer([
        { ...olderActive, is_primary: true },
        newerActive,
      ]).currentExperience?.id,
    ).toBe("exp-old-active");
  });

  it("un indipendente non mostra un'agenzia fittizia", () => {
    const career = buildCareer([
      buildCareerEntry({
        agency_name: null,
        id: "exp-independent",
        organization_mode: "independent",
      }),
    ]);

    expect(career.currentExperience?.agencyName).toBeNull();
    expect(career.currentExperience?.organizationMode).toBe("independent");
  });

  it("tiene fuori dal profilo le esperienze non pubbliche", () => {
    const career = buildCareer([
      buildCareerEntry({ id: "exp-private", visibility: "private" }),
      PREVIOUS_ENTRY,
    ]);

    expect(career.experiences.map((item) => item.id)).toEqual(["exp-previous"]);
  });

  it("legge le colonne legacy solo quando la carriera è vuota", () => {
    const career = buildAgentProfileCareer({
      agentCareerEntries: [],
      agentProfile: buildAgentProfileRecord(),
    });

    expect(career.currentExperience?.agencyName).toBe("MB Football Management");
    expect(career.currentExperience?.role).toBe("Titolare");
  });
});

describe("Master Profile Procuratore — anni di attività", () => {
  it("unisce i periodi sovrapposti invece di sommarli due volte", () => {
    const overlapping = [
      buildCareerEntry({
        id: "a",
        is_current: false,
        period_end_year: CURRENT_YEAR - 2,
        period_start_year: CURRENT_YEAR - 6,
      }),
      buildCareerEntry({
        id: "b",
        is_current: false,
        period_end_year: CURRENT_YEAR - 3,
        period_start_year: CURRENT_YEAR - 5,
      }),
    ];

    // Dal CURRENT_YEAR-6 al CURRENT_YEAR-2 inclusi: 5 anni, non 5 + 3.
    expect(computeAgentActivityYears(buildCareer(overlapping).experiences)).toBe(5);
  });

  it("non calcola gli anni senza una data di inizio", () => {
    const career = buildCareer([
      buildCareerEntry({ id: "no-start", period_start_year: null }),
    ]);

    expect(career.activityYears).toBeNull();
  });
});

describe("Master Profile Procuratore — assistiti", () => {
  it("non pubblica gli inserimenti manuali: il modello non porta un consenso", () => {
    expect(
      isManualEntryPubliclyVisible({
        agent_profile_id: "agent-1",
        avatar_url: null,
        birth_year: 2004,
        category_label: "Primavera",
        display_name: "Andrea Neri",
        id: "manual-1",
        is_free_agent: false,
        linked_profile_id: null,
        primary_position: "midfielder",
        sort_order: 0,
      }),
    ).toBe(false);
  });

  it("mostra gli assistiti pubblici con ruolo, squadra e tipo di rapporto", () => {
    const tree = render(
      <AgentCareerTab
        assistiti={ASSISTITI}
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="agent"
      />,
    );
    const rendered = textOf(tree);

    expect(rendered).toContain("Assistiti in evidenza");
    expect(rendered).toContain("Luca Bianchi");
    expect(rendered).toContain("Intermediario");
    expect(tree.root.findAllByProps({ testID: "agent-assistito-player-1" }).length)
      .toBeGreaterThan(0);
  });

  it("differenzia l'empty state del portfolio fra owner e visitor", () => {
    const owner = render(
      <AgentCareerTab
        assistiti={[]}
        career={buildCareer()}
        isOwner
        onManageAssistiti={() => undefined}
        onPathChange={() => undefined}
        path="agent"
      />,
    );
    const visitor = render(
      <AgentCareerTab
        assistiti={[]}
        career={buildCareer()}
        isOwner={false}
        onManageAssistiti={() => undefined}
        onPathChange={() => undefined}
        path="agent"
      />,
    );

    expect(textOf(owner)).toContain("Il tuo portfolio è ancora vuoto");
    expect(owner.root.findAllByProps({ testID: "agent-assistiti-manage" }).length)
      .toBeGreaterThan(0);

    expect(textOf(visitor)).toContain("Nessun assistito pubblico");
    // Nessuna CTA gestionale al Visitor, nemmeno a portfolio vuoto.
    expect(visitor.root.findAllByProps({ testID: "agent-assistiti-manage" })).toHaveLength(
      0,
    );
  });

  it("mostra un errore locale senza portarsi via la carriera", () => {
    const tree = render(
      <AgentCareerTab
        assistiti={[]}
        assistitiFailed
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="agent"
      />,
    );

    expect(tree.root.findAllByProps({ testID: "agent-assistiti-error" }).length)
      .toBeGreaterThan(0);
    expect(textOf(tree)).toContain("MB Football Management");
  });
});

// ---------------------------------------------------------------------------
// Informazioni rapide
// ---------------------------------------------------------------------------

describe("Master Profile Procuratore — informazioni rapide", () => {
  it("usa Età, Assistiti, Mercati e Anni dai dati reali", () => {
    const details = buildAgentProfileHeaderDetails(buildProfile(), 2);

    expect(details?.quickFacts.map((fact) => fact.key)).toEqual([
      "age",
      "assistiti",
      "markets",
      "years",
    ]);
    expect(details?.quickFacts.find((fact) => fact.key === "assistiti")?.value).toBe(
      "2",
    );
    // Due ambiti di attività dichiarati, non due regioni.
    expect(details?.quickFacts.find((fact) => fact.key === "markets")?.value).toBe(
      "2",
    );
  });

  it("toglie l'età quando la data di nascita non è pubblica", () => {
    const profile = buildProfile({
      profile: {
        ...buildProfile().profile,
        age: null,
        birth_date: null,
      },
    } as unknown as Partial<CompleteProfessionalProfile>);

    const details = buildAgentProfileHeaderDetails(profile, 2);

    // La colonna sparisce: nessuno zero e nessun trattino fuorviante.
    expect(details?.quickFacts.map((fact) => fact.key)).not.toContain("age");
  });

  it("costruisce la licenza dai dati e la omette quando non c'è", () => {
    expect(buildAgentProfileHeaderDetails(buildProfile(), 0)?.badges).toEqual([
      expect.objectContaining({ label: "Licenza FIGC (Italia)" }),
    ]);

    const unlicensed = buildProfile({
      agentProfile: buildAgentProfileRecord({}),
    });
    (unlicensed.agentProfile as { is_federation_licensed: boolean }).is_federation_licensed =
      false;

    expect(buildAgentProfileHeaderDetails(unlicensed, 0)?.badges).toEqual([]);
  });

  it("usa la denominazione approvata e l'organizzazione attuale", () => {
    const details = buildAgentProfileHeaderDetails(buildProfile(), 0);

    expect(details?.primaryRole).toBe("Procuratore sportivo");
    expect(details?.clubLabel).toBe("MB Football Management · Titolare");
    expect(details?.availabilityLabel).toBe("Aperto a nuove rappresentanze");
  });

  it("non accende il badge di verifica per una licenza", () => {
    expect(buildAgentProfileHeaderDetails(buildProfile(), 0)?.isVerified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dettagli
// ---------------------------------------------------------------------------

describe("Master Profile Procuratore — Dettagli", () => {
  it("dispone le macroaree nell'ordine della task", () => {
    const tree = render(
      <AgentDetailsTab career={buildCareer()} completeProfile={buildProfile()} />,
    );

    /*
      `findAll` restituisce sia il nodo componente sia il suo host: conta
      l'ordine delle macroaree, non quante volte ciascuna compare.
    */
    const order = tree.root
      .findAll(
        (node) =>
          typeof node.props?.testID === "string" &&
          node.props.testID.startsWith("agent-details-") &&
          node.props.testID !== "agent-details-tab" &&
          !node.props.testID.includes("path") &&
          !node.props.testID.includes("previous-agent"),
      )
      .map((node) => node.props.testID as string)
      .filter((id, index, all) => all[index - 1] !== id);

    expect(order).toEqual([
      "agent-details-opportunities",
      "agent-details-professional",
      "agent-details-activities",
      "agent-details-situation",
      "agent-details-previous",
      "agent-details-contacts",
    ]);
  });

  it("deriva agenzia e ruolo dall'incarico in corso", () => {
    const rendered = textOf(
      render(<AgentDetailsTab career={buildCareer()} completeProfile={buildProfile()} />),
    );

    expect(rendered).toContain("Agenzia");
    expect(rendered).toContain("MB Football Management");
    expect(rendered).toContain("Agenzia / Studio");
  });

  it("omette agenzia e ruolo quando nessun incarico è in corso", () => {
    const rendered = textOf(
      render(
        <AgentDetailsTab
          career={buildCareer([PREVIOUS_ENTRY])}
          completeProfile={buildProfile()}
        />,
      ),
    );

    expect(rendered).not.toContain("agent-details-situation");
    expect(rendered).not.toContain("Roma Sports Agency");
  });

  it("non mostra i contatti privati e spiega all'owner perché mancano", () => {
    const visitor = textOf(
      render(<AgentDetailsTab career={buildCareer()} completeProfile={buildProfile()} />),
    );
    const ownerProfile = buildProfile();
    // Nessun contatto pubblico, ma dei contatti salvati: il caso che l'avviso copre.
    (ownerProfile.userContacts as { showEmail: boolean }).showEmail = false;
    const owner = textOf(
      render(
        <AgentDetailsTab
          career={buildCareer()}
          completeProfile={ownerProfile}
          isOwner
        />,
      ),
    );

    // `showPhone: false`: il numero non arriva a nessuno dei due.
    expect(visitor).not.toContain("+39 333 1112223");
    expect(owner).not.toContain("+39 333 1112223");
    expect(visitor).not.toContain("I tuoi contatti sono privati");
    expect(owner).toContain("I tuoi contatti sono privati");
  });
});

// ---------------------------------------------------------------------------
// Struttura a tab
// ---------------------------------------------------------------------------

describe("Master Profile Procuratore — tab", () => {
  it("espone solo Carriera, Media e Dettagli, con Carriera iniziale", () => {
    fetchPublicAssistiti.mockResolvedValue([]);

    const tree = render(
      <AgentProfileTabView completeProfile={buildProfile()} isOwner={false} />,
    );

    const labels = tree.root
      .findAll(
        (node) =>
          typeof node.type === "string" && node.props?.accessibilityRole === "tab",
      )
      .map((node) => node.props.accessibilityLabel as string);

    expect(labels).toEqual(["Carriera", "Media", "Dettagli"]);
    // Nessuna traccia delle vecchie tab.
    expect(labels).not.toContain("Info");
    expect(labels).not.toContain("Opportunità");
    expect(tree.root.findAllByProps({ testID: "agent-career-tab" }).length)
      .toBeGreaterThan(0);
  });

  it("rimappa i nomi di tab legacy sul contenuto giusto", () => {
    expect(resolveAgentInitialTab("info")).toBe("details");
    expect(resolveAgentInitialTab("opportunities")).toBe("career");
    expect(resolveAgentInitialTab("media")).toBe("media");
    expect(resolveAgentInitialTab(undefined)).toBe("career");
  });

  it("non mostra controlli owner al visitor nella tab Media", () => {
    fetchPublicAssistiti.mockResolvedValue([]);

    const tree = render(
      <AgentProfileTabView
        completeProfile={buildProfile()}
        isOwner={false}
        onManageMedia={() => undefined}
      />,
    );

    pressTab(tree, "Media");

    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Aggiungi contenuto" }),
    ).toHaveLength(0);
  });

  it("nasconde il selettore dei percorsi senza carriere aggiuntive", () => {
    expect(getAvailableAgentPaths(buildCareer())).toEqual(["agent"]);

    const tree = render(
      <AgentCareerTab
        assistiti={[]}
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="agent"
      />,
    );

    expect(tree.root.findAllByProps({ testID: "agent-career-path" })).toHaveLength(0);
  });
});
