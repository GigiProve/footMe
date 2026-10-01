/**
 * Scenari a schermo della gestione carriera Dirigente (REV-PROF-10).
 *
 * Coprono le otto schermate del mockup e quello che il Dirigente ha in più
 * rispetto agli altri ruoli: quattro percorsi aggiuntivi con conteggi
 * dinamici, la tassonomia dirigenziale dentro "Ruolo per stagione", il campo
 * società con il nome che il Dirigente gli dà, e la descrizione facoltativa
 * mostrata sotto i campi principali.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import {
  buildCoachExperienceGroups,
  type CoachAssignment,
} from "../coach-career/coach-assignment-model";
import { createCoachDraft } from "../coach-career/coach-career-draft";
import { CoachSeasonRolesStep } from "../coach-career/steps/CoachSeasonRolesStep";
import { CoachSeasonsStep } from "../coach-career/steps/CoachSeasonsStep";
import { CoachSingleAssignmentStep } from "../coach-career/steps/CoachSingleAssignmentStep";
import { CoachCareerSummaryStep } from "../coach-career/steps/CoachCareerSummaryStep";
import type { CareerPathCopy } from "../career-manager/career-manager-config";
import { AdditionalPathsStep } from "../career-manager/steps/AdditionalPathsStep";
import { CareerHubStep } from "../career-manager/steps/CareerHubStep";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("Ionicon", props),
}));

const NOW = new Date("2026-10-01T00:00:00.000Z");

const DIRECTOR_ROLE_OPTIONS = [
  { label: "Direttore sportivo", value: "Direttore sportivo" },
  { label: "Responsabile scouting", value: "Responsabile scouting" },
  { label: "Direttore generale", value: "Direttore generale" },
];

/** I quattro percorsi che il modello del Dirigente supporta (REV-ONB-07 §AC–§AG). */
const PATHS: CareerPathCopy[] = [
  {
    appBarTitle: "Carriera da allenatore",
    emptyCtaLabel: "Aggiungi carriera da allenatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza aggiunta",
    icon: "clipboard-outline",
    key: "coach",
    title: "Allenatore",
  },
  {
    appBarTitle: "Carriera nello staff tecnico",
    emptyCtaLabel: "Aggiungi carriera nello staff tecnico",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza aggiunta",
    icon: "person-outline",
    key: "staff",
    title: "Staff tecnico",
  },
  {
    appBarTitle: "Carriera da calciatore",
    emptyCtaLabel: "Aggiungi carriera da calciatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza aggiunta",
    icon: "walk-outline",
    key: "player",
    title: "Calciatore",
  },
  {
    appBarTitle: "Altre esperienze nel calcio",
    emptyCtaLabel: "Aggiungi altre esperienze",
    emptyText: "Puoi aggiungere questi percorsi anche in seguito.",
    emptyTitle: "Nessuna esperienza aggiunta",
    icon: "search-outline",
    key: "other",
    title: "Altri ruoli",
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

/** L'esempio del mockup: tre stagioni, tre ruoli, due categorie. */
const GROUPS = buildCoachExperienceGroups(
  [
    assignment({ groupId: "prodi", id: "p1", seasonKey: "2026/2027" }),
    assignment({
      groupId: "prodi",
      id: "p2",
      role: "Responsabile scouting",
      seasonKey: "2025/2026",
    }),
    assignment({
      category: "Serie B",
      groupId: "prodi",
      id: "p3",
      role: "Direttore generale",
      seasonKey: "2024/2025",
    }),
  ],
  { now: NOW },
);

function searchTeams() {
  return Promise.resolve([]);
}

describe("Screen 1 — Hub carriera", () => {
  function hub(counts: number[], groups = GROUPS) {
    return (
      <CareerHubStep
        additionalEyebrow="Percorsi aggiuntivi"
        emptyText="Aggiungi le tue esperienze per raccontare il tuo percorso professionale."
        emptyTitle="Completa la tua carriera"
        eyebrow="Carriera dirigenziale"
        groups={groups}
        onAddExperience={() => {}}
        onEditGroup={() => {}}
        onOpenPath={() => {}}
        paths={PATHS.map((copy, index) => ({ copy, count: counts[index] }))}
        testIDPrefix="director"
      />
    );
  }

  it("mostra società, periodo, numero di stagioni e di ruoli distinti", () => {
    const rendered = texts(render(hub([1, 0, 1, 0])));

    expect(rendered).toContain("Carriera dirigenziale");
    expect(rendered).toContain("ASD Romano Prodi");
    expect(rendered).toContain("2024 — Presente");
    // Una riga sola, come nel mockup: "3 stagioni · 3 ruoli".
    expect(rendered).toContain("3 stagioni · 3 ruoli");
  });

  it("elenca i quattro percorsi aggiuntivi con il conteggio di ciascuno", () => {
    const rendered = texts(render(hub([1, 2, 1, 0])));

    expect(rendered).toContain("Allenatore");
    expect(rendered).toContain("Staff tecnico");
    expect(rendered).toContain("Calciatore");
    expect(rendered).toContain("Altri ruoli");
    expect(rendered).toContain("1 esperienza aggiunta");
    expect(rendered).toContain("2 esperienze aggiunte");
    expect(rendered).toContain("Nessuna esperienza aggiunta");
  });

  it("a carriera vuota mostra l'empty state con la CTA, non una lista vuota", () => {
    const tree = render(hub([0, 0, 0, 0], []));

    expect(tree.root.findAllByProps({ testID: "director-career-hub-empty" })).not.toHaveLength(
      0,
    );
    expect(texts(tree)).toContain("Completa la tua carriera");
    expect(tree.root.findAllByProps({ testID: "director-career-add" })).not.toHaveLength(
      0,
    );
  });
});

describe("Screen 3 — Più stagioni complete", () => {
  it("chiama il campo società col nome che il Dirigente gli dà", () => {
    const rendered = texts(
      render(
        <CoachSeasonsStep
          draft={createCoachDraft("MULTI_SEASON")}
          errors={{}}
          onChangeDraft={() => {}}
          onToggleSeason={() => {}}
          searchTeams={searchTeams}
          teamLabel="Società / Club"
          teamPlaceholder="Cerca la società"
          testIDPrefix="director"
        />,
      ),
    );

    expect(rendered).toContain("Società / Club");
    expect(rendered).not.toContain("Squadra");
  });

  it("non mostra ruolo o categoria globali, e dichiara che sono per stagione", () => {
    const rendered = texts(
      render(
        <CoachSeasonsStep
          draft={createCoachDraft("MULTI_SEASON")}
          errors={{}}
          onChangeDraft={() => {}}
          onToggleSeason={() => {}}
          searchTeams={searchTeams}
          teamLabel="Società / Club"
          testIDPrefix="director"
        />,
      ),
    );

    expect(rendered).toContain(
      "Ruolo e categoria potranno essere modificati per ogni stagione.",
    );
    expect(rendered).not.toContain("Ruolo");
    expect(rendered).not.toContain("Categoria");
  });
});

describe("Screen 4 — Ruolo per stagione", () => {
  it("dà a ogni stagione il proprio selettore di ruolo e di categoria", () => {
    const tree = render(
      <CoachSeasonRolesStep
        draft={{
          ...createCoachDraft("MULTI_SEASON"),
          seasonDetails: {
            "2024/2025": { category: "Serie B", role: "Direttore generale" },
            "2025/2026": { category: "Serie A", role: "Responsabile scouting" },
            "2026/2027": { category: "Serie A", role: "Direttore sportivo" },
          },
          seasons: ["2026/2027", "2025/2026", "2024/2025"],
          teamName: "ASD Romano Prodi",
        }}
        errors={{}}
        onChangeSeasonDetail={() => {}}
        roleOptions={DIRECTOR_ROLE_OPTIONS}
        testIDPrefix="director"
      />,
    );
    const rendered = texts(tree);

    expect(rendered).toContain("2026/27");
    expect(rendered).toContain("2025/26");
    expect(rendered).toContain("2024/25");
    expect(rendered).toContain("Direttore sportivo");
    expect(rendered).toContain("Responsabile scouting");
    expect(rendered).toContain("Direttore generale");
    expect(rendered).toContain("Serie B");
  });
});

describe("Screen 5 e 6 — Singola stagione e Periodo personalizzato", () => {
  it("mostra la descrizione facoltativa sotto i campi principali", () => {
    const tree = render(
      <CoachSingleAssignmentStep
        descriptionLabel="Attività svolte"
        draft={createCoachDraft("SINGLE_SEASON")}
        errors={{}}
        onChangeDraft={() => {}}
        roleOptions={DIRECTOR_ROLE_OPTIONS}
        searchTeams={searchTeams}
        showDescription
        teamLabel="Società / Club"
        testIDPrefix="director"
      />,
    );

    expect(texts(tree)).toContain("Attività svolte");
    expect(
      tree.root.findAllByProps({ testID: "director-assignment-description" }),
    ).not.toHaveLength(0);
  });

  it("non mostra la descrizione quando il flusso non la chiede", () => {
    const tree = render(
      <CoachSingleAssignmentStep
        draft={createCoachDraft("SINGLE_SEASON")}
        errors={{}}
        onChangeDraft={() => {}}
        searchTeams={searchTeams}
        testIDPrefix="coach"
      />,
    );

    expect(
      tree.root.findAllByProps({ testID: "coach-assignment-description" }),
    ).toHaveLength(0);
  });

  it("il periodo personalizzato offre Da, A e l'incarico in corso", () => {
    const rendered = texts(
      render(
        <CoachSingleAssignmentStep
          draft={createCoachDraft("CUSTOM_PERIOD")}
          errors={{}}
          onChangeDraft={() => {}}
          periodHelpMessage="Utile per subentri, incarichi brevi o periodi fuori stagione."
          roleOptions={DIRECTOR_ROLE_OPTIONS}
          searchTeams={searchTeams}
          teamLabel="Società / Club"
          testIDPrefix="director"
        />,
      ),
    );

    expect(rendered).toContain("Da");
    expect(rendered).toContain("A");
    expect(rendered).toContain("Incarico in corso");
    expect(rendered).toContain(
      "Utile per subentri, incarichi brevi o periodi fuori stagione.",
    );
  });
});

describe("Screen 7 — Riepilogo carriera", () => {
  it("raggruppa per società e mostra ruolo e categoria di ogni stagione", () => {
    const rendered = texts(
      render(
        <CoachCareerSummaryStep
          groups={GROUPS}
          onAddAnother={() => {}}
          onEditGroup={() => {}}
          subtitle="Controlla il tuo percorso dirigenziale."
          testIDPrefix="director"
        />,
      ),
    );

    expect(rendered).toContain("Controlla il tuo percorso dirigenziale.");
    expect(rendered).toContain("ASD Romano Prodi");
    expect(rendered).toContain("2026/27");
    expect(rendered).toContain("Direttore sportivo");
    expect(rendered).toContain("Direttore generale");
    expect(rendered).toContain("Serie B");
  });
});

describe("Screen 8 — Percorsi aggiuntivi", () => {
  function paths(counts: number[]) {
    return (
      <AdditionalPathsStep
        description="Aggiungi eventuali esperienze svolte in altri ruoli nel calcio. Rimarranno separate dalla carriera dirigenziale."
        onOpenPath={() => {}}
        paths={PATHS.map((copy, index) => ({ copy, count: counts[index] }))}
        testIDPrefix="director"
      />
    );
  }

  it("dichiara i percorsi facoltativi e separati dalla carriera dirigenziale", () => {
    const rendered = texts(render(paths([1, 0, 1, 0])));

    expect(rendered).toContain("Facoltativi");
    expect(rendered).toContain(
      "Aggiungi eventuali esperienze svolte in altri ruoli nel calcio. Rimarranno separate dalla carriera dirigenziale.",
    );
    expect(rendered).toContain("Puoi completarle anche in seguito.");
  });

  it("tiene accessibili tutti i percorsi supportati anche quando sono vuoti", () => {
    const tree = render(paths([0, 0, 0, 0]));

    for (const path of PATHS) {
      expect(
        tree.root.findAllByProps({ testID: `director-career-paths-${path.key}` }),
      ).not.toHaveLength(0);
    }
  });

  it("usa singolare e plurale corretti nel conteggio", () => {
    const rendered = texts(render(paths([1, 3, 0, 0])));

    expect(rendered).toContain("1 esperienza aggiunta");
    expect(rendered).toContain("3 esperienze aggiunte");
    expect(rendered).toContain("Nessuna esperienza aggiunta");
  });
});
