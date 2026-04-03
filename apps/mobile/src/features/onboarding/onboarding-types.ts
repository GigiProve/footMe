export type AppRole =
  | "admin"
  | "player"
  | "coach"
  | "staff"
  | "club_admin"
  | "agent"
  | "director"
  | "fan"
  | "media";

export type ProfileGender =
  | "male"
  | "female"
  | "non_binary"
  | "prefer_not_to_say";

export type StaffSpecialization =
  | "fitness_coach"
  | "goalkeeper_coach"
  | "physiotherapist"
  | "match_analyst"
  | "team_manager"
  | "other";

export type StaffRole =
  | "Preparatore atletico"
  | "Match analyst"
  | "Collaboratore tecnico"
  | "Preparatore dei portieri"
  | "Fisioterapista"
  | "Team manager";

export const STAFF_ROLE_OPTIONS: { label: string; value: StaffRole }[] = [
  { label: "Preparatore atletico", value: "Preparatore atletico" },
  { label: "Match analyst", value: "Match analyst" },
  { label: "Collaboratore tecnico", value: "Collaboratore tecnico" },
  { label: "Preparatore dei portieri", value: "Preparatore dei portieri" },
  { label: "Fisioterapista", value: "Fisioterapista" },
  { label: "Team manager", value: "Team manager" },
];

export function mapStaffRoleToSpecialization(
  role: StaffRole | string | null | undefined,
): StaffSpecialization {
  switch (role) {
    case "Preparatore atletico":
      return "fitness_coach";
    case "Preparatore dei portieri":
      return "goalkeeper_coach";
    case "Fisioterapista":
      return "physiotherapist";
    case "Match analyst":
      return "match_analyst";
    case "Team manager":
      return "team_manager";
    default:
      return "other";
  }
}

// Director-specific types
export type DirectorRole =
  | "Direttore sportivo"
  | "Direttore generale"
  | "Team manager"
  | "Responsabile scouting"
  | "Responsabile settore giovanile"
  | "Direttore tecnico"
  | "Segretario generale"
  | "Altro";

export const DIRECTOR_ROLE_OPTIONS: { label: string; value: DirectorRole }[] = [
  { label: "Direttore sportivo", value: "Direttore sportivo" },
  { label: "Direttore generale", value: "Direttore generale" },
  { label: "Team manager", value: "Team manager" },
  { label: "Responsabile scouting", value: "Responsabile scouting" },
  { label: "Responsabile settore giovanile", value: "Responsabile settore giovanile" },
  { label: "Direttore tecnico", value: "Direttore tecnico" },
  { label: "Segretario generale", value: "Segretario generale" },
  { label: "Altro", value: "Altro" },
];

export const DIRECTOR_RESPONSIBILITY_OPTIONS = [
  "Gestione rose e contratti",
  "Mercato calciatori",
  "Scouting e osservazione",
  "Gestione allenatori e staff",
  "Relazioni con la federazione",
  "Settore giovanile",
  "Budget e finanze",
  "Comunicazione e sponsor",
  "Organizzazione logistica",
  "Altro",
] as const;

export const DIRECTOR_CATEGORY_OPTIONS = [
  "Serie A",
  "Serie B",
  "Serie C",
  "Serie D",
  "Eccellenza",
  "Promozione",
  "Prima Categoria",
  "Settore giovanile",
  "Calcio femminile",
  "Calcio internazionale",
] as const;

export type DirectorFocus = "Prima squadra" | "Settore giovanile" | "Entrambi";

export const DIRECTOR_FOCUS_OPTIONS: { label: string; value: DirectorFocus }[] = [
  { label: "Prima squadra", value: "Prima squadra" },
  { label: "Settore giovanile", value: "Settore giovanile" },
  { label: "Entrambi", value: "Entrambi" },
];

export type DirectorMarketInvolvement =
  | "Sì, attivamente"
  | "Solo supporto"
  | "No";

export const DIRECTOR_MARKET_OPTIONS: { label: string; value: DirectorMarketInvolvement }[] = [
  { label: "Sì, attivamente", value: "Sì, attivamente" },
  { label: "Solo supporto", value: "Solo supporto" },
  { label: "No", value: "No" },
];

export const DIRECTOR_EXTRA_FOOTBALL_ROLE_OPTIONS = [
  "Ex calciatore",
  "Allenatore",
  "Agente",
  "Scout",
  "Staff tecnico",
  "Preparatore atletico",
  "Altro",
] as const;

export type DirectorClubType =
  | "Società professionistica"
  | "Società dilettantistica"
  | "Settore giovanile autonomo"
  | "Club internazionale"
  | "Federazione / Ente";

export const DIRECTOR_CLUB_TYPE_OPTIONS: { label: string; value: DirectorClubType }[] = [
  { label: "Società professionistica", value: "Società professionistica" },
  { label: "Società dilettantistica", value: "Società dilettantistica" },
  { label: "Settore giovanile autonomo", value: "Settore giovanile autonomo" },
  { label: "Club internazionale", value: "Club internazionale" },
  { label: "Federazione / Ente", value: "Federazione / Ente" },
];

export const DIRECTOR_LANGUAGE_OPTIONS = [
  "Italiano",
  "Inglese",
  "Francese",
  "Spagnolo",
  "Tedesco",
  "Portoghese",
  "Arabo",
] as const;

export const COMMUNITY_PROFILE_TYPE_OPTIONS = [
  {
    description: "Per seguire, commentare e interagire velocemente con la community.",
    label: "Profilo base",
    value: "fan",
  },
  {
    description:
      "Per giornalisti, creator, pagine, testate e progetti editoriali sul calcio.",
    label: "Profilo media",
    value: "media",
  },
] as const;

export const MEDIA_CONTENT_TYPE_OPTIONS = [
  "Notizie",
  "Partite e risultati",
  "Highlights",
  "Analisi",
  "Interviste",
  "Osservazione giocatori",
  "Contenuti social",
  "Foto",
  "Video",
  "Altro",
] as const;

export const MEDIA_FOCUS_AREA_OPTIONS = [
  "Calcio locale",
  "Calcio dilettantistico",
  "Settore giovanile",
  "Professionistico",
  "Mercato",
  "Calcio generale",
] as const;

export const MEDIA_AFFILIATION_TYPE_OPTIONS = [
  "Nessuna",
  "Società sportiva",
  "Testata o sito",
  "Pagina o progetto media",
  "Altro",
] as const;
