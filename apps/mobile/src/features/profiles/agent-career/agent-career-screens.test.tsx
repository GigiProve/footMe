/**
 * Scenari a schermo della gestione carriera Procuratore (REV-PROF-15).
 *
 * Coprono le otto schermate del mockup e quello che il Procuratore ha di
 * diverso dagli altri ruoli: periodi al posto delle stagioni, l'attività
 * indipendente senza agenzia fittizia, la ricerca delle organizzazioni reali
 * con il fallback manuale che compare solo dopo un tentativo, e la timeline
 * degli incarichi nel riepilogo.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CareerPathCopy } from "../career-manager/career-manager-config";
import { AdditionalPathsStep } from "../career-manager/steps/AdditionalPathsStep";
import {
  createAgentAssignment,
  groupAgentAssignments,
  type AgentCareerAssignment,
} from "./agent-assignment-model";
import { AGENT_CAREER_ROLE_OPTIONS } from "./agent-career-taxonomy";
import type { AgentOrganizationResult } from "./agent-career-service";
import { AgentCareerHubStep } from "./steps/AgentCareerHubStep";
import { AgentCareerSummaryStep } from "./steps/AgentCareerSummaryStep";
import { AgentExperienceFormStep } from "./steps/AgentExperienceFormStep";
import { AgentManualOrganizationStep } from "./steps/AgentManualOrganizationStep";
import { AgentOrganizationSearchStep } from "./steps/AgentOrganizationSearchStep";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("Ionicon", props),
}));

const PATHS: CareerPathCopy[] = [
  {
    appBarTitle: "Carriera da dirigente",
    emptyCtaLabel: "Aggiungi carriera da dirigente",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza",
    icon: "briefcase-outline",
    key: "director",
    title: "Carriera da dirigente",
  },
  {
    appBarTitle: "Carriera da calciatore",
    emptyCtaLabel: "Aggiungi carriera da calciatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza",
    icon: "walk-outline",
    key: "player",
    title: "Carriera da calciatore",
  },
];

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => (node.type as unknown as string) === "Text")
    .flatMap((node) =>
      React.Children.toArray(node.props.children).filter(
        (child): child is string => typeof child === "string",
      ),
    );
}

function assignment(
  overrides: Partial<AgentCareerAssignment> = {},
): AgentCareerAssignment {
  return {
    ...createAgentAssignment("agency"),
    id: "a1",
    organizationCity: "Milano",
    organizationClubId: "club-1",
    organizationName: "MB Football Management",
    role: "Titolare",
    startMonth: "Gennaio",
    startYear: "2021",
    ...overrides,
  };
}

/** L'esempio del mockup: due ruoli nella stessa agenzia, più un indipendente. */
const GROUPS = groupAgentAssignments([
  assignment({ id: "a1", isCurrent: true, isPrimary: true, startYear: "2023" }),
  assignment({
    endMonth: "Dicembre",
    endYear: "2022",
    id: "a2",
    role: "Procuratore sportivo",
  }),
  {
    ...createAgentAssignment("independent"),
    endMonth: "Dicembre",
    endYear: "2020",
    id: "a3",
    role: "Procuratore sportivo",
    startMonth: "Marzo",
    startYear: "2017",
  },
]);

describe("Screen 1 — Hub carriera", () => {
  it("mostra la carriera, i percorsi aggiuntivi e la CTA", () => {
    const tree = render(
      <AgentCareerHubStep
        groups={GROUPS}
        onAddExperience={() => {}}
        onEditGroup={() => {}}
        onOpenPath={() => {}}
        paths={[
          { copy: PATHS[0]!, count: 1 },
          { copy: PATHS[1]!, count: 0 },
        ]}
      />,
    );
    const content = texts(tree);

    expect(content).toContain("Carriera da procuratore");
    expect(content).toContain("MB Football Management");
    expect(content).toContain("2 incarichi");
    expect(content).toContain("Professionista indipendente");
    expect(content).toContain("Percorsi aggiuntivi");
    expect(content).toContain("Aggiungi esperienza");
    expect(content).toContain("1 esperienza aggiunta");
    expect(content).toContain("Nessuna esperienza aggiunta");
  });

  it("mostra l'empty state owner a carriera vuota", () => {
    const tree = render(
      <AgentCareerHubStep
        groups={[]}
        onAddExperience={() => {}}
        onEditGroup={() => {}}
        onOpenPath={() => {}}
        paths={[]}
      />,
    );

    expect(texts(tree)).toContain("Completa la tua carriera");
  });
});

describe("Screen 3 — Ricerca agenzia", () => {
  const RESULTS: AgentOrganizationResult[] = [
    {
      category: "Agenzia",
      city: "Milano",
      id: "club-1",
      logoUrl: null,
      name: "MB Football Management",
      region: "Lombardia",
    },
  ];

  it("non propone l'inserimento manuale prima di una ricerca", () => {
    const tree = render(
      <AgentOrganizationSearchStep
        onChangeQuery={() => {}}
        onManualEntry={() => {}}
        onSelect={() => {}}
        query=""
        search={() => Promise.resolve(RESULTS)}
      />,
    );

    expect(texts(tree)).not.toContain("Non trovi l'organizzazione?");
  });

  it("mostra i risultati reali e poi il fallback manuale", async () => {
    vi.useFakeTimers();

    const tree = render(
      <AgentOrganizationSearchStep
        onChangeQuery={() => {}}
        onManualEntry={() => {}}
        onSelect={() => {}}
        query="football"
        search={() => Promise.resolve(RESULTS)}
      />,
    );

    await act(async () => {
      vi.runAllTimers();
    });

    const content = texts(tree);

    expect(content).toContain("MB Football Management");
    expect(content).toContain("Milano");
    expect(content).toContain("Seleziona");
    expect(content).toContain("Non trovi l'organizzazione?");

    vi.useRealTimers();
  });

  it("mostra l'empty state con l'accesso manuale quando non trova nulla", async () => {
    vi.useFakeTimers();

    const tree = render(
      <AgentOrganizationSearchStep
        onChangeQuery={() => {}}
        onManualEntry={() => {}}
        onSelect={() => {}}
        query="zzzz"
        search={() => Promise.resolve([])}
      />,
    );

    await act(async () => {
      vi.runAllTimers();
    });

    const content = texts(tree);

    expect(content).toContain("Nessuna organizzazione trovata");
    expect(content).toContain("Inserisci manualmente");

    vi.useRealTimers();
  });

  it("mostra l'errore con il retry e lascia aperto l'inserimento manuale", async () => {
    vi.useFakeTimers();

    const tree = render(
      <AgentOrganizationSearchStep
        onChangeQuery={() => {}}
        onManualEntry={() => {}}
        onSelect={() => {}}
        query="football"
        search={() => Promise.reject(new Error("offline"))}
      />,
    );

    await act(async () => {
      vi.runAllTimers();
    });

    const content = texts(tree);

    expect(content).toContain(
      "Non è stato possibile caricare le organizzazioni. Riprova.",
    );
    expect(content).toContain("Riprova");
    expect(content).toContain("Inserisci manualmente");

    vi.useRealTimers();
  });
});

describe("Fallback manuale", () => {
  it("dichiara che non verrà creata nessuna pagina pubblica", () => {
    const tree = render(
      <AgentManualOrganizationStep
        draft={{ city: "", country: "", name: "" }}
        onChange={() => {}}
      />,
    );
    const content = texts(tree);

    expect(content).toContain("Nome dell'agenzia o dello studio");
    expect(content.join(" ")).toContain("non verrà creata una pagina su PROLINK");
  });
});

describe("Screen 4 e 5 — Form dell'esperienza", () => {
  it("mostra la card dell'organizzazione e l'ordine dei campi", () => {
    const tree = render(
      <AgentExperienceFormStep
        assignment={assignment({ isCurrent: true })}
        errors={{}}
        onChange={() => {}}
        roleOptions={AGENT_CAREER_ROLE_OPTIONS}
      />,
    );
    const content = texts(tree);

    expect(content).toContain("MB Football Management");
    expect(content).toContain("Milano");
    expect(content).toContain("Ruolo");
    expect(content).toContain("Da");
    expect(content).toContain("Incarico in corso");
    expect(content).toContain("Esperienza principale");
    expect(content).toContain(
      "L'esperienza principale viene mostrata nell'header del profilo.",
    );
    // §Screen 4: un incarico in corso non porta una data di fine, quindi il
    // campo sparisce invece di restare a schermo disattivato e ambiguo.
    expect(content).not.toContain("A");
    // Nessuna stagione, nessuna statistica, nessun dato degli assistiti.
    expect(content.join(" ")).not.toContain("Stagione");
    expect(content.join(" ")).not.toContain("assistit");
  });

  it("chiede la data finale quando l'incarico non è in corso", () => {
    const tree = render(
      <AgentExperienceFormStep
        assignment={assignment({ isCurrent: false })}
        errors={{}}
        onChange={() => {}}
        roleOptions={AGENT_CAREER_ROLE_OPTIONS}
      />,
    );
    const content = texts(tree);

    expect(content).toContain("Da");
    expect(content).toContain("A");
  });

  it("non chiede nessuna agenzia all'attività indipendente", () => {
    const tree = render(
      <AgentExperienceFormStep
        assignment={{
          ...createAgentAssignment("independent"),
          isCurrent: true,
          role: "Procuratore sportivo",
          startMonth: "Marzo",
          startYear: "2017",
        }}
        errors={{}}
        onChange={() => {}}
        roleOptions={AGENT_CAREER_ROLE_OPTIONS}
      />,
    );
    const content = texts(tree);

    expect(content.join(" ")).toContain(
      'Nel profilo verrà mostrato "Professionista indipendente"',
    );
    expect(content).toContain("Attività in corso");
    expect(content).not.toContain("Organizzazione da selezionare");
  });

  it("mostra gli errori di validazione accanto ai campi", () => {
    const tree = render(
      <AgentExperienceFormStep
        assignment={assignment()}
        errors={{
          endDate: "La data finale non può precedere quella iniziale.",
          role: "Seleziona un ruolo.",
        }}
        onChange={() => {}}
        roleOptions={AGENT_CAREER_ROLE_OPTIONS}
      />,
    );
    const content = texts(tree);

    expect(content).toContain("Seleziona un ruolo.");
    expect(content).toContain("La data finale non può precedere quella iniziale.");
  });
});

describe("Screen 6 — Riepilogo carriera", () => {
  it("mostra la timeline per gruppo e il badge Attuale", () => {
    const tree = render(
      <AgentCareerSummaryStep
        groups={GROUPS}
        onAddExperience={() => {}}
        onEditGroup={() => {}}
      />,
    );
    const content = texts(tree);

    expect(content).toContain("Controlla il tuo percorso da procuratore.");
    expect(content).toContain("Attuale");
    expect(content).toContain("Gennaio 2023 — Presente");
    expect(content).toContain("Gennaio 2021 — Dicembre 2022");
    expect(content).toContain("Titolare");
    expect(content).toContain("Professionista indipendente");
    expect(content).toContain("Marzo 2017 — Dicembre 2020");
    expect(content).toContain("Aggiungi un'altra esperienza");
  });
});

describe("Screen 8 — Percorsi aggiuntivi", () => {
  it("resta accessibile anche a zero esperienze", () => {
    const tree = render(
      <AdditionalPathsStep
        description="Aggiungi eventuali esperienze svolte in altri ruoli nel calcio. Rimarranno separate dalla carriera da procuratore."
        onOpenPath={() => {}}
        paths={[
          { copy: PATHS[0]!, count: 1 },
          { copy: PATHS[1]!, count: 0 },
        ]}
        testIDPrefix="agent"
      />,
    );
    const content = texts(tree);

    expect(content).toContain("Facoltativi");
    expect(content).toContain("Carriera da dirigente");
    expect(content).toContain("1 esperienza aggiunta");
    expect(content).toContain("Carriera da calciatore");
    expect(content).toContain("Nessuna esperienza aggiunta");
  });
});
