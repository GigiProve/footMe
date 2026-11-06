/**
 * Test della matrice categoria/ruolo/ambito (§9) e del form condiviso (§29).
 *
 * È la regola che più facilmente diverge fra i due actor e le quattro
 * categorie, ed è l'unica copia che esiste: se si rompe qui, si rompe in
 * tutte le schermate insieme.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import {
  RoleAssignmentFields,
  hasFieldErrors,
  validateRoleFields,
  type RoleFieldsValue,
} from "./components/RoleAssignmentFields";
import type { RoleCatalog } from "./role-link-types";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

const catalog: RoleCatalog = {
  customRoleMax: 60,
  roles: [
    { isCustom: false, label: "Calciatore", profileType: "player", roleId: "player" },
    { isCustom: false, label: "Allenatore", profileType: "coach", roleId: "coach" },
    {
      isCustom: false,
      label: "Match analyst",
      profileType: "staff",
      roleId: "staff_match_analyst",
    },
    {
      isCustom: true,
      label: "Altro ruolo staff",
      profileType: "staff",
      roleId: "staff_other",
    },
    {
      isCustom: false,
      label: "Responsabile settore giovanile",
      profileType: "director",
      roleId: "director_youth_head",
    },
  ],
};

const teams = [
  { category: "Eccellenza", label: "Prima squadra", teamId: "t1" },
  { category: "Primavera 3", label: "Primavera", teamId: "t2" },
];

function value(overrides: Partial<RoleFieldsValue> = {}): RoleFieldsValue {
  return {
    customRole: "",
    profileType: "player",
    roleId: "player",
    scopeType: "team",
    teamId: "t1",
    ...overrides,
  };
}

describe("validazione dei campi (§12, §29)", () => {
  it("un Calciatore con squadra è valido senza ruolo tattico", () => {
    expect(hasFieldErrors(validateRoleFields(value(), catalog))).toBe(false);
  });

  it("la squadra è obbligatoria con ambito TEAM", () => {
    const errors = validateRoleFields(value({ teamId: null }), catalog);

    expect(errors.teamId).toBe("Seleziona una squadra.");
  });

  it("Altro richiede il testo libero", () => {
    const errors = validateRoleFields(
      value({ profileType: "staff", roleId: "staff_other" }),
      catalog,
    );

    expect(errors.customRole).toBe("Specifica il ruolo.");
  });

  it("un custom di soli spazi non passa (QA-026)", () => {
    const errors = validateRoleFields(
      value({ customRole: "   ", profileType: "staff", roleId: "staff_other" }),
      catalog,
    );

    expect(errors.customRole).toBe("Specifica il ruolo.");
  });

  it("oltre il limite centrale il messaggio è quello del ruolo, non un troncamento", () => {
    const errors = validateRoleFields(
      value({
        customRole: "x".repeat(61),
        profileType: "staff",
        roleId: "staff_other",
      }),
      catalog,
    );

    expect(errors.customRole).toBe("Controlla il ruolo inserito.");
  });

  it("l'ambito societario non richiede una squadra (§12, screen 05)", () => {
    const errors = validateRoleFields(
      value({
        profileType: "director",
        roleId: "director_youth_head",
        scopeType: "society",
        teamId: null,
      }),
      catalog,
    );

    expect(hasFieldErrors(errors)).toBe(false);
  });
});

function fieldsTree(props: Partial<Parameters<typeof RoleAssignmentFields>[0]> = {}) {
  return render(
    <RoleAssignmentFields
      catalog={catalog}
      identities={[{ label: "Calciatore", profileType: "player" }]}
      mode="request"
      onChange={vi.fn()}
      teams={teams}
      value={value()}
      {...props}
    />,
  );
}

function has(tree: ReturnType<typeof render>, testID: string): boolean {
  return tree.root.findAllByProps({ testID }).length > 0;
}

describe("forma del form per categoria (§9)", () => {
  it("Calciatore non mostra un selettore di ruolo", () => {
    const tree = fieldsTree();

    expect(has(tree, "role-field-role")).toBe(false);
    expect(has(tree, "role-field-team")).toBe(true);
  });

  it("Staff mostra il ruolo e il campo custom solo per Altro", () => {
    const standard = fieldsTree({
      value: value({ profileType: "staff", roleId: "staff_match_analyst" }),
    });

    expect(has(standard, "role-field-role")).toBe(true);
    expect(has(standard, "role-field-custom")).toBe(false);

    const custom = fieldsTree({
      value: value({ profileType: "staff", roleId: "staff_other" }),
    });

    expect(has(custom, "role-field-custom")).toBe(true);
  });

  it("solo il Dirigente vede i radio di ambito", () => {
    expect(has(fieldsTree(), "role-scope-society")).toBe(false);

    const director = fieldsTree({
      value: value({ profileType: "director", roleId: "director_youth_head" }),
    });

    expect(has(director, "role-scope-society")).toBe(true);
  });

  it("con Intera società la squadra sparisce dal form (§12, screen 05)", () => {
    const tree = fieldsTree({
      value: value({
        profileType: "director",
        roleId: "director_youth_head",
        scopeType: "society",
        teamId: null,
      }),
    });

    expect(has(tree, "role-field-team")).toBe(false);
  });

  it("con una sola identità reale la riga Profilo non è un controllo (§12)", () => {
    const tree = fieldsTree();
    const row = tree.root.findByProps({ testID: "role-field-profile" });

    /* §13: «La riga read-only Profilo non deve sembrare un campo disabilitato
       o un dropdown senza opzioni.» Senza `onPress` non è un bottone. */
    expect(row.props.onPress ?? null).toBe(null);
  });

  it("in gestione la categoria è modificabile (§10)", () => {
    const tree = fieldsTree({ mode: "manage" });

    expect(has(tree, "role-field-type")).toBe(true);
  });
});
