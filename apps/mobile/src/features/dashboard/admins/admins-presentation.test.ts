/**
 * Regole di presentazione del Centro Amministratori.
 *
 * Non si verifica che un titolo esista: si verificano le distinzioni che la
 * specifica impone e che sono facili da perdere — zero contro non leggibile,
 * canale contro stato, accettato contro accesso attivo.
 */
import { describe, expect, it } from "vitest";

import {
  CANDIDATE_STATUS_LABEL,
  consentHelper,
  describeAdminError,
  describeMyInviteState,
  inviteChannelLabel,
  inviteRecipientName,
  isValidEmail,
  sectionAccessibilityLabel,
  sectionCount,
  shareMessage,
  validateDraft,
} from "./admins-presentation";
import type { AdminInviteRow } from "./admins-types";

function inviteRow(overrides: Partial<AdminInviteRow> = {}): AdminInviteRow {
  return {
    avatarUrl: null,
    createdAt: "2026-10-11T09:00:00Z",
    emailDisplay: null,
    expiresAt: "2026-10-18T09:00:00Z",
    fullName: "Luca Riva",
    inviteId: "invite-1",
    profileId: "profile-1",
    recipientKind: "member",
    revision: 1,
    roleLabel: "Team manager",
    scopeLabel: "Under 17",
    ...overrides,
  };
}

describe("conteggi di sezione (§7.3, §25)", () => {
  it("non trasforma un dato non leggibile in zero", () => {
    expect(sectionCount(null)).toBeNull();
    expect(sectionCount(0)).toBe("0");
    expect(sectionCount(4)).toBe("4");
  });

  it("pluralizza la label accessibile e tace quando non c'è un numero", () => {
    expect(
      sectionAccessibilityLabel(
        "Amministratori attivi",
        1,
        "amministratore",
        "amministratori",
      ),
    ).toBe("Amministratori attivi: 1 amministratore");

    expect(
      sectionAccessibilityLabel(
        "Amministratori attivi",
        4,
        "amministratore",
        "amministratori",
      ),
    ).toBe("Amministratori attivi: 4 amministratori");

    expect(
      sectionAccessibilityLabel(
        "Inviti in attesa",
        null,
        "invito",
        "inviti",
      ),
    ).toBe("Inviti in attesa");
  });
});

describe("canale contro stato dell'invito (§7.2)", () => {
  it("usa Invito inviato per l'interno e Link pronto per l'esterno", () => {
    expect(inviteChannelLabel(inviteRow())).toBe("Invito inviato");
    expect(inviteChannelLabel(inviteRow({ recipientKind: "email" }))).toBe(
      "Link pronto",
    );
  });

  it("mostra l'email di un destinatario non risolto, senza inventare un nome", () => {
    expect(
      inviteRecipientName(
        inviteRow({
          emailDisplay: "giulia@example.com",
          fullName: null,
          profileId: null,
          recipientKind: "email",
        }),
      ),
    ).toBe("giulia@example.com");
  });
});

describe("stato della ricerca (§8)", () => {
  it("esprime già amministratore e già invitato come testo, non come badge", () => {
    expect(CANDIDATE_STATUS_LABEL.already_admin).toBe("Già amministratore");
    expect(CANDIDATE_STATUS_LABEL.already_invited).toBe("Invito già inviato");
    expect(CANDIDATE_STATUS_LABEL.eligible).toBeNull();
  });
});

describe("validazione della proposta (§30)", () => {
  it("chiede un ruolo prima di qualunque invio", () => {
    expect(
      validateDraft({
        isExternal: false,
        roleId: null,
        scopeMode: "society",
        teamIds: [],
      }),
    ).toBe("Seleziona un ruolo.");
  });

  it("rifiuta la modalità squadre senza nessuna squadra", () => {
    expect(
      validateDraft({
        isExternal: false,
        roleId: "role-1",
        scopeMode: "teams",
        teamIds: [],
      }),
    ).toBe("Seleziona almeno una squadra.");
  });

  it("accetta una proposta completa", () => {
    expect(
      validateDraft({
        isExternal: false,
        roleId: "role-1",
        scopeMode: "teams",
        teamIds: ["team-1"],
      }),
    ).toBeNull();
  });

  it("sul percorso esterno pretende l'email prima del ruolo", () => {
    expect(
      validateDraft({
        email: "non-una-email",
        isExternal: true,
        roleId: "role-1",
        scopeMode: "society",
        teamIds: [],
      }),
    ).toBe("Inserisci un indirizzo email valido.");
  });
});

describe("normalizzazione dell'email (§12)", () => {
  it("accetta le forme valide ignorando gli spazi accidentali", () => {
    expect(isValidEmail("  Giulia@Example.com ")).toBe(true);
  });

  it("non inventa equivalenze: un alias resta un indirizzo valido a sé", () => {
    expect(isValidEmail("giulia+club@example.com")).toBe(true);
    expect(isValidEmail("giulia.rossi@example.com")).toBe(true);
  });

  it("rifiuta ciò che non è un indirizzo", () => {
    expect(isValidEmail("giulia@example")).toBe(false);
    expect(isValidEmail("giulia example.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("stati della ricezione (§25)", () => {
  it("distingue un accepted con accesso attivo da uno revocato dopo", () => {
    expect(describeMyInviteState("accepted", true)).toBe(
      "Hai già accettato questo invito.",
    );
    expect(describeMyInviteState("accepted", false)).toBe(
      "Hai accettato questo invito, ma l'accesso non è più attivo.",
    );
  });

  it("non produce nessuna copy terminale finché l'invito è pending", () => {
    expect(describeMyInviteState("pending", false)).toBeNull();
  });

  it("copre scaduto, rifiutato e revocato", () => {
    expect(describeMyInviteState("expired", false)).toBe(
      "Questo invito è scaduto.",
    );
    expect(describeMyInviteState("rejected", false)).toBe(
      "Hai rifiutato questo invito.",
    );
    expect(describeMyInviteState("revoked", false)).toBe(
      "Questo invito non è più disponibile.",
    );
  });
});

describe("copy degli errori (§30)", () => {
  it("per un esito ignoto non afferma un rollback", () => {
    expect(describeAdminError("UNKNOWN")).toBe(
      "Stiamo verificando l'esito dell'operazione.",
    );
  });

  it("per una revisione superata chiede di ricaricare, non di riprovare a vuoto", () => {
    expect(describeAdminError("ADMIN_INVITE_REVISION_CONFLICT")).toBe(
      "L'invito è cambiato o non è più disponibile. Controlla i dettagli e riprova.",
    );
  });
});

describe("testo condiviso e helper (§9, §12)", () => {
  it("il messaggio dello share non contiene l'email del destinatario", () => {
    const message = shareMessage({
      clubName: "AC Como",
      link: "https://prolink.example/admin-invite/abc",
    });

    expect(message).toContain("AC Como");
    expect(message).toContain("https://prolink.example/admin-invite/abc");
    expect(message).not.toContain("@");
  });

  it("l'helper del composer usa il nome reale senza troncarlo", () => {
    expect(consentHelper("Luca Romano")).toBe(
      "Luca Romano potrà accettare o rifiutare l'invito. L'accesso si attiverà solo dopo l'accettazione.",
    );
  });
});
