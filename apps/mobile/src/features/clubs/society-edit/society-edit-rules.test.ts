/**
 * REV-PROF-18 — regole dell'editor Società.
 *
 * I test coprono i punti in cui la task è prescrittiva: validazioni, limiti,
 * conflitti fra struttura e squadre attive, toggle dell'indirizzo e regola di
 * pubblicazione dei contatti.
 */
import { describe, expect, it } from "vitest";

import {
  countVisibleContacts,
  describeStructureConflict,
  detectStructureConflict,
  findInvalidVisibleContact,
  normalizeClubName,
  normalizeFoundingYearInput,
  parseSocietyColors,
  resolveVenueAddress,
  sanitizeSocietyDescription,
  serializeSocietyColors,
  shouldAskFirstTeamCategory,
  shouldInviteToCreateYouthTeams,
  SOCIETY_DESCRIPTION_MAX_LENGTH,
  validateClubName,
  validateFoundingYear,
  validateSocietyColors,
  validateSocietyDescription,
  validateSportProfile,
  validateVenue,
  type SocietyContactsDraft,
} from "./society-edit-rules";

describe("denominazione", () => {
  it("riduce gli spazi ripetuti e toglie quelli esterni", () => {
    expect(normalizeClubName("  ASD   Predappio ")).toBe("ASD Predappio");
  });

  it("non tocca sigle, apostrofi e accenti", () => {
    expect(normalizeClubName("A.S.D. Città di Sant'Angelo")).toBe(
      "A.S.D. Città di Sant'Angelo",
    );
  });

  it("rifiuta una denominazione fatta di soli spazi", () => {
    expect(validateClubName("   ")).toBe("Inserisci la denominazione del club.");
    expect(validateClubName("ASD Predappio")).toBeNull();
  });
});

describe("anno di fondazione", () => {
  it("tiene solo quattro cifre", () => {
    expect(normalizeFoundingYearInput("19a45x9")).toBe("1945");
  });

  it("accetta un campo vuoto: non tutti i club conoscono il proprio anno", () => {
    expect(validateFoundingYear("")).toBeNull();
  });

  it("rifiuta un anno futuro", () => {
    expect(validateFoundingYear("2030", new Date("2026-10-08"))).toBe(
      "L'anno di fondazione non può essere futuro.",
    );
  });

  it("accetta i club storici", () => {
    expect(validateFoundingYear("1899", new Date("2026-10-08"))).toBeNull();
  });

  it("rifiuta un anno non plausibile", () => {
    expect(validateFoundingYear("0012")).toBe(
      "Inserisci un anno di fondazione valido.",
    );
  });
});

describe("colori sociali", () => {
  it("conserva l'ordine e scarta i duplicati", () => {
    expect(parseSocietyColors("Giallo, Blu, giallo")).toEqual([
      "Giallo",
      "Blu",
    ]);
  });

  it("torna al formato testuale già letto da onboarding e Master Profile", () => {
    expect(serializeSocietyColors(["Giallo", "Blu"])).toBe("Giallo, Blu");
  });

  it("non pretende i colori, che l onboarding non chiede, ma ne limita il numero", () => {
    expect(validateSocietyColors([])).toBeNull();
    expect(validateSocietyColors(["Giallo", "Blu", "Nero", "Rosso"])).toBe(
      "Hai raggiunto il numero massimo di colori sociali.",
    );
    expect(validateSocietyColors(["Giallo", "Blu"])).toBeNull();
  });
});

describe("struttura del club", () => {
  it("blocca Prima squadra se esistono squadre giovanili attive", () => {
    const conflict = detectStructureConflict("first_team_only", {
      hasFirstTeam: true,
      hasYouthTeams: true,
    });

    expect(conflict).toBe("youth_teams_active");
    expect(describeStructureConflict(conflict)).toContain(
      "squadre giovanili attive",
    );
  });

  it("blocca Solo settore giovanile se esiste una prima squadra attiva", () => {
    const conflict = detectStructureConflict("youth_only", {
      hasFirstTeam: true,
      hasYouthTeams: true,
    });

    expect(conflict).toBe("first_team_active");
  });

  it("non blocca una configurazione coerente", () => {
    expect(
      detectStructureConflict("first_team_and_youth", {
        hasFirstTeam: true,
        hasYouthTeams: true,
      }),
    ).toBeNull();
  });

  it("chiede la categoria solo a chi ha una prima squadra", () => {
    expect(shouldAskFirstTeamCategory("first_team_only")).toBe(true);
    expect(shouldAskFirstTeamCategory("first_team_and_youth")).toBe(true);
    expect(shouldAskFirstTeamCategory("youth_only")).toBe(false);
  });

  it("richiede la struttura e, quando serve, la categoria", () => {
    expect(validateSportProfile("", "")).toBe("Seleziona la struttura del club.");
    expect(validateSportProfile("first_team_only", "")).toBe(
      "Seleziona la categoria della prima squadra.",
    );
    expect(validateSportProfile("youth_only", "")).toBeNull();
    expect(validateSportProfile("first_team_only", "Serie D")).toBeNull();
  });

  it("invita a creare le squadre giovanili senza bloccare il salvataggio", () => {
    expect(
      shouldInviteToCreateYouthTeams("first_team_and_youth", {
        hasYouthTeams: false,
      }),
    ).toBe(true);
    expect(
      shouldInviteToCreateYouthTeams("first_team_only", { hasYouthTeams: false }),
    ).toBe(false);
  });
});

describe("sede e impianto", () => {
  it("richiede una città con la sua regione", () => {
    expect(
      validateVenue({ city: "", headquartersAddress: "", region: "" }),
    ).toBe("Seleziona una città valida.");
    expect(
      validateVenue({
        city: "Predappio",
        headquartersAddress: "",
        region: "Emilia-Romagna",
      }),
    ).toBeNull();
  });

  it("con il toggle attivo l'indirizzo impianto è quello della sede", () => {
    expect(
      resolveVenueAddress({
        fieldAddress: "Via dello Sport, 4",
        headquartersAddress: "Via Roma, 10",
        sameAsHeadquarters: true,
      }),
    ).toBe("Via Roma, 10");
  });

  it("con il toggle spento resta il valore dedicato", () => {
    expect(
      resolveVenueAddress({
        fieldAddress: "Via dello Sport, 4",
        headquartersAddress: "Via Roma, 10",
        sameAsHeadquarters: false,
      }),
    ).toBe("Via dello Sport, 4");
  });
});

describe("descrizione", () => {
  it("toglie il markup e conserva gli a capo", () => {
    expect(
      sanitizeSocietyDescription("<b>Storia</b>\n\nValori<script>x</script>"),
    ).toBe("Storia\n\nValorix");
  });

  it("riduce le righe vuote a catena senza appiattire il testo", () => {
    expect(sanitizeSocietyDescription("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("rifiuta oltre 500 caratteri", () => {
    expect(validateSocietyDescription("x".repeat(501))).toBe(
      "La descrizione non può superare 500 caratteri.",
    );
    expect(
      validateSocietyDescription("x".repeat(SOCIETY_DESCRIPTION_MAX_LENGTH)),
    ).toBeNull();
  });
});

describe("contatti pubblici", () => {
  const draft: SocietyContactsDraft = {
    values: {
      email: "info@asdpredappio.it",
      facebook: "",
      instagram: "@asdpredappio",
      phone: "+39 0543 000000",
      website: "asdpredappio.it",
    },
    visibility: {
      email: true,
      facebook: false,
      instagram: false,
      phone: true,
      website: true,
    },
  };

  it("conta solo i canali accesi con un valore valido", () => {
    expect(countVisibleContacts(draft)).toBe(3);
  });

  it("non conta un canale acceso ma vuoto", () => {
    expect(
      countVisibleContacts({
        values: { ...draft.values, email: "" },
        visibility: draft.visibility,
      }),
    ).toBe(2);
  });

  it("non conta un canale valido ma spento", () => {
    expect(
      countVisibleContacts({
        values: draft.values,
        visibility: { ...draft.visibility, instagram: true },
      }),
    ).toBe(4);
  });

  it("segnala il primo canale acceso con un valore non pubblicabile", () => {
    expect(
      findInvalidVisibleContact({
        values: { ...draft.values, email: "non-una-email" },
        visibility: draft.visibility,
      }),
    ).toBe("email");
    expect(findInvalidVisibleContact(draft)).toBeNull();
  });
});
