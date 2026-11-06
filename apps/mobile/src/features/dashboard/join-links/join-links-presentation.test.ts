/**
 * join-links-presentation.test.ts
 *
 * Copie, formatteri e logica di ui per i link di invito.
 */
import { describe, expect, it } from "vitest";
import {
  JOIN_LINKS_COPY,
  JOIN_PROFILE_TYPES,
  audienceSentence,
  audienceSummary,
  availabilityLabel,
  constraintHelper,
  enteredViaLabel,
  formatConnectedDate,
  isSelectableDay,
  landingHeading,
  limitBelowUsageError,
  limitLabel,
  mutationErrorCopy,
  normalizeCustomRole,
  parseDay,
  parseLimit,
  peopleLabel,
  removeRoleSentence,
  rowStateLine,
  selectAllState,
  shareMessage,
  successSentence,
  toDayString,
  toggleAllTeam,
  toggleProfileType,
  usageLine,
  wrongDataSentence,
} from "./join-links-presentation";
import type { JoinLinkRow, JoinProfileType } from "./join-links-types";

// ──────────────────────────────────────────────────────────────────────────
// §12 Categorie e select-all
// ──────────────────────────────────────────────────────────────────────────

describe("categorie — §12", () => {
  it("audienceSummary: quattro categorie → 'Tutta la squadra'", () => {
    const result = audienceSummary(["player", "coach", "staff", "director"]);
    expect(result).toBe("Tutta la squadra");
  });

  it("audienceSummary: ordine canonico ignora input disordinato", () => {
    const result = audienceSummary(["director", "player", "staff", "coach"]);
    expect(result).toBe("Tutta la squadra");
  });

  it("audienceSummary: due categorie → congiunzione 'e'", () => {
    const result = audienceSummary(["player", "staff"]);
    expect(result).toBe("Giocatori e Staff");
  });

  it("audienceSummary: tre categorie → elenco con 'e'", () => {
    const result = audienceSummary(["player", "coach", "staff"]);
    expect(result).toBe("Giocatori, Allenatori e Staff");
  });

  it("audienceSummary: empty array → stringa vuota", () => {
    const result = audienceSummary([]);
    expect(result).toBe("");
  });

  it("audienceSentence: minuscolo per il messaggio di condivisione", () => {
    const result = audienceSentence(["player", "coach"]);
    expect(result).toBe("giocatori e allenatori");
  });

  it("audienceSentence: ordine canonico", () => {
    const result = audienceSentence(["coach", "player"]);
    expect(result).toBe("giocatori e allenatori");
  });

  it("toggleProfileType: deselezionare lascia le altre intatte", () => {
    const current: JoinProfileType[] = ["player", "coach", "staff"];
    const result = toggleProfileType(current, "coach");
    expect(result).toEqual(["player", "staff"]);
  });

  it("toggleProfileType: aggiungere ripristina ordine canonico", () => {
    const current: JoinProfileType[] = ["player", "staff"];
    const result = toggleProfileType(current, "coach");
    expect(result).toEqual(["player", "coach", "staff"]);
  });

  it("toggleAllTeam: da nulla a tutte quattro", () => {
    const result = toggleAllTeam([]);
    expect(result).toEqual(JOIN_PROFILE_TYPES);
  });

  it("toggleAllTeam: da tutte a nulla", () => {
    const result = toggleAllTeam(["player", "coach", "staff", "director"]);
    expect(result).toEqual([]);
  });

  it("toggleAllTeam: da alcune seleziona tutte (non deseleziona)", () => {
    const result = toggleAllTeam(["player", "coach"]);
    expect(result).toEqual(JOIN_PROFILE_TYPES);
  });

  it("selectAllState: nulla → unchecked", () => {
    expect(selectAllState([])).toBe("unchecked");
  });

  it("selectAllState: alcune → indeterminate", () => {
    expect(selectAllState(["player", "coach"])).toBe("indeterminate");
  });

  it("selectAllState: tutte → checked", () => {
    expect(selectAllState(["player", "coach", "staff", "director"])).toBe(
      "checked",
    );
  });

  it("selectAllState: da indeterminate non è savable, serve toggleAllTeam", () => {
    const state = selectAllState(["player", "coach"]);
    expect(state).toBe("indeterminate");
    const after = toggleAllTeam(["player", "coach"]);
    expect(after).toEqual(["player", "coach", "staff", "director"]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §9, §10, §27 Stato e contatori
// ──────────────────────────────────────────────────────────────────────────

describe("disponibilità — §9", () => {
  it("availabilityLabel: 'available' → 'Attivo'", () => {
    expect(availabilityLabel("available")).toBe("Attivo");
  });

  it("availabilityLabel: 'expired' → 'Scaduto'", () => {
    expect(availabilityLabel("expired")).toBe("Scaduto");
  });

  it("availabilityLabel: 'limit_reached' → 'Limite raggiunto'", () => {
    expect(availabilityLabel("limit_reached")).toBe("Limite raggiunto");
  });

  it("availabilityLabel: 'revoked' → 'Disattivato'", () => {
    expect(availabilityLabel("revoked")).toBe("Disattivato");
  });

  it("availabilityLabel: 'structure' → 'Non disponibile'", () => {
    expect(availabilityLabel("structure")).toBe("Non disponibile");
  });
});

describe("persone collegate — §10", () => {
  it("peopleLabel: 0 → 'Nessuna persona collegata'", () => {
    expect(peopleLabel(0)).toBe("Nessuna persona collegata");
  });

  it("peopleLabel: 1 → singolare", () => {
    expect(peopleLabel(1)).toBe("1 persona collegata");
  });

  it("peopleLabel: 27 → plurale", () => {
    expect(peopleLabel(27)).toBe("27 persone collegate");
  });

  it("rowStateLine: compone stato e persone", () => {
    const row: JoinLinkRow = {
      activePeople: 27,
      allowedProfileTypes: ["player"],
      availability: "available",
      completedUses: 10,
      createdAt: "2026-11-06T09:00:00Z",
      id: "link-1",
      maxRedemptions: null,
      revokedAt: null,
      status: "active",
      teamId: "t1",
      teamName: "Prima squadra",
    };

    expect(rowStateLine(row)).toBe("Attivo · 27 persone collegate");
  });

  it("rowStateLine: con zero persone", () => {
    const row: JoinLinkRow = {
      activePeople: 0,
      allowedProfileTypes: ["player"],
      availability: "expired",
      completedUses: 5,
      createdAt: "2026-11-06T09:00:00Z",
      id: "link-1",
      maxRedemptions: 10,
      revokedAt: null,
      status: "active",
      teamId: "t1",
      teamName: "Prima squadra",
    };

    expect(rowStateLine(row)).toBe("Scaduto · Nessuna persona collegata");
  });
});

describe("consumo del limite — §27", () => {
  it("usageLine: con limite → '30 di 40 utilizzati'", () => {
    expect(usageLine(30, 40)).toBe("30 di 40 utilizzati");
  });

  it("usageLine: senza limite → '30 utilizzi completati'", () => {
    expect(usageLine(30, null)).toBe("30 utilizzi completati");
  });

  it("usageLine: 1 utilizzo con limite", () => {
    expect(usageLine(1, 10)).toBe("1 di 10 utilizzati");
  });

  it("usageLine: 1 utilizzo senza limite → singolare", () => {
    expect(usageLine(1, null)).toBe("1 utilizzo completato");
  });

  it("usageLine: un link con 20 completed su 20 ma 18 active riporta entrambi", () => {
    const completed = usageLine(20, 20);
    const active = peopleLabel(18);
    expect(completed).toBe("20 di 20 utilizzati");
    expect(active).toBe("18 persone collegate");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §15 Date e selezione giorni
// ──────────────────────────────────────────────────────────────────────────

describe("date — §15", () => {
  it("parseDay: '2026-09-30' come data civile, non istante UTC", () => {
    const date = parseDay("2026-09-30");
    expect(date).not.toBeNull();
    expect(date!.getMonth()).toBe(8); // settembre, indice 8
    expect(date!.getDate()).toBe(30);
  });

  it("toDayString: round-trip", () => {
    const date = parseDay("2026-09-30");
    expect(date).not.toBeNull();
    const str = toDayString(date!);
    expect(str).toBe("2026-09-30");
  });

  it("parseDay: null input → null", () => {
    expect(parseDay(null)).toBeNull();
  });

  it("parseDay: stringa vuota → null", () => {
    expect(parseDay("")).toBeNull();
  });

  it("parseDay: stringa non parsabile → null", () => {
    expect(parseDay("abc")).toBeNull();
  });

  it("isSelectableDay: oggi è selezionabile", () => {
    const now = new Date(2026, 10, 6); // 6 novembre 2026
    const today = new Date(2026, 10, 6);
    expect(isSelectableDay(today, now)).toBe(true);
  });

  it("isSelectableDay: ieri no", () => {
    const now = new Date(2026, 10, 6);
    const yesterday = new Date(2026, 10, 5);
    expect(isSelectableDay(yesterday, now)).toBe(false);
  });

  it("isSelectableDay: domani sì", () => {
    const now = new Date(2026, 10, 6);
    const tomorrow = new Date(2026, 10, 7);
    expect(isSelectableDay(tomorrow, now)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §15, §30 Validazioni e helper
// ──────────────────────────────────────────────────────────────────────────

describe("validazione limite — §15", () => {
  it("parseLimit: '40' → 40", () => {
    expect(parseLimit("40")).toBe(40);
  });

  it("parseLimit: '0' → null", () => {
    expect(parseLimit("0")).toBeNull();
  });

  it("parseLimit: '-3' → null", () => {
    expect(parseLimit("-3")).toBeNull();
  });

  it("parseLimit: '2.5' → null", () => {
    expect(parseLimit("2.5")).toBeNull();
  });

  it("parseLimit: 'abc' → null", () => {
    expect(parseLimit("abc")).toBeNull();
  });

  it("parseLimit: '' → null", () => {
    expect(parseLimit("")).toBeNull();
  });

  it("parseLimit: ' ' → null", () => {
    expect(parseLimit(" ")).toBeNull();
  });
});

describe("helper correttivo — §30", () => {
  it("constraintHelper: solo scadenza esaurita", () => {
    const now = new Date(2026, 10, 6);
    const result = constraintHelper({
      availability: "expired",
      completedUses: 5,
      expiresOn: "2026-11-05",
      maxRedemptions: null,
      now,
    });
    expect(result).toBe(JOIN_LINKS_COPY.expiredHelper);
  });

  it("constraintHelper: solo limite raggiunto", () => {
    const now = new Date(2026, 10, 6);
    const result = constraintHelper({
      availability: "limit_reached",
      completedUses: 10,
      expiresOn: "2026-11-30",
      maxRedemptions: 10,
      now,
    });
    expect(result).toBe(JOIN_LINKS_COPY.limitHelper);
  });

  it("constraintHelper: entrambi scaduti e raggiunto", () => {
    const now = new Date(2026, 10, 6);
    const result = constraintHelper({
      availability: "available",
      completedUses: 10,
      expiresOn: "2026-11-05",
      maxRedemptions: 10,
      now,
    });
    expect(result).toBe(JOIN_LINKS_COPY.bothHelper);
  });

  it("constraintHelper: revocato", () => {
    const result = constraintHelper({
      availability: "revoked",
      completedUses: 0,
      expiresOn: null,
      maxRedemptions: null,
    });
    expect(result).toBe(JOIN_LINKS_COPY.revokedHelper);
  });

  it("constraintHelper: structure", () => {
    const result = constraintHelper({
      availability: "structure",
      completedUses: 0,
      expiresOn: null,
      maxRedemptions: null,
    });
    expect(result).toBe(JOIN_LINKS_COPY.structureHelper);
  });

  it("constraintHelper: disponibile → null", () => {
    const result = constraintHelper({
      availability: "available",
      completedUses: 5,
      expiresOn: "2026-11-30",
      maxRedemptions: 20,
    });
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §41 Errori
// ──────────────────────────────────────────────────────────────────────────

describe("errore limite — §41", () => {
  it("limitBelowUsageError: plurale con 30", () => {
    const result = limitBelowUsageError(30);
    expect(result).toBe(
      "30 persone hanno già utilizzato questo link. Il limite non può essere inferiore a 30.",
    );
  });

  it("limitBelowUsageError: singolare con 1", () => {
    const result = limitBelowUsageError(1);
    expect(result).toBe(
      "1 persona ha già utilizzato questo link. Il limite non può essere inferiore a 1.",
    );
  });

  it("mutationErrorCopy: JOIN_LINK_LIMIT_BELOW_USAGE usa il detail", () => {
    const result = mutationErrorCopy(
      "JOIN_LINK_LIMIT_BELOW_USAGE",
      "update",
      "31",
    );
    expect(result).toBe(
      "31 persone hanno già utilizzato questo link. Il limite non può essere inferiore a 31.",
    );
  });

  it("mutationErrorCopy: fallback se detail non è un numero", () => {
    const result = mutationErrorCopy(
      "JOIN_LINK_LIMIT_BELOW_USAGE",
      "update",
      "invalid",
    );
    expect(result).toBe("Non è stato possibile salvare le modifiche. Riprova.");
  });

  it("mutationErrorCopy: codice sconosciuto usa fallback", () => {
    const result = mutationErrorCopy("UNKNOWN" as any, "create", null);
    expect(result).toBe("Non è stato possibile creare il link. Riprova.");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §13 Normalizzazione ruoli
// ──────────────────────────────────────────────────────────────────────────

describe("normalizzazione ruolo custom — §13", () => {
  it("normalizeCustomRole: rimuove caratteri di controllo", () => {
    const result = normalizeCustomRole("Ruolo\n\tSpeciale");
    expect(result).toBe("Ruolo Speciale");
  });

  it("normalizeCustomRole: rimuove <> sostituendoli con spazi", () => {
    const result = normalizeCustomRole("Ruolo<script>");
    expect(result).toBe("Ruolo script");
  });

  it("normalizeCustomRole: collassa spazi", () => {
    const result = normalizeCustomRole("Ruolo    Speciale");
    expect(result).toBe("Ruolo Speciale");
  });

  it("normalizeCustomRole: trim", () => {
    const result = normalizeCustomRole("  Ruolo Speciale  ");
    expect(result).toBe("Ruolo Speciale");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// §5, §18, §19, §26, §34, §41 Frasi parametriche
// ──────────────────────────────────────────────────────────────────────────

describe("frasi parametriche — §18, §19, §26, §34", () => {
  it("shareMessage: include società, squadra, audience e url", () => {
    const result = shareMessage({
      allowedProfileTypes: ["player", "coach"],
      clubName: "AC Como",
      teamName: "Prima squadra",
      url: "https://prolink.app/join/abc123",
    });

    expect(result).toContain("AC Como ti invita");
    expect(result).toContain("Prima squadra");
    expect(result).toContain("giocatori e allenatori");
    expect(result).toContain("https://prolink.app/join/abc123");
  });

  it("shareMessage: senza audience", () => {
    const result = shareMessage({
      allowedProfileTypes: [],
      clubName: "AC Como",
      teamName: "Prima squadra",
      url: "https://prolink.app/join/abc123",
    });

    expect(result).not.toContain("Il link è dedicato");
  });

  it("landingHeading: 'AC Como ti invita a collegarti'", () => {
    const result = landingHeading("AC Como");
    expect(result).toBe("AC Como ti invita a collegarti");
  });

  it("successSentence: collegamento completato", () => {
    const result = successSentence({
      clubName: "AC Como",
      roleLabel: "Calciatore",
      teamName: "Prima squadra",
    });
    expect(result).toBe(
      "Ora sei collegato ad AC Como come Calciatore della Prima squadra.",
    );
  });

  it("removeRoleSentence: rimozione di un ruolo", () => {
    const result = removeRoleSentence({
      clubName: "AC Como",
      personName: "Mario Rossi",
      roleLabel: "Calciatore",
      teamName: "Prima squadra",
    });
    expect(result).toBe(
      "Mario Rossi non risulterà più come Calciatore della Prima squadra di AC Como.",
    );
  });

  it("wrongDataSentence: categoria non ammessa", () => {
    const result = wrongDataSentence({
      allowedProfileTypes: ["player"],
      teamName: "Prima squadra",
    });
    expect(result).toContain("riservato a giocatori della Prima squadra");
  });

  it("enteredViaLabel: con audience", () => {
    const result = enteredViaLabel({
      allowedProfileTypes: ["player", "coach", "staff", "director"],
      teamName: "Prima squadra",
    });
    expect(result).toBe("Link Prima squadra · Tutta la squadra");
  });

  it("enteredViaLabel: senza audience", () => {
    const result = enteredViaLabel({
      allowedProfileTypes: [],
      teamName: "Prima squadra",
    });
    expect(result).toBe("Link Prima squadra");
  });

  it("limitLabel: null → 'Nessun limite'", () => {
    expect(limitLabel(null)).toBe(JOIN_LINKS_COPY.noLimit);
  });

  it("limitLabel: 40 → '40'", () => {
    expect(limitLabel(40)).toBe("40");
  });
});

describe("date formattate — §26", () => {
  it("formatConnectedDate: stesso anno → senza anno", () => {
    const now = new Date(2026, 10, 6); // 6 novembre 2026
    const result = formatConnectedDate("2026-10-25T09:00:00Z", now);
    expect(result).toBe("25 ottobre");
  });

  it("formatConnectedDate: anno diverso → con anno", () => {
    const now = new Date(2026, 10, 6);
    const result = formatConnectedDate("2025-10-25T09:00:00Z", now);
    expect(result).toContain("2025");
  });
});
