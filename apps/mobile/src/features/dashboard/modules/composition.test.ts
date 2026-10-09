import { describe, expect, it } from "vitest";

import type {
  DashboardCapability,
  DashboardIdentity,
  DashboardIdentityKind,
} from "../dashboard-types";
import {
  composeDashboard,
  composeQuickActions,
  isModuleEligible,
} from "./composition";
import { MODULE_REGISTRY } from "./module-registry";
import { DASHBOARD_FEATURES } from "./dashboard-features";

function identity(
  kind: DashboardIdentityKind,
  capabilities: DashboardCapability[] = [],
): DashboardIdentity {
  return {
    avatarUrl: null,
    capabilities,
    id: `${kind}-1`,
    isOwner: false,
    isVerified: false,
    kind,
    name: kind,
    scopeLabel: null,
  };
}

const FULL_SOCIETY: DashboardCapability[] = [
  "dashboard_view",
  "positions_view",
  "positions_create",
  "applications_view",
  "teams_view",
  "content_view",
  "content_create",
  "invites_create",
];

describe("isModuleEligible", () => {
  it("rejects every module without an identity", () => {
    expect(isModuleEligible(MODULE_REGISTRY.society_applications, null)).toBe(
      false,
    );
  });

  it("rejects a module whose domain does not fit the identity kind", () => {
    // Una Società non ha "Le tue candidature": non è un problema di permessi,
    // il modulo non le appartiene proprio.
    expect(
      isModuleEligible(
        MODULE_REGISTRY.personal_applications,
        identity("society", FULL_SOCIETY),
      ),
    ).toBe(false);
  });

  it("requires every capability in capabilitiesAll", () => {
    const withoutApplications = identity("society", [
      "dashboard_view",
      "positions_view",
    ]);

    expect(
      isModuleEligible(
        MODULE_REGISTRY.society_applications,
        withoutApplications,
      ),
    ).toBe(false);
  });

  it("accepts a module when a single capabilitiesAny entry matches", () => {
    // "Aree di gestione" esiste se almeno una riga è autorizzata.
    const onlyTeams = identity("society", ["dashboard_view", "teams_view"]);

    expect(isModuleEligible(MODULE_REGISTRY.society_areas, onlyTeams)).toBe(
      true,
    );
  });

  it("rejects capabilitiesAny when none of the entries match", () => {
    const neither = identity("society", ["dashboard_view", "content_view"]);

    expect(isModuleEligible(MODULE_REGISTRY.society_areas, neither)).toBe(
      false,
    );
  });
});

describe("composeDashboard", () => {
  it("produces no modules without an identity", () => {
    expect(composeDashboard(null).modules).toEqual([]);
  });

  it("gives a personal identity only its own modules", () => {
    const modules = composeDashboard(identity("person")).modules.map(
      (module) => module.id,
    );

    // DAS-REV-03 §6: ordine ordinario della composizione personale —
    // Aggiornamenti recenti, Le tue candidature, Posizioni salvate ed
    // eventuale suggerimento facoltativo, che resta per ultimo.
    expect(modules).toEqual([
      "personal_recent_updates",
      "personal_applications",
      "personal_saved_positions",
      "personal_profile_suggestion",
    ]);
  });

  it("orders modules by their base order", () => {
    const modules = composeDashboard(
      identity("society", FULL_SOCIETY),
    ).modules.map((module) => module.id);

    // DAS-REV-02 §11: senza priorità, Posizioni aperte precede Candidature
    // ricevute. È l'ordine base che la promozione deve poter ripristinare.
    expect(modules).toEqual([
      "society_positions",
      "society_applications",
      "society_drafts",
      "society_recent_content",
      "society_areas",
    ]);
  });

  it("gives two actors of the same society different modules", () => {
    // È il caso del master 02 contro il master 03: stessa Società, stesso
    // sistema, composizione diversa — non due Dashboard diverse.
    const sport = composeDashboard(
      identity("society", [
        "dashboard_view",
        "positions_view",
        "applications_view",
        "teams_view",
      ]),
    ).modules.map((module) => module.id);

    const editorial = composeDashboard(
      identity("society", ["dashboard_view", "content_view"]),
    ).modules.map((module) => module.id);

    expect(sport).toEqual([
      "society_positions",
      "society_applications",
      "society_areas",
    ]);
    expect(editorial).toEqual(["society_drafts", "society_recent_content"]);
  });
});

describe("composeQuickActions", () => {
  it("hides the create action when only the read capability is granted", () => {
    // §14: chi vede le Posizioni ma non può crearle non vede "Nuova posizione".
    const readOnly = identity("society", ["dashboard_view", "positions_view"]);

    expect(composeQuickActions(readOnly)).not.toContain(
      "society_new_position",
    );
  });

  it("shows the create action when the capability is granted", () => {
    const creator = identity("society", [
      "dashboard_view",
      "positions_view",
      "positions_create",
    ]);

    expect(composeQuickActions(creator)).toContain("society_new_position");
  });

  it("withholds an action whose destination is not available yet", () => {
    // `invites_create` è concessa, ma la feature è spenta: il contratto
    // esiste, la CTA no. Una CTA senza destinazione è vietata da §4.
    expect(DASHBOARD_FEATURES.society_invites.available).toBe(false);

    const invited = identity("society", [
      "dashboard_view",
      "invites_create",
    ]);

    expect(composeQuickActions(invited)).not.toContain(
      "society_invite_person",
    );
  });

  it("gives a personal identity the search action", () => {
    expect(composeQuickActions(identity("person"))).toEqual([
      "personal_search_positions",
    ]);
  });
});

describe("blocked features", () => {
  it("documents a reason and an owner for every unavailable feature", () => {
    // Un flag spento senza motivo e senza responsabile diventa debito
    // invisibile: il test impedisce che ne nasca uno.
    for (const [key, config] of Object.entries(DASHBOARD_FEATURES)) {
      if (!config.available) {
        expect(config.blockedReason, `${key} reason`).toBeTruthy();
        expect(config.owner, `${key} owner`).toBeTruthy();
      }
    }
  });
});
