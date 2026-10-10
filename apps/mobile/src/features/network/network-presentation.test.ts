/**
 * Regole di dominio della Rete societaria (§35).
 *
 * «Aggiungere test mirati alle regole che possono produrre duplicati, perdita
 * di consenso o accessi indebiti. Non limitarsi a test che rispecchiano il
 * markup.» Qui ci sono quelle derivabili sul client: prospettiva, direzione,
 * conteggi, esclusioni dallo storico, stato degli inviti ed eligibility.
 */
import { describe, expect, it } from "vitest";

import {
  NETWORK_EMPTY,
  activeCountLabel,
  applyTemplate,
  buildDraftSentence,
  describeNetworkError,
  eligibilityLabel,
  groupActiveRelationships,
  groupRequests,
  historyPeriodLabel,
  inviteStateLabel,
  isSelectableResult,
  locationLabel,
  longDateLabel,
  prepositionA,
  requestStatusLabel,
  roleOptions,
} from "./network-presentation";
import type {
  LinkEligibility,
  NetworkRequestItem,
  RelationshipType,
  RelationshipView,
  SocietySummary,
} from "./network-types";

function society(overrides: Partial<SocietySummary> = {}): SocietySummary {
  return {
    city: "Cantù",
    clubId: "club-2",
    isVerified: true,
    logoUrl: null,
    name: "Academy Como SSD",
    province: "CO",
    region: "Lombardia",
    ...overrides,
  };
}

function relationship(
  overrides: Partial<RelationshipView> = {},
): RelationshipView {
  return {
    acceptedAt: "2026-03-12T10:00:00Z",
    activeSentence: "Academy Como SSD è affiliata ad AC Como.",
    allowedActions: [],
    cancelledAt: null,
    clubA: society({ clubId: "club-1", name: "AC Como", city: "Como" }),
    clubB: society(),
    counterpart: society(),
    counterpartRoleId: "affiliate",
    counterpartRoleLabel: "Società affiliata",
    draftSentence: "Academy Como SSD sarà affiliata ad AC Como.",
    endedAt: null,
    endedByClubId: null,
    groupLabel: "Società affiliate",
    groupSort: 10,
    isDirectional: true,
    isPublic: true,
    isRequester: true,
    proposalSentence: "AC Como propone un'affiliazione ad Academy Como SSD.",
    recipientClubId: "club-2",
    rejectedAt: null,
    relationshipId: "rel-1",
    requestedAt: "2026-03-01T10:00:00Z",
    requesterClubId: "club-1",
    rowLabel: "Affiliata ad AC Como",
    status: "active",
    typeDescription: null,
    typeId: "affiliation",
    typeLabel: "Affiliazione",
    version: 1,
    viewerClubId: "club-1",
    viewerRoleId: "reference",
    viewerRoleLabel: "Società di riferimento",
    viewerSide: "a",
    ...overrides,
  };
}

const AFFILIATION: RelationshipType = {
  activeTemplate: "{b} è affiliata {to_a}.",
  description: null,
  draftTemplate: "{b} sarà affiliata {to_a}.",
  exclusivityGroup: "structural",
  id: "affiliation",
  isDirectional: true,
  isSelectable: true,
  label: "Affiliazione",
  proposalTemplate: "{a} propone un'affiliazione {to_b}.",
  roleAId: "reference",
  roleALabel: "Società di riferimento",
  roleASection: "Società affiliate",
  roleBId: "affiliate",
  roleBLabel: "Società affiliata",
  roleBSection: "Società di riferimento",
  rowTemplateA: "Affiliata {to_a}",
  rowTemplateB: "Società di riferimento",
  rowTemplateSymmetric: null,
  sortOrder: 10,
  symmetricSection: null,
};

const PARTNERSHIP: RelationshipType = {
  ...AFFILIATION,
  activeTemplate: "Partnership tra {a} e {b}.",
  draftTemplate: "Partnership tra {a} e {b}.",
  exclusivityGroup: null,
  id: "partnership",
  isDirectional: false,
  label: "Partnership",
  proposalTemplate: "{a} propone una partnership con {b}.",
  roleAId: null,
  roleALabel: null,
  roleASection: null,
  roleBId: null,
  roleBLabel: null,
  roleBSection: null,
  rowTemplateA: null,
  rowTemplateB: null,
  rowTemplateSymmetric: "Partnership",
  sortOrder: 20,
  symmetricSection: "Partnership",
};

describe("frasi e direzione (§7)", () => {
  it("elide la preposizione davanti a vocale", () => {
    expect(prepositionA("AC Como")).toBe("ad AC Como");
    expect(prepositionA("Lario Academy")).toBe("a Lario Academy");
  });

  it("sostituisce {to_a} prima di {a}, così il nome non resta nudo", () => {
    expect(applyTemplate("{b} è affiliata {to_a}.", "AC Como", "Academy")).toBe(
      "Academy è affiliata ad AC Como.",
    );
  });

  it("cambia i lati, non solo le label, quando la direzione si inverte", () => {
    const asReference = buildDraftSentence({
      currentName: "AC Como",
      roleId: "reference",
      targetName: "Como Academy ASD",
      type: AFFILIATION,
    });

    const asAffiliate = buildDraftSentence({
      currentName: "AC Como",
      roleId: "affiliate",
      targetName: "Como Academy ASD",
      type: AFFILIATION,
    });

    expect(asReference).toBe("Como Academy ASD sarà affiliata ad AC Como.");
    expect(asAffiliate).toBe("AC Como sarà affiliata a Como Academy ASD.");
  });

  it("non chiede un ruolo a un tipo simmetrico e ne scrive la frase", () => {
    expect(roleOptions(PARTNERSHIP)).toEqual([]);
    expect(
      buildDraftSentence({
        currentName: "AC Como",
        roleId: null,
        targetName: "Lario Academy",
        type: PARTNERSHIP,
      }),
    ).toBe("Partnership tra AC Como e Lario Academy.");
  });

  it("non compone nulla finché il ruolo direzionale manca", () => {
    expect(
      buildDraftSentence({
        currentName: "AC Como",
        roleId: null,
        targetName: "Como Academy ASD",
        type: AFFILIATION,
      }),
    ).toBeNull();
  });

  it("offre i due ruoli del catalogo, non due stringhe della schermata", () => {
    expect(roleOptions(AFFILIATION)).toEqual([
      { id: "reference", label: "Società di riferimento" },
      { id: "affiliate", label: "Società affiliata" },
    ]);
  });
});

describe("elenco e conteggi (§8)", () => {
  it("non converte un conteggio non consultabile in zero", () => {
    expect(activeCountLabel(null)).toBeNull();
    expect(activeCountLabel(0)).toBe("0 collegamenti attivi");
    expect(activeCountLabel(1)).toBe("1 collegamento attivo");
    expect(activeCountLabel(2)).toBe("2 collegamenti attivi");
  });

  it("raggruppa per tipo e prospettiva senza creare sezioni vuote", () => {
    const sections = groupActiveRelationships([
      relationship(),
      relationship({ relationshipId: "rel-2", counterpart: society({ clubId: "club-3", name: "Altra" }) }),
      relationship({
        counterpart: society({ clubId: "club-4", name: "FC Lugano" }),
        groupLabel: "Partnership",
        groupSort: 20,
        isDirectional: false,
        relationshipId: "rel-3",
        rowLabel: "Partnership",
        typeId: "partnership",
        typeLabel: "Partnership",
      }),
    ]);

    expect(sections.map((section) => section.title)).toEqual([
      "Società affiliate",
      "Partnership",
    ]);
    expect(sections[0].data).toHaveLength(2);
    expect(sections[1].data).toHaveLength(1);
  });

  it("separa la stessa relazione vista dai due lati", () => {
    const sections = groupActiveRelationships([
      relationship(),
      relationship({
        groupLabel: "Società di riferimento",
        relationshipId: "rel-2",
        rowLabel: "Società di riferimento",
        viewerSide: "b",
      }),
    ]);

    expect(sections.map((section) => section.title)).toEqual([
      "Società affiliate",
      "Società di riferimento",
    ]);
  });

  it("compone la località come città e provincia", () => {
    expect(locationLabel("Cantù", "CO", "Lombardia")).toBe("Cantù, CO");
    expect(locationLabel("Cantù", null, "Lombardia")).toBe("Cantù, Lombardia");
    expect(locationLabel(null, null, null)).toBeNull();
  });
});

describe("richieste e inviti (§9, §17)", () => {
  const received: NetworkRequestItem = {
    kind: "received",
    relationship: relationship({
      relationshipId: "rel-in",
      status: "pending",
      typeLabel: "Partnership",
    }),
  };

  const sent: NetworkRequestItem = {
    kind: "sent",
    relationship: relationship({ relationshipId: "rel-out", status: "pending" }),
  };

  const invite: NetworkRequestItem = {
    invite: {
      createdAt: "2026-03-01T10:00:00Z",
      descriptiveName: "Centro Lago ASD",
      expiresAt: "2026-03-08T10:00:00Z",
      inviteId: "inv-1",
      inviterRoleId: "reference",
      isDirectional: true,
      state: "valid",
      typeId: "affiliation",
      typeLabel: "Affiliazione",
      version: 1,
    },
    kind: "invite",
  };

  it("usa due soli heading, Ricevute e Inviate", () => {
    const sections = groupRequests([received, sent, invite]);

    expect(sections.map((section) => section.title)).toEqual([
      "Ricevute",
      "Inviate",
    ]);
    expect(sections[1].data).toHaveLength(2);
  });

  it("omette il gruppo che non ha elementi", () => {
    expect(groupRequests([sent]).map((section) => section.key)).toEqual(["sent"]);
  });

  it("distingue richiesta ricevuta, in attesa e invito esterno", () => {
    expect(requestStatusLabel(received)).toBe("Partnership · Richiesta ricevuta");
    expect(requestStatusLabel(sent)).toBe("Affiliazione · In attesa");
    expect(requestStatusLabel(invite)).toBe(
      "Affiliazione · Invito esterno · Link disponibile",
    );
  });

  it("dice lo stato reale di un invito, non uno generico", () => {
    const base = invite.kind === "invite" ? invite.invite : null;

    expect(base).not.toBeNull();
    expect(inviteStateLabel({ ...(base as NonNullable<typeof base>), state: "valid" })).toBe(
      "Invito esterno · Link disponibile",
    );
    expect(inviteStateLabel({ ...(base as NonNullable<typeof base>), state: "expired" })).toBe(
      "Invito esterno · Scaduto",
    );
    expect(inviteStateLabel({ ...(base as NonNullable<typeof base>), state: "revoked" })).toBe(
      "Invito esterno · Revocato",
    );
    expect(inviteStateLabel({ ...(base as NonNullable<typeof base>), state: "resolved" })).toBe(
      "Invito esterno · In attesa della società",
    );
  });
});

describe("eligibility della ricerca (§10)", () => {
  function eligibility(
    overrides: Partial<LinkEligibility> = {},
  ): LinkEligibility {
    return {
      availableTypeIds: ["partnership"],
      blockingTypeIds: ["affiliation"],
      relationshipId: "rel-1",
      society: society(),
      state: "linked",
      targetClubId: "club-2",
      ...overrides,
    };
  }

  it("non vieta tutto con una label generica quando altri tipi restano", () => {
    expect(eligibilityLabel(eligibility())).toBe(
      "Già collegata · altri collegamenti possibili",
    );
    expect(isSelectableResult(eligibility())).toBe(true);
  });

  it("blocca la riga solo quando nessun tipo è proponibile", () => {
    const blocked = eligibility({ availableTypeIds: [] });

    expect(eligibilityLabel(blocked)).toBe("Già collegata");
    expect(isSelectableResult(blocked)).toBe(false);
  });

  it("riconosce una richiesta già in attesa", () => {
    expect(
      eligibilityLabel(eligibility({ availableTypeIds: [], state: "pending" })),
    ).toBe("Richiesta in attesa");
  });

  it("non lascia selezionare la società corrente", () => {
    expect(isSelectableResult(eligibility({ state: "self" }))).toBe(false);
  });

  it("non blocca una riga di cui non conosce ancora lo stato", () => {
    expect(isSelectableResult(undefined)).toBe(true);
    expect(eligibilityLabel(undefined)).toBeNull();
  });
});

describe("storico (§23)", () => {
  it("deriva il periodo da accepted_at ed ended_at", () => {
    expect(
      historyPeriodLabel(
        relationship({
          acceptedAt: "2026-03-12T10:00:00Z",
          endedAt: "2026-09-11T10:00:00Z",
          status: "ended",
        }),
      ),
    ).toBe("12 mar – 11 set 2026");
  });

  it("riporta l'anno su entrambe le date quando cambia", () => {
    expect(
      historyPeriodLabel(
        relationship({
          acceptedAt: "2022-07-01T10:00:00Z",
          endedAt: "2025-06-30T10:00:00Z",
          status: "ended",
        }),
      ),
    ).toBe("1 lug 2022 – 30 giu 2025");
  });

  it("non inventa un periodo per una relazione mai accettata", () => {
    expect(
      historyPeriodLabel(relationship({ acceptedAt: null, endedAt: null })),
    ).toBeNull();
  });

  it("scrive la data di attivazione per esteso", () => {
    expect(longDateLabel("2026-03-12T10:00:00Z")).toBe("12 marzo 2026");
    expect(longDateLabel(null)).toBeNull();
  });
});

describe("copy di errore ed empty (§29)", () => {
  it("distingue richiesta già esistente da collegamento già attivo", () => {
    expect(describeNetworkError("REQUEST_ALREADY_PENDING")).toBe(
      "Esiste già una richiesta per questo collegamento.",
    );
    expect(describeNetworkError("RELATIONSHIP_ALREADY_ACTIVE")).toBe(
      "Questo collegamento è già attivo.",
    );
  });

  it("distingue invito non disponibile da invito scaduto", () => {
    expect(describeNetworkError("INVITE_REVOKED")).toBe(
      "Questo invito non è più disponibile.",
    );
    expect(describeNetworkError("INVITE_EXPIRED")).toBe(
      "Questo invito è scaduto. Chiedi alla società un nuovo link.",
    );
  });

  it("non mostra mai dettagli tecnici", () => {
    expect(describeNetworkError("UNKNOWN")).toBe(
      "Non è stato possibile completare l'operazione. Riprova.",
    );
  });

  it("ha un empty state contestuale per ogni superficie", () => {
    expect(NETWORK_EMPTY.links.title).toBe("Nessun collegamento attivo");
    expect(NETWORK_EMPTY.requests.title).toBe("Nessuna richiesta in attesa");
    expect(NETWORK_EMPTY.history.title).toBe("Nessun collegamento nello storico");
    expect(NETWORK_EMPTY.search.title).toBe("Nessuna società trovata");
  });
});
