/**
 * Regole di presentazione del Master Profile Società (REV-PROF-17).
 *
 * Funzioni pure, tutte testate: il conteggio delle squadre, la composizione
 * del nome del profilo squadra e i filtri delle posizioni sono esattamente i
 * punti in cui la task è prescrittiva, quindi vivono fuori dai componenti.
 */
import type {
  SocietyAffiliate,
  SocietyClub,
  SocietyPosition,
  SocietyTeamSummary,
} from "./society-profile-types";

/** Righe mostrate in anteprima prima della CTA "Vedi tutte" (§Anteprima). */
export const TEAMS_PREVIEW_LIMIT = 3;

/**
 * Conteggio della sezione "Squadre del club".
 *
 * Le affiliate non sono squadre e non entrano: sono un'altra sezione e un'altra
 * entità. Le squadre archiviate o non pubbliche non arrivano nemmeno dal
 * backend, ma il filtro resta anche qui perché il conteggio è un'informazione
 * mostrata, non un totale di comodo.
 */
export function countPublicTeams(teams: readonly SocietyTeamSummary[]): number {
  return teams.length;
}

/** "1 squadra" / "8 squadre": il singolare non è un caso particolare da scordare. */
export function formatTeamsCount(count: number): string {
  return count === 1 ? "1 squadra" : `${count} squadre`;
}

export function formatOpportunitiesCount(count: number): string {
  return count === 1 ? "1 opportunità nel club" : `${count} opportunità nel club`;
}

/**
 * Ordine sportivo, non alfabetico: prima squadra, poi il settore giovanile
 * nell'ordine configurato dalla Società. L'ordine arriva già così dalla RPC;
 * questa funzione lo riafferma per le liste costruite lato client.
 */
export function sortSocietyTeams(
  teams: readonly SocietyTeamSummary[],
): SocietyTeamSummary[] {
  return [...teams].sort((left, right) => {
    const rank = teamRank(left) - teamRank(right);
    if (rank !== 0) return rank;

    const order = left.sortOrder - right.sortOrder;
    if (order !== 0) return order;

    return left.name.localeCompare(right.name, "it");
  });
}

function teamRank(team: SocietyTeamSummary): number {
  return team.teamType === "senior" ? 0 : 1;
}

/**
 * Categoria mostrata nell'header del club: quella della prima squadra attiva.
 * Mai un valore scritto a mano sul club quando esiste una squadra che lo dice.
 */
export function resolveClubCategory(
  club: Pick<SocietyClub, "category">,
  teams: readonly SocietyTeamSummary[],
): string | null {
  const [firstTeam] = sortSocietyTeams(teams);

  return firstTeam?.category?.trim() || club.category?.trim() || null;
}

/**
 * Nome del profilo squadra: "{Società} {squadra}", per esempio
 * "ASD Predappio Primavera".
 *
 * Se la denominazione salvata contiene già il nome della Società — capita
 * spesso nei dati inseriti a mano — non lo si ripete. Il confronto è sui
 * caratteri alfanumerici, così "A.S.D. Predappio" e "ASD Predappio" restano
 * la stessa cosa.
 */
export function composeTeamDisplayName(
  clubName: string,
  teamName: string,
): string {
  const club = clubName.trim();
  const team = teamName.trim();

  if (!team) return club;
  if (!club) return team;

  const normalizedClub = normalizeForComparison(club);
  const normalizedTeam = normalizeForComparison(team);

  if (!normalizedClub || normalizedTeam.startsWith(normalizedClub)) {
    return team;
  }

  return `${club} ${team}`;
}

function normalizeForComparison(value: string): string {
  return value
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Fallback in lettura: dato della squadra, poi dato della Società, poi niente.
 * "Niente" è un ritorno legittimo — il fallback visuale neutro lo mette il
 * componente, non questa funzione inventando un valore.
 */
export function resolveTeamFallback(
  teamValue: string | null | undefined,
  clubValue: string | null | undefined,
): string | null {
  return teamValue?.trim() || clubValue?.trim() || null;
}

export type PositionFilter = "all" | "senior" | "youth";

export const POSITION_FILTERS: readonly {
  label: string;
  value: PositionFilter;
}[] = [
  { label: "Tutte", value: "all" },
  { label: "Prima squadra", value: "senior" },
  { label: "Settore giovanile", value: "youth" },
];

/**
 * Filtro delle posizioni per destinazione sportiva. Un annuncio senza squadra
 * collegata appartiene alla prima squadra: è la destinazione implicita quando
 * la Società non ne indica una.
 */
export function filterPositions(
  positions: readonly SocietyPosition[],
  filter: PositionFilter,
): SocietyPosition[] {
  if (filter === "all") {
    return [...positions];
  }

  return positions.filter((position) => position.teamType === filter);
}

/** "Pubblicata oggi" / "Pubblicata 2 giorni fa": data relativa, mai un timestamp. */
export function formatPublishedAgo(
  publishedAt: string | null,
  now: Date = new Date(),
): string | null {
  if (!publishedAt) return null;

  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return null;

  const days = Math.floor(
    (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (days <= 0) return "Pubblicata oggi";
  if (days === 1) return "Pubblicata ieri";
  if (days < 30) return `Pubblicata ${days} giorni fa`;

  const months = Math.floor(days / 30);
  return months === 1 ? "Pubblicata 1 mese fa" : `Pubblicata ${months} mesi fa`;
}

/**
 * Colori sociali leggibili. Il dato è un testo libero ("Giallo, Blu"): si
 * normalizza in etichette, non in pallini, perché un pallino da solo non è
 * leggibile da uno screen reader né da chi non distingue i colori.
 */
export function parseClubColors(raw: string | null): string[] {
  if (!raw) return [];

  return raw
    .split(/[,/·;]|\se\s/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.charAt(0).toLocaleUpperCase("it") + entry.slice(1));
}

/**
 * La label "Pagina ufficiale" appartiene a un profilo verificato. Su un
 * profilo non verificato o non reclamato non compare: sarebbe una promessa
 * che il dato non sostiene.
 */
export function isOfficialPage(
  club: Pick<SocietyClub, "verificationStatus">,
): boolean {
  return club.verificationStatus === "verified";
}

/** Sede e impianto coincidono: una riga sola, non la stessa cosa scritta due volte. */
export function buildVenueRows(
  club: Pick<SocietyClub, "city" | "fieldAddress" | "headquartersAddress" | "stadium">,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const seen = new Set<string>();

  function push(label: string, value: string | null) {
    const trimmed = value?.trim();
    if (!trimmed) return;

    const key = normalizeForComparison(trimmed);
    if (!key || seen.has(key)) return;

    seen.add(key);
    rows.push({ label, value: trimmed });
  }

  push("Città", club.city);
  push("Impianto", club.stadium);
  push("Indirizzo", club.fieldAddress ?? club.headquartersAddress);

  return rows;
}

/**
 * Deep link canonici. Lo schema e' quello registrato dall'app (`footme`,
 * invariato dal rebranding): scriverlo qui una volta evita che ogni superficie
 * ne inventi uno diverso.
 */
export function buildClubDeepLink(clubId: string): string {
  return `footme://club/${clubId}`;
}

export function buildTeamDeepLink(teamId: string): string {
  return `footme://club/team/${teamId}`;
}

/** Testo di condivisione del club: nome e link, nessun dato gestionale. */
export function buildClubShareMessage(
  club: Pick<SocietyClub, "id" | "name">,
): string {
  return `Scopri ${club.name} su ProLink. ${buildClubDeepLink(club.id)}`;
}

export function buildTeamShareMessage(
  clubName: string,
  teamName: string,
  teamId: string,
): string {
  return `Scopri ${composeTeamDisplayName(clubName, teamName)} su ProLink. ${buildTeamDeepLink(teamId)}`;
}

/** Nessuna affiliata pubblica: la sezione non esiste, non è una card vuota. */
export function hasPublicAffiliates(
  affiliates: readonly SocietyAffiliate[],
): boolean {
  return affiliates.length > 0;
}
