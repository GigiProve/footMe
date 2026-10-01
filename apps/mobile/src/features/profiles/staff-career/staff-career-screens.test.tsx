/**
 * Scenari a schermo della gestione carriera Staff tecnico (REV-PROF-07).
 *
 * Coprono quello che lo Staff tecnico ha in più rispetto all'Allenatore: due
 * percorsi aggiuntivi con conteggi dinamici nell'hub, la schermata "Percorsi
 * aggiuntivi", e la tassonomia dei ruoli Staff dentro "Ruolo per stagione".
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import {
  buildCoachExperienceGroups,
  type CoachAssignment,
} from "../coach-career/coach-assignment-model";
import {
  createCoachDraft,
  type CoachExperienceDraft,
} from "../coach-career/coach-career-draft";
import { CoachSeasonRolesStep } from "../coach-career/steps/CoachSeasonRolesStep";
import type { CareerPathCopy } from "../career-manager/career-manager-config";
import { AdditionalPathsStep } from "../career-manager/steps/AdditionalPathsStep";
import { CareerHubStep } from "../career-manager/steps/CareerHubStep";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("Ionicon", props),
}));

const NOW = new Date("2025-03-01T00:00:00.000Z");

const PATHS: CareerPathCopy[] = [
  {
    appBarTitle: "Carriera da allenatore",
    emptyCtaLabel: "Aggiungi carriera da allenatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza da allenatore",
    icon: "clipboard-outline",
    key: "coach",
    title: "Allenatore",
  },
  {
    appBarTitle: "Carriera da calciatore",
    emptyCtaLabel: "Aggiungi carriera da calciatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza da calciatore",
    icon: "walk-outline",
    key: "player",
    title: "Calciatore",
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
    clubId: null,
    isOngoing: false,
    mode: "MULTI_SEASON",
    period: null,
    role: "Preparatore atletico",
    seasonKey: "2024/2025",
    teamLogoUrl: "",
    teamName: "AC Milan",
    ...overrides,
  };
}

const GROUPS = buildCoachExperienceGroups(
  [
    assignment({ groupId: "milan", id: "m1", seasonKey: "2024/2025" }),
    assignment({ groupId: "milan", id: "m2", seasonKey: "2023/2024" }),
    assignment({
      groupId: "milan",
      id: "m3",
      role: "Match analyst",
      seasonKey: "2022/2023",
    }),
  ],
  { now: NOW },
);

describe("CareerHubStep — Staff tecnico", () => {
  function hub(coachCount: number, playerCount: number) {
    return (
      <CareerHubStep
        additionalEyebrow="Percorsi aggiuntivi"
        emptyText="Aggiungi le esperienze maturate nello staff tecnico."
        emptyTitle="Completa la tua carriera"
        eyebrow="Carriera nello staff tecnico"
        groups={GROUPS}
        onAddExperience={() => {}}
        onEditGroup={() => {}}
        onOpenPath={() => {}}
        paths={[
          { copy: PATHS[0], count: coachCount },
          { copy: PATHS[1], count: playerCount },
        ]}
        testIDPrefix="staff"
      />
    );
  }

  it("riassume la società con stagioni e ruoli distinti", () => {
    const rendered = texts(render(hub(1, 2)));

    expect(rendered).toContain("AC Milan");
    expect(rendered).toContain("2022 — Presente");
    expect(rendered).toContain("3 stagioni · 2 ruoli");
  });

  it("mostra i due percorsi aggiuntivi con i conteggi dinamici", () => {
    const rendered = texts(render(hub(1, 2)));

    expect(rendered).toContain("Allenatore");
    expect(rendered).toContain("1 esperienza aggiunta");
    expect(rendered).toContain("Calciatore");
    expect(rendered).toContain("2 esperienze aggiunte");
  });

  it("dichiara un percorso vuoto invece di nasconderlo", () => {
    const tree = render(hub(0, 0));

    expect(texts(tree).filter((text) => text === "Nessuna esperienza aggiunta"))
      .toHaveLength(2);
    expect(
      tree.root.findAllByProps({ testID: "staff-career-coach-entry" }).length,
    ).toBeGreaterThan(0);
  });

  it("apre direttamente il percorso toccato, senza passaggi intermedi", () => {
    const opened: string[] = [];
    const tree = render(
      <CareerHubStep
        additionalEyebrow="Percorsi aggiuntivi"
        emptyText=""
        emptyTitle=""
        eyebrow="Carriera nello staff tecnico"
        groups={GROUPS}
        onAddExperience={() => {}}
        onEditGroup={() => {}}
        onOpenPath={(path) => opened.push(path)}
        paths={[
          { copy: PATHS[0], count: 0 },
          { copy: PATHS[1], count: 0 },
        ]}
        testIDPrefix="staff"
      />,
    );

    const [coachRow] = tree.root.findAllByProps({
      testID: "staff-career-coach-entry",
    });

    act(() => {
      coachRow.props.onPress();
    });

    expect(opened).toEqual(["coach"]);
  });
});

describe("AdditionalPathsStep", () => {
  it("elenca i due percorsi con il conteggio e la nota di separazione", () => {
    const tree = render(
      <AdditionalPathsStep
        description="Aggiungi eventuali esperienze da allenatore o calciatore. Rimarranno separate dalla carriera nello staff tecnico."
        onOpenPath={() => {}}
        paths={[
          { copy: PATHS[0], count: 1 },
          { copy: PATHS[1], count: 0 },
        ]}
        testIDPrefix="staff"
      />,
    );

    const rendered = texts(tree);

    expect(rendered).toContain("Facoltativi");
    expect(rendered).toContain("Allenatore");
    expect(rendered).toContain("1 esperienza aggiunta");
    expect(rendered).toContain("Calciatore");
    expect(rendered).toContain("Nessuna esperienza aggiunta");
    expect(rendered).toContain("Puoi completarle anche in seguito.");
  });
});

describe("CoachSeasonRolesStep — ruoli Staff tecnico", () => {
  const draft: CoachExperienceDraft = {
    ...createCoachDraft("MULTI_SEASON", { defaultRole: "Preparatore atletico" }),
    category: "Serie A",
    seasonDetails: {
      "2022/2023": { category: "Serie A", role: "Match analyst" },
      "2023/2024": { category: "Serie A", role: "Preparatore atletico" },
      "2024/2025": { category: "Serie A", role: "Preparatore atletico" },
    },
    seasons: ["2024/2025", "2023/2024", "2022/2023"],
    teamName: "AC Milan",
  };

  const STAFF_ROLES = [
    { label: "Preparatore atletico", value: "Preparatore atletico" },
    { label: "Match analyst", value: "Match analyst" },
  ];

  it("offre la tassonomia Staff, non quella dell'Allenatore", () => {
    const tree = render(
      <CoachSeasonRolesStep
        draft={draft}
        errors={{}}
        onChangeSeasonDetail={() => {}}
        roleOptions={STAFF_ROLES}
        testIDPrefix="staff"
      />,
    );

    const [roleField] = tree.root.findAllByProps({
      testID: "staff-season-role-2024/2025",
    });

    expect(roleField.props.options).toEqual(STAFF_ROLES);
  });

  it("cambia il ruolo di una sola stagione", () => {
    const changes: [string, unknown][] = [];
    const tree = render(
      <CoachSeasonRolesStep
        draft={draft}
        errors={{}}
        onChangeSeasonDetail={(seasonKey, patch) =>
          changes.push([seasonKey, patch])
        }
        roleOptions={STAFF_ROLES}
        testIDPrefix="staff"
      />,
    );

    const [roleField] = tree.root.findAllByProps({
      testID: "staff-season-role-2023/2024",
    });

    act(() => {
      roleField.props.onChange("Match analyst");
    });

    expect(changes).toEqual([["2023/2024", { role: "Match analyst" }]]);
  });
});
