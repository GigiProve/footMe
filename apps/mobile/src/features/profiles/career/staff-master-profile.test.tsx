/**
 * Scenari QA del Master Profile Staff tecnico (REV-PROF-06).
 *
 * Coprono ciò che distingue questa tipologia dagli altri Master Profile: il
 * selettore a tre percorsi, la carriera con ruolo e categoria per singola
 * stagione e senza statistiche, i conteggi derivati dai record canonici, le
 * macroaree dei Dettagli nell'ordine del mockup e la privacy dei contatti.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type {
  CompleteProfessionalProfile,
  StaffCareerEntryRecord,
  StaffPlayerCareerEntryRecord,
} from "../profile-service";
import { buildStaffProfileHeaderDetails } from "../profile-edit-helpers";
import { getCurrentSeasonKey } from "./player-career-model";
import { StaffProfileHeader } from "../profile-screen-components";
import { StaffCareerTab } from "./StaffCareerTab";
import { StaffProfileTabView } from "./StaffProfileTabView";
import { StaffDetailsTab } from "./StaffDetailsTab";
import { buildStaffProfileCareer } from "./staff-career-model";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

vi.mock("../../../components/ui/video-player-modal", () => ({
  VideoPlayerModal: (props: Record<string, unknown>) =>
    React.createElement("mock-video-player-modal", props),
}));

vi.mock("../../content/use-tagged-content", () => ({
  useTaggedMediaItems: () => ({ onOpenTaggedItem: () => undefined, taggedItems: [] }),
}));

const NOW = new Date("2025-03-01T00:00:00.000Z");

/**
 * `buildStaffProfileHeaderDetails` legge la data reale, come in app. Le
 * stagioni delle sue fixture sono quindi relative alla stagione in corso, così
 * "incarico attuale" resta vero qualunque giorno il test venga eseguito.
 */
function seasonKeyBefore(offset: number): string {
  const startYear = Number.parseInt(getCurrentSeasonKey(new Date()).slice(0, 4), 10) - offset;

  return `${startYear}/${startYear + 1}`;
}

/** Le tab del design system sono nodi host con `accessibilityRole="tab"`. */
function pressTab(tree: TestRenderer.ReactTestRenderer, label: string) {
  const tab = tree.root.find(
    (node) =>
      typeof node.type === "string" &&
      node.props?.accessibilityRole === "tab" &&
      node.props?.accessibilityLabel === label,
  );

  act(() => {
    tab.props.onPress();
  });
}

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

function staffEntry(
  overrides: Partial<StaffCareerEntryRecord> & Pick<StaffCareerEntryRecord, "id">,
): StaffCareerEntryRecord {
  return {
    category: "Serie A",
    club_id: null,
    description: null,
    experience_group_id: null,
    experience_type: "MULTI_SEASON",
    head_coach_name: null,
    period_end_month: null,
    period_end_year: null,
    period_start_month: null,
    period_start_year: null,
    results: [],
    role: "Preparatore atletico",
    season_details: {},
    seasons: [],
    sort_order: 0,
    staff_profile_id: "staff-1",
    team_logo_url: null,
    team_name: "AC Milan",
    ...overrides,
  };
}

/**
 * Tre stagioni al Milan con un cambio di ruolo, tre alla Juventus. Le due
 * società hanno un `club_id` canonico distinto: è quella la chiave dei
 * conteggi, non il nome.
 */
const STAFF_ENTRIES: StaffCareerEntryRecord[] = [
  staffEntry({
    club_id: "club-milan",
    id: "staff-a",
    season_details: {
      "2022/2023": { category: "Serie A", role: "Match analyst" },
      "2023/2024": { category: "Serie A", role: "Preparatore atletico" },
      "2024/2025": { category: "Serie A", role: "Preparatore atletico" },
    },
    seasons: ["2022/2023", "2023/2024", "2024/2025"],
    team_name: "AC Milan",
  }),
  staffEntry({
    category: "Primavera",
    club_id: "club-juve",
    id: "staff-b",
    role: "Match analyst",
    season_details: {
      "2019/2020": { category: "Primavera", role: "Match analyst" },
      "2020/2021": { category: "Serie A", role: "Collaboratore tecnico" },
      "2021/2022": { category: "Serie A", role: "Match analyst" },
    },
    seasons: ["2019/2020", "2020/2021", "2021/2022"],
    team_name: "Juventus",
  }),
];

const COACH_ENTRIES: StaffCareerEntryRecord[] = [
  staffEntry({
    category: "Juniores",
    id: "coach-a",
    role: "Allenatore",
    seasons: ["2017/2018"],
    staff_profile_id: "staff-1",
    team_name: "Pro Vercelli",
  }),
];

const PLAYER_ENTRIES: StaffPlayerCareerEntryRecord[] = [
  {
    appearances: 24,
    assists: 3,
    awards: null,
    career_type: null,
    category: "Serie C",
    experience_group_id: null,
    goals: 5,
    id: "pl-1",
    minutes_played: null,
    period_end_month: null,
    period_start_month: null,
    position: "Centrocampista",
    season: "2010/2011",
    season_period: "full",
    sort_order: 0,
    staff_profile_id: "staff-1",
    team_logo_url: null,
    team_name: "Como",
  },
  {
    appearances: 18,
    assists: 1,
    awards: null,
    career_type: null,
    category: "Serie D",
    experience_group_id: null,
    goals: 2,
    id: "pl-2",
    minutes_played: null,
    period_end_month: null,
    period_start_month: null,
    position: "Centrocampista",
    season: "2011/2012",
    season_period: "full",
    sort_order: 1,
    staff_profile_id: "staff-1",
    team_logo_url: null,
    team_name: "Lecco",
  },
];

function buildCareer(
  overrides: Parameters<typeof buildStaffProfileCareer>[0] = {},
) {
  return buildStaffProfileCareer({ now: NOW, staffEntries: STAFF_ENTRIES, ...overrides });
}

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    profile: {
      age: 31,
      birth_date: "1994-02-10",
      city: "Milano",
      full_name: "Marco Rossi",
      id: "staff-1",
      region: "Lombardia",
      role: "staff",
    },
    staffCareerEntries: STAFF_ENTRIES,
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: {
      availability_type: "REGIONS",
      available_from: null,
      certifications: [],
      experience_entries: [],
      experience_summary: null,
      media_items: [],
      open_to_work: true,
      preferred_categories: [],
      preferred_provinces: [],
      preferred_regions: ["lombardia", "piemonte"],
      primary_staff_role: "Preparatore atletico",
      profile_id: "staff-1",
      specialization: "fitness_coach",
      staff_roles: ["Preparatore atletico", "Match analyst"],
    },
    userContacts: {
      email: "marco@example.com",
      facebook: "",
      instagram: "marcorossi.performance",
      phone: "+39 320 1234567",
      showEmail: true,
      showFacebook: false,
      showInstagram: true,
      showPhone: true,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

describe("Master Profile Staff tecnico — Carriera", () => {
  it("intitola la carriera 'Percorso nello staff tecnico' e mostra tutte le stagioni", () => {
    const tree = render(
      <StaffCareerTab
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="staff"
        playerCareerEntries={[]}
      />,
    );

    expect(
      tree.root.findByProps({ children: "Percorso nello staff tecnico" }),
    ).toBeTruthy();

    for (const key of ["2024/2025", "2023/2024", "2022/2023", "2019/2020"]) {
      expect(
        tree.root.findAllByProps({ testID: `staff-career-season-${key}` }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("mostra ruolo e categoria della singola stagione, non dell'intero incarico", () => {
    const tree = render(
      <StaffCareerTab
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="staff"
        playerCareerEntries={[]}
      />,
    );

    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Stagione 2022-2023, Match analyst, Serie A",
      }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Stagione 2020-2021, Collaboratore tecnico, Serie A",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("non mostra nessuna statistica nella carriera nello staff tecnico", () => {
    const tree = render(
      <StaffCareerTab
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="staff"
        playerCareerEntries={[]}
      />,
    );

    for (const label of ["Presenze", "Gol", "Assist", "Totali carriera"]) {
      expect(() => tree.root.findByProps({ children: label })).toThrow();
    }
  });

  it("omette il selettore quando esiste solo la carriera nello staff", () => {
    const tree = render(
      <StaffCareerTab
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="staff"
        playerCareerEntries={[]}
      />,
    );

    expect(() => tree.root.findByProps({ testID: "staff-career-path" })).toThrow();
  });

  it("mostra i soli percorsi esistenti, con Staff tecnico preselezionato", () => {
    const tree = render(
      <StaffCareerTab
        career={buildCareer({ coachEntries: COACH_ENTRIES })}
        isOwner={false}
        onPathChange={() => undefined}
        path="staff"
        playerCareerEntries={[]}
      />,
    );

    expect(
      tree.root.findByProps({ testID: "staff-career-path-staff" }).props
        .accessibilityState.selected,
    ).toBe(true);
    expect(
      tree.root.findByProps({ testID: "staff-career-path-coach" }),
    ).toBeTruthy();
    // Nessuna esperienza da calciatore: il terzo percorso non esiste.
    expect(() =>
      tree.root.findByProps({ testID: "staff-career-path-player" }),
    ).toThrow();
  });

  it("mostra le statistiche solo nel percorso da calciatore", () => {
    const tree = render(
      <StaffCareerTab
        career={buildCareer({ playerEntries: PLAYER_ENTRIES })}
        isOwner={false}
        onPathChange={() => undefined}
        path="player"
        playerCareerEntries={PLAYER_ENTRIES}
      />,
    );

    expect(
      tree.root.findByProps({ children: "Percorso da calciatore" }),
    ).toBeTruthy();
    expect(
      tree.root.findAllByProps({ children: "Presenze" }).length,
    ).toBeGreaterThan(0);
  });

  it("all'Owner offre l'empty state con la CTA della carriera canonica", () => {
    const onAddExperience = vi.fn();
    const tree = render(
      <StaffCareerTab
        career={buildCareer({ staffEntries: [] })}
        isOwner
        onAddExperience={onAddExperience}
        onPathChange={() => undefined}
        path="staff"
        playerCareerEntries={[]}
      />,
    );

    expect(tree.root.findByProps({ children: "Aggiungi il tuo percorso" })).toBeTruthy();
    expect(
      tree.root.findByProps({
        children: "Racconta le esperienze maturate nello staff tecnico.",
      }),
    ).toBeTruthy();

    act(() => {
      tree.root.findByProps({ label: "Aggiungi esperienza" }).props.onPress();
    });

    expect(onAddExperience).toHaveBeenCalledTimes(1);
  });

  it("al Visitor mostra l'empty state senza nessuna CTA di modifica", () => {
    const tree = render(
      <StaffCareerTab
        career={buildCareer({ staffEntries: [] })}
        isOwner={false}
        onPathChange={() => undefined}
        path="staff"
        playerCareerEntries={[]}
      />,
    );

    expect(
      tree.root.findByProps({ children: "Carriera non ancora disponibile" }),
    ).toBeTruthy();
    expect(() =>
      tree.root.findByProps({ label: "Aggiungi esperienza" }),
    ).toThrow();
  });
});

describe("Master Profile Staff tecnico — Dettagli", () => {
  it("mostra le macroaree nell'ordine del mockup", () => {
    const tree = render(
      <StaffDetailsTab
        career={buildCareer({ coachEntries: COACH_ENTRIES, playerEntries: PLAYER_ENTRIES })}
        completeProfile={buildProfile()}
      />,
    );

    const rendered = tree.root
      .findAll(
        (node) =>
          typeof node.type === "string" &&
          typeof node.props.testID === "string" &&
          node.props.testID.startsWith("staff-details-") &&
          !node.props.testID.startsWith("staff-details-path-") &&
          node.props.testID !== "staff-details-current-club" &&
          node.props.testID !== "staff-details-tab",
      )
      .map((node) => node.props.testID as string);

    expect(rendered).toEqual([
      "staff-details-opportunities",
      "staff-details-professional",
      "staff-details-situation",
      "staff-details-additional-paths",
      "staff-details-contacts",
    ]);
  });

  it("espone le quattro info rapide nell'ordine del mockup", () => {
    const facts =
      buildStaffProfileHeaderDetails(buildProfile())?.quickFacts.map(
        (fact) => fact.label,
      ) ?? [];

    expect(facts).toEqual(["Eta", "Ruoli", "Stagioni", "Club"]);
  });

  it("non aggiunge informazioni dell'Allenatore o del Calciatore", () => {
    const tree = render(
      <StaffDetailsTab
        career={buildCareer()}
        completeProfile={buildProfile()}
      />,
    );

    for (const title of [
      "Patentino",
      "Modulo preferito",
      "Filosofia di gioco",
      "Palmarès",
    ]) {
      expect(() => tree.root.findByProps({ children: title })).toThrow();
    }
  });

  it("separa ruolo principale e altri ruoli e deduce le categorie dalla carriera", () => {
    const tree = render(
      <StaffDetailsTab
        career={buildCareer()}
        completeProfile={buildProfile()}
      />,
    );

    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Ruolo principale, Preparatore atletico",
      }).length,
    ).toBeGreaterThan(0);
    // "Altri ruoli" non ripete il principale.
    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Altri ruoli, Match analyst" })
        .length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Categorie di esperienza, Serie A, Primavera",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("nasconde l'intera sezione Opportunità quando la disponibilità è spenta", () => {
    const profile = buildProfile();
    const tree = render(
      <StaffDetailsTab
        career={buildCareer()}
        completeProfile={{
          ...profile,
          staffProfile: { ...profile.staffProfile!, open_to_work: false },
        }}
      />,
    );

    expect(() =>
      tree.root.findByProps({ testID: "staff-details-opportunities" }),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({ children: "Non disponibile" }),
    ).toThrow();
  });

  it("omette Situazione attuale quando nessun incarico è in corso", () => {
    const tree = render(
      <StaffDetailsTab
        career={buildCareer({
          staffEntries: [staffEntry({ id: "old", seasons: ["2018/2019"] })],
        })}
        completeProfile={buildProfile()}
      />,
    );

    expect(() =>
      tree.root.findByProps({ testID: "staff-details-situation" }),
    ).toThrow();
  });

  it("rende la società attuale interattiva solo se ha una pagina PROLINK", () => {
    const withoutClubPage = render(
      <StaffDetailsTab
        career={buildCareer({
          staffEntries: [
            staffEntry({ club_id: null, id: "staff-a", seasons: ["2024/2025"] }),
          ],
        })}
        completeProfile={buildProfile()}
        onOpenClub={() => undefined}
      />,
    );

    expect(
      withoutClubPage.root.findByProps({ testID: "staff-details-current-club" }).props
        .accessibilityRole,
    ).toBeUndefined();

    const onOpenClub = vi.fn();
    const withClubPage = render(
      <StaffDetailsTab
        career={buildCareer()}
        completeProfile={buildProfile()}
        onOpenClub={onOpenClub}
      />,
    );

    act(() => {
      withClubPage.root
        .findByProps({ testID: "staff-details-current-club" })
        .props.onPress();
    });

    expect(onOpenClub).toHaveBeenCalledWith("club-milan");
  });

  it("mostra solo i percorsi aggiuntivi esistenti e li apre nella tab Carriera", () => {
    const onOpenCareerPath = vi.fn();
    const tree = render(
      <StaffDetailsTab
        career={buildCareer({ coachEntries: COACH_ENTRIES })}
        completeProfile={buildProfile()}
        onOpenCareerPath={onOpenCareerPath}
      />,
    );

    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Allenatore, 1 esperienza" })
        .length,
    ).toBeGreaterThan(0);
    // Nessuna riga a conteggio zero.
    expect(() =>
      tree.root.findByProps({ testID: "staff-details-path-player" }),
    ).toThrow();

    act(() => {
      tree.root.findByProps({ testID: "staff-details-path-coach" }).props.onPress();
    });

    expect(onOpenCareerPath).toHaveBeenCalledWith("coach");
  });

  it("nasconde del tutto la sezione quando non esiste nessun percorso aggiuntivo", () => {
    const tree = render(
      <StaffDetailsTab career={buildCareer()} completeProfile={buildProfile()} />,
    );

    expect(() =>
      tree.root.findByProps({ testID: "staff-details-additional-paths" }),
    ).toThrow();
  });

  it("non espone al Visitor i contatti che non sono pubblici", () => {
    const profile = buildProfile();
    const tree = render(
      <StaffDetailsTab
        career={buildCareer()}
        completeProfile={{
          ...profile,
          userContacts: {
            ...profile.userContacts,
            showEmail: false,
            showInstagram: false,
            showPhone: false,
          },
        }}
      />,
    );

    expect(() =>
      tree.root.findByProps({ testID: "staff-details-contacts" }),
    ).toThrow();
    for (const value of [
      "marco@example.com",
      "+39 320 1234567",
      "@marcorossi.performance",
    ]) {
      expect(() => tree.root.findByProps({ children: value })).toThrow();
    }
  });
});

describe("Master Profile Staff tecnico — Header e info rapide", () => {
  const CURRENT_STAFF_ENTRIES: StaffCareerEntryRecord[] = [
    staffEntry({
      club_id: "club-milan",
      id: "staff-a",
      seasons: [seasonKeyBefore(2), seasonKeyBefore(1), seasonKeyBefore(0)],
      team_name: "AC Milan",
    }),
    staffEntry({
      category: "Primavera",
      club_id: "club-juve",
      id: "staff-b",
      role: "Match analyst",
      seasons: [seasonKeyBefore(5), seasonKeyBefore(4), seasonKeyBefore(3)],
      team_name: "Juventus",
    }),
  ];

  function buildCurrentProfile(
    overrides: Partial<CompleteProfessionalProfile> = {},
  ): CompleteProfessionalProfile {
    return buildProfile({ staffCareerEntries: CURRENT_STAFF_ENTRIES, ...overrides });
  }

  it("tiene il ruolo principale dichiarato, non quello dell'ultimo incarico", () => {
    const details = buildStaffProfileHeaderDetails(
      buildCurrentProfile({
        staffProfile: {
          ...buildCurrentProfile().staffProfile!,
          primary_staff_role: "Match analyst",
        },
      }),
    );

    // L'incarico in corso è da "Preparatore atletico": non sostituisce il
    // posizionamento scelto dall'utente.
    expect(details?.primaryRole).toBe("Match analyst");
  });

  it("deriva società e categoria attuali dalla carriera", () => {
    expect(buildStaffProfileHeaderDetails(buildCurrentProfile())?.clubLabel).toBe(
      "AC Milan · Serie A",
    );
  });

  it("omette la riga società quando nessun incarico è in corso", () => {
    const details = buildStaffProfileHeaderDetails(
      buildCurrentProfile({
        staffCareerEntries: [staffEntry({ id: "old", seasons: ["2018/2019"] })],
      }),
    );

    expect(details?.clubLabel).toBeUndefined();
    expect(details?.primaryRole).toBe("Preparatore atletico");
  });

  it("nasconde la disponibilità quando è spenta", () => {
    const profile = buildCurrentProfile();

    expect(buildStaffProfileHeaderDetails(profile)?.availabilityLabel).toBe(
      "Disponibile per nuove collaborazioni",
    );
    expect(
      buildStaffProfileHeaderDetails({
        ...profile,
        staffProfile: { ...profile.staffProfile!, open_to_work: false },
      })?.availabilityLabel,
    ).toBeUndefined();
  });

  it("conta ruoli, stagioni e società senza duplicati", () => {
    const facts = buildStaffProfileHeaderDetails(buildCurrentProfile())?.quickFacts ?? [];
    const valueOf = (key: string) =>
      facts.find((fact) => fact.key === key)?.value;

    expect(valueOf("age")).toBe("31");
    // Due ruoli dichiarati, anche se la carriera ne attraversa tre.
    expect(valueOf("roles")).toBe("2");
    // Sei stagioni distinte fra i due incarichi.
    expect(valueOf("seasons")).toBe("6");
    expect(valueOf("clubs")).toBe("2");
  });

  it("non conta due volte la stessa stagione con incarichi simultanei", () => {
    const details = buildStaffProfileHeaderDetails(
      buildCurrentProfile({
        staffCareerEntries: [
          staffEntry({
            club_id: "club-milan",
            id: "a",
            seasons: [seasonKeyBefore(0)],
          }),
          staffEntry({
            club_id: "club-milan-u19",
            id: "b",
            seasons: [seasonKeyBefore(0)],
            team_name: "AC Milan U19",
          }),
        ],
      }),
    );
    const valueOf = (key: string) =>
      details?.quickFacts.find((fact) => fact.key === key)?.value;

    expect(valueOf("seasons")).toBe("1");
    expect(valueOf("clubs")).toBe("2");
  });
});

describe("Master Profile Staff tecnico — Owner e Visitor", () => {
  const HEADER_PROPS = {
    avatarUrl: null,
    clubLabel: "AC Milan · Serie A",
    fullName: "Marco Rossi",
    locationLabel: "Milano, Italia",
    primaryRole: "Preparatore atletico",
    quickFacts: [],
  };

  it("all'Owner mostra solo le azioni del proprietario", () => {
    const tree = render(
      <StaffProfileHeader
        {...HEADER_PROPS}
        mode="owner"
        onEditProfilePress={() => undefined}
        onMorePress={() => undefined}
        onSharePress={() => undefined}
      />,
    );

    expect(tree.root.findByProps({ label: "Modifica profilo" })).toBeTruthy();
    expect(
      tree.root.findByProps({ accessibilityLabel: "Condividi profilo" }),
    ).toBeTruthy();
    for (const label of ["Segui", "Seguito", "Messaggio"]) {
      expect(() => tree.root.findByProps({ label })).toThrow();
    }
  });

  it("al Visitor mostra solo le azioni del visitatore", () => {
    const tree = render(
      <StaffProfileHeader
        {...HEADER_PROPS}
        mode="visitor"
        onFollowPress={() => undefined}
        onMessagePress={() => undefined}
        onMorePress={() => undefined}
        onSharePress={() => undefined}
      />,
    );

    expect(tree.root.findByProps({ label: "Segui" })).toBeTruthy();
    expect(tree.root.findByProps({ label: "Messaggio" })).toBeTruthy();
    expect(() => tree.root.findByProps({ label: "Modifica profilo" })).toThrow();
  });

  it("riusa l'header condiviso invece di un header dedicato", () => {
    const tree = render(<StaffProfileHeader {...HEADER_PROPS} mode="visitor" />);

    expect(tree.root.findByProps({ testID: "staff-profile-header" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "staff-quick-facts" })).toBeTruthy();
  });

  it("espone esattamente le tab Carriera, Media e Dettagli", () => {
    const tree = render(
      <StaffProfileTabView
        completeProfile={buildProfile()}
        isOwner={false}
        onManageMedia={() => undefined}
      />,
    );

    for (const label of ["Carriera", "Media", "Dettagli"]) {
      expect(tree.root.findAllByProps({ children: label }).length).toBeGreaterThan(0);
    }
    // La tab "Profilo" non esiste in nessun Master Profile.
    expect(() => tree.root.findByProps({ children: "Profilo" })).toThrow();
  });

  it("mostra la CTA di aggiunta Media al solo Owner", () => {
    const ownerTree = render(
      <StaffProfileTabView
        completeProfile={buildProfile()}
        isOwner
        onManageMedia={() => undefined}
      />,
    );
    const visitorTree = render(
      <StaffProfileTabView
        completeProfile={buildProfile()}
        isOwner={false}
        onManageMedia={() => undefined}
      />,
    );

    for (const tree of [ownerTree, visitorTree]) {
      pressTab(tree, "Media");
    }

    expect(
      ownerTree.root.findAllByProps({ accessibilityLabel: "Aggiungi contenuto" })
        .length,
    ).toBeGreaterThan(0);
    expect(() =>
      visitorTree.root.findByProps({ accessibilityLabel: "Aggiungi contenuto" }),
    ).toThrow();
  });

  it("dai Dettagli apre la Carriera sul percorso scelto, nello stesso profilo", () => {
    const tree = render(
      <StaffProfileTabView
        completeProfile={buildProfile({ staffCoachCareerEntries: COACH_ENTRIES })}
        isOwner={false}
        onManageMedia={() => undefined}
      />,
    );

    pressTab(tree, "Dettagli");
    act(() => {
      tree.root.findByProps({ testID: "staff-details-path-coach" }).props.onPress();
    });

    expect(tree.root.findByProps({ children: "Percorso da allenatore" })).toBeTruthy();
    expect(
      tree.root.findByProps({ testID: "staff-career-path-coach" }).props
        .accessibilityState.selected,
    ).toBe(true);
  });
});
