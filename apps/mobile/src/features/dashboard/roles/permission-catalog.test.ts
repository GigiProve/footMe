/**
 * Risoluzione dei livelli e delle dipendenze (§37).
 *
 * «Evitando test che ripetono soltanto l'implementazione o controllano la
 * presenza di una stringa.» Qui si verificano le distinzioni che la
 * specifica impone e che sono facili da perdere: Personalizzato derivato e
 * non scelto, dipendenze che non si possono aggirare, un'area sostituita
 * senza toccare le altre, un controllo a più chiavi che non è attivo a metà.
 */
import { describe, expect, it } from "vitest";

import {
  AREA_LEVEL_LABEL,
  areaIsConfigurable,
  areaLevel,
  areasEnabled,
  bundleControls,
  controlsFromKeys,
  describeChanges,
  expandControls,
  levelIsGrantable,
  lockedControls,
} from "./permission-catalog";
import type { PermissionArea, PermissionCatalog } from "./roles-types";

/** Il ramo Candidature del master: cinque controlli, una dipendenza comune. */
function applicationsArea(
  overrides: Partial<PermissionArea> = {},
): PermissionArea {
  return {
    controls: [
      {
        bundle: "view",
        helper: null,
        id: "applications_read",
        isGrantable: true,
        label: "Visualizza candidature",
        permissionKeys: ["applications_view", "shortlist_view"],
        requires: [],
        sortOrder: 1,
      },
      {
        bundle: "manage",
        helper: "Necessario per aggiornare lo stato",
        id: "applications_status",
        isGrantable: true,
        label: "Aggiorna stato candidatura",
        permissionKeys: ["shortlist_edit_status"],
        requires: ["applications_read"],
        sortOrder: 2,
      },
      {
        bundle: "manage",
        helper: null,
        id: "shortlist_add",
        isGrantable: true,
        label: "Aggiungi candidati a Shortlist",
        permissionKeys: ["shortlist_add_profiles", "shortlist_add_notes"],
        requires: ["applications_read"],
        sortOrder: 3,
      },
      {
        bundle: "manage",
        helper: null,
        id: "shortlist_remove",
        isGrantable: true,
        label: "Rimuovi candidati da Shortlist",
        permissionKeys: ["shortlist_remove_profiles"],
        requires: ["applications_read"],
        sortOrder: 4,
      },
      {
        bundle: "manage",
        helper: null,
        id: "shortlist_lists",
        isGrantable: true,
        label: "Crea e gestisci Shortlist",
        permissionKeys: ["shortlist_create_lists"],
        requires: ["applications_read"],
        sortOrder: 5,
      },
    ],
    description: null,
    id: "applications",
    label: "Candidature e Shortlist",
    scopeKind: "team",
    sortOrder: 3,
    ...overrides,
  };
}

function positionsArea(): PermissionArea {
  return {
    controls: [
      {
        bundle: "view",
        helper: null,
        id: "positions_read",
        isGrantable: true,
        label: "Visualizza posizioni aperte",
        permissionKeys: ["positions_view"],
        requires: [],
        sortOrder: 1,
      },
      {
        bundle: "manage",
        helper: null,
        id: "positions_write",
        isGrantable: true,
        label: "Crea e gestisci posizioni",
        permissionKeys: ["positions_create", "society_manage_positions"],
        requires: ["positions_read"],
        sortOrder: 2,
      },
    ],
    description: null,
    id: "positions",
    label: "Posizioni aperte",
    scopeKind: "team",
    sortOrder: 2,
  };
}

function catalog(): PermissionCatalog {
  return { areas: [positionsArea(), applicationsArea()], revision: 1 };
}

describe("livello di un'area (§7)", () => {
  const area = applicationsArea();

  it("è Nessun accesso senza controlli attivi", () => {
    expect(areaLevel(area, [])).toBe("none");
  });

  it("riconosce il bundle Visualizza esatto", () => {
    expect(areaLevel(area, bundleControls(area, "view"))).toBe("view");
  });

  it("include le letture necessarie in Gestisci", () => {
    // §7: «Gestisci | Bundle standard delle normali azioni gestionali **e
    // letture necessarie**.» Senza la lettura non sarebbe Gestisci.
    expect(bundleControls(area, "manage")).toContain("applications_read");
    expect(areaLevel(area, bundleControls(area, "manage"))).toBe("manage");
  });

  it("deriva Personalizzato da un set che non coincide con un bundle", () => {
    // Il ramo del mockup (screen 05): tre controlli su cinque.
    const custom = ["applications_read", "applications_status", "shortlist_add"];

    expect(areaLevel(area, custom)).toBe("custom");
    expect(AREA_LEVEL_LABEL.custom).toBe("Personalizzato");
  });

  it("torna a un livello rapido quando il custom coincide con un bundle", () => {
    // QA-25: un set costruito a mano che corrisponde esattamente a Gestisci
    // è Gestisci, non Personalizzato.
    const manual = [...bundleControls(area, "manage")].reverse();

    expect(areaLevel(area, manual)).toBe("manage");
  });
});

describe("dipendenze obbligatorie (§12)", () => {
  const area = applicationsArea();

  it("attiva la lettura insieme all'aggiornamento di stato", () => {
    expect(expandControls(area, ["applications_status"])).toContain(
      "applications_read",
    );
  });

  it("segnala come bloccata la dipendenza che serve a un controllo attivo", () => {
    const selection = expandControls(area, ["applications_status"]);

    expect(lockedControls(area, selection)).toEqual(["applications_read"]);
  });

  it("non blocca una lettura che nessuno richiede", () => {
    expect(lockedControls(area, ["applications_read"])).toEqual([]);
  });

  it("non va in loop su un catalogo ciclico", () => {
    // Una revisione futura potrebbe introdurre un ciclo: §12 lo vieta, e qui
    // si verifica che il client si fermi invece di esaurire lo stack.
    const cyclic: PermissionArea = {
      ...area,
      controls: [
        { ...area.controls[0], requires: ["applications_status"] },
        { ...area.controls[1], requires: ["applications_read"] },
      ],
    };

    expect(expandControls(cyclic, ["applications_read"]).sort()).toEqual([
      "applications_read",
      "applications_status",
    ]);
  });
});

describe("controlli derivati da una configurazione salvata", () => {
  it("non attiva un controllo a più chiavi quando ne manca una", () => {
    // «Aggiungi candidati a Shortlist» mappa due chiavi: metà di un potere
    // non è un potere concesso.
    const active = controlsFromKeys(catalog(), [
      "applications_view",
      "shortlist_view",
      "shortlist_add_profiles",
    ]);

    expect(active).toContain("applications_read");
    expect(active).not.toContain("shortlist_add");
  });

  it("conta un'area come abilitata con almeno un controllo attivo (§8)", () => {
    const active = controlsFromKeys(catalog(), [
      "applications_view",
      "shortlist_view",
    ]);

    expect(areasEnabled(catalog(), active)).toBe(1);
  });

  it("non conta un'area con un set vuoto", () => {
    expect(areasEnabled(catalog(), [])).toBe(0);
  });
});

describe("concedibilità (§6)", () => {
  it("nasconde Gestisci quando un suo controllo non è concedibile", () => {
    const area = applicationsArea();
    const limited: PermissionArea = {
      ...area,
      controls: area.controls.map((control) =>
        control.id === "shortlist_lists"
          ? { ...control, isGrantable: false }
          : control,
      ),
    };

    expect(levelIsGrantable(limited, "view")).toBe(true);
    expect(levelIsGrantable(limited, "manage")).toBe(false);
    // L'area resta configurabile: Visualizza è ancora offribile.
    expect(areaIsConfigurable(limited)).toBe(true);
  });

  it("toglie l'area quando nemmeno Visualizza è concedibile", () => {
    const area = applicationsArea();
    const closed: PermissionArea = {
      ...area,
      controls: area.controls.map((control) => ({
        ...control,
        isGrantable: false,
      })),
    };

    expect(areaIsConfigurable(closed)).toBe(false);
  });
});

describe("riepilogo d'impatto (§10)", () => {
  it("descrive una sola area cambiata e lascia intatte le altre", () => {
    const before = [
      ...bundleControls(positionsArea(), "manage"),
      ...bundleControls(applicationsArea(), "view"),
    ];
    const after = [
      ...bundleControls(positionsArea(), "manage"),
      ...bundleControls(applicationsArea(), "manage"),
    ];

    const changes = describeChanges(catalog(), before, after);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      areaId: "applications",
      next: "manage",
      previous: "view",
    });
  });

  it("usa parole umane quando il livello non racconta il cambiamento", () => {
    // Personalizzato → Personalizzato: il livello è identico, la
    // configurazione no. §10 vieta un «Permessi cambiati» incomprensibile.
    const before = ["applications_read", "applications_status"];
    const after = ["applications_read", "shortlist_add"];

    const changes = describeChanges(catalog(), before, after);

    expect(changes).toHaveLength(1);
    expect(changes[0].previous).toBe("custom");
    expect(changes[0].next).toBe("custom");
    expect(changes[0].details).toEqual([
      "Rimosso: Aggiorna stato candidatura",
      "Aggiunto: Aggiungi candidati a Shortlist",
    ]);
  });

  it("non segnala nulla quando il draft coincide con il server", () => {
    const same = bundleControls(applicationsArea(), "manage");

    expect(describeChanges(catalog(), same, same)).toEqual([]);
  });
});
