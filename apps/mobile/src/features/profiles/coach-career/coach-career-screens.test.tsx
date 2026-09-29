/**
 * Scenari a schermo della gestione carriera Allenatore (REV-PROF-04).
 *
 * Coprono quello che distingue questo modulo dalla vecchia modifica
 * esperienze: il riassunto per società con i ruoli distinti, l'hub vuoto e
 * popolato, e la schermata "Ruolo per stagione" che deve mostrare una coppia
 * ruolo+categoria per ogni stagione e permettere di cambiarne una sola.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import {
  buildCoachExperienceGroups,
  type CoachAssignment,
} from "./coach-assignment-model";
import { createCoachDraft, type CoachExperienceDraft } from "./coach-career-draft";
import { CoachCareerHubStep } from "./steps/CoachCareerHubStep";
import { CoachSeasonRolesStep } from "./steps/CoachSeasonRolesStep";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("Ionicon", props),
}));

const NOW = new Date("2025-03-01T00:00:00.000Z");

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
    category: "Prima Squadra",
    clubId: null,
    isOngoing: false,
    mode: "MULTI_SEASON",
    period: null,
    role: "Allenatore",
    seasonKey: "2024/2025",
    teamLogoUrl: "",
    teamName: "Torino FC",
    ...overrides,
  };
}

const GROUPS = buildCoachExperienceGroups(
  [
    assignment({ groupId: "torino", id: "t1", seasonKey: "2024/2025" }),
    assignment({
      groupId: "torino",
      id: "t2",
      role: "Vice allenatore",
      seasonKey: "2023/2024",
    }),
    assignment({
      category: "Juniores",
      groupId: "torino",
      id: "t3",
      seasonKey: "2022/2023",
    }),
  ],
  { now: NOW },
);

describe("CoachCareerHubStep", () => {
  it("riassume la società con stagioni e ruoli distinti", () => {
    const tree = render(
      <CoachCareerHubStep
        groups={GROUPS}
        onAddExperience={() => {}}
        onEditGroup={() => {}}
        onOpenPlayerCareer={() => {}}
        playerExperienceCount={2}
      />,
    );

    const rendered = texts(tree);

    expect(rendered).toContain("Torino FC");
    expect(rendered).toContain("2022 — Presente");
    expect(rendered).toContain("3 stagioni · 2 ruoli");
    expect(rendered).toContain("2 esperienze aggiunte");
  });

  it("mostra l'empty state quando non c'è ancora una carriera", () => {
    const tree = render(
      <CoachCareerHubStep
        groups={[]}
        onAddExperience={() => {}}
        onEditGroup={() => {}}
        onOpenPlayerCareer={() => {}}
        playerExperienceCount={0}
      />,
    );

    expect(tree.root.findAllByProps({ testID: "coach-career-hub-empty" }).length)
      .toBeGreaterThan(0);
    expect(texts(tree)).toContain("Nessuna esperienza aggiunta");
  });
});

describe("CoachSeasonRolesStep", () => {
  const draft: CoachExperienceDraft = {
    ...createCoachDraft("MULTI_SEASON", { defaultRole: "Allenatore" }),
    category: "Prima Squadra",
    seasonDetails: {
      "2022/2023": { category: "Primavera", role: "Allenatore" },
      "2023/2024": { category: "Serie B", role: "Vice allenatore" },
      "2024/2025": { category: "Serie B", role: "Allenatore" },
    },
    seasons: ["2024/2025", "2023/2024", "2022/2023"],
    teamName: "Torino FC",
  };

  it("mostra una card per stagione con i valori già precompilati", () => {
    const tree = render(
      <CoachSeasonRolesStep
        draft={draft}
        errors={{}}
        onChangeSeasonDetail={() => {}}
      />,
    );

    for (const season of ["2024/2025", "2023/2024", "2022/2023"]) {
      expect(
        tree.root.findAllByProps({
          testID: `coach-season-role-card-${season}`,
        }).length,
      ).toBeGreaterThan(0);
    }

    const rendered = texts(tree);

    expect(rendered).toContain("Vice allenatore");
    expect(rendered).toContain("Primavera");
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
      />,
    );

    const [roleField] = tree.root.findAllByProps({
      testID: "coach-season-role-2023/2024",
    });

    act(() => {
      roleField.props.onChange("Preparatore atletico");
    });

    expect(changes).toEqual([["2023/2024", { role: "Preparatore atletico" }]]);
  });

  it("non offre la rimozione di una stagione in creazione", () => {
    const tree = render(
      <CoachSeasonRolesStep
        draft={draft}
        errors={{}}
        onChangeSeasonDetail={() => {}}
      />,
    );

    expect(
      tree.root.findAllByProps({ testID: "coach-season-remove-2023/2024" }),
    ).toHaveLength(0);
  });

  it("offre la rimozione in modifica, ma non sull'ultima stagione", () => {
    const withRemoval = render(
      <CoachSeasonRolesStep
        draft={draft}
        errors={{}}
        onChangeSeasonDetail={() => {}}
        onRemoveSeason={() => {}}
      />,
    );
    const lastOne = render(
      <CoachSeasonRolesStep
        draft={{ ...draft, seasons: ["2024/2025"] }}
        errors={{}}
        onChangeSeasonDetail={() => {}}
        onRemoveSeason={() => {}}
      />,
    );

    expect(
      withRemoval.root.findAllByProps({
        testID: "coach-season-remove-2023/2024",
      }).length,
    ).toBeGreaterThan(0);
    expect(
      lastOne.root.findAllByProps({ testID: "coach-season-remove-2024/2025" }),
    ).toHaveLength(0);
  });
});
