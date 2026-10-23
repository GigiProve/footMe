/**
 * Regole di presentazione dell'accesso amministrativo (§37).
 *
 * Si verificano l'impatto leggibile di un cambio di ambito, la distinzione
 * fra canale e stato di un invito, e la soglia del riepilogo delle squadre —
 * tre punti in cui un'approssimazione produrrebbe una frase falsa.
 */
import { describe, expect, it } from "vitest";

import {
  ACCESS_COPY,
  cancelInviteQuestion,
  inviteRecipientName,
  inviteStatusLabel,
  newOwnerHelper,
  revokeQuestion,
  scopeChangeNotice,
  scopeSummary,
  teamSelectionLabel,
  withSociety,
} from "./access-presentation";
import type { AdminInviteDetail } from "./access-types";

function invite(overrides: Partial<AdminInviteDetail> = {}): AdminInviteDetail {
  return {
    avatarUrl: null,
    canCancel: true,
    createdAt: "2026-10-11T09:00:00Z",
    emailDisplay: null,
    expiresAt: "2026-10-18T09:00:00Z",
    fullName: "Luca Riva",
    inviteId: "i1",
    membershipProfileId: null,
    profileId: "p9",
    recipientKind: "member",
    revision: 1,
    roleLabel: "Team manager",
    scopeLabel: "Under 17",
    state: "pending",
    ...overrides,
  };
}

describe("impatto di un cambio di ambito (§15)", () => {
  it("annuncia la squadra aggiunta, come nel master", () => {
    expect(
      scopeChangeNotice({
        nextMode: "teams",
        nextNames: ["Primavera", "Under 18"],
        previousMode: "teams",
        previousNames: ["Primavera"],
      }),
    ).toBe("Stai aggiungendo Under 18.");
  });

  it("chiarisce quali squadre escono dal perimetro", () => {
    // §15: «Per una riduzione chiarisci quali squadre escono dal perimetro»
    // — non basta dire che qualcosa è cambiato.
    expect(
      scopeChangeNotice({
        nextMode: "teams",
        nextNames: ["Primavera"],
        previousMode: "teams",
        previousNames: ["Primavera", "Under 17"],
      }),
    ).toBe("Stai rimuovendo Under 17.");
  });

  it("elenca più squadre con una congiunzione leggibile", () => {
    expect(
      scopeChangeNotice({
        nextMode: "teams",
        nextNames: ["Primavera", "Under 18", "Under 17"],
        previousMode: "teams",
        previousNames: ["Primavera"],
      }),
    ).toBe("Stai aggiungendo Under 18 e Under 17.");
  });

  it("distingue l'estensione dalla limitazione fra le due modalità", () => {
    expect(
      scopeChangeNotice({
        nextMode: "society",
        nextNames: [],
        previousMode: "teams",
        previousNames: ["Primavera"],
      }),
    ).toBe("Stai estendendo l'ambito a tutta la società.");

    expect(
      scopeChangeNotice({
        nextMode: "teams",
        nextNames: ["Primavera"],
        previousMode: "society",
        previousNames: [],
      }),
    ).toBe("Stai limitando l'ambito alle squadre selezionate.");
  });

  it("tace quando nulla cambia", () => {
    expect(
      scopeChangeNotice({
        nextMode: "teams",
        nextNames: ["Primavera"],
        previousMode: "teams",
        previousNames: ["Primavera"],
      }),
    ).toBeNull();

    expect(
      scopeChangeNotice({
        nextMode: "society",
        nextNames: [],
        previousMode: "society",
        previousNames: [],
      }),
    ).toBeNull();
  });
});

describe("riepilogo della selezione (§15, §16)", () => {
  it("mostra i nomi finché restano leggibili", () => {
    expect(scopeSummary(["Primavera", "Under 18"])).toBe("Primavera · Under 18");
  });

  it("passa al conteggio oltre la soglia, come club_admin_scope_label", () => {
    // La stessa soglia del server: due superfici che la scegliessero
    // diversamente mostrerebbero due riepiloghi diversi dello stesso ambito.
    expect(scopeSummary(["A", "B", "C"])).toBe("3 squadre");
  });

  it("non inventa un riepilogo per una selezione vuota", () => {
    expect(scopeSummary([])).toBeNull();
  });

  it("gestisce il singolare nel contatore del picker", () => {
    expect(teamSelectionLabel(1)).toBe("1 squadra selezionata");
    expect(teamSelectionLabel(2)).toBe("2 squadre selezionate");
  });
});

describe("stato di un invito (§23)", () => {
  it("un link esterno appena preparato non è una consegna", () => {
    expect(inviteStatusLabel(invite({ recipientKind: "email" }))).toBe(
      "Link pronto",
    );
  });

  it("un invito interno pending è Invito inviato", () => {
    expect(inviteStatusLabel(invite())).toBe("Invito inviato");
  });

  it("uno stato concluso non viene mascherato da canale", () => {
    expect(
      inviteStatusLabel(invite({ recipientKind: "email", state: "accepted" })),
    ).toBe("Invito accettato");
    expect(inviteStatusLabel(invite({ state: "expired" }))).toBe(
      "Invito scaduto",
    );
  });

  it("usa l'email quando non c'è una PERSON risolta, senza inventare un nome", () => {
    expect(
      inviteRecipientName(
        invite({
          emailDisplay: "luca@example.com",
          fullName: null,
          recipientKind: "email",
        }),
      ),
    ).toBe("luca@example.com");
  });
});

describe("conferme distruttive (§22, §23, §34)", () => {
  it("nominano la persona", () => {
    expect(revokeQuestion("Andrea Verdi")).toBe(
      "Revocare l'accesso ad Andrea Verdi?",
    );
    expect(cancelInviteQuestion("Luca Riva")).toBe(
      "Annullare l'invito a Luca Riva?",
    );
  });

  it("nominano la Società nell'effetto, non solo l'azione", () => {
    expect(withSociety(ACCESS_COPY.revokeBodyOne, "AC Como")).toContain(
      "AC Como",
    );
    expect(withSociety(ACCESS_COPY.revokeScopeHelper, "AC Como")).toBe(
      "Riguarda solo l'accesso amministrativo ad AC Como.",
    );
  });

  it("dichiarano che profilo e rapporti sportivi restano invariati", () => {
    // §22: la revoca «non cancella account, profilo, rapporti sportivi».
    expect(ACCESS_COPY.revokeBodyTwo).toBe(
      "Il suo profilo e i rapporti sportivi restano invariati.",
    );
  });

  it("il trasferimento nomina il nuovo Owner e la Società", () => {
    expect(newOwnerHelper("Luca Bianchi", "AC Como")).toBe(
      "Luca Bianchi diventerà Owner di AC Como.",
    );
  });
});

describe("d eufonica (§4 — il master scrive «ad Andrea Verdi»)", () => {
  it("usa ad davanti a una vocale", () => {
    expect(revokeQuestion("Andrea Verdi")).toBe(
      "Revocare l'accesso ad Andrea Verdi?",
    );
    expect(withSociety(ACCESS_COPY.revokeScopeHelper, "AC Como")).toBe(
      "Riguarda solo l'accesso amministrativo ad AC Como.",
    );
  });

  it("usa a davanti a una consonante", () => {
    expect(revokeQuestion("Paolo Neri")).toBe(
      "Revocare l'accesso a Paolo Neri?",
    );
    expect(cancelInviteQuestion("Luca Riva")).toBe(
      "Annullare l'invito a Luca Riva?",
    );
    expect(withSociety(ACCESS_COPY.revokeScopeHelper, "Como 1907")).toBe(
      "Riguarda solo l'accesso amministrativo a Como 1907.",
    );
  });
});
