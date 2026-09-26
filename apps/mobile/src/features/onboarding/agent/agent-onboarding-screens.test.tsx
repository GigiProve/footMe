import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { isAgentMasterStep } from "./AgentOnboardingFlow";
import { AgentActivityStep } from "./AgentActivityStep";
import { AgentContactPreferencesStep } from "./AgentContactPreferencesStep";
import { AgentPortfolioStep } from "./AgentPortfolioStep";
import { AgentPresentationStep } from "./AgentPresentationStep";
import { AgentPreviousExperiencesStep } from "./AgentPreviousExperiencesStep";
import { AgentProfessionalStep } from "./AgentProfessionalStep";
import { AgentQualificationStep } from "./AgentQualificationStep";
import {
  buildAgentPreviousRolesPatch,
  getNextAgentStepAfterPreviousRoles,
  readAgentPreviousRoles,
  toggleAgentPreviousRole,
} from "./agent-previous-roles";
import {
  fromLegacyManagedPlayersCount,
  toLegacyManagedPlayersCount,
} from "./agent-taxonomy";

vi.mock("@expo/vector-icons/Ionicons", () => {
  function Ionicons(props: Record<string, unknown>) {
    return React.createElement("Ionicon", props);
  }

  Ionicons.glyphMap = {};

  return { default: Ionicons };
});

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

function findPressable(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const match = tree.root
    .findAllByProps({ testID })
    .find(
      (instance) =>
        typeof instance.type === "string" &&
        typeof instance.props.onPress === "function",
    );

  if (!match) {
    throw new Error(`Nessun elemento premibile con testID "${testID}"`);
  }

  return match;
}

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = findPressable(tree, testID);

  act(() => {
    target.props.onPress();
  });
}

function texts(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll((node) => typeof node.type === "string")
    .flatMap((node) =>
      React.Children.toArray(node.props.children).filter(
        (child): child is string => typeof child === "string",
      ),
    );
}

function hasTestID(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAllByProps({ testID }).length > 0;
}

const noop = () => {};
const searchPlayers = vi.fn(async () => []);

const pageProps = {
  currentStep: 3,
  isBusy: false,
  onBack: noop,
  stepLabel: "Profilo",
  totalSteps: 9,
};

describe("isAgentMasterStep", () => {
  it("copre schermate comuni e passi specifici del Procuratore", () => {
    for (const step of [
      "base",
      "photo",
      "agent_professional",
      "agent_qualification",
      "agent_portfolio",
      "agent_activity",
      "agent_previous_experiences",
      "agent_player_career",
      "agent_contact_preferences",
      "agent_presentation",
    ] as const) {
      expect(isAgentMasterStep(step, "agent")).toBe(true);
    }
  });

  it("non intercetta i passi di un altro ruolo", () => {
    expect(isAgentMasterStep("base", "coach")).toBe(false);
    expect(isAgentMasterStep("staff_role", "agent")).toBe(false);
  });
});

describe("AgentProfessionalStep", () => {
  // §I: l'indipendente non deve vedere nessun campo dell'agenzia.
  it("mostra i campi agenzia solo a chi fa parte di un'agenzia", () => {
    const independent = render(
      <AgentProfessionalStep
        {...pageProps}
        agencyLogoUrl=""
        agencyName=""
        agencyRole=""
        agencyStartYear=""
        isUploadingLogo={false}
        mode="independent"
        onAgencyNameChange={noop}
        onAgencyRoleChange={noop}
        onAgencyStartYearChange={noop}
        onContinue={noop}
        onModeChange={noop}
        onPickLogoFromLibrary={noop}
        onRemoveLogo={noop}
        onTakeLogoPhoto={noop}
        validationErrors={{}}
      />,
    );

    expect(hasTestID(independent, "agent-agency-name")).toBe(false);
    expect(hasTestID(independent, "agent-agency-logo")).toBe(false);

    const agency = render(
      <AgentProfessionalStep
        {...pageProps}
        agencyLogoUrl=""
        agencyName=""
        agencyRole=""
        agencyStartYear=""
        isUploadingLogo={false}
        mode="agency"
        onAgencyNameChange={noop}
        onAgencyRoleChange={noop}
        onAgencyStartYearChange={noop}
        onContinue={noop}
        onModeChange={noop}
        onPickLogoFromLibrary={noop}
        onRemoveLogo={noop}
        onTakeLogoPhoto={noop}
        validationErrors={{}}
      />,
    );

    expect(hasTestID(agency, "agent-agency-name")).toBe(true);
    expect(hasTestID(agency, "agent-agency-role")).toBe(true);
    expect(hasTestID(agency, "agent-agency-start-year")).toBe(true);
    expect(hasTestID(agency, "agent-agency-logo")).toBe(true);
  });

  // §M: nessun riferimento a mockup, componenti o modalità di salvataggio.
  it("non mostra copy tecniche o prototipali", () => {
    const tree = render(
      <AgentProfessionalStep
        {...pageProps}
        agencyLogoUrl=""
        agencyName=""
        agencyRole=""
        agencyStartYear=""
        isUploadingLogo={false}
        mode="agency"
        onAgencyNameChange={noop}
        onAgencyRoleChange={noop}
        onAgencyStartYearChange={noop}
        onContinue={noop}
        onModeChange={noop}
        onPickLogoFromLibrary={noop}
        onRemoveLogo={noop}
        onTakeLogoPhoto={noop}
        validationErrors={{}}
      />,
    );

    const copy = texts(tree).join(" ").toLowerCase();

    expect(copy).not.toContain("banani");
    expect(copy).not.toContain("mockup");
    expect(copy).not.toContain("database");
    expect(copy).not.toContain("salvataggio");
    // §B: in superficie esiste solo "Procuratore".
    expect(copy).not.toContain("agente");
  });
});

describe("AgentQualificationStep", () => {
  // §O: con il controllo spento non si chiede nient'altro.
  it("nasconde federazione e licenza quando l'abilitazione è spenta", () => {
    const off = render(
      <AgentQualificationStep
        {...pageProps}
        federation=""
        isLicensed={false}
        licenseNumber=""
        onContinue={noop}
        onFederationChange={noop}
        onLicenseNumberChange={noop}
        onLicensedChange={noop}
        validationErrors={{}}
      />,
    );

    expect(hasTestID(off, "agent-federation")).toBe(false);

    const on = render(
      <AgentQualificationStep
        {...pageProps}
        federation=""
        isLicensed
        licenseNumber=""
        onContinue={noop}
        onFederationChange={noop}
        onLicenseNumberChange={noop}
        onLicensedChange={noop}
        validationErrors={{}}
      />,
    );

    expect(hasTestID(on, "agent-federation")).toBe(true);
    expect(hasTestID(on, "agent-license-number")).toBe(true);
  });
});

describe("AgentPortfolioStep", () => {
  // §U: range e collegamenti sono concetti distinti, si prosegue con zero.
  it("lascia proseguire senza nessun calciatore collegato", () => {
    const onContinue = vi.fn();
    const tree = render(
      <AgentPortfolioStep
        {...pageProps}
        managedPlayerEntries={[]}
        onContinue={onContinue}
        onManagedPlayerEntriesChange={noop}
        onRangeChange={noop}
        range="6_15"
        searchPlayers={searchPlayers}
        validationErrors={{}}
      />,
    );

    press(tree, "agent-portfolio-continue");

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("offre tutte e cinque le fasce di portfolio", () => {
    const tree = render(
      <AgentPortfolioStep
        {...pageProps}
        managedPlayerEntries={[]}
        onContinue={noop}
        onManagedPlayerEntriesChange={noop}
        onRangeChange={noop}
        range=""
        searchPlayers={searchPlayers}
        validationErrors={{}}
      />,
    );

    for (const value of ["none", "1_5", "6_15", "16_30", "30_plus"]) {
      expect(hasTestID(tree, `agent-portfolio-range-${value}`)).toBe(true);
    }
  });
});

describe("AgentActivityStep", () => {
  const activityProps = {
    ...pageProps,
    countries: [] as string[],
    onContinue: noop,
    onCountriesChange: noop,
    onDraftChange: noop,
    onScopesChange: noop,
    onWorksAbroadChange: noop,
    scopes: [] as never[],
  };

  // §AB: "Ovunque in Italia" è già una risposta completa.
  it("non apre selector quando la modalità è tutta Italia", () => {
    const onContinue = vi.fn();
    const tree = render(
      <AgentActivityStep
        {...activityProps}
        draft={{ mode: "ITALY", provinces: [], regions: [] }}
        onContinue={onContinue}
        scopes={["professional"]}
        worksAbroad={false}
      />,
    );

    expect(hasTestID(tree, "agent-activity-regions")).toBe(false);
    press(tree, "agent-activity-continue");
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // §BN: senza ambiti o senza area non si prosegue, e l'errore è inline.
  it("blocca il passo finché ambiti e area non sono scelti", () => {
    const onContinue = vi.fn();
    const tree = render(
      <AgentActivityStep
        {...activityProps}
        draft={{ mode: "", provinces: [], regions: [] }}
        onContinue={onContinue}
        worksAbroad={false}
      />,
    );

    press(tree, "agent-activity-continue");

    expect(onContinue).not.toHaveBeenCalled();
    expect(texts(tree)).toContain("Seleziona almeno un'area operativa.");
    expect(texts(tree)).toContain("Seleziona almeno un ambito di attività.");
  });

  // §AE: Nord/Centro/Sud/Isole non sono più un modo di scegliere.
  it("non offre più le macro aree", () => {
    const tree = render(
      <AgentActivityStep
        {...activityProps}
        draft={{ mode: "ITALY", provinces: [], regions: [] }}
        scopes={["professional"]}
        worksAbroad={false}
      />,
    );

    const copy = texts(tree).join(" ");

    expect(copy).not.toContain("Nord Italia");
    expect(copy).not.toContain("Isole");
    expect(copy).not.toContain("Nota operativa");
  });

  // §AF: i paesi compaiono solo con l'operatività estera accesa.
  it("mostra i paesi solo quando si opera all'estero", () => {
    const off = render(
      <AgentActivityStep
        {...activityProps}
        draft={{ mode: "ITALY", provinces: [], regions: [] }}
        scopes={["professional"]}
        worksAbroad={false}
      />,
    );

    expect(hasTestID(off, "agent-activity-countries")).toBe(false);

    const on = render(
      <AgentActivityStep
        {...activityProps}
        draft={{ mode: "ITALY", provinces: [], regions: [] }}
        scopes={["professional"]}
        worksAbroad
      />,
    );

    expect(hasTestID(on, "agent-activity-countries")).toBe(true);
  });
});

describe("AgentPreviousExperiencesStep", () => {
  it("dichiara la selezione multipla e offre tutti i ruoli", () => {
    const tree = render(
      <AgentPreviousExperiencesStep
        {...pageProps}
        onChange={noop}
        onContinue={noop}
        selection={[]}
      />,
    );

    expect(texts(tree)).toContain("Puoi scegliere più opzioni.");

    for (const value of [
      "player",
      "coach",
      "director",
      "scout",
      "staff",
      "other",
      "none",
    ]) {
      expect(hasTestID(tree, `agent-previous-role-${value}`)).toBe(true);
    }
  });

  it("non prosegue con nessun ruolo selezionato", () => {
    const onContinue = vi.fn();
    const tree = render(
      <AgentPreviousExperiencesStep
        {...pageProps}
        onChange={noop}
        onContinue={onContinue}
        selection={[]}
      />,
    );

    press(tree, "agent-previous-experiences-continue");

    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe("esperienze precedenti del Procuratore", () => {
  // §AK: "Nessuna esperienza precedente" è mutuamente esclusiva.
  it("rende esclusiva la voce «nessuna esperienza precedente»", () => {
    expect(toggleAgentPreviousRole(["player", "scout"], "none")).toEqual([
      "none",
    ]);
    expect(toggleAgentPreviousRole(["none"], "coach")).toEqual(["coach"]);
    expect(toggleAgentPreviousRole(["player"], "player")).toEqual([]);
  });

  it("permette più ruoli contemporaneamente", () => {
    expect(toggleAgentPreviousRole(["player"], "scout")).toEqual([
      "player",
      "scout",
    ]);
  });

  // §AM: solo "Calciatore" apre il ramo carriera.
  it("apre la carriera da calciatore solo quando è dichiarata", () => {
    expect(getNextAgentStepAfterPreviousRoles(["player", "scout"])).toBe(
      "agent_player_career",
    );
    expect(getNextAgentStepAfterPreviousRoles(["coach"])).toBe(
      "agent_contact_preferences",
    );
    expect(getNextAgentStepAfterPreviousRoles(["none"])).toBe(
      "agent_contact_preferences",
    );
  });

  // §BI: togliendo "Calciatore" la carriera non resta esposta.
  it("svuota la carriera quando «Calciatore» viene tolto", () => {
    expect(buildAgentPreviousRolesPatch(["coach"])).toMatchObject({
      agentHasPlayedFootball: false,
      agentPlayerCareerEntries: [],
    });
    expect(buildAgentPreviousRolesPatch(["player"])).toMatchObject({
      agentHasPlayedFootball: true,
    });
    expect(
      buildAgentPreviousRolesPatch(["player"]),
    ).not.toHaveProperty("agentPlayerCareerEntries");
  });

  it("rilegge la selezione dai campi del form", () => {
    expect(
      readAgentPreviousRoles({
        agentHasNoPreviousExperience: true,
        agentPreviousRoles: ["player"],
      }),
    ).toEqual(["none"]);
    expect(
      readAgentPreviousRoles({
        agentHasNoPreviousExperience: false,
        agentPreviousRoles: ["player", "inventato"],
      }),
    ).toEqual(["player"]);
  });
});

describe("AgentContactPreferencesStep", () => {
  // §AX: i due toggle sono indipendenti, anche entrambi spenti.
  it("prosegue con qualsiasi combinazione, spenti compresi", () => {
    const onContinue = vi.fn();
    const tree = render(
      <AgentContactPreferencesStep
        {...pageProps}
        onContinue={onContinue}
        onOpenToClubsChange={noop}
        onOpenToPlayersChange={noop}
        openToClubs={false}
        openToPlayers={false}
      />,
    );

    press(tree, "agent-contact-preferences-continue");

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(texts(tree)).toContain("Aperto a richieste di rappresentanza");
  });
});

describe("AgentPresentationStep", () => {
  // §BC: nessuna CTA "Salta"; i campi opzionali restano vuoti.
  it("completa la registrazione senza bio né lingue", () => {
    const onFinish = vi.fn();
    const tree = render(
      <AgentPresentationStep
        {...pageProps}
        bio=""
        languages={[]}
        onBioChange={noop}
        onFinish={onFinish}
        onLanguagesChange={noop}
      />,
    );

    expect(texts(tree)).not.toContain("Salta");
    press(tree, "agent-presentation-finish");
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe("compatibilità con il portfolio legacy", () => {
  // §BQ: la colonna testuale continua a essere leggibile in entrambi i versi.
  it("converte la fascia nel valore legacy e viceversa", () => {
    expect(toLegacyManagedPlayersCount("none")).toBeNull();
    expect(toLegacyManagedPlayersCount("6_15")).toBe("6–15 calciatori");
    expect(fromLegacyManagedPlayersCount("5-15 calciatori")).toBe("6_15");
    expect(fromLegacyManagedPlayersCount("15+ calciatori")).toBe("16_30");
    expect(fromLegacyManagedPlayersCount(null)).toBe("");
  });
});
