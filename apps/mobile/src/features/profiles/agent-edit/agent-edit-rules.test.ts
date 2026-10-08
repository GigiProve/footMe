/**
 * Regole dei moduli Modifica profilo Procuratore (REV-PROF-16).
 *
 * Attività principali, abilitazione e contatti hanno in comune una cosa: la
 * regola sta in una funzione pura, e la schermata la applica. Provarle qui
 * significa provare il comportamento, non il rendering.
 */
import { describe, expect, it } from "vitest";

import {
  AGENT_PRIMARY_ACTIVITY_LIMIT,
  AGENT_PRIMARY_ACTIVITY_OPTIONS,
  buildAgentActivityOptions,
  buildAgentLicenseLabel,
} from "../../onboarding/agent/agent-taxonomy";
import { buildPublicContacts } from "../master/PublicContactsList";
import { normalizeLinkedInInput } from "../profile-form-utils";
import type { UserContactsRecord } from "../profile-service";
import {
  isAgentLicenseNumberValid,
  normalizeAgentLicenseNumber,
  toggleAgentActivity,
} from "./agent-edit-rules";

function buildContacts(
  overrides: Partial<UserContactsRecord> = {},
): UserContactsRecord {
  return {
    email: "",
    facebook: "",
    instagram: "",
    linkedin: "",
    phone: "",
    showEmail: false,
    showFacebook: false,
    showInstagram: false,
    showLinkedIn: false,
    showPhone: false,
    ...overrides,
  };
}

describe("attività principali", () => {
  it("non accetta la quarta e non toglie una scelta per farle posto", () => {
    const result = toggleAgentActivity(
      ["Scouting", "Intermediazione", "Valorizzazione giovani"],
      "Relazioni con club",
    );

    expect(result.atLimit).toBe(true);
    expect(result.activities).toHaveLength(AGENT_PRIMARY_ACTIVITY_LIMIT);
    expect(result.activities).not.toContain("Relazioni con club");
  });

  it("deselezionare resta possibile anche al limite", () => {
    const result = toggleAgentActivity(
      ["Scouting", "Intermediazione", "Valorizzazione giovani"],
      "Scouting",
    );

    expect(result.atLimit).toBe(false);
    expect(result.activities).toEqual([
      "Intermediazione",
      "Valorizzazione giovani",
    ]);
  });

  it("offre le sei attività canoniche e nient'altro a un profilo nuovo", () => {
    expect(buildAgentActivityOptions([])).toEqual(
      AGENT_PRIMARY_ACTIVITY_OPTIONS,
    );
  });

  it("tiene selezionabile una voce legacy finché non viene tolta", () => {
    // Senza questo, un'attività salvata dal vecchio onboarding risulterebbe
    // nel profilo e non sarebbe più raggiungibile da nessuna schermata.
    const options = buildAgentActivityOptions(["Mercato dilettanti"]);

    expect(options.at(-1)).toEqual({
      icon: "ellipse-outline",
      label: "Mercato dilettanti",
      value: "Mercato dilettanti",
    });
    expect(buildAgentActivityOptions([])).not.toContainEqual(
      expect.objectContaining({ value: "Mercato dilettanti" }),
    );
  });

  it("non duplica una voce storica che è anche canonica", () => {
    const options = buildAgentActivityOptions(["Valorizzazione giovani"]);

    expect(
      options.filter((option) => option.value === "Valorizzazione giovani"),
    ).toHaveLength(1);
  });
});

describe("numero di licenza", () => {
  it("normalizza maiuscole e spazi, così lo stesso numero non diventa due dati", () => {
    expect(normalizeAgentLicenseNumber("  figc-12345  ")).toBe("FIGC-12345");
  });

  it("accetta i formati plausibili e rifiuta quello che non lo è", () => {
    expect(isAgentLicenseNumberValid("12345")).toBe(true);
    expect(isAgentLicenseNumberValid("FIGC/2024-99")).toBe(true);
    // Vuoto è lecito: il numero resta facoltativo anche con l'abilitazione.
    expect(isAgentLicenseNumberValid("")).toBe(true);
    expect(isAgentLicenseNumberValid("9")).toBe(false);
    expect(isAgentLicenseNumberValid("licenza@casa")).toBe(false);
  });

  it("non compare mai nell'etichetta pubblica della licenza", () => {
    const label = buildAgentLicenseLabel({
      federation: "FIGC",
      isLicensed: true,
    });

    expect(label).toBe("Licenza FIGC (Italia)");
    expect(label).not.toContain("12345");
  });

  it("senza abilitazione pubblica non c'è nessuna etichetta da mostrare", () => {
    expect(
      buildAgentLicenseLabel({ federation: "FIGC", isLicensed: false }),
    ).toBeNull();
  });
});

describe("contatti pubblici", () => {
  it("normalizza LinkedIn da handle, da percorso e da URL con tracking", () => {
    expect(normalizeLinkedInInput("luca-rinaldi")).toBe(
      "https://www.linkedin.com/in/luca-rinaldi",
    );
    expect(normalizeLinkedInInput("/in/luca-rinaldi")).toBe(
      "https://www.linkedin.com/in/luca-rinaldi",
    );
    expect(
      normalizeLinkedInInput(
        "https://it.linkedin.com/in/luca-rinaldi?utm_source=share",
      ),
    ).toBe("https://www.linkedin.com/in/luca-rinaldi");
    expect(normalizeLinkedInInput("https://www.linkedin.com/company/prova")).toBe(
      "https://www.linkedin.com/company/prova",
    );
  });

  it("rifiuta ciò che non è un profilo LinkedIn", () => {
    expect(normalizeLinkedInInput("javascript:alert(1)")).toBe("");
    expect(normalizeLinkedInInput("https://esempio.it/in/luca")).toBe("");
    expect(normalizeLinkedInInput("")).toBe("");
  });

  it("pubblica solo i canali accesi: la visibilità è una preferenza, non il valore", () => {
    const contacts = buildContacts({
      email: "procuratore@example.com",
      linkedin: "https://www.linkedin.com/in/luca-rinaldi",
      phone: "+39 320 7654321",
      showEmail: true,
      showLinkedIn: true,
      showPhone: false,
    });

    expect(buildPublicContacts(contacts).map((row) => row.type)).toEqual([
      "email",
      "linkedin",
    ]);
  });

  it("non pubblica un canale acceso con un valore non valido", () => {
    const contacts = buildContacts({
      linkedin: "non un profilo",
      showLinkedIn: true,
    });

    expect(buildPublicContacts(contacts)).toHaveLength(0);
  });

  it("mostra il percorso del profilo LinkedIn, non il dominio", () => {
    const contacts = buildContacts({
      linkedin: "https://www.linkedin.com/in/luca-rinaldi",
      showLinkedIn: true,
    });

    expect(buildPublicContacts(contacts)[0]?.value).toBe("/in/luca-rinaldi");
  });
});
