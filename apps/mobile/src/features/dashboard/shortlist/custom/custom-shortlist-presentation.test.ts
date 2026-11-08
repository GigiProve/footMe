/**
 * DAS-REV-27 — derivazioni pure del governo CUSTOM.
 * Ogni caso porta gli ID della matrice §29/§30 che rappresenta lato client.
 */
import { describe, expect, it } from "vitest";

import {
  CUSTOM_COPY,
  accessDirty,
  accessSubmittable,
  accessSummary,
  deleteBody,
  editDirty,
  editPatch,
  governanceErrorCopy,
  initialChoice,
  isRevocation,
  manageActions,
  reconcileSelection,
  recoveryRoute,
  scopeImpactLine,
  sharedWithLabel,
  toggleSelection,
  validateAccessDraft,
} from "./custom-shortlist-presentation";

describe("accessSummary (§9)", () => {
  it("owner Solo io → Solo tu (screen 04, 14)", () => {
    expect(accessSummary({ accessMode: "owner_only", isOwner: true, sharedCount: 0 })).toEqual({
      icon: "lock-closed-outline",
      label: "Solo tu",
    });
  });

  it("owner condivisa → numero di persone escluso l'owner", () => {
    expect(accessSummary({ accessMode: "shared", isOwner: true, sharedCount: 2 }).label).toBe(
      "Condivisa con 2 persone",
    );
    expect(sharedWithLabel(1)).toBe("Condivisa con 1 persona");
  });

  it("collaboratore → Condivisa, senza numero (screen 07)", () => {
    const summary = accessSummary({ accessMode: "shared", isOwner: false, sharedCount: null });
    expect(summary.label).toBe("Condivisa");
    expect(summary.label).not.toMatch(/\d/);
  });

  it("lista storica → audience dell'ambito, non Solo io né Condivisa (§25)", () => {
    expect(accessSummary({ accessMode: "scope", isOwner: true, sharedCount: 0 }).label).toBe(
      CUSTOM_COPY.accessScope,
    );
  });
});

describe("draft accessi (§11, §13)", () => {
  it("Q27-07: SHARED con zero persone è invalido, senza conversione a Solo io", () => {
    expect(validateAccessDraft({ choice: "shared", selected: [] })).toBe(
      "Seleziona almeno una persona oppure scegli Solo io.",
    );
    expect(accessSubmittable({ choice: "shared", selected: [] })).toBe(false);
    expect(accessSubmittable({ choice: "shared", selected: ["m"] })).toBe(true);
    expect(accessSubmittable({ choice: "owner_only", selected: [] })).toBe(true);
  });

  it("lista storica: nessuna radio preselezionata e nessun invio senza scelta", () => {
    expect(initialChoice("scope")).toBeNull();
    expect(accessSubmittable({ choice: null, selected: [] })).toBe(false);
    expect(initialChoice("shared")).toBe("shared");
  });

  it("Q27-08: invariato ⇒ non sporco; ordine delle scelte irrilevante", () => {
    const initial = { choice: "shared" as const, selected: ["a", "b"] };
    expect(accessDirty(initial, { choice: "shared", selected: ["b", "a"] })).toBe(false);
    expect(accessDirty(initial, { choice: "shared", selected: ["a"] })).toBe(true);
    expect(accessDirty(initial, { choice: "owner_only", selected: ["a", "b"] })).toBe(true);
  });

  it("toggle per id", () => {
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("Q27-09/Q27-11: riconciliazione conserva solo le scelte ancora eleggibili, anche fuori pagina", () => {
    expect(reconcileSelection(["m", "a", "x"], ["a", "p", "m"])).toEqual(["m", "a"]);
    expect(reconcileSelection([], ["a"])).toEqual([]);
  });
});

describe("Modifica lista (§14)", () => {
  const original = { description: "Profili da osservare", name: "Under 21 Lombardia", teamId: "prima" };

  it("patch dei soli campi modificati, con trim", () => {
    expect(editPatch(original, { ...original, teamId: "primavera" })).toEqual({ team_id: "primavera" });
    expect(editPatch(original, { ...original, name: "  Under 21  " })).toEqual({ name: "Under 21" });
    expect(editPatch(original, { ...original, description: "   " })).toEqual({ description: null });
    expect(editPatch(original, { ...original, teamId: null })).toEqual({ team_id: null });
  });

  it("invariato ⇒ nessuna conferma di uscita", () => {
    expect(editDirty(original, { ...original, name: "Under 21 Lombardia " })).toBe(false);
    expect(editDirty(original, { ...original, teamId: "primavera" })).toBe(true);
  });

  it("screen 08: l'owner vede chi perde l'accesso", () => {
    expect(
      scopeImpactLine({ kind: "named", losing: [{ fullName: "Marco Bianchi", profileId: "m" }], ownerValid: true }),
    ).toBe("Marco Bianchi non avrà più accesso con il nuovo ambito.");
    expect(
      scopeImpactLine({
        kind: "named",
        losing: [
          { fullName: "Marco Bianchi", profileId: "m" },
          { fullName: "Luca Ferri", profileId: "l" },
        ],
        ownerValid: true,
      }),
    ).toBe("Marco Bianchi e Luca Ferri non avranno più accesso con il nuovo ambito.");
  });

  it("Q27-19: gestore senza ACL → avviso generico, senza nomi né numeri", () => {
    const line = scopeImpactLine({ kind: "generic", losing: null, ownerValid: true });
    expect(line).toBe("Alcune persone potrebbero non avere più accesso con il nuovo ambito.");
    expect(line).not.toMatch(/\d/);
  });

  it("Q27-17: owner fuori dal nuovo ambito → blocco esplicito", () => {
    expect(scopeImpactLine({ kind: "named", losing: [], ownerValid: false })).toBe(CUSTOM_COPY.ownerScopeBlocked);
  });

  it("nessun impatto → nessuna riga", () => {
    expect(scopeImpactLine({ kind: "named", losing: [], ownerValid: true })).toBeNull();
    expect(scopeImpactLine(null)).toBeNull();
  });
});

describe("menu e capability (§8)", () => {
  it("PER-15/PER-05: owner con Gestire liste vede tutte e tre le voci, nell'ordine del mockup", () => {
    expect(manageActions({ canDelete: true, canEdit: true, canManageAccess: true })).toEqual([
      "edit",
      "access",
      "delete",
    ]);
  });

  it("Q27-15: owner senza Gestire liste → solo Gestisci accesso", () => {
    expect(manageActions({ canDelete: false, canEdit: false, canManageAccess: true })).toEqual(["access"]);
  });

  it("Q27-14/CUS-14: condiviso con Gestire liste → niente Gestisci accesso", () => {
    expect(manageActions({ canDelete: true, canEdit: true, canManageAccess: false })).toEqual(["edit", "delete"]);
  });

  it("screen 07: collaboratore senza capability → nessun menu", () => {
    expect(manageActions({ canDelete: false, canEdit: false, canManageAccess: false })).toEqual([]);
  });
});

describe("eliminazione (§16)", () => {
  it("testo con il nome della lista", () => {
    expect(deleteBody("Under 21 Lombardia")).toBe(
      "Under 21 Lombardia e le relative valutazioni interne verranno eliminate.",
    );
  });
});

describe("recupero (§19)", () => {
  const item = (id: string) => ({ name: id, scopeLabel: "Primavera", shortlistId: id });

  it("zero → stato vuoto; una → screen 12 diretto; più → elenco", () => {
    expect(recoveryRoute([], false)).toEqual({ kind: "empty" });
    expect(recoveryRoute([item("a")], false)).toEqual({ kind: "direct", shortlistId: "a" });
    expect(recoveryRoute([item("a"), item("b")], false)).toEqual({ kind: "list" });
    expect(recoveryRoute([item("a")], true)).toEqual({ kind: "list" });
  });
});

describe("errori (§24)", () => {
  it("copy per operazione, mai codici tecnici", () => {
    expect(governanceErrorCopy("network", "access", false)).toBe("Impossibile aggiornare l'accesso. Riprova.");
    expect(governanceErrorCopy("network", "edit", false)).toBe("Impossibile salvare le modifiche. Riprova.");
    expect(governanceErrorCopy("network", "delete", false)).toBe("Impossibile eliminare la lista. Riprova.");
    expect(governanceErrorCopy("network", "recovery", false)).toBe("Impossibile aggiornare il proprietario. Riprova.");
    expect(governanceErrorCopy("network", "create", false)).toBe("Impossibile creare la lista. Riprova.");
  });

  it("offline, conflitto, eligibility", () => {
    expect(governanceErrorCopy("network", "access", true)).toBe("Connessione assente. Riprova quando sei online.");
    expect(governanceErrorCopy("versionConflict", "access", false)).toBe(CUSTOM_COPY.conflict);
    expect(governanceErrorCopy("shareIneligible", "access", false)).toBe(CUSTOM_COPY.ineligible);
    expect(governanceErrorCopy("ownerValid", "recovery", false)).toBe(CUSTOM_COPY.ownerReturned);
  });

  it("§18: solo «non disponibile» è una revoca; rete e capability mancante no", () => {
    expect(isRevocation("notFound")).toBe(true);
    expect(isRevocation("network")).toBe(false);
    expect(isRevocation("notAuthorized")).toBe(false);
  });
});
