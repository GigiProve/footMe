/**
 * Le decisioni del composer che precedono la UI (DAS-REV-16 §39).
 *
 * §39 chiede test «che verifichino regole e rischi reali, evitando suite che
 * copiano semplicemente il rendering». Qui si verificano quindi le tre
 * distinzioni su cui l'intera specifica insiste e che un refactor
 * distratto collasserebbe:
 *
 *   * UNSET ≠ UNRESTRICTED ≠ RANGE;
 *   * readiness ≠ presenza di optional ≠ lifecycle;
 *   * ambito SOCIETY ≠ Team nullo.
 */
import { describe, expect, it } from "vitest";

import {
  COMPOSE_COPY,
  ageSummary,
  availabilitySummary,
  contextSummary,
  continueLabel,
  describeBlocker,
  experienceSummary,
  incompatibleAreas,
  isPublishable,
  playerExperienceSummary,
  publishLabel,
  publishSuccessMessage,
  readinessActionLabel,
  readinessLabel,
  readinessOf,
  remainingCountHelper,
  remainingDraftsHelper,
  secondaryTeamsHelper,
  validateAgeInput,
  validateCustomRoleName,
} from "./compose-presentation";
import { POSITION_SCHEMAS } from "./compose-schema";
import type { PositionDraft } from "./compose-types";

const LIMITS = {
  ageMax: 70,
  ageMin: 5,
  customRoleName: 80,
  description: 2000,
  requirements: 1000,
  responsibilities: 1500,
  staffQualification: 300,
};

function draft(overrides: Partial<PositionDraft> = {}): PositionDraft {
  return {
    ageMax: null,
    ageMin: null,
    ageMode: "unset",
    blockers: [],
    canEdit: true,
    canPublish: true,
    clubCity: "Como",
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    clubRegion: "Lombardia",
    contextLabel: "Serie D",
    creationBatchId: "batch-1",
    customRoleName: null,
    deadlineDate: null,
    deadlineTimezone: null,
    description: null,
    details: {},
    hasDetails: false,
    id: "pos-1",
    profileType: "coach",
    publishedAt: null,
    resourceVersion: 1,
    roleId: "head_coach",
    roleIsCustom: false,
    roleLabel: "Allenatore",
    schemaVersion: 1,
    scope: "team",
    secondaryTeams: [],
    status: "draft",
    teamId: "team-1",
    teamName: "Prima squadra",
    title: "Allenatore",
    updatedAt: null,
    ...overrides,
  };
}

describe("fascia d'età a tre stati (§13)", () => {
  it("non confonde «non configurato» con «nessun limite»", () => {
    // Entrambi hanno min e max nulli: solo il modo li distingue.
    expect(ageSummary({ ageMax: null, ageMin: null, ageMode: "unset" })).toBeNull();
    expect(
      ageSummary({ ageMax: null, ageMin: null, ageMode: "unrestricted" }),
    ).toBe(COMPOSE_COPY.noAgeLimit);
  });

  it("riassume il range con il trattino del mockup", () => {
    expect(ageSummary({ ageMax: 25, ageMin: 18, ageMode: "range" })).toBe(
      "18–25 anni",
    );
  });

  it("un range con un solo estremo non è un riepilogo valido", () => {
    expect(ageSummary({ ageMax: null, ageMin: 18, ageMode: "range" })).toBeNull();
  });

  it("blocca il minimo superiore al massimo, non il contrario", () => {
    expect(validateAgeInput({ max: "18", min: "25", mode: "range" }, LIMITS)).toBe(
      COMPOSE_COPY.ageOrder,
    );
    expect(
      validateAgeInput({ max: "25", min: "18", mode: "range" }, LIMITS),
    ).toBeNull();
  });

  it("chiede entrambe le età prima di giudicare il valore", () => {
    expect(validateAgeInput({ max: "", min: "18", mode: "range" }, LIMITS)).toBe(
      COMPOSE_COPY.ageBoth,
    );
  });

  it("rifiuta decimali e valori fuori dall'intervallo rappresentabile", () => {
    expect(validateAgeInput({ max: "25", min: "18.5", mode: "range" }, LIMITS)).toBe(
      COMPOSE_COPY.ageInvalid,
    );
    expect(validateAgeInput({ max: "99", min: "18", mode: "range" }, LIMITS)).toBe(
      COMPOSE_COPY.ageInvalid,
    );
  });

  it("«Nessun limite» non ha nulla da validare", () => {
    expect(
      validateAgeInput({ max: "", min: "", mode: "unrestricted" }, LIMITS),
    ).toBeNull();
  });
});

describe("readiness derivata, non persistita (§6, §12)", () => {
  it("un Allenatore valido senza dettagli è già pronto", () => {
    const row = draft({ hasDetails: false, profileType: "coach" });

    expect(readinessOf(row)).toBe("ready_without_details");
    expect(readinessLabel(readinessOf(row))).toBe("Pronta per la pubblicazione");
    expect(readinessActionLabel(readinessOf(row), row.hasDetails)).toBe(
      "Aggiungi dettagli",
    );
  });

  it("Staff e Dirigente validi senza dettagli ricevono la guidance", () => {
    for (const profileType of ["staff", "director"] as const) {
      const row = draft({ hasDetails: false, profileType });

      expect(readinessOf(row)).toBe("suggest_details");
      expect(readinessLabel(readinessOf(row))).toBe(
        "Aggiungi dettagli per completare l'annuncio",
      );
    }
  });

  it("un blocker vince sulla presenza di dettagli", () => {
    const row = draft({ blockers: ["AGE_UNSET"], hasDetails: true });

    expect(readinessOf(row)).toBe("incomplete");
    expect(readinessActionLabel(readinessOf(row), true)).toBe("Completa");
    expect(isPublishable(row)).toBe(false);
  });

  it("la guidance non toglie pubblicabilità", () => {
    expect(isPublishable(draft({ hasDetails: false, profileType: "staff" }))).toBe(
      true,
    );
  });

  it("senza capability di pubblicazione la bozza non è pubblicabile", () => {
    // §5: un creator senza publish conserva bozze e non pubblica.
    expect(isPublishable(draft({ canPublish: false }))).toBe(false);
  });
});

describe("ambito esplicito, non Team nullo (§6, §17)", () => {
  it("un incarico SOCIETY mostra «Intera società» e nessuna categoria", () => {
    const row = draft({
      contextLabel: "Serie D",
      profileType: "director",
      scope: "society",
      teamId: null,
      teamName: null,
    });

    expect(contextSummary(row)).toBe("Intera società");
  });

  it("una bozza TEAM senza squadra resta TEAM e lo dichiara", () => {
    // §30 di DAS-REV-15: «Squadra da definire» è il fallback di una bozza
    // incompleta, non la presentazione di un valido incarico SOCIETY.
    const row = draft({ contextLabel: null, teamId: null, teamName: null });

    expect(contextSummary(row)).toBe("Squadra da definire");
  });

  it("un incarico TEAM concatena squadra e livello", () => {
    expect(contextSummary(draft())).toBe("Prima squadra · Serie D");
  });
});

describe("squadre dello stesso incarico (§15, §16)", () => {
  it("il soggetto cambia fra Allenatore e Staff", () => {
    expect(secondaryTeamsHelper("coach", ["Under 15"])).toBe(
      "Lo stesso allenatore seguirà anche Under 15.",
    );
    expect(secondaryTeamsHelper("staff", ["Under 15"])).toBe(
      "La stessa persona seguirà anche Under 15.",
    );
  });

  it("più squadre vengono elencate per intero, non troncate", () => {
    expect(secondaryTeamsHelper("coach", ["Under 15", "Under 17"])).toBe(
      "Lo stesso allenatore seguirà anche Under 15 e Under 17.",
    );
  });

  it("nessuna squadra secondaria non produce helper", () => {
    expect(secondaryTeamsHelper("coach", [])).toBeNull();
  });
});

describe("criteri e cataloghi per profilo (§14, §19)", () => {
  const categories = [
    { id: "serie_d", isCustom: false, label: "Serie D", needsContext: false },
  ];
  const seasons = [
    { id: "2027/28", isCustom: false, label: "2027/28", needsContext: false },
  ];
  const experiences = [
    { id: "first_team", isCustom: false, label: "Prima squadra", needsContext: false },
    {
      id: "multi_team",
      isCustom: false,
      label: "Gestione di più squadre",
      needsContext: false,
    },
  ];

  it("la categoria specifica è una soglia, non un'uguaglianza", () => {
    expect(
      playerExperienceSummary(
        { levelId: "serie_d", mode: "from_category" },
        categories,
      ),
    ).toBe("Serie D o categorie superiori");
  });

  it("una categoria sconosciuta non diventa una label inventata", () => {
    expect(
      playerExperienceSummary({ levelId: "ignota", mode: "from_category" }, categories),
    ).toBeNull();
  });

  it("la disponibilità per stagione conserva il riferimento risolto", () => {
    expect(
      availabilitySummary({ mode: "next_season", seasonId: "2027/28" }, seasons),
    ).toBe("Inizio prossima stagione · 2027/28");
  });

  it("la data civile non viene riconvertita in un istante", () => {
    expect(
      availabilitySummary({ date: "2027-01-09", mode: "from_date" }, seasons),
    ).toBe("Da 09/01/2027");
  });

  it("zero esperienze selezionate è uno stato valido senza etichetta", () => {
    expect(experienceSummary([], experiences)).toBeNull();
    expect(experienceSummary(undefined, experiences)).toBeNull();
  });

  it("le esperienze selezionate si leggono nell'ordine del catalogo", () => {
    expect(experienceSummary(["multi_team", "first_team"], experiences)).toBe(
      "Prima squadra · Gestione di più squadre",
    );
  });
});

describe("conteggi e plurali (§11, §24, §26)", () => {
  it("la CTA di continuazione conta i pubblicabili", () => {
    expect(continueLabel(1)).toBe("Continua con 1 posizione");
    expect(continueLabel(2)).toBe("Continua con 2 posizioni");
  });

  it("la CTA di pubblicazione conta i selezionati", () => {
    expect(publishLabel(1)).toBe("Pubblica 1 posizione");
    expect(publishLabel(3)).toBe("Pubblica 3 posizioni");
  });

  it("lo screen 04 nomina la bozza che resta indietro", () => {
    expect(remainingDraftsHelper(["Primavera"])).toBe(
      "La posizione Primavera resterà in bozza.",
    );
  });

  it("con più bozze residue il helper conta invece di elencare", () => {
    expect(remainingDraftsHelper(["Primavera", "Under 15"])).toBe(
      "2 posizioni resteranno in bozza.",
    );
  });

  it("nessuna bozza residua non produce helper", () => {
    expect(remainingDraftsHelper([])).toBeNull();
    expect(remainingCountHelper(0)).toBeNull();
  });

  it("l'esito distingue pubblicate e conservate", () => {
    expect(publishSuccessMessage(1, 0)).toBe("Posizione pubblicata");
    expect(publishSuccessMessage(2, 0)).toBe("2 posizioni pubblicate");
    expect(publishSuccessMessage(1, 1)).toBe(
      "Posizione pubblicata · 1 conservata in bozza",
    );
  });
});

describe("nome del ruolo custom (§8, §20)", () => {
  it("rifiuta i soli spazi", () => {
    expect(validateCustomRoleName("   ", LIMITS)).toBe(
      COMPOSE_COPY.roleCustomRequired,
    );
  });

  it("conta i code point, non le code unit", () => {
    // 80 emoji sono 80 caratteri per l'utente e 160 per `String.length`.
    expect(validateCustomRoleName("🧠".repeat(80), LIMITS)).toBeNull();
    expect(validateCustomRoleName("🧠".repeat(81), LIMITS)).toBe(
      COMPOSE_COPY.textTooLong,
    );
  });

  it("accetta la capitalizzazione intenzionale", () => {
    expect(validateCustomRoleName("Data analyst", LIMITS)).toBeNull();
  });
});

describe("cambio dei dati comuni (§22)", () => {
  it("elenca le aree che un cambio di profilo renderebbe inutilizzabili", () => {
    const row = draft({
      details: { coachQualificationId: "uefa_a", experience: ["first_team"] },
      profileType: "coach",
    });

    expect(incompatibleAreas(row, { profileType: "staff", scope: "team" })).toEqual([
      "Patentino richiesto",
      "Esperienza richiesta",
    ]);
  });

  it("non segnala nulla quando non c'è niente da perdere", () => {
    expect(
      incompatibleAreas(draft(), { profileType: "staff", scope: "team" }),
    ).toEqual([]);
  });

  it("il passaggio a SOCIETY mette in conto le squadre secondarie", () => {
    const row = draft({
      secondaryTeams: [{ isInactive: false, name: "Under 15", teamId: "t2" }],
    });

    expect(
      incompatibleAreas(row, { profileType: "coach", scope: "society" }),
    ).toContain("Altre squadre coinvolte nell'incarico");
  });
});

describe("copy dei blocker (§12, §31)", () => {
  it("un'età non configurata chiede una scelta, non un valore", () => {
    expect(describeBlocker("AGE_UNSET")).toBe(COMPOSE_COPY.ageRequired);
  });

  it("un Team non più utilizzabile ha una copy propria", () => {
    expect(describeBlocker("TEAM_UNAVAILABLE")).toBe(COMPOSE_COPY.teamUnavailable);
    expect(describeBlocker("SECONDARY_TEAM_UNAVAILABLE")).toBe(
      COMPOSE_COPY.teamUnavailable,
    );
  });
});

describe("matrice dei quattro schemi (§7, §39)", () => {
  it("solo il Calciatore ha un campo obbligatorio", () => {
    const required = Object.values(POSITION_SCHEMAS)
      .filter((schema) => schema.fields.some((field) => !field.optional))
      .map((schema) => schema.profileType);

    expect(required).toEqual(["player"]);
  });

  it("solo il Dirigente supporta l'ambito SOCIETY", () => {
    const society = Object.values(POSITION_SCHEMAS)
      .filter((schema) => schema.supportsSocietyScope)
      .map((schema) => schema.profileType);

    expect(society).toEqual(["director"]);
  });

  it("le squadre dello stesso incarico esistono solo per Coach e Staff", () => {
    const withSecondary = Object.values(POSITION_SCHEMAS)
      .filter((schema) =>
        schema.fields.some((field) => field.kind === "secondaryTeams"),
      )
      .map((schema) => schema.profileType);

    expect(withSecondary.sort()).toEqual(["coach", "staff"]);
  });

  it("il patentino è dell'Allenatore, la qualifica testuale dello Staff", () => {
    const coachKinds = POSITION_SCHEMAS.coach.fields.map((field) => field.kind);
    const staffKinds = POSITION_SCHEMAS.staff.fields.map((field) => field.kind);

    expect(coachKinds).toContain("coachQualification");
    expect(coachKinds).not.toContain("shortText");
    expect(staffKinds).toContain("shortText");
    expect(staffKinds).not.toContain("coachQualification");
  });

  it("il Dirigente non eredita età, patentino né squadre secondarie", () => {
    const kinds = POSITION_SCHEMAS.director.fields.map((field) => field.kind);

    expect(kinds).not.toContain("ageRange");
    expect(kinds).not.toContain("coachQualification");
    expect(kinds).not.toContain("secondaryTeams");
  });

  it("nessuno schema chiede un titolo: è derivato dal ruolo (§8)", () => {
    for (const schema of Object.values(POSITION_SCHEMAS)) {
      expect(schema.fields.some((field) => field.key === "title")).toBe(false);
    }
  });
});
