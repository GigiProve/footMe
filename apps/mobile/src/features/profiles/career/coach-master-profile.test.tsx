/**
 * Scenari QA del Master Profile Allenatore (REV-PROF-03).
 *
 * Coprono ciò che distingue questa revisione dal profilo Allenatore
 * precedente: niente statistiche da giocatore nella carriera da allenatore, il
 * selettore Allenatore/Calciatore solo quando ha senso, le macroaree dei
 * Dettagli nell'ordine della task e senza duplicazioni, e la privacy dei
 * contatti.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type {
  CoachCareerEntryRecord,
  CoachPlayerCareerEntryRecord,
  CompleteProfessionalProfile,
} from "../profile-service";
import { buildCoachCareerView } from "./coach-career-model";
import { CoachCareerTab } from "./CoachCareerTab";
import { CoachDetailsTab } from "./CoachDetailsTab";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

const NOW = new Date("2025-03-01T00:00:00.000Z");

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

/**
 * Righe effettivamente renderizzate con una certa etichetta accessibile. Si
 * ferma ai nodi host: un componente e la View che produce porterebbero la
 * stessa prop, e conterebbero due volte la stessa riga a schermo.
 */
function countRows(tree: TestRenderer.ReactTestRenderer, label: string): number {
  return tree.root.findAll(
    (node) =>
      typeof node.type === "string" && node.props.accessibilityLabel === label,
  ).length;
}

function careerEntry(
  overrides: Partial<CoachCareerEntryRecord> & Pick<CoachCareerEntryRecord, "id">,
): CoachCareerEntryRecord {
  return {
    category: "Prima Squadra",
    club_id: null,
    coach_profile_id: "coach-1",
    description: null,
    experience_group_id: null,
    experience_type: "MULTI_SEASON",
    period_end_month: null,
    period_end_year: null,
    period_start_month: null,
    period_start_year: null,
    results: [],
    role: "Allenatore",
    season_details: {},
    seasons: [],
    sort_order: 0,
    team_logo_url: null,
    team_name: "Torino FC",
    ...overrides,
  };
}

const CAREER_VIEW = buildCoachCareerView(
  [
    careerEntry({
      id: "exp-a",
      season_details: {
        "2022/2023": { category: "Juniores", role: "Allenatore" },
        "2023/2024": { category: "Prima Squadra", role: "Vice allenatore" },
        "2024/2025": { category: "Prima Squadra", role: "Allenatore" },
      },
      seasons: ["2022/2023", "2023/2024", "2024/2025"],
      team_name: "Torino FC",
    }),
    careerEntry({
      id: "exp-b",
      seasons: ["2019/2020", "2020/2021", "2021/2022"],
      team_name: "Fiorentina",
    }),
  ],
  { now: NOW },
);

const EMPTY_CAREER_VIEW = buildCoachCareerView([], { now: NOW });

const PLAYER_ENTRIES: CoachPlayerCareerEntryRecord[] = [
  {
    appearances: 30,
    assists: 4,
    awards: null,
    career_type: "SINGLE_SEASON",
    category: "Serie C",
    coach_profile_id: "coach-1",
    experience_group_id: "pl-group-1",
    goals: 7,
    id: "pl-1",
    minutes_played: null,
    period_end_month: null,
    period_start_month: null,
    position: "Centrocampista",
    season: "2010/2011",
    season_period: "full",
    sort_order: 0,
    team_logo_url: null,
    team_name: "Como",
  },
];

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    coachCareerEntries: [],
    coachDirectorCareerEntries: [],
    coachPlayerCareerEntries: [],
    coachProfile: {
      achievements: [],
      availability_type: "REGIONS",
      available_from: null,
      coached_categories: ["Prima Squadra", "Juniores"],
      coached_clubs: [],
      contract_end: null,
      current_club: null,
      game_philosophy:
        "Credo in un calcio propositivo, basato su possesso palla, organizzazione e crescita continua.",
      licenses: ["UEFA B"],
      media_items: [],
      open_to_new_role: true,
      play_styles: ["Possesso palla"],
      preferred_categories: [],
      preferred_formation: "4-3-3",
      preferred_provinces: [],
      preferred_regions: ["lazio", "toscana"],
      primary_role: "Allenatore",
      profile_id: "coach-1",
      secondary_formations: [],
      technical_video_url: null,
    },
    profile: { id: "coach-1", languages: ["Italiano", "Inglese"] },
    userContacts: {
      email: "luca@example.com",
      facebook: "",
      instagram: "lucarossi.coach",
      phone: "+39 320 1234567",
      showEmail: true,
      showFacebook: false,
      showInstagram: true,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

describe("Master Profile Allenatore — Carriera", () => {
  it("intitola la carriera 'Percorso da allenatore' e mostra tutte le stagioni", () => {
    const tree = render(
      <CoachCareerTab
        careerView={CAREER_VIEW}
        isOwner={false}
        playerCareerEntries={[]}
      />,
    );

    expect(tree.root.findByProps({ children: "Percorso da allenatore" })).toBeTruthy();
    expect(
      tree.root.findAllByProps({ testID: "coach-career-experience-exp-a" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ testID: "coach-career-experience-exp-b" }).length,
    ).toBeGreaterThan(0);

    for (const key of ["2024/2025", "2023/2024", "2022/2023"]) {
      expect(
        tree.root.findAllByProps({ testID: `coach-career-season-${key}` }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("mostra ruolo e categoria della singola stagione", () => {
    const tree = render(
      <CoachCareerTab
        careerView={CAREER_VIEW}
        isOwner={false}
        playerCareerEntries={[]}
      />,
    );

    // Una sola stagione porta "Vice allenatore" e una sola porta "Juniores":
    // ruolo e categoria non vengono ereditati dall'intero incarico.
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Stagione 2023-2024, Vice allenatore, Prima Squadra",
      }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Stagione 2022-2023, Allenatore, Juniores",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("non mostra nessuna statistica da giocatore nella carriera da allenatore", () => {
    const tree = render(
      <CoachCareerTab
        careerView={CAREER_VIEW}
        isOwner={false}
        playerCareerEntries={[]}
      />,
    );

    for (const label of ["Presenze", "Gol", "Assist", "Totali carriera"]) {
      expect(() => tree.root.findByProps({ children: label })).toThrow();
    }
  });

  it("nasconde il selettore quando non esiste una carriera da ex calciatore", () => {
    const tree = render(
      <CoachCareerTab
        careerView={CAREER_VIEW}
        isOwner={false}
        playerCareerEntries={[]}
      />,
    );

    expect(() => tree.root.findByProps({ testID: "coach-career-mode" })).toThrow();
  });

  it("mostra il selettore con Allenatore preselezionato quando la carriera da calciatore esiste", () => {
    const tree = render(
      <CoachCareerTab
        careerView={CAREER_VIEW}
        isOwner={false}
        playerCareerEntries={PLAYER_ENTRIES}
      />,
    );

    const coachChip = tree.root.findByProps({ testID: "coach-career-mode-coach" });
    const playerChip = tree.root.findByProps({ testID: "coach-career-mode-player" });

    expect(coachChip.props.accessibilityState.selected).toBe(true);
    expect(playerChip.props.accessibilityState.selected).toBe(false);
  });

  it("passando a Calciatore riusa il componente di carriera del Calciatore", () => {
    const tree = render(
      <CoachCareerTab
        careerView={CAREER_VIEW}
        isOwner={false}
        playerCareerEntries={PLAYER_ENTRIES}
      />,
    );

    act(() => {
      tree.root.findByProps({ testID: "coach-career-mode-player" }).props.onPress();
    });

    expect(tree.root.findByProps({ children: "Percorso da calciatore" })).toBeTruthy();
    // Le statistiche tornano solo qui, dentro il blocco approvato del Calciatore.
    expect(
      tree.root.findAllByProps({ testID: "career-season-2010/2011" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ children: "Presenze" }).length,
    ).toBeGreaterThan(0);
  });

  it("mostra al Visitor un empty state senza CTA di modifica", () => {
    const tree = render(
      <CoachCareerTab
        careerView={EMPTY_CAREER_VIEW}
        isOwner={false}
        playerCareerEntries={[]}
      />,
    );

    expect(tree.root.findByProps({ children: "Nessuna esperienza" })).toBeTruthy();
    expect(
      tree.root.findByProps({
        children:
          "Questo allenatore non ha ancora aggiunto esperienze professionali.",
      }),
    ).toBeTruthy();
    expect(() =>
      tree.root.findByProps({ accessibilityLabel: "Aggiungi esperienza" }),
    ).toThrow();
  });

  it("mostra all'Owner l'empty state con la CTA del flusso esistente", () => {
    const onAddExperience = vi.fn();
    const tree = render(
      <CoachCareerTab
        careerView={EMPTY_CAREER_VIEW}
        isOwner
        onAddExperience={onAddExperience}
        playerCareerEntries={[]}
      />,
    );

    expect(tree.root.findByProps({ children: "Completa la tua carriera" })).toBeTruthy();

    act(() => {
      tree.root.findByProps({ accessibilityLabel: "Aggiungi esperienza" }).props.onPress();
    });

    expect(onAddExperience).toHaveBeenCalledTimes(1);
  });
});

describe("Master Profile Allenatore — Dettagli", () => {
  it("mostra le macroaree nell'ordine previsto dalla task", () => {
    const tree = render(
      <CoachDetailsTab careerView={CAREER_VIEW} completeProfile={buildProfile()} />,
    );

    for (const testID of [
      "coach-details-opportunities",
      "coach-details-technical",
      "coach-details-situation",
      "coach-details-philosophy",
      "coach-details-palmares",
      "coach-details-contacts",
    ]) {
      expect(tree.root.findAllByProps({ testID }).length).toBeGreaterThan(0);
    }
  });

  it("mostra il profilo tecnico come coppie label/valore", () => {
    const tree = render(
      <CoachDetailsTab careerView={CAREER_VIEW} completeProfile={buildProfile()} />,
    );

    expect(tree.root.findByProps({ accessibilityLabel: "Patentino, UEFA B" })).toBeTruthy();
    expect(
      tree.root.findByProps({
        accessibilityLabel: "Categorie allenate, Prima Squadra, Juniores",
      }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ accessibilityLabel: "Modulo preferito, 4-3-3" }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ accessibilityLabel: "Stile di gioco, Possesso palla" }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ accessibilityLabel: "Lingue, Italiano, Inglese" }),
    ).toBeTruthy();
  });

  it("deriva la situazione attuale dalla carriera in corso", () => {
    const tree = render(
      <CoachDetailsTab careerView={CAREER_VIEW} completeProfile={buildProfile()} />,
    );

    expect(
      tree.root.findByProps({
        accessibilityLabel: "Torino FC, Prima Squadra, Allenatore",
      }),
    ).toBeTruthy();
  });

  it("non mostra la situazione attuale quando nessun incarico è in corso", () => {
    const tree = render(
      <CoachDetailsTab
        careerView={EMPTY_CAREER_VIEW}
        completeProfile={buildProfile()}
      />,
    );

    expect(() =>
      tree.root.findByProps({ testID: "coach-details-situation" }),
    ).toThrow();
  });

  it("mostra il chevron della società solo quando la riga è navigabile", () => {
    const withoutLink = render(
      <CoachDetailsTab careerView={CAREER_VIEW} completeProfile={buildProfile()} />,
    );

    expect(() =>
      withoutLink.root.findByProps({
        accessibilityRole: "button",
        accessibilityLabel: "Torino FC, Prima Squadra, Allenatore",
      }),
    ).toThrow();

    const linkedView = buildCoachCareerView(
      [
        careerEntry({
          club_id: "club-1",
          id: "exp-a",
          seasons: ["2024/2025"],
        }),
      ],
      { now: NOW },
    );
    const onOpenClub = vi.fn();
    const withLink = render(
      <CoachDetailsTab
        careerView={linkedView}
        completeProfile={buildProfile()}
        onOpenClub={onOpenClub}
      />,
    );

    act(() => {
      withLink.root
        .findByProps({
          accessibilityRole: "button",
          accessibilityLabel: "Torino FC, Prima Squadra, Allenatore",
        })
        .props.onPress();
    });

    expect(onOpenClub).toHaveBeenCalledWith("club-1");
  });

  it("non offre 'Mostra altro' su una filosofia che sta in tre righe", () => {
    const tree = render(
      <CoachDetailsTab careerView={CAREER_VIEW} completeProfile={buildProfile()} />,
    );

    expect(() => tree.root.findByProps({ children: "Mostra altro" })).toThrow();
  });

  it("collassa la filosofia lunga e la espande su richiesta", () => {
    const longPhilosophy = `${"Credo in un calcio propositivo. ".repeat(10)}`;
    const tree = render(
      <CoachDetailsTab
        careerView={CAREER_VIEW}
        completeProfile={buildProfile({
          coachProfile: {
            ...(buildProfile().coachProfile as NonNullable<
              CompleteProfessionalProfile["coachProfile"]
            >),
            game_philosophy: longPhilosophy,
          },
        } as Partial<CompleteProfessionalProfile>)}
      />,
    );

    const toggle = tree.root.findByProps({ testID: "coach-philosophy-toggle" });

    act(() => {
      toggle.props.onPress();
    });

    expect(
      tree.root.findAllByProps({ children: "Mostra meno" }).length,
    ).toBeGreaterThan(0);
  });

  it("mostra il palmarès vuoto nella forma compatta, non come card grande", () => {
    const tree = render(
      <CoachDetailsTab careerView={CAREER_VIEW} completeProfile={buildProfile()} />,
    );

    expect(tree.root.findByProps({ children: "Nessuna voce" })).toBeTruthy();
  });

  it("non rende nessun contatto non marcato pubblico", () => {
    const tree = render(
      <CoachDetailsTab
        careerView={CAREER_VIEW}
        completeProfile={buildProfile({
          userContacts: {
            email: "privata@example.com",
            facebook: "",
            instagram: "lucarossi.coach",
            phone: "+39 320 1234567",
            showEmail: false,
            showFacebook: false,
            showInstagram: true,
          },
        } as Partial<CompleteProfessionalProfile>)}
      />,
    );

    expect(() =>
      tree.root.findByProps({ children: "privata@example.com" }),
    ).toThrow();
    // Il telefono non ha una preferenza pubblica nel prodotto: non compare mai.
    expect(() =>
      tree.root.findByProps({ children: "+39 320 1234567" }),
    ).toThrow();
    expect(
      tree.root.findAllByProps({ children: "@lucarossi.coach" }).length,
    ).toBeGreaterThan(0);
  });

  it("non duplica patentino e disponibilità come sezioni separate", () => {
    const tree = render(
      <CoachDetailsTab careerView={CAREER_VIEW} completeProfile={buildProfile()} />,
    );

    // "Licenze" era la sezione isolata sopra le tab: non esiste più.
    expect(() => tree.root.findByProps({ children: "Licenze" })).toThrow();
    // Il patentino ha una sola riga renderizzata, dentro Profilo tecnico.
    expect(countRows(tree, "Patentino, UEFA B")).toBe(1);
    // La disponibilità compare una volta sola in Opportunità, senza una
    // seconda riga che ripeta lo stesso stato.
    expect(countRows(tree, "Disponibile per una nuova squadra")).toBe(1);
  });
});
