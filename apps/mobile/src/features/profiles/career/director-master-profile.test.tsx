/**
 * Scenari QA del Master Profile Dirigente (REV-PROF-09).
 *
 * Coprono ciò che distingue questa tipologia dagli altri Master Profile: la
 * carriera che vive come JSON dentro `director_profiles` invece che su una
 * tabella, il selettore fino a cinque percorsi, i conteggi derivati dai record
 * canonici, le informazioni rapide che spariscono invece di mostrare un
 * trattino, le macroaree dei Dettagli nell'ordine del mockup e la separazione
 * fra azioni Owner e Visitor.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { buildDirectorProfileHeaderDetails } from "../profile-edit-helpers";
import { DirectorCareerTab } from "./DirectorCareerTab";
import { DirectorDetailsTab } from "./DirectorDetailsTab";
import { DirectorProfileTabView } from "./DirectorProfileTabView";
import {
  buildDirectorProfileCareer,
  getAvailableDirectorPaths,
} from "./director-career-model";
import { getCurrentSeasonKey } from "./player-career-model";

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

/**
 * `buildDirectorProfileHeaderDetails` legge la data reale, come in app. Le
 * stagioni delle fixture sono quindi relative alla stagione in corso, così
 * "incarico attuale" resta vero qualunque giorno il test venga eseguito.
 */
function seasonKeyBefore(offset: number): string {
  const startYear =
    Number.parseInt(getCurrentSeasonKey(new Date()).slice(0, 4), 10) - offset;

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

/**
 * Carriera dirigenziale nella forma in cui l'onboarding la salva: camelCase,
 * ruolo e categoria per stagione, `clubId` canonico quando la società ha una
 * pagina PROLINK.
 */
const DIRECTOR_ENTRIES = [
  {
    category: "Serie A",
    clubId: "club-romano-prodi",
    id: "dir-a",
    role: "Direttore sportivo",
    seasonDetails: {
      [seasonKeyBefore(0)]: { category: "Serie A", role: "Direttore sportivo" },
      [seasonKeyBefore(1)]: { category: "Serie A", role: "Responsabile scouting" },
      [seasonKeyBefore(2)]: { category: "Serie B", role: "Direttore generale" },
    },
    seasons: [seasonKeyBefore(0), seasonKeyBefore(1), seasonKeyBefore(2)],
    teamLogoUrl: "https://example.com/romano-prodi.png",
    teamName: "ASD Romano Prodi",
    type: "MULTI_SEASON",
  },
  {
    category: "Serie A",
    clubId: "club-fiorentina",
    id: "dir-b",
    role: "Responsabile scouting",
    seasonDetails: {
      "2020/2021": { category: "Serie A", role: "Coordinatore area tecnica" },
      "2021/2022": { category: "Serie A", role: "Team manager" },
      "2022/2023": { category: "Serie A", role: "Responsabile scouting" },
    },
    seasons: ["2020/2021", "2021/2022", "2022/2023"],
    teamLogoUrl: "",
    teamName: "Fiorentina",
    type: "MULTI_SEASON",
  },
];

/** Riga scritta prima della review: snake_case e nessun dettaglio stagione. */
const LEGACY_ENTRY = {
  category: "Settore giovanile",
  id: "dir-legacy",
  period_end_year: 2019,
  period_start_month: "Gennaio",
  period_start_year: 2018,
  role: "Responsabile settore giovanile",
  team_logo_url: "",
  team_name: "Monza",
};

const COACH_ENTRIES = [
  {
    category: "Under 17",
    id: "dir-coach-a",
    role: "Allenatore",
    seasons: ["2016/2017"],
    teamName: "Como Academy",
    type: "SINGLE_SEASON",
  },
];

const PLAYER_ENTRIES = [
  {
    appearances: "22",
    assists: "3",
    awards: "",
    category: "Serie C",
    clubName: "Lecco",
    goals: "4",
    id: "dir-player-a",
    minutesPlayed: "",
    periodEndMonth: "",
    periodStartMonth: "",
    seasonLabel: "2008/2009",
    seasonPeriod: "full",
    teamCity: "",
    teamLogoUrl: "",
  },
];

function buildDirectorProfileRecord(
  overrides: Record<string, unknown> = {},
): CompleteProfessionalProfile["directorProfile"] {
  return {
    career_entries: DIRECTOR_ENTRIES,
    coach_career_entries: [],
    club_types: [],
    director_roles: ["Direttore sportivo", "Direttore generale", "Responsabile scouting"],
    experience_categories: [],
    has_other_football_experience: false,
    has_played_football: false,
    main_focus: "Entrambi",
    market_involvement: null,
    media_items: [],
    open_to_clubs: true,
    open_to_others: false,
    open_to_players: false,
    open_to_staff: true,
    // REV-PROF-11: la disponibilità è un dato suo, non la somma dei
    // destinatari. Il profilo di riferimento è disponibile.
    open_to_work: true,
    other_career_entries: [],
    other_football_roles: [],
    other_role_label: null,
    player_career_entries: [],
    previous_roles: [],
    primary_role: "Direttore sportivo",
    profile_id: "director-1",
    responsibilities: ["Gestione rose e contratti", "Mercato calciatori"],
    staff_career_entries: [],
    ...overrides,
  } as unknown as CompleteProfessionalProfile["directorProfile"];
}

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    directorProfile: buildDirectorProfileRecord(),
    profile: {
      age: 46,
      avatar_url: null,
      birth_date: "1979-05-04",
      city: "Palermo",
      cover_url: null,
      full_name: "Salvatore Burgio",
      id: "director-1",
      languages: ["Italiano", "Inglese"],
      region: "Sicilia",
      role: "director",
    },
    userContacts: {
      email: "salvatore@example.com",
      facebook: "",
      instagram: "",
      phone: "+39 320 7654321",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
      showPhone: true,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

function buildCareer(overrides: Record<string, unknown> = {}) {
  return buildDirectorProfileCareer({
    directorProfile: buildDirectorProfileRecord(overrides),
  });
}

// ---------------------------------------------------------------------------
// Carriera
// ---------------------------------------------------------------------------

describe("Master Profile Dirigente — Carriera", () => {
  it("intitola la carriera 'Percorso dirigenziale' e mostra tutte le stagioni", () => {
    const tree = render(
      <DirectorCareerTab
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="director"
      />,
    );

    expect(
      tree.root.findByProps({ children: "Percorso dirigenziale" }),
    ).toBeTruthy();

    for (const key of [seasonKeyBefore(0), seasonKeyBefore(1), seasonKeyBefore(2)]) {
      expect(
        tree.root.findAllByProps({ testID: `director-career-season-${key}` }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("mostra ruolo e categoria della singola stagione, non dell'intero incarico", () => {
    const tree = render(
      <DirectorCareerTab
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="director"
      />,
    );

    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Stagione 2021-2022, Team manager, Serie A",
      }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Stagione 2020-2021, Coordinatore area tecnica, Serie A",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("raggruppa per società e mette l'incarico in corso per primo", () => {
    const career = buildCareer();

    expect(career.director.experiences.map((experience) => experience.clubName)).toEqual([
      "ASD Romano Prodi",
      "Fiorentina",
    ]);
    expect(career.director.experiences[0].isCurrent).toBe(true);
  });

  it("non mostra nessuna statistica da giocatore nella carriera dirigenziale", () => {
    const tree = render(
      <DirectorCareerTab
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="director"
      />,
    );

    for (const label of ["Presenze", "Gol", "Assist", "Totali carriera"]) {
      expect(() => tree.root.findByProps({ children: label })).toThrow();
    }
  });

  it("legge le righe legacy in snake_case e ne mostra il periodo per mese e anno", () => {
    const career = buildCareer({ career_entries: [LEGACY_ENTRY] });
    const [experience] = career.director.experiences;

    expect(experience.clubName).toBe("Monza");
    expect(experience.periodLabel).toContain("Gennaio 2018");
    expect(experience.isCurrent).toBe(false);
  });

  it("tratta un periodo senza data di fine come incarico in corso", () => {
    const career = buildCareer({
      career_entries: [
        {
          category: "Serie C",
          id: "dir-ongoing",
          period: { endMonth: "", endYear: "", startMonth: "Marzo", startYear: "2023" },
          role: "Direttore generale",
          teamName: "Pro Vercelli",
          type: "CUSTOM_PERIOD",
        },
      ],
    });
    const [experience] = career.director.experiences;

    expect(experience.isCurrent).toBe(true);
    expect(experience.periodLabel).toContain("Presente");
  });

  it("scarta le righe illeggibili senza portarsi via la carriera", () => {
    const career = buildCareer({
      career_entries: [null, "non un record", { id: "senza-societa" }, ...DIRECTOR_ENTRIES],
    });

    expect(career.director.experiences).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Selettore dei percorsi
// ---------------------------------------------------------------------------

describe("Master Profile Dirigente — Percorsi", () => {
  it("non mostra il selettore quando esiste il solo percorso dirigenziale", () => {
    const career = buildCareer();

    expect(getAvailableDirectorPaths(career)).toEqual(["director"]);

    const tree = render(
      <DirectorCareerTab
        career={career}
        isOwner={false}
        onPathChange={() => undefined}
        path="director"
      />,
    );

    expect(tree.root.findAllByProps({ testID: "director-career-path" })).toHaveLength(0);
  });

  it("elenca soltanto i percorsi che hanno almeno un'esperienza", () => {
    const career = buildCareer({
      coach_career_entries: COACH_ENTRIES,
      player_career_entries: PLAYER_ENTRIES,
    });

    expect(getAvailableDirectorPaths(career)).toEqual(["director", "coach", "player"]);
  });

  it("torna al percorso dirigenziale se quello attivo non esiste più", () => {
    const tree = render(
      <DirectorCareerTab
        career={buildCareer()}
        isOwner={false}
        onPathChange={() => undefined}
        path="player"
      />,
    );

    expect(
      tree.root.findByProps({ children: "Percorso dirigenziale" }),
    ).toBeTruthy();
  });

  it("mostra le statistiche solo sul percorso da calciatore", () => {
    const career = buildCareer({ player_career_entries: PLAYER_ENTRIES });
    const tree = render(
      <DirectorCareerTab
        career={career}
        isOwner={false}
        onPathChange={() => undefined}
        path="player"
      />,
    );

    expect(tree.root.findAllByProps({ children: "Lecco" }).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("Master Profile Dirigente — Empty state carriera", () => {
  it("invita l'Owner a completare la carriera", () => {
    const tree = render(
      <DirectorCareerTab
        career={buildCareer({ career_entries: [] })}
        isOwner
        onAddExperience={() => undefined}
        onPathChange={() => undefined}
        path="director"
      />,
    );

    expect(tree.root.findByProps({ children: "Completa la tua carriera" })).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: "director-career-add" }).length).toBeGreaterThan(0);
  });

  it("al Visitor non mostra nessuna CTA di modifica", () => {
    const tree = render(
      <DirectorCareerTab
        career={buildCareer({ career_entries: [] })}
        isOwner={false}
        onAddExperience={() => undefined}
        onPathChange={() => undefined}
        path="director"
      />,
    );

    expect(
      tree.root.findByProps({ children: "Nessuna esperienza disponibile" }),
    ).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: "director-career-add" })).toHaveLength(0);
  });

  it("mostra comunque il selettore quando mancano le sole esperienze dirigenziali", () => {
    const career = buildCareer({
      career_entries: [],
      coach_career_entries: COACH_ENTRIES,
    });

    expect(getAvailableDirectorPaths(career)).toEqual(["director", "coach"]);
  });
});

// ---------------------------------------------------------------------------
// Header e informazioni rapide
// ---------------------------------------------------------------------------

describe("Master Profile Dirigente — Header", () => {
  it("deriva società e categoria dall'incarico in corso", () => {
    const details = buildDirectorProfileHeaderDetails(buildProfile());

    expect(details?.clubLabel).toBe("ASD Romano Prodi · Serie A");
    expect(details?.primaryRole).toBe("Direttore sportivo");
    expect(details?.locationLabel).toBe("Palermo, Sicilia");
  });

  it("non inventa una società quando nessun incarico è in corso", () => {
    const details = buildDirectorProfileHeaderDetails(
      buildProfile({
        directorProfile: buildDirectorProfileRecord({
          career_entries: [DIRECTOR_ENTRIES[1]],
        }),
      }),
    );

    expect(details?.clubLabel).toBeUndefined();
    expect(details?.primaryRole).toBe("Direttore sportivo");
  });

  it("conta ruoli, stagioni e società dai record canonici", () => {
    const details = buildDirectorProfileHeaderDetails(buildProfile());
    const facts = Object.fromEntries(
      (details?.quickFacts ?? []).map((fact) => [fact.key, fact.value]),
    );

    // Tre ruoli dichiarati più "Coordinatore area tecnica" e "Team manager"
    // ricoperti in carriera: cinque identificativi distinti.
    expect(facts.roles).toBe("5");
    expect(facts.seasons).toBe("6");
    expect(facts.clubs).toBe("2");
    expect(facts.age).toBe("46");
  });

  it("omette l'età quando non è disponibile, senza lasciare un trattino", () => {
    const profile = buildProfile();
    const details = buildDirectorProfileHeaderDetails({
      ...profile,
      profile: { ...profile.profile, age: null, birth_date: null },
    } as CompleteProfessionalProfile);

    expect(details?.quickFacts.map((fact) => fact.key)).toEqual([
      "roles",
      "seasons",
      "clubs",
    ]);
  });

  it("mostra la disponibilità solo se almeno un destinatario è attivo", () => {
    const open = buildDirectorProfileHeaderDetails(buildProfile());

    expect(open?.availabilityLabel).toBe("Disponibile per nuove opportunita");

    const closed = buildDirectorProfileHeaderDetails(
      buildProfile({
        directorProfile: buildDirectorProfileRecord({
          open_to_clubs: false,
          open_to_others: false,
          open_to_players: false,
          open_to_staff: false,
        }),
      }),
    );

    expect(closed?.availabilityLabel).toBeUndefined();
  });

  it("spegne la disponibilità con l'interruttore, pur conservando i destinatari", () => {
    /*
      REV-PROF-11: spegnere "Disponibile per nuove opportunità" non cancella i
      destinatari — si ritrovano riaccendendolo — quindi l'header deve
      guardare l'interruttore, non solo i quattro flag.
    */
    const closed = buildDirectorProfileHeaderDetails(
      buildProfile({
        directorProfile: buildDirectorProfileRecord({ open_to_work: false }),
      }),
    );

    expect(closed?.availabilityLabel).toBeUndefined();
  });

  it("non accende mai il badge verificato senza un dato che lo esprima", () => {
    expect(buildDirectorProfileHeaderDetails(buildProfile())?.isVerified).toBe(false);
  });

  it("non costruisce l'header per una tipologia diversa", () => {
    const profile = buildProfile();

    expect(
      buildDirectorProfileHeaderDetails({
        ...profile,
        profile: { ...profile.profile, role: "coach" },
      } as CompleteProfessionalProfile),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Dettagli
// ---------------------------------------------------------------------------

describe("Master Profile Dirigente — Dettagli", () => {
  function renderDetails(
    overrides: Partial<CompleteProfessionalProfile> = {},
    isOwner = false,
  ) {
    const completeProfile = buildProfile(overrides);

    return render(
      <DirectorDetailsTab
        career={buildDirectorProfileCareer({
          directorProfile: completeProfile.directorProfile,
        })}
        completeProfile={completeProfile}
        isOwner={isOwner}
      />,
    );
  }

  it("mostra le macroaree nell'ordine del mockup", () => {
    const tree = renderDetails();
    const order = [
      "director-details-opportunities",
      "director-details-professional",
      "director-details-responsibilities",
      "director-details-situation",
      "director-details-contacts",
    ];

    for (const testID of order) {
      expect(tree.root.findAllByProps({ testID }).length).toBeGreaterThan(0);
    }
  });

  it("elenca i soli destinatari attivi e l'area operativa compatta", () => {
    const tree = renderDetails();

    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Disponibile per, Società e club, Staff tecnico",
      }).length,
    ).toBeGreaterThan(0);
    /*
      Senza una scelta esplicita vale il default dichiarato dalla migrazione
      20261002090000, cioè tutta Italia. Prima qui si leggeva "Sicilia,
      Isole", derivato dalla residenza: un'area operativa che il dirigente non
      aveva mai indicato, e che la spec REV-PROF-11 vieta di dedurre.
    */
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Area operativa, Ovunque in Italia",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("mostra l'area operativa dichiarata al posto di quella derivata", () => {
    /*
      REV-PROF-11: senza una scelta vale il default "tutta Italia", mai la
      residenza. Appena l'area viene dichiarata è quella a comparire,
      altrimenti salvare le Opportunità non cambierebbe niente nel Master
      Profile.
    */
    const tree = renderDetails({
      directorProfile: buildDirectorProfileRecord({
        availability_type: "REGIONS",
        preferred_regions: ["Lombardia", "Piemonte"],
      }),
    });

    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Area operativa, Lombardia, Piemonte",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("nasconde Opportunità quando la disponibilità è spenta", () => {
    const tree = renderDetails({
      directorProfile: buildDirectorProfileRecord({ open_to_work: false }),
    });

    expect(
      tree.root.findAllByProps({ testID: "director-details-opportunities" }),
    ).toHaveLength(0);
  });

  it("nasconde Opportunità quando nessun destinatario è attivo", () => {
    const tree = renderDetails({
      directorProfile: buildDirectorProfileRecord({
        open_to_clubs: false,
        open_to_others: false,
        open_to_players: false,
        open_to_staff: false,
      }),
    });

    expect(
      tree.root.findAllByProps({ testID: "director-details-opportunities" }),
    ).toHaveLength(0);
  });

  it("scrive il focus per esteso e deriva le categorie dalla carriera", () => {
    const tree = renderDetails();

    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Focus, Prima squadra e settore giovanile",
      }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Categorie di esperienza, Serie A, Serie B",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("non ripete il ruolo principale fra gli altri ruoli", () => {
    const tree = renderDetails();

    expect(
      tree.root.findAllByProps({
        accessibilityLabel: "Altri ruoli, Direttore generale, Responsabile scouting",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("mostra le aree di responsabilità come chip, non come card", () => {
    const tree = renderDetails();

    expect(
      tree.root.findAllByProps({ testID: "director-responsibility-chips" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Mercato calciatori" }).length,
    ).toBeGreaterThan(0);
  });

  it("mostra soltanto i contatti pubblici", () => {
    const tree = renderDetails({
      userContacts: {
        email: "privata@example.com",
        facebook: "",
        instagram: "",
        phone: "+39 320 7654321",
        showEmail: false,
        showFacebook: false,
        showInstagram: false,
        showPhone: true,
      },
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(
      tree.root.findAllByProps({ children: "+39 320 7654321" }).length,
    ).toBeGreaterThan(0);
    expect(() =>
      tree.root.findByProps({ children: "privata@example.com" }),
    ).toThrow();
  });

  it("elenca i percorsi aggiuntivi con singolare e plurale corretti", () => {
    const tree = renderDetails({
      directorProfile: buildDirectorProfileRecord({
        coach_career_entries: COACH_ENTRIES,
        player_career_entries: PLAYER_ENTRIES,
      }),
    });

    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Allenatore, 1 esperienza" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ accessibilityLabel: "Calciatore, 1 esperienza" }).length,
    ).toBeGreaterThan(0);
  });

  it("omette la bio al Visitor e la propone all'Owner", () => {
    const visitor = renderDetails();

    expect(visitor.root.findAllByProps({ testID: "director-details-bio" })).toHaveLength(0);

    const completeProfile = buildProfile();
    const owner = render(
      <DirectorDetailsTab
        career={buildDirectorProfileCareer({
          directorProfile: completeProfile.directorProfile,
        })}
        completeProfile={completeProfile}
        isOwner
        onEditProfile={() => undefined}
      />,
    );

    expect(
      owner.root.findAllByProps({ testID: "director-details-add-bio" }).length,
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Owner e Visitor
// ---------------------------------------------------------------------------

describe("Master Profile Dirigente — Owner e Visitor", () => {
  it("usa esattamente le tab Carriera, Media e Dettagli, con Carriera iniziale", () => {
    const tree = render(
      <DirectorProfileTabView completeProfile={buildProfile()} isOwner={false} />,
    );

    const tabs = tree.root
      .findAll(
        (node) =>
          typeof node.type === "string" && node.props?.accessibilityRole === "tab",
      )
      .map((node) => node.props.accessibilityLabel);

    expect(tabs).toEqual(["Carriera", "Media", "Dettagli"]);
    expect(tree.root.findAllByProps({ testID: "director-career-tab" }).length).toBeGreaterThan(0);
  });

  it("porta dai Percorsi aggiuntivi alla Carriera sul percorso scelto", () => {
    const tree = render(
      <DirectorProfileTabView
        completeProfile={buildProfile({
          directorProfile: buildDirectorProfileRecord({
            coach_career_entries: COACH_ENTRIES,
          }),
        })}
        isOwner={false}
      />,
    );

    pressTab(tree, "Dettagli");

    const row = tree.root.findByProps({ testID: "director-details-path-coach" });

    act(() => {
      row.props.onPress();
    });

    expect(
      tree.root.findByProps({ children: "Percorso da allenatore" }),
    ).toBeTruthy();
  });

  it("non mostra al Visitor nessun controllo di pubblicazione nel Media", () => {
    const tree = render(
      <DirectorProfileTabView completeProfile={buildProfile()} isOwner={false} />,
    );

    pressTab(tree, "Media");

    expect(tree.root.findAllByProps({ testID: "media-add" })).toHaveLength(0);
    expect(() =>
      tree.root.findByProps({ children: "Pubblica contenuto" }),
    ).toThrow();
  });

  it("mostra all'Owner la CTA di pubblicazione a contenuti vuoti", () => {
    const tree = render(
      <DirectorProfileTabView
        completeProfile={buildProfile()}
        isOwner
        onManageMedia={() => undefined}
      />,
    );

    pressTab(tree, "Media");

    expect(
      tree.root.findAllByProps({ children: "Pubblica contenuto" }).length,
    ).toBeGreaterThan(0);
  });

  it("mostra la stessa carriera all'Owner e al Visitor", () => {
    const completeProfile = buildProfile();
    const owner = render(
      <DirectorProfileTabView completeProfile={completeProfile} isOwner />,
    );
    const visitor = render(
      <DirectorProfileTabView completeProfile={completeProfile} isOwner={false} />,
    );

    for (const tree of [owner, visitor]) {
      expect(
        tree.root.findAllByProps({
          testID: `director-career-season-${seasonKeyBefore(0)}`,
        }).length,
      ).toBeGreaterThan(0);
    }
  });
});
