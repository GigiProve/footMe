import { describe, expect, it } from "vitest";

import {
  buildClubDeepLink,
  buildClubShareMessage,
  buildTeamDeepLink,
  buildTeamShareMessage,
  buildVenueRows,
  composeTeamDisplayName,
  countPublicTeams,
  filterPositions,
  formatOpportunitiesCount,
  formatPublishedAgo,
  formatTeamsCount,
  hasPublicAffiliates,
  isOfficialPage,
  parseClubColors,
  resolveClubCategory,
  resolveTeamFallback,
  sortSocietyTeams,
  TEAMS_PREVIEW_LIMIT,
} from "./society-profile-model";
import type {
  SocietyPosition,
  SocietyTeamSummary,
} from "./society-profile-types";

function team(overrides: Partial<SocietyTeamSummary> = {}): SocietyTeamSummary {
  return {
    category: "Serie D",
    city: "Predappio",
    clubId: "club-1",
    competitionName: null,
    coverUrl: null,
    id: "team-1",
    logoUrl: null,
    name: "Prima squadra",
    region: "Emilia-Romagna",
    season: "2026/27",
    sortOrder: 0,
    teamType: "senior",
    venueName: null,
    ...overrides,
  };
}

function position(overrides: Partial<SocietyPosition> = {}): SocietyPosition {
  return {
    category: "Serie D",
    city: "Predappio",
    id: "ad-1",
    publishedAt: "2026-10-01T10:00:00.000Z",
    region: "Emilia-Romagna",
    roleRequired: "goalkeeper",
    targetRole: "player",
    teamId: null,
    teamName: null,
    teamType: "senior",
    title: "Portiere",
    ...overrides,
  };
}

describe("conteggio e pluralizzazione delle squadre", () => {
  it("conta le squadre pubbliche ricevute", () => {
    expect(countPublicTeams([team(), team({ id: "team-2" })])).toBe(2);
  });

  it("usa il singolare con una sola squadra", () => {
    expect(formatTeamsCount(1)).toBe("1 squadra");
    expect(formatTeamsCount(0)).toBe("0 squadre");
    expect(formatTeamsCount(8)).toBe("8 squadre");
  });

  it("pluralizza anche le opportunità", () => {
    expect(formatOpportunitiesCount(1)).toBe("1 opportunità nel club");
    expect(formatOpportunitiesCount(2)).toBe("2 opportunità nel club");
  });

  it("mostra tre righe prima di Vedi tutte", () => {
    expect(TEAMS_PREVIEW_LIMIT).toBe(3);
  });
});

describe("ordinamento delle squadre", () => {
  it("mette la prima squadra davanti al settore giovanile", () => {
    const sorted = sortSocietyTeams([
      team({ id: "u18", name: "Under 18", sortOrder: 1, teamType: "youth" }),
      team({ id: "senior", name: "Prima squadra", sortOrder: 5 }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["senior", "u18"]);
  });

  it("rispetta l'ordine configurato dalla Società, non l'alfabeto", () => {
    const sorted = sortSocietyTeams([
      team({ id: "u15", name: "Under 15", sortOrder: 2, teamType: "youth" }),
      team({ id: "primavera", name: "Primavera", sortOrder: 0, teamType: "youth" }),
      team({ id: "u18", name: "Under 18", sortOrder: 1, teamType: "youth" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["primavera", "u18", "u15"]);
  });
});

describe("categoria dell'header", () => {
  it("deriva dalla prima squadra attiva", () => {
    const category = resolveClubCategory({ category: "Eccellenza" }, [
      team({ category: "Serie D" }),
    ]);

    expect(category).toBe("Serie D");
  });

  it("ricade sul dato del club quando non ci sono squadre", () => {
    expect(resolveClubCategory({ category: "Eccellenza" }, [])).toBe("Eccellenza");
  });

  it("non inventa una categoria quando nessuno la dichiara", () => {
    expect(resolveClubCategory({ category: null }, [])).toBeNull();
  });
});

describe("nome composto del profilo squadra", () => {
  it("antepone il nome della Società", () => {
    expect(composeTeamDisplayName("ASD Predappio", "Primavera")).toBe(
      "ASD Predappio Primavera",
    );
  });

  it("non duplica il nome già contenuto nella denominazione salvata", () => {
    expect(composeTeamDisplayName("ASD Predappio", "ASD Predappio Primavera")).toBe(
      "ASD Predappio Primavera",
    );
  });

  it("riconosce la stessa Società scritta con punteggiatura diversa", () => {
    expect(composeTeamDisplayName("ASD Predappio", "A.S.D. Predappio Under 18")).toBe(
      "A.S.D. Predappio Under 18",
    );
  });

  it("regge un nome squadra vuoto", () => {
    expect(composeTeamDisplayName("ASD Predappio", "   ")).toBe("ASD Predappio");
  });
});

describe("fallback dalla Società", () => {
  it("preferisce il dato specifico della squadra", () => {
    expect(resolveTeamFallback("Campo Nord", "Stadio Comunale")).toBe("Campo Nord");
  });

  it("ricade sulla Società quando la squadra non ha il dato", () => {
    expect(resolveTeamFallback(null, "Stadio Comunale")).toBe("Stadio Comunale");
    expect(resolveTeamFallback("   ", "Stadio Comunale")).toBe("Stadio Comunale");
  });

  it("restituisce null quando il dato non esiste da nessuna parte", () => {
    expect(resolveTeamFallback(null, null)).toBeNull();
  });
});

describe("filtro delle posizioni", () => {
  const positions = [
    position({ id: "senior-ad" }),
    position({ id: "youth-ad", teamType: "youth" }),
  ];

  it("mostra tutte le posizioni per default", () => {
    expect(filterPositions(positions, "all")).toHaveLength(2);
  });

  it("isola la prima squadra", () => {
    expect(filterPositions(positions, "senior").map((entry) => entry.id)).toEqual([
      "senior-ad",
    ]);
  });

  it("isola il settore giovanile", () => {
    expect(filterPositions(positions, "youth").map((entry) => entry.id)).toEqual([
      "youth-ad",
    ]);
  });
});

describe("data relativa di pubblicazione", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");

  it("dice oggi, ieri e i giorni trascorsi", () => {
    expect(formatPublishedAgo("2026-10-08T08:00:00.000Z", now)).toBe("Pubblicata oggi");
    expect(formatPublishedAgo("2026-10-07T08:00:00.000Z", now)).toBe("Pubblicata ieri");
    expect(formatPublishedAgo("2026-10-06T08:00:00.000Z", now)).toBe(
      "Pubblicata 2 giorni fa",
    );
  });

  it("non produce una riga quando la data manca o non è valida", () => {
    expect(formatPublishedAgo(null, now)).toBeNull();
    expect(formatPublishedAgo("non-una-data", now)).toBeNull();
  });
});

describe("colori sociali", () => {
  it("restituisce nomi leggibili, non codici", () => {
    expect(parseClubColors("giallo, blu")).toEqual(["Giallo", "Blu"]);
  });

  it("gestisce un colore solo e il dato assente", () => {
    expect(parseClubColors("Rossoblù")).toEqual(["Rossoblù"]);
    expect(parseClubColors(null)).toEqual([]);
  });
});

describe("label Pagina ufficiale", () => {
  it("compare solo su un profilo verificato", () => {
    expect(isOfficialPage({ verificationStatus: "verified" })).toBe(true);
    expect(isOfficialPage({ verificationStatus: "unverified" })).toBe(false);
    expect(isOfficialPage({ verificationStatus: "pending_review" })).toBe(false);
  });
});

describe("sede e impianto", () => {
  it("non ripete la stessa informazione su due righe", () => {
    const rows = buildVenueRows({
      city: "Predappio",
      fieldAddress: "Stadio Comunale",
      headquartersAddress: null,
      stadium: "Stadio Comunale",
    });

    expect(rows).toEqual([
      { label: "Città", value: "Predappio" },
      { label: "Impianto", value: "Stadio Comunale" },
    ]);
  });

  it("omette le righe senza valore", () => {
    const rows = buildVenueRows({
      city: "Predappio",
      fieldAddress: null,
      headquartersAddress: null,
      stadium: null,
    });

    expect(rows).toEqual([{ label: "Città", value: "Predappio" }]);
  });
});

describe("affiliate e condivisione", () => {
  it("omette la sezione affiliate quando non ce ne sono", () => {
    expect(hasPublicAffiliates([])).toBe(false);
  });

  it("condivide nome e deep link, nient'altro", () => {
    expect(buildClubShareMessage({ id: "club-1", name: "ASD Predappio" })).toBe(
      "Scopri ASD Predappio su ProLink. footme://club/club-1",
    );
  });

  it("usa lo schema registrato dall'app nei deep link", () => {
    expect(buildClubDeepLink("club-1")).toBe("footme://club/club-1");
    expect(buildTeamDeepLink("team-1")).toBe("footme://club/team/team-1");
  });

  it("condivide la squadra con il nome composto", () => {
    expect(buildTeamShareMessage("ASD Predappio", "Primavera", "team-1")).toBe(
      "Scopri ASD Predappio Primavera su ProLink. footme://club/team/team-1",
    );
  });
});
