import { describe, expect, it } from "vitest";

import { MODULE_REGISTRY, type ModuleDefinition } from "../modules/module-registry";
import { applyPromotion, isSafePoint, orderFingerprint } from "./module-order";

/**
 * Ordine base, promozione e momenti sicuri (§36).
 *
 * L'ordine base dello scenario sportivo è il requisito di §11: senza
 * priorità, Posizioni aperte precede Candidature ricevute.
 */

const SOCIETY_MODULES: ModuleDefinition[] = [
  MODULE_REGISTRY.society_positions,
  MODULE_REGISTRY.society_applications,
  MODULE_REGISTRY.society_drafts,
  MODULE_REGISTRY.society_areas,
];

describe("applyPromotion", () => {
  it("QA-01: senza promozione l'ordine base resta intatto", () => {
    expect(orderFingerprint(applyPromotion(SOCIETY_MODULES, null))).toBe(
      "society_positions|society_applications|society_drafts|society_areas",
    );
  });

  it("QA-02: il modulo promosso sale in cima e gli altri conservano l'ordine relativo", () => {
    expect(
      orderFingerprint(
        applyPromotion(SOCIETY_MODULES, "society_applications"),
      ),
    ).toBe(
      "society_applications|society_positions|society_drafts|society_areas",
    );
  });

  it("QA-04: alla risoluzione si torna all'ordine base", () => {
    const promoted = applyPromotion(SOCIETY_MODULES, "society_applications");

    expect(orderFingerprint(applyPromotion(promoted, null))).toBe(
      "society_applications|society_positions|society_drafts|society_areas",
    );

    // L'ordine base si ricostruisce dalla composizione, non dall'ordine
    // promosso: è la ragione per cui la Foundation ripassa `composition.modules`
    // e non il risultato precedente.
    expect(orderFingerprint(applyPromotion(SOCIETY_MODULES, null))).toBe(
      "society_positions|society_applications|society_drafts|society_areas",
    );
  });

  it("un modulo promosso ma assente dalla composizione non altera l'ordine", () => {
    expect(
      orderFingerprint(applyPromotion(SOCIETY_MODULES, "personal_applications")),
    ).toBe(orderFingerprint(SOCIETY_MODULES));
  });
});

describe("isSafePoint", () => {
  it("non riordina sotto il dito dell'utente", () => {
    expect(
      isSafePoint({ isInteracting: true, trigger: "refresh_completed" }),
    ).toBe(false);
  });

  it("riordina al primo caricamento, al cambio identità e dopo un refresh", () => {
    for (const trigger of [
      "first_load",
      "identity_change",
      "refresh_completed",
      "action_confirmed",
    ] as const) {
      expect(isSafePoint({ isInteracting: false, trigger })).toBe(true);
    }
  });

  it("le rimozioni per sicurezza non attendono nulla", () => {
    expect(
      isSafePoint({ isInteracting: true, trigger: "security_removal" }),
    ).toBe(true);
  });
});
