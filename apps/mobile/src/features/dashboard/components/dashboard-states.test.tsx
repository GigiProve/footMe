import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { DashboardModuleError, DashboardSection } from "./DashboardSection";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "./DashboardStates";

/**
 * Copy e struttura degli otto master (§37).
 *
 * **Non sostituiscono il confronto visuale**, che richiede l'app avviata:
 * verificano che le stringhe prescritte dalla task non vadano alla deriva e
 * che ogni stato esponga l'azione che gli compete. Uno snapshot di markup non
 * dimostra tipografia, spacing o densità.
 */

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

describe("master 03 — caricamento iniziale", () => {
  it("non mostra conteggi, nomi o testo di dominio", () => {
    const content = texts(render(<DashboardSkeleton />));

    expect(content).toHaveLength(0);
  });

  it("resta fuori dalla sequenza dei contenuti per lo screen reader", () => {
    // §25: lo skeleton non è una lista di elementi annunciabili; il
    // caricamento si comunica una volta sola.
    // Solo gli host element: `findAll` restituisce anche il componente
    // composito che inoltra le stesse props.
    const root = render(<DashboardSkeleton />).root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props?.accessibilityLabel === "Caricamento della Dashboard",
    );

    expect(root).toHaveLength(1);
    expect(root[0].props.accessibilityElementsHidden).toBe(true);
    expect(root[0].props.importantForAccessibility).toBe("no-hide-descendants");
  });
});

describe("master 04 — errore di una sezione", () => {
  it("usa la copy specifica delle Posizioni e un retry locale", () => {
    const onRetry = vi.fn();
    const renderer = render(
      <DashboardSection title="Posizioni aperte">
        <DashboardModuleError
          message="Non siamo riusciti a caricare le posizioni."
          onRetry={onRetry}
        />
      </DashboardSection>,
    );

    const content = texts(renderer);

    expect(content).toContain("Posizioni aperte");
    expect(content).toContain("Non siamo riusciti a caricare le posizioni.");
    expect(content).toContain("Riprova");

    const retry = renderer.root.find(
      (node) =>
        node.props.accessibilityLabel ===
        "Riprova: Non siamo riusciti a caricare le posizioni.",
    );

    act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("durante il retry l'azione non si ripete a vuoto", () => {
    const onRetry = vi.fn();
    const renderer = render(
      <DashboardModuleError
        isRetrying
        message="Non siamo riusciti a caricare le posizioni."
        onRetry={onRetry}
      />,
    );

    const retry = renderer.root.find(
      (node) =>
        node.props.accessibilityLabel ===
        "Riprova: Non siamo riusciti a caricare le posizioni.",
    );

    expect(retry.props.disabled).toBe(true);
    expect(retry.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
  });
});

describe("master 05 — offline con dati", () => {
  it("mostra un indicatore compatto, non un overlay", () => {
    const renderer = render(<DashboardOfflineNotice />);

    expect(texts(renderer)).toContain("Sei offline · Dati non aggiornati");

    // Nessuna azione: l'indicatore informa, non blocca né propone un retry
    // che duplicherebbe il pull-to-refresh (§27).
    expect(
      renderer.root.findAll((node) => typeof node.props?.onPress === "function"),
    ).toHaveLength(0);
  });
});

describe("master 07 — errore generale", () => {
  it("usa le due righe di copy e un solo pulsante Riprova", () => {
    const onRetry = vi.fn();
    const renderer = render(<DashboardGlobalError onRetry={onRetry} />);
    const content = texts(renderer);

    expect(content).toContain("Non riusciamo a caricare la Dashboard");
    expect(content).toContain("Riprova tra poco.");
    expect(content).toContain("Riprova");

    // §19: nessun riepilogo fittizio, contatore a zero o CTA di creazione.
    expect(content).not.toContain("Nuova posizione");
    expect(content).not.toContain("Cerca posizioni");
  });

  it("offline senza dati non si chiama «nessuna attività»", () => {
    const content = texts(render(<DashboardGlobalOffline onRetry={vi.fn()} />));

    expect(content).toContain("Sei offline");
    expect(content).toContain("Connettiti a Internet per caricare la tua Dashboard.");
    expect(content).not.toContain("Non hai attività da gestire al momento.");
  });
});

describe("master 08 — primo accesso", () => {
  const copy = {
    actionLabel: "Nuova posizione",
    body: "Pubblica una posizione per iniziare a ricevere candidature.",
    icon: "briefcase-outline" as const,
    title: "Non hai ancora posizioni aperte",
  };

  it("mostra titolo, guida e CTA autorizzata", () => {
    const onAction = vi.fn();
    const renderer = render(
      <DashboardGlobalEmpty copy={copy} onAction={onAction} />,
    );
    const content = texts(renderer);

    expect(content).toContain("Non hai ancora posizioni aperte");
    expect(content).toContain(
      "Pubblica una posizione per iniziare a ricevere candidature.",
    );
    expect(content).toContain("Nuova posizione");

    // §30: niente zero decorativi, Da gestire, warning o Riprova.
    expect(content).not.toContain("Da gestire");
    expect(content).not.toContain("Riprova");
  });

  it("senza capability non mostra un pulsante disabled", () => {
    // §20: un pulsante disabled pubblicizzerebbe un permesso mancante.
    const renderer = render(
      <DashboardGlobalEmpty copy={copy} onAction={null} />,
    );

    expect(texts(renderer)).not.toContain("Nuova posizione");
    expect(
      renderer.root.findAll((node) => typeof node.props?.onPress === "function"),
    ).toHaveLength(0);
  });
});
