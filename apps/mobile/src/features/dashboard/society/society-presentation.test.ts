import { describe, expect, it } from "vitest";

import type { SocietyOverview } from "../adapters/society-adapter";
import type {
  DashboardCapability,
  DashboardIdentity,
} from "../dashboard-types";
import {
  buildManagementAreas,
  societyApplicationStatusLabel,
  societyFirstRunProposals,
  societyInviteLines,
  SOCIETY_HREFS,
  teamContextLabel,
} from "./society-presentation";

function society(
  capabilities: DashboardCapability[],
  isOwner = false,
): DashboardIdentity {
  return {
    avatarUrl: null,
    capabilities,
    id: "club-1",
    isOwner,
    isVerified: true,
    kind: "society",
    name: "AC Como",
    scopeLabel: null,
  };
}

function overview(patch: Partial<SocietyOverview> = {}): SocietyOverview {
  return {
    accessVerifiedAt: null,
    applicationsCount: null,
    applicationsPreview: null,
    applicationsToHandleCount: null,
    dataRevision: 1,
    draftsCount: null,
    draftsPreview: null,
    invitesIncomingCount: null,
    invitesPendingCount: null,
    positionsOpenCount: null,
    prioritySignals: [],
    priorityTotalCount: 0,
    recentContentPreview: null,
    scheduledCount: null,
    teamsCount: null,
    teamsPreview: null,
    ...patch,
  };
}

describe("societyInviteLines", () => {
  it("omits an aggregate the domain cannot answer for", () => {
    // §14: le richieste in ingresso non esistono come stato nel dominio.
    // Mostrarle a zero direbbe «nessuna richiesta da gestire» su qualcosa che
    // nessuno ha calcolato.
    expect(
      societyInviteLines(
        overview({ invitesIncomingCount: null, invitesPendingCount: 4 }),
      ),
    ).toEqual(["4 inviti in attesa"]);
  });

  it("keeps the two quantities distinct", () => {
    // §14 vieta di sommare richieste ricevute e inviti in uscita in un unico
    // totale: sono due relazioni con direzioni opposte.
    expect(
      societyInviteLines(
        overview({ invitesIncomingCount: 2, invitesPendingCount: 4 }),
      ),
    ).toEqual(["2 richieste ricevute", "4 inviti in attesa"]);
  });

  it("uses the singular form", () => {
    expect(
      societyInviteLines(
        overview({ invitesIncomingCount: 1, invitesPendingCount: 1 }),
      ),
    ).toEqual(["1 richiesta ricevuta", "1 invito in attesa"]);
  });

  it("produces nothing when no aggregate is readable", () => {
    expect(societyInviteLines(overview())).toEqual([]);
  });

  it("treats zero as a valid answer", () => {
    // §8: «Zero è un risultato valido; un errore di caricamento non diventa
    // zero.» Zero inviti pendenti è un'informazione, non un'assenza.
    expect(
      societyInviteLines(overview({ invitesPendingCount: 0 })),
    ).toEqual(["0 inviti in attesa"]);
  });
});

describe("societyApplicationStatusLabel", () => {
  it("reads the canonical lifecycle from the society side", () => {
    // §10: «Non creare application_status = NEW per riprodurre la label
    // Nuova.» Gli stati restano quelli dell'Application; cambia il lettore.
    expect(societyApplicationStatusLabel("submitted")).toBe("Nuova");
    expect(societyApplicationStatusLabel("reviewing")).toBe("In valutazione");
    expect(societyApplicationStatusLabel("accepted")).toBe("Accettata");
  });

  it("leaves an unknown status unlabelled", () => {
    // Una label inventata direbbe il falso su una candidatura reale.
    expect(societyApplicationStatusLabel("teletrasportata")).toBeNull();
  });
});

describe("teamContextLabel", () => {
  it("drops a category that only repeats the team name", () => {
    expect(teamContextLabel("Under 17", "Under 17")).toBeNull();
    expect(teamContextLabel("Primavera", "primavera")).toBeNull();
  });

  it("keeps a category that adds something", () => {
    expect(teamContextLabel("Prima squadra", "Serie D")).toBe("Serie D");
    expect(teamContextLabel("Primavera", "Settore giovanile")).toBe(
      "Settore giovanile",
    );
  });

  it("returns null without a category", () => {
    expect(teamContextLabel("Prima squadra", null)).toBeNull();
  });
});

describe("buildManagementAreas", () => {
  it("gives the owner the four rows of §16", () => {
    const rows = buildManagementAreas(
      society(["dashboard_view", "shortlist_view"], true),
    ).map((row) => row.id);

    expect(rows).toEqual([
      "shortlist",
      "permissions",
      "affiliates",
      "society_profile",
    ]);
  });

  it("withholds the admin rows from a member who only manages a team", () => {
    // §16: «Non esporre Amministratori e permessi a chi può soltanto gestire
    // una squadra.» Una riga non autorizzata è assente, non disabilitata.
    const rows = buildManagementAreas(
      society(["dashboard_view", "teams_view", "shortlist_view"]),
    ).map((row) => row.id);

    // "seasons" resta: DAS-REV-10 §9 la concede con `teams_view`, che è
    // esattamente la capability di chi gestisce una squadra. Le due righe
    // amministrative restano fuori.
    expect(rows).toEqual(["seasons", "shortlist", "society_profile"]);
  });

  it("mostra Stagioni e storico solo con teams_view (DAS-REV-10 §9)", () => {
    expect(
      buildManagementAreas(society(["dashboard_view", "teams_view"])).map(
        (row) => row.id,
      ),
    ).toContain("seasons");

    // Senza la chiave la riga è assente, non disabilitata: aprendola
    // l'actor troverebbe zero squadre consultabili.
    expect(
      buildManagementAreas(society(["dashboard_view"])).map((row) => row.id),
    ).not.toContain("seasons");
  });

  it("withholds Shortlist without its own domain permission", () => {
    const rows = buildManagementAreas(society(["dashboard_view"])).map(
      (row) => row.id,
    );

    expect(rows).toEqual(["society_profile"]);
  });

  it("points the profile row at the canonical society profile", () => {
    const [profile] = buildManagementAreas(society(["dashboard_view"]));

    expect(profile.href).toBe(SOCIETY_HREFS.societyProfile("club-1"));
  });

  it("never carries a count: Posizioni e Squadre hanno moduli propri", () => {
    // §7: ogni dominio compare una volta sola nella stessa composizione.
    const rows = buildManagementAreas(
      society(["dashboard_view", "shortlist_view"], true),
    );

    expect(rows.map((row) => row.title)).not.toContain("Posizioni aperte");
    expect(rows.map((row) => row.title)).not.toContain("Squadre del club");
  });
});

describe("societyFirstRunProposals", () => {
  it("shows the two proposals of the master 04", () => {
    const proposals = societyFirstRunProposals([
      "society_new_position",
      "society_invite_person",
    ]);

    expect(proposals.map((proposal) => proposal.id)).toEqual([
      "first_position",
      "first_invite",
    ]);
    expect(proposals[0].actionLabel).toBe("Nuova posizione");
    expect(proposals[1].actionLabel).toBe("Invita persona");
  });

  it("shows only the authorized proposal", () => {
    // §18: «Mostrare soltanto le proposte autorizzate e tecnicamente
    // disponibili.» La seconda non diventa un pulsante disabilitato.
    const proposals = societyFirstRunProposals(["society_new_position"]);

    expect(proposals.map((proposal) => proposal.id)).toEqual([
      "first_position",
    ]);
  });

  it("proposes content only to an actor without sport actions", () => {
    // §18: «Con soli permessi editoriali proporre l'avvio di contenuti […]
    // senza suggerire operazioni sportive.»
    expect(
      societyFirstRunProposals(["society_new_post"]).map(
        (proposal) => proposal.id,
      ),
    ).toEqual(["first_content"]);

    expect(
      societyFirstRunProposals([
        "society_new_position",
        "society_new_post",
      ]).map((proposal) => proposal.id),
    ).toEqual(["first_position"]);
  });

  it("produces nothing for a read-only administrator", () => {
    // §18: «Con soli permessi di consultazione usare un empty state
    // informativo senza azioni non consentite.»
    expect(societyFirstRunProposals([])).toEqual([]);
  });
});

describe("SOCIETY_HREFS", () => {
  it("carries the group as an explicit filter", () => {
    // §13: «L'eventuale filtro della preview deve essere esplicito nel
    // collegamento; non aprire una lista vuota o estranea al gruppo mostrato.»
    expect(SOCIETY_HREFS.applications("ad-1")).toBe(
      "/(tabs)/announcements?focus=applications&adId=ad-1",
    );
    expect(SOCIETY_HREFS.applications()).toBe(
      "/(tabs)/announcements?focus=applications",
    );
  });

  it("keeps the two centres distinguishable", () => {
    // Il centro Posizioni e il centro Candidature sono oggi la stessa
    // schermata: senza `focus` le due destinazioni sarebbero indistinguibili.
    expect(SOCIETY_HREFS.positions()).not.toBe(SOCIETY_HREFS.applications());
  });

  it("escapes a reference instead of interpolating it raw", () => {
    expect(SOCIETY_HREFS.applications("a d&x")).toBe(
      "/(tabs)/announcements?focus=applications&adId=a%20d%26x",
    );
  });
});
