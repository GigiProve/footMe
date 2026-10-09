import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type {
  DashboardCapability,
  DashboardIdentity,
  DashboardIdentityKind,
} from "../dashboard-types";
import { DashboardAreaRows } from "./DashboardAreaRow";
import { DashboardEntityRow } from "./DashboardEntityRow";
import { DashboardIdentityRow } from "./DashboardIdentityRow";
import { DashboardIdentitySheet } from "./DashboardIdentitySheet";
import { DashboardPriority } from "./DashboardPriority";
import { DashboardSummary } from "./DashboardSummary";
import { DashboardSkeleton, DashboardNoIdentity } from "./DashboardStates";

/**
 * Montaggio reale dei componenti della Foundation.
 *
 * Il typecheck non vede un uso sbagliato di un'API runtime (per esempio
 * `Skeleton` usato come componente quando è un oggetto di sottocomponenti):
 * questi test esistono per quello, oltre che per le regole di presentazione.
 */

function identity(
  id: string,
  kind: DashboardIdentityKind,
  overrides: Partial<DashboardIdentity> = {},
): DashboardIdentity {
  return {
    avatarUrl: null,
    capabilities: [] as DashboardCapability[],
    id,
    isOwner: false,
    isVerified: false,
    kind,
    name: id,
    scopeLabel: null,
    ...overrides,
  };
}

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(element);
  });

  return renderer;
}

function texts(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root.findAll(
    (node) => typeof node.type === "string" && node.children.length > 0,
  )
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === "string");
}

describe("DashboardIdentityRow", () => {
  it("renders a static row without a button role when not selectable", () => {
    const renderer = render(
      <DashboardIdentityRow
        identity={identity("AC Como", "society")}
        selectable={false}
      />,
    );

    expect(texts(renderer)).toContain("AC Como");
    expect(texts(renderer)).toContain("Società");
    expect(
      renderer.root.findAll(
        (node) => node.props.accessibilityRole === "button",
      ),
    ).toHaveLength(0);
  });

  it("exposes a button and opens the selector when selectable", () => {
    const onPress = vi.fn();
    const renderer = render(
      <DashboardIdentityRow
        identity={identity("AC Como", "society")}
        onPress={onPress}
        selectable
      />,
    );

    const button = renderer.root.find(
      (node) => node.props.accessibilityRole === "button",
    );

    act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows the scope label without folding it into the identity name", () => {
    const renderer = render(
      <DashboardIdentityRow
        identity={identity("AC Como", "society", { scopeLabel: "Primavera" })}
        selectable={false}
      />,
    );

    expect(texts(renderer)).toContain("AC Como");
    expect(texts(renderer)).toContain("Ambito: Primavera");
  });
});

describe("DashboardIdentitySheet", () => {
  const identities = [
    identity("Marco Bianchi", "person"),
    identity("AC Como", "society", { isVerified: true }),
    identity("Como Football News", "media"),
  ];

  it("renders the title, the hint and every identity", () => {
    const renderer = render(
      <DashboardIdentitySheet
        currentId="AC Como"
        identities={identities}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        visible
      />,
    );

    const content = texts(renderer);

    expect(content).toContain("Scegli quale Dashboard aprire.");
    expect(content).toContain("Il cambio riguarda solo la Dashboard.");
    expect(content).toContain("Marco Bianchi");
    expect(content).toContain("Como Football News");
  });

  it("marks the current identity as selected", () => {
    const renderer = render(
      <DashboardIdentitySheet
        currentId="AC Como"
        identities={identities}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        visible
      />,
    );

    // Pressable e la sua View host espongono entrambi le stesse props: conta
    // quante *righe* risultano selezionate, non quanti nodi.
    const selectedLabels = new Set(
      renderer.root
        .findAll((node) => node.props.accessibilityState?.selected === true)
        .map((node) => node.props.accessibilityLabel),
    );

    expect([...selectedLabels]).toEqual(["AC Como, Società"]);
  });

  it("closes without switching when the current identity is tapped", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const renderer = render(
      <DashboardIdentitySheet
        currentId="AC Como"
        identities={identities}
        onClose={onClose}
        onSelect={onSelect}
        visible
      />,
    );

    const row = renderer.root.find(
      (node) => node.props.accessibilityLabel === "AC Como, Società",
    );

    act(() => row.props.onPress());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes and switches when another identity is tapped", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const renderer = render(
      <DashboardIdentitySheet
        currentId="AC Como"
        identities={identities}
        onClose={onClose}
        onSelect={onSelect}
        visible
      />,
    );

    const row = renderer.root.find(
      (node) => node.props.accessibilityLabel === "Marco Bianchi, Personale",
    );

    act(() => row.props.onPress());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("Marco Bianchi");
  });
});

describe("DashboardSummary", () => {
  it("announces the full metric to a screen reader, not just the number", () => {
    const renderer = render(
      <DashboardSummary
        metrics={[
          {
            accessibilityLabel: "3 candidature attive",
            id: "a",
            label: "Candidature attive",
            value: 3,
          },
        ]}
      />,
    );

    expect(
      renderer.root.findAll(
        (node) => node.props.accessibilityLabel === "3 candidature attive",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("renders nothing when there is no authorized metric", () => {
    const renderer = render(<DashboardSummary metrics={[]} />);
    expect(renderer.toJSON()).toBeNull();
  });
});

describe("DashboardPriority", () => {
  it("renders object, reason and action", () => {
    const onPress = vi.fn();
    const renderer = render(
      <DashboardPriority
        items={[
          {
            actionLabel: "Valuta candidature",
            description: "Attaccante · Prima squadra",
            icon: "people-outline",
            id: "p",
            onPress,
            title: "5 nuove candidature",
            tone: "neutral",
          },
        ]}
      />,
    );

    const content = texts(renderer);
    expect(content).toContain("Da gestire");
    expect(content).toContain("5 nuove candidature");
    expect(content).toContain("Attaccante · Prima squadra");

    const action = renderer.root.find(
      (node) => node.props.accessibilityLabel === "Valuta candidature",
    );
    act(() => action.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there is no priority", () => {
    expect(render(<DashboardPriority items={[]} />).toJSON()).toBeNull();
  });
});

describe("DashboardEntityRow", () => {
  it("keeps the bookmark separate from the row navigation", () => {
    const onPress = vi.fn();
    const onToggle = vi.fn();

    const renderer = render(
      <DashboardEntityRow
        bookmark={{ isSaved: false, onToggle }}
        avatarName="Calcio Lecco"
        meta="Calcio Lecco · Prima squadra"
        onPress={onPress}
        title="Ala destra"
      />,
    );

    const bookmark = renderer.root.find(
      (node) => node.props.accessibilityLabel === "Salva: Ala destra",
    );

    act(() => bookmark.props.onPress());

    // Il tap sul bookmark non deve attivare anche l'apertura del dettaglio.
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("DashboardAreaRows", () => {
  it("omits the count when the actor cannot read the total", () => {
    const renderer = render(
      <DashboardAreaRows
        items={[
          {
            count: null,
            icon: "briefcase-outline",
            id: "positions",
            onPress: vi.fn(),
            title: "Posizioni aperte",
          },
        ]}
      />,
    );

    // Un conteggio non autorizzato non diventa "0".
    expect(texts(renderer)).not.toContain("0");
    expect(
      renderer.root.find(
        (node) => node.props.accessibilityLabel === "Posizioni aperte",
      ),
    ).toBeTruthy();
  });
});

describe("Dashboard states", () => {
  it("mounts the skeleton", () => {
    expect(render(<DashboardSkeleton />).toJSON()).toBeTruthy();
  });

  it("uses the non-technical copy when no identity is available", () => {
    expect(texts(render(<DashboardNoIdentity />))).toContain(
      "Non hai attività da gestire al momento.",
    );
  });
});
