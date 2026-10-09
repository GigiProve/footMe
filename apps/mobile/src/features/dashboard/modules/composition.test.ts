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
  isOwner = false,
): DashboardIdentity {
  return {
    avatarUrl: null,
    capabilities,
    id: `${kind}-1`,
    isOwner,
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
  "invites_view",
  "shortlist_view",
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
    // Nessun modulo del registry usa oggi la valutazione ANY — DAS-REV-07 §16
    // ha tolto le capability a "Aree di gestione", che le applica riga per
    // riga. La semantica resta però parte del contratto di composizione, e un
    // modulo futuro deve poterci contare.
    const anyOfTwo = {
      ...MODULE_REGISTRY.society_areas,
      capabilitiesAny: ["positions_view", "teams_view"] as const,
    };

    const neither = identity("society", ["dashboard_view", "content_view"]);
    const one = identity("society", ["dashboard_view", "teams_view"]);

    expect(isModuleEligible(anyOfTwo, neither)).toBe(false);
    expect(isModuleEligible(anyOfTwo, one)).toBe(true);
  });

  it("hides a module whose destination is still gated on the owner role", () => {
    // DAS-REV-07 §16: applicare i permessi a ogni voce. `/club-admin/invites`
    // redirige chi non ha `profile.role === 'club_admin'`, quindi il modulo
    // sarebbe una promessa che la route rimanda indietro.
    const member = identity("society", ["dashboard_view", "invites_view"]);
    const owner: DashboardIdentity = { ...member, isOwner: true };

    expect(isModuleEligible(MODULE_REGISTRY.society_invites, member)).toBe(
      false,
    );
    expect(isModuleEligible(MODULE_REGISTRY.society_invites, owner)).toBe(true);
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
      identity("society", FULL_SOCIETY, true),
    ).modules.map((module) => module.id);

    // DAS-REV-02 §11: senza priorità, Posizioni aperte precede Candidature
    // ricevute. È l'ordine base che la promozione deve poter ripristinare.
    //
    // DAS-REV-07 §7: moduli operativi (Posizioni, Candidature, Inviti,
    // Squadre), poi editoriali, poi gli accessi gestionali secondari.
    expect(modules).toEqual([
      "society_positions",
      "society_applications",
      "society_invites",
      "society_teams",
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
      "society_teams",
      "society_areas",
    ]);
    // DAS-REV-07 §6: «Un utente con soli permessi editoriali non riceve
    // aggregati sportivi non autorizzati». "Aree di gestione" resta, perché
    // "Profilo della società" è raggiungibile da chiunque apra la Dashboard.
    expect(editorial).toEqual([
      "society_drafts",
      "society_recent_content",
      "society_areas",
    ]);
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
    // `content_create` è concessa, ma il composer Articolo non esiste: il
    // contratto c'è, la CTA no. Una CTA senza destinazione è vietata da §4.
    expect(DASHBOARD_FEATURES.society_article_composer.available).toBe(false);

    const editor = identity("society", ["dashboard_view", "content_create"]);

    expect(composeQuickActions(editor)).not.toContain("society_new_article");
  });

  it("withholds the invite action from a member whose route rejects them", () => {
    // DAS-REV-07 §11: l'azione apre «il flusso canonico di invito
    // nell'organico». Per un membro autorizzato ma non proprietario quel
    // flusso rimbalza, quindi l'azione non compare.
    const member = identity("society", ["dashboard_view", "invites_create"]);

    expect(composeQuickActions(member)).not.toContain("society_invite_person");
    expect(
      composeQuickActions({ ...member, isOwner: true }),
    ).toContain("society_invite_person");
  });

  it("keeps at most two quick actions with mixed responsibilities", () => {
    // §11: «mantenere al massimo due azioni principali anche con
    // responsabilità miste, selezionate con una regola stabile». La regola è
    // sportive prima di editoriali, non la quantità di dati di ciascun dominio.
    const mixed = identity("society", FULL_SOCIETY, true);

    expect(composeQuickActions(mixed)).toEqual([
      "society_new_position",
      "society_invite_person",
    ]);
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
