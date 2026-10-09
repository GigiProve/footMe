import { describe, expect, it } from "vitest";

import {
  derivePageState,
  isOfflineWithoutData,
  nextConnectionState,
  type DashboardStateInput,
} from "./dashboard-state";
import {
  classifyDashboardError,
  DashboardPayloadError,
  DashboardTimeoutError,
  suggestsOffline,
} from "./error-classification";
import {
  backoffDelayMs,
  CYCLE_BUDGET_MS,
  shouldAutoRetry,
} from "./retry-policy";

/**
 * Transizioni loading/ready/empty/error con lo stato di connessione tenuto
 * **separato** (§36). È il modello che impedisce i due bug che la task
 * vieta per nome: un errore presentato come empty e un server irraggiungibile
 * presentato come assenza di rete.
 */

function input(overrides: Partial<DashboardStateInput> = {}): DashboardStateInput {
  return {
    access: "valid",
    allModulesEmpty: false,
    allModulesSettled: true,
    compositionKnown: true,
    connection: "online",
    data: "fresh",
    hasEligibleModules: true,
    hasUsableContent: true,
    ...overrides,
  };
}

describe("derivePageState", () => {
  it("è pronta quando resta almeno un modulo con dati utili", () => {
    expect(derivePageState(input())).toBe("ready");
  });

  it("resta pronta anche offline: offline non è uno stato di pagina", () => {
    expect(derivePageState(input({ connection: "offline" }))).toBe("ready");
  });

  it("non converte moduli ancora pending in uno stato vuoto", () => {
    // §13: «Errori, moduli ancora pending e schemi non interpretabili non
    // vengono convertiti in liste vuote.»
    expect(
      derivePageState(
        input({
          allModulesEmpty: true,
          allModulesSettled: false,
          hasUsableContent: false,
        }),
      ),
    ).toBe("initial");
  });

  it("è vuota solo con risposte valide su tutti i moduli eleggibili", () => {
    expect(
      derivePageState(
        input({
          allModulesEmpty: true,
          allModulesSettled: true,
          hasUsableContent: false,
        }),
      ),
    ).toBe("empty");
  });

  it("è indisponibile quando il dato non è più utilizzabile e non resta contenuto", () => {
    expect(
      derivePageState(input({ data: "unusable", hasUsableContent: false })),
    ).toBe("unavailable");
  });

  it("una revoca rende indisponibile anche con contenuto ancora a schermo", () => {
    // §21: le rimozioni per sicurezza sono immediate, non attendono un
    // momento sicuro.
    expect(derivePageState(input({ access: "revoked" }))).toBe("unavailable");
  });

  it("nessun modulo autorizzato è un caso distinto dal fallimento di rete", () => {
    expect(
      derivePageState(
        input({ hasEligibleModules: false, hasUsableContent: false }),
      ),
    ).toBe("empty");
  });

  it("senza composizione interpretabile resta in caricamento, non in empty", () => {
    expect(derivePageState(input({ compositionKnown: false }))).toBe("initial");
  });
});

describe("nextConnectionState", () => {
  it("un server irraggiungibile non dichiara l'offline", () => {
    // §17, requisito esplicito.
    expect(
      nextConnectionState({
        category: "server",
        current: "online",
        outcome: "failure",
      }),
    ).toBe("online");
  });

  it("un fallimento di trasporto porta offline", () => {
    expect(
      nextConnectionState({
        category: "network",
        current: "online",
        outcome: "failure",
      }),
    ).toBe("offline");
  });

  it("un successo riporta sempre online", () => {
    expect(
      nextConnectionState({
        category: null,
        current: "offline",
        outcome: "success",
      }),
    ).toBe("online");
  });

  it("un timeout non è un'assenza di rete", () => {
    expect(
      nextConnectionState({
        category: "timeout",
        current: "unknown",
        outcome: "failure",
      }),
    ).toBe("unknown");
  });
});

describe("classifyDashboardError", () => {
  it("riconosce un rifiuto di policy RLS come autorizzazione, non come errore server", () => {
    expect(classifyDashboardError({ code: "42501" })).toBe("authorization");
  });

  it("uno status HTTP dimostra che una risposta è arrivata", () => {
    expect(classifyDashboardError({ status: 500 })).toBe("server");
    expect(suggestsOffline(classifyDashboardError({ status: 500 }))).toBe(false);
  });

  it("un fallimento di trasporto senza status è rete", () => {
    expect(classifyDashboardError(new TypeError("Network request failed"))).toBe(
      "network",
    );
  });

  it("distingue rate limit e manutenzione", () => {
    expect(classifyDashboardError({ status: 429 })).toBe("rate_limit");
    expect(classifyDashboardError({ status: 503 })).toBe("maintenance");
  });

  it("riconosce timeout e payload incompatibile dalle classi dedicate", () => {
    expect(classifyDashboardError(new DashboardTimeoutError())).toBe("timeout");
    expect(classifyDashboardError(new DashboardPayloadError())).toBe(
      "unsupported_payload",
    );
  });

  it("uno schema non riconosciuto non diventa un errore server", () => {
    expect(classifyDashboardError({ code: "42703" })).toBe("unsupported_payload");
  });
});

describe("shouldAutoRetry", () => {
  it("non ritenta ciò che un secondo tentativo identico non può risolvere", () => {
    for (const category of [
      "offline",
      "authorization",
      "not_found",
      "unsupported_payload",
      "maintenance",
      "rate_limit",
    ] as const) {
      expect(shouldAutoRetry({ attempt: 0, category, elapsedMs: 0 })).toBe(false);
    }
  });

  it("concede un solo retry automatico a un errore transitorio", () => {
    expect(
      shouldAutoRetry({ attempt: 0, category: "network", elapsedMs: 0 }),
    ).toBe(true);
    expect(
      shouldAutoRetry({ attempt: 1, category: "network", elapsedMs: 0 }),
    ).toBe(false);
  });

  it("il budget complessivo prevale sul tentativo residuo", () => {
    expect(
      shouldAutoRetry({
        attempt: 0,
        category: "network",
        elapsedMs: CYCLE_BUDGET_MS,
      }),
    ).toBe(false);
  });

  it("il backoff cresce e resta determinabile con random iniettabile", () => {
    expect(backoffDelayMs(0, () => 0)).toBe(1000);
    expect(backoffDelayMs(1, () => 0)).toBe(2000);
  });
});

describe("isOfflineWithoutData", () => {
  it("distingue l'offline senza dati dall'errore generale", () => {
    expect(
      isOfflineWithoutData({ connection: "offline", pageState: "unavailable" }),
    ).toBe(true);
    expect(
      isOfflineWithoutData({ connection: "online", pageState: "unavailable" }),
    ).toBe(false);
  });
});
