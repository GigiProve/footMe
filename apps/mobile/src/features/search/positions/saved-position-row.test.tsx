import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { SavedPositionRow } from "./SavedPositionRow";
import type { SavedPositionRow as SavedPosition } from "./saved-positions-service";

/**
 * Montaggio reale della row (DAS-REV-05 §16, §27).
 *
 * Le regole verificate qui non sono visibili al typecheck: presenza del
 * chevron, ruolo accessibile del corpo, stato del bookmark e indipendenza fra
 * tap sulla row e tap sul segnalibro.
 */

function row(overrides: Partial<SavedPosition> = {}): SavedPosition {
  return {
    adId: "ad1",
    category: "Prima squadra",
    clubId: "c1",
    clubLogoUrl: null,
    clubName: "AC Como",
    group: "available",
    hasApplied: false,
    isNavigable: true,
    location: "Como · Lombardia",
    role: "forward",
    savedAt: "2026-09-05T10:00:00Z",
    teamName: "Prima squadra",
    unavailableAt: null,
    unavailableReason: null,
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
  return renderer.root
    .findAll((node) => typeof node.type === "string" && node.children.length > 0)
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === "string");
}

function icons(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAll((node) => typeof node.props?.name === "string")
    .map((node) => node.props.name as string);
}

describe("SavedPositionRow", () => {
  it("shows the saved bookmark and the chevron on a navigable row", () => {
    const renderer = render(
      <SavedPositionRow onPress={() => {}} onToggleSaved={() => {}} row={row()} />,
    );

    // §10: la risorsa è nei Salvati, quindi il controllo è nello stato
    // salvato — non un'icona che sembri non selezionata.
    expect(icons(renderer)).toContain("bookmark");
    expect(icons(renderer)).toContain("chevron-forward");
    expect(texts(renderer)).toContain("Como · Lombardia");
  });

  /**
   * §16: «Dettaglio assente o non accessibile — la row non è un link e non
   * mostra chevron. Il bookmark resta utilizzabile per rimuovere il
   * salvataggio.»
   */
  it("drops the chevron and the link role when the detail is unreachable", () => {
    const renderer = render(
      <SavedPositionRow
        onPress={null}
        onToggleSaved={() => {}}
        row={row({ group: "unavailable", isNavigable: false })}
      />,
    );

    expect(icons(renderer)).not.toContain("chevron-forward");
    expect(icons(renderer)).toContain("bookmark");
    expect(texts(renderer)).toContain("Dettaglio non disponibile");
  });

  /** §17: la data affidabile della chiusura, quando esiste. */
  it("dates the historical row with the closing date", () => {
    const renderer = render(
      <SavedPositionRow
        onPress={() => {}}
        onToggleSaved={() => {}}
        row={row({
          group: "unavailable",
          unavailableAt: "2026-09-11T08:00:00Z",
          unavailableReason: "closed",
        })}
      />,
    );

    expect(texts(renderer)).toContain("Non più disponibile · 11 set 2026");
  });

  /**
   * §17: senza data di chiusura si mostra la data reale di salvataggio con la
   * propria label, mai travestita da data di chiusura.
   */
  it("falls back to the saved date, labelled for what it is", () => {
    const renderer = render(
      <SavedPositionRow
        onPress={() => {}}
        onToggleSaved={() => {}}
        row={row({ group: "unavailable", unavailableAt: null })}
      />,
    );

    expect(texts(renderer)).toContain(
      "Non più disponibile · Salvata il 5 settembre",
    );
  });

  /** §11: metadato secondario, non uno stato della posizione. */
  it("marks an already sent application without changing the group", () => {
    const renderer = render(
      <SavedPositionRow
        onPress={() => {}}
        onToggleSaved={() => {}}
        row={row({ hasApplied: true })}
      />,
    );

    expect(texts(renderer)).toContain("Candidatura inviata");
  });

  /** §10: «Il tap sul bookmark non deve aprire anche il dettaglio.» */
  it("keeps the bookmark tap out of the detail navigation", () => {
    const onPress = vi.fn();
    const onToggleSaved = vi.fn();

    const renderer = render(
      <SavedPositionRow
        onPress={onPress}
        onToggleSaved={onToggleSaved}
        row={row()}
      />,
    );

    const bookmark = renderer.root.find(
      (node) =>
        typeof node.props?.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Rimuovi dai salvati"),
    );

    act(() => {
      bookmark.props.onPress();
    });

    expect(onToggleSaved).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
