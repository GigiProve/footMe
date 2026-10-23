/**
 * Regole di presentazione di Ruoli e permessi (§37).
 *
 * Si verificano le distinzioni che la specifica impone e che sono facili da
 * perdere: singolare e zero gestiti davvero, nome normalizzato come lo
 * normalizza il server, nomi riservati rifiutati e `Super Admin` **non**
 * riservato.
 */
import { describe, expect, it } from "vitest";

import {
  ROLES_ERROR_COPY,
  describeRolesError,
  normalizeRoleName,
  roleImpactLabel,
  roleRowMeta,
  roleUsageLabel,
  validateRoleName,
} from "./roles-presentation";
import type { RolesErrorCode } from "./roles-service";

describe("meta di una riga ruolo (§8)", () => {
  it("usa i numeri della fixture canonica", () => {
    expect(roleRowMeta({ adminsCount: 2, areasEnabled: 5 })).toBe(
      "5 aree abilitate · 2 amministratori",
    );
  });

  it("gestisce il singolare su entrambi i conteggi", () => {
    expect(roleRowMeta({ adminsCount: 1, areasEnabled: 1 })).toBe(
      "1 area abilitata · 1 amministratore",
    );
  });

  it("non nasconde lo zero", () => {
    // §33.2: dopo la creazione il quarto ruolo ha 0 amministratori, e dirlo
    // è il modo di rendere evidente che nessuno è stato assegnato.
    expect(roleRowMeta({ adminsCount: 0, areasEnabled: 5 })).toBe(
      "5 aree abilitate · 0 amministratori",
    );
  });
});

describe("impatto di una modifica condivisa (§10)", () => {
  it("riproduce la variante breve del master", () => {
    expect(roleImpactLabel(2)).toBe(
      "Si applicherà a 2 amministratori. Gli ambiti non cambiano.",
    );
  });

  it("gestisce il singolare", () => {
    expect(roleImpactLabel(1)).toBe(
      "Si applicherà a 1 amministratore. Gli ambiti non cambiano.",
    );
  });

  it("tace con zero utilizzatori invece di annunciare una platea vuota", () => {
    expect(roleImpactLabel(0)).toBeNull();
  });

  it("descrive un ruolo non ancora utilizzato senza inventare un numero", () => {
    expect(roleUsageLabel(0)).toBe("Non ancora utilizzato");
    expect(roleUsageLabel(1)).toBe("Utilizzato da 1 amministratore");
    expect(roleUsageLabel(2)).toBe("Utilizzato da 2 amministratori");
  });
});

describe("nome del ruolo (§9)", () => {
  it("normalizza spazi ridondanti come fa il server", () => {
    expect(normalizeRoleName("  Responsabile   settore  giovanile ")).toBe(
      "Responsabile settore giovanile",
    );
  });

  it("rifiuta un nome troppo corto o troppo lungo", () => {
    expect(validateRoleName(" A ")).toBe(ROLES_ERROR_COPY.ROLE_NAME_INVALID);
    expect(validateRoleName("x".repeat(61))).toBe(
      ROLES_ERROR_COPY.ROLE_NAME_INVALID,
    );
    expect(validateRoleName("x".repeat(60))).toBeNull();
  });

  it("rifiuta il markup invece di ripulirlo in silenzio", () => {
    // Sanificare salverebbe un nome diverso da quello approvato.
    expect(validateRoleName("<b>Direttore</b>")).toBe(
      ROLES_ERROR_COPY.ROLE_NAME_INVALID,
    );
  });

  it("accetta accenti e caratteri non ASCII", () => {
    // §9: «Non applicare una validazione limitata all'ASCII.»
    expect(validateRoleName("Responsabile attività")).toBeNull();
  });

  it("riserva Owner e le sue label protette", () => {
    expect(validateRoleName("Owner")).toBe(ROLES_ERROR_COPY.ROLE_NAME_RESERVED);
    expect(validateRoleName("  owner  ")).toBe(
      ROLES_ERROR_COPY.ROLE_NAME_RESERVED,
    );
    expect(validateRoleName("Proprietario")).toBe(
      ROLES_ERROR_COPY.ROLE_NAME_RESERVED,
    );
  });

  it("non riserva Super Admin: un nome non concede poteri", () => {
    // §9: «il nome Super Admin non attribuisce alcun privilegio.» Non è
    // riservato — è solo un nome che non fa nulla.
    expect(validateRoleName("Super Admin")).toBeNull();
  });

  it("accetta un nome professionale senza precompilare poteri", () => {
    expect(validateRoleName("Direttore sportivo")).toBeNull();
  });
});

describe("copy degli errori (§29)", () => {
  const codes: RolesErrorCode[] = [
    "ADMIN_OWNER_PROTECTED",
    "ADMIN_SCOPE_EMPTY",
    "ADMIN_TEAM_UNAVAILABLE",
    "ADMIN_VERSION_CONFLICT",
    "OPERATION_CONTENT_CHANGED",
    "OWNER_CHANGED",
    "ROLE_CATALOG_CHANGED",
    "ROLE_NAME_DUPLICATE",
    "ROLE_STILL_IN_USE",
    "UNKNOWN",
  ];

  it("non espone mai il codice tecnico all'utente", () => {
    for (const code of codes) {
      const message = describeRolesError(code);

      expect(message).not.toContain(code);
      expect(message).not.toMatch(/\b[A-Z_]{6,}\b/);
    }
  });

  it("usa le frasi esatte della tabella §29", () => {
    expect(describeRolesError("ROLE_NAME_DUPLICATE")).toBe(
      "Esiste già un ruolo con questo nome.",
    );
    expect(describeRolesError("ADMIN_SCOPE_EMPTY")).toBe(
      "Seleziona almeno una squadra.",
    );
    expect(describeRolesError("ADMIN_TEAM_UNAVAILABLE")).toBe(
      "Una delle squadre non è più disponibile. Controlla la selezione.",
    );
    expect(describeRolesError("ROLE_STILL_IN_USE")).toBe(
      "Il ruolo è ancora utilizzato. Gestisci le assegnazioni e gli inviti prima di archiviarlo.",
    );
  });

  it("un codice sconosciuto non lascia la UI senza messaggio", () => {
    expect(describeRolesError("UNKNOWN")).toBe(
      ROLES_ERROR_COPY.UNKNOWN,
    );
  });
});
