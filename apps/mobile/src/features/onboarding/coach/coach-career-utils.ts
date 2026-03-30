const CURRENT_YEAR = new Date().getFullYear();
const CHIP_FIRST_YEAR = 2010;
const OLDEST_YEAR = 2000;

export const MONTH_OPTIONS: { label: string; value: string }[] = [
  { label: "Gennaio", value: "Gennaio" },
  { label: "Febbraio", value: "Febbraio" },
  { label: "Marzo", value: "Marzo" },
  { label: "Aprile", value: "Aprile" },
  { label: "Maggio", value: "Maggio" },
  { label: "Giugno", value: "Giugno" },
  { label: "Luglio", value: "Luglio" },
  { label: "Agosto", value: "Agosto" },
  { label: "Settembre", value: "Settembre" },
  { label: "Ottobre", value: "Ottobre" },
  { label: "Novembre", value: "Novembre" },
  { label: "Dicembre", value: "Dicembre" },
];

/** Seasons from current year back to 2010 as chips. */
export function getCoachSeasonOptions(): string[] {
  const seasons: string[] = [];
  for (let year = CURRENT_YEAR; year >= CHIP_FIRST_YEAR; year--) {
    seasons.push(`${year}/${year + 1}`);
  }
  return seasons;
}

/** Seasons before 2010 back to 2000 for older seasons picker. */
export function getOlderCoachSeasonOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let year = CHIP_FIRST_YEAR - 1; year >= OLDEST_YEAR; year--) {
    const season = `${year}/${year + 1}`;
    options.push({ label: formatSeasonShort(season), value: season });
  }
  return options;
}

/** Last 20 seasons for player career dropdown. */
export function getPlayerSeasonOptions(): { label: string; value: string }[] {
  return Array.from({ length: 20 }, (_, i) => {
    const year = CURRENT_YEAR - i;
    const season = `${year}/${year + 1}`;
    const label = `${year}/${String(year + 1).slice(2)}`;
    return { label, value: season };
  });
}

/** Last 30 years + current for period pickers. */
export function getCoachYearOptions(): { label: string; value: string }[] {
  return Array.from({ length: 31 }, (_, i) => {
    const year = CURRENT_YEAR - i;
    return { label: String(year), value: String(year) };
  });
}

export function formatSeasonShort(season: string): string {
  const parts = season.split("/");
  if (parts.length !== 2) return season;
  const endYear = parts[1];
  return `${parts[0]}/${endYear.length === 4 ? endYear.slice(2) : endYear}`;
}

let idCounter = 0;

export function generateCoachEntryId(): string {
  idCounter += 1;
  return `coach-${Date.now()}-${idCounter}`;
}

export const COACH_ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Allenatore", value: "Allenatore" },
  { label: "Vice allenatore", value: "Vice allenatore" },
  { label: "Collaboratore tecnico", value: "Collaboratore tecnico" },
  { label: "Allenatore portieri", value: "Allenatore portieri" },
  { label: "Preparatore atletico", value: "Preparatore atletico" },
];

export const PLAYER_POSITION_OPTIONS: { label: string; value: string }[] = [
  { label: "Portiere", value: "Portiere" },
  { label: "Difensore centrale", value: "Difensore centrale" },
  { label: "Terzino destro", value: "Terzino destro" },
  { label: "Terzino sinistro", value: "Terzino sinistro" },
  { label: "Mediano", value: "Mediano" },
  { label: "Mezzala", value: "Mezzala" },
  { label: "Trequartista", value: "Trequartista" },
  { label: "Ala destra", value: "Ala destra" },
  { label: "Ala sinistra", value: "Ala sinistra" },
  { label: "Centravanti", value: "Centravanti" },
  { label: "Attaccante esterno", value: "Attaccante esterno" },
];
