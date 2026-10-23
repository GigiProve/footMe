/**
 * Copy, etichette e stati del Centro Posizioni aperte (DAS-REV-15).
 *
 * Tutta la lingua del Centro vive qui, in un posto solo: lista, sheet, vuoti
 * ed errori usano le stesse parole, e un cambio di copy non deve essere
 * inseguito in sei componenti. Le funzioni sono pure — nessuna legge la rete,
 * la sessione o l'orologio se non attraverso un parametro — così §36 può
 * fissare l'istante di test al 12 settembre 2026 senza toccare la UI.
 */
import { getPlayerPositionLabel } from "../../profiles/player-sports";
import type {
  PositionFilter,
  PositionFilterOption,
  PositionGroup,
  PositionRow,
} from "./positions-types";

export const POSITIONS_COPY = {
  centerTitle: "Posizioni aperte",
  countsUnavailable: "Candidature non disponibili",
  deadlinePassed: "Scadenza candidature superata",
  /** §13: descrizione, non un link né una promessa di accesso. */
  historyHelper: "Lo storico delle squadre resta consultabile.",
  inactiveTeam: "Squadra non attiva",
  newPosition: "Nuova posizione",
  noApplications: "Nessuna candidatura",
  notAvailable: "Questa posizione non è più disponibile.",
  readOnly: "Sola consultazione",
  scopeChanged: "L'ambito delle posizioni disponibili è cambiato.",
  showAll: "Mostra tutte le posizioni",
  societyScope: "Intera società",
  societyScopeHelper: "Solo incarichi per il club",
  /** §12: bozza TEAM ancora senza squadra, non un incarico SOCIETY. */
  teamToBeDefined: "Squadra da definire",
  filterAll: "Tutte le posizioni",
  filterSheetHelper: "Scegli la società o una squadra.",
  filterSheetTitle: "Filtra per ambito",
  filterOptionsError: "Non è stato possibile caricare le squadre.",
  inactiveSection: "Squadre non attive",
  listError: "Non è stato possibile caricare le posizioni.",
  nextPageError: "Non è stato possibile caricare altre posizioni.",
  offlineBody: "Connettiti a Internet per caricare le posizioni.",
  refreshError: "Non è stato possibile aggiornare le posizioni. Riprova.",
  retry: "Riprova",
  /** §13: chiusura reale ma senza data affidabile. Non diventa "oggi". */
  closedUnknown: "Posizione chiusa",
  untitled: "Posizione senza titolo",
} as const;

export const POSITION_TABS: readonly { label: string; value: PositionGroup }[] =
  [
    { label: "Attive", value: "active" },
    { label: "Bozze", value: "drafts" },
    { label: "Chiuse", value: "closed" },
  ];

const ITALIAN_MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;

/**
 * «il 12 settembre», «l'11 settembre».
 *
 * L'elisione non è un vezzo: il master scrive «Modificata l'11 settembre», e
 * in italiano l'articolo si elide davanti ai soli numerali che iniziano per
 * vocale — otto e undici. Diciotto comincia per consonante e resta «il 18».
 */
function articledDay(day: number): string {
  return day === 8 || day === 11 ? `l'${day}` : `il ${day}`;
}

type DateParts = { day: number; month: number; year: number };

function partsOf(iso: string, timeZone?: string | null): DateParts | null {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (timeZone) {
    try {
      const formatted = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        timeZone,
        year: "numeric",
      }).formatToParts(date);

      const read = (type: string) =>
        Number(formatted.find((part) => part.type === type)?.value ?? NaN);

      const parts = {
        day: read("day"),
        month: read("month"),
        year: read("year"),
      };

      if (!Number.isNaN(parts.day + parts.month + parts.year)) {
        return parts;
      }
    } catch {
      // Fuso non riconosciuto dal runtime: si ricade sul fuso del device,
      // che è una data leggibile e non un errore da mostrare.
    }
  }

  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

/**
 * «Modificata il 12 settembre» (§12).
 *
 * L'anno compare solo quando serve a disambiguare: §12 chiede di includerlo
 * «quando evita ambiguità», non sempre. `now` è un parametro perché il
 * confronto visuale di §36 fissa l'istante di test.
 */
export function formatDraftUpdatedLabel(
  updatedAt: string | null,
  now: Date = new Date(),
): string | null {
  if (!updatedAt) {
    return null;
  }

  const parts = partsOf(updatedAt);
  const month = parts ? ITALIAN_MONTHS[parts.month - 1] : null;

  if (!parts || !month) {
    return null;
  }

  const suffix =
    parts.year === now.getFullYear() ? "" : ` ${parts.year}`;

  return `Modificata ${articledDay(parts.day)} ${month}${suffix}`;
}

/**
 * «Chiusa il 30 giugno 2026» (§13).
 *
 * Lo storico porta **sempre** l'anno: una data del 2024 e una del 2026 si
 * leggono nella stessa lista. Senza data affidabile si usa la label neutra,
 * non la data di oggi.
 */
export function formatClosedLabel(closedAt: string | null): string {
  if (!closedAt) {
    return POSITIONS_COPY.closedUnknown;
  }

  const parts = partsOf(closedAt);
  const month = parts ? ITALIAN_MONTHS[parts.month - 1] : null;

  if (!parts || !month) {
    return POSITIONS_COPY.closedUnknown;
  }

  return `Chiusa ${articledDay(parts.day)} ${month} ${parts.year}`;
}

/**
 * Titolo della riga (§11, §12).
 *
 * «Il titolo è letto dalla Position canonica.» Quando manca si ricade sul
 * ruolo cercato, che è comunque un dato reale dell'oggetto; solo se manca
 * anche quello compare «Posizione senza titolo» — mai `null`, `Untitled` o
 * un id tecnico.
 */
export function positionTitle(row: {
  roleRequired: string | null;
  targetRole: string | null;
  title: string | null;
}): string {
  if (row.title) {
    return row.title;
  }

  if (row.targetRole === "player" && row.roleRequired) {
    return getPlayerPositionLabel(row.roleRequired, POSITIONS_COPY.untitled);
  }

  return POSITIONS_COPY.untitled;
}

/**
 * Seconda riga: squadra e contesto sportivo, oppure «Intera società» (§11).
 *
 * «Per SOCIETY mostra Intera società, senza aggiungere categoria o
 * competizione della Prima squadra.» E «Se un metadato opzionale manca,
 * omettilo senza separatori pendenti o valori inventati»: da qui il filtro
 * su `Boolean` prima del join.
 */
export function positionContextLine(row: {
  contextLabel: string | null;
  scope: "society" | "team";
  seasonLabel: string | null;
  teamId: string | null;
  teamName: string | null;
}): string {
  if (row.scope === "society") {
    return POSITIONS_COPY.societyScope;
  }

  if (!row.teamId) {
    return POSITIONS_COPY.teamToBeDefined;
  }

  return [row.teamName, row.contextLabel, row.seasonLabel]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/**
 * «12 candidature · 3 nuove» (§10).
 *
 * Quattro esiti distinti, come §10 richiede: non autorizzato (nessuna riga),
 * errore (`countsUnavailable`), totale confermato zero, totale noto.
 * `nuove` compare solo se maggiore di zero e conosciuto.
 */
export function applicationsLabel(input: {
  available: boolean;
  failed?: boolean;
  group: PositionGroup;
  newCount: number | null;
  total: number | null;
}): string | null {
  // §12: sulle Bozze non si mostra nemmeno «Nessuna candidatura».
  if (input.group === "drafts" || !input.available) {
    return null;
  }

  if (input.failed) {
    return POSITIONS_COPY.countsUnavailable;
  }

  if (input.total === null) {
    return null;
  }

  if (input.total === 0) {
    return POSITIONS_COPY.noApplications;
  }

  const base =
    input.total === 1 ? "1 candidatura" : `${input.total} candidature`;

  if (input.newCount === null || input.newCount <= 0) {
    return base;
  }

  const fresh = input.newCount === 1 ? "1 nuova" : `${input.newCount} nuove`;

  return `${base} · ${fresh}`;
}

/** Etichetta di un'opzione del bottom sheet. */
export function filterOptionLabel(option: PositionFilterOption): string {
  if (option.kind === "all") {
    return POSITIONS_COPY.filterAll;
  }

  if (option.kind === "society") {
    return POSITIONS_COPY.societyScope;
  }

  return option.label;
}

/** Etichetta della riga di filtro sotto le tab. */
export function filterRowLabel(filter: PositionFilter): string {
  if (filter.kind === "all") {
    return POSITIONS_COPY.filterAll;
  }

  if (filter.kind === "society") {
    return POSITIONS_COPY.societyScope;
  }

  return filter.label;
}

export function sameFilter(a: PositionFilter, b: PositionFilter): boolean {
  if (a.kind !== b.kind) {
    return false;
  }

  return a.kind !== "team" || a.teamId === (b as { teamId: string }).teamId;
}

export function optionToFilter(option: PositionFilterOption): PositionFilter {
  if (option.kind === "team") {
    return {
      isInactive: option.isInactive,
      kind: "team",
      label: option.label,
      teamId: option.teamId,
    };
  }

  return { kind: option.kind };
}

/**
 * Il filtro corrente è ancora un'opzione valida in questa tab? (§15)
 *
 * «Se il filtro diventa non autorizzato per cambio scope o revoca, rimuovi
 * subito dati e opzioni non più accessibili.» Un Team storico selezionato
 * nelle Chiuse **non** viene invece azzerato passando alle Attive: resta il
 * contesto esplicito della query, e §15 vieta di «cambiare silenziosamente
 * il Team selezionato con Prima squadra».
 */
export function filterIsAuthorized(
  filter: PositionFilter,
  options: PositionFilterOption[],
): boolean {
  if (filter.kind === "all") {
    return true;
  }

  if (filter.kind === "society") {
    return options.some((option) => option.kind === "society");
  }

  return options.some(
    (option) => option.kind === "team" && option.teamId === filter.teamId,
  );
}

export type PositionsEmptyCopy = {
  body: string | null;
  title: string;
};

/**
 * Stato vuoto, per gruppo e per filtro (§27).
 *
 * «Non usare nel vuoto filtrato una frase che affermi l'assenza di posizioni
 * nell'intera Society»: per questo il filtro entra nella scelta della copy e
 * non solo nella query.
 */
export function emptyCopy(input: {
  canCreate: boolean;
  filter: PositionFilter;
  group: PositionGroup;
}): PositionsEmptyCopy {
  const { canCreate, filter, group } = input;

  if (filter.kind === "team") {
    return {
      body: null,
      title:
        group === "drafts"
          ? "Nessuna bozza per questa squadra"
          : group === "closed"
            ? "Nessuna posizione chiusa per questa squadra"
            : "Nessuna posizione aperta per questa squadra",
    };
  }

  if (filter.kind === "society") {
    return {
      body: null,
      title:
        group === "drafts"
          ? "Nessuna bozza per l'intera società"
          : group === "closed"
            ? "Nessuna posizione chiusa per l'intera società"
            : "Nessuna posizione aperta per l'intera società",
    };
  }

  if (group === "drafts") {
    return {
      body: canCreate
        ? "Le posizioni che inizi a preparare compariranno qui."
        : null,
      title: "Nessuna bozza",
    };
  }

  if (group === "closed") {
    return {
      body: "Le posizioni concluse compariranno qui.",
      title: "Nessuna posizione chiusa",
    };
  }

  return {
    body: canCreate
      ? "Pubblica un'opportunità per iniziare a ricevere candidature."
      : "Le posizioni disponibili compariranno qui.",
    title: "Nessuna posizione aperta",
  };
}

/**
 * Etichetta accessibile della riga (§30).
 *
 * «Centrocampista centrale, Prima squadra, Serie D, 12 candidature, 3 nuove,
 * pubblicata. Apri posizione.» Nella variante senza permesso candidature i
 * valori omessi visivamente **non** vengono annunciati: l'etichetta si
 * costruisce dalle stesse parti già visibili, non dai dati grezzi.
 */
export function rowAccessibilityLabel(input: {
  counts: string | null;
  group: PositionGroup;
  meta: string | null;
  row: PositionRow;
  title: string;
}): string {
  const parts: string[] = [input.title];

  if (input.row.scope === "society") {
    parts.push(POSITIONS_COPY.societyScope);
  } else {
    if (input.row.teamName) {
      parts.push(input.row.teamName);
    }

    if (input.row.contextLabel) {
      parts.push(input.row.contextLabel);
    }

    if (input.row.seasonLabel) {
      parts.push(input.row.seasonLabel);
    }
  }

  if (input.counts) {
    parts.push(input.counts);
  }

  if (input.meta) {
    parts.push(input.meta);
  }

  if (input.row.teamIsInactive && input.group !== "active") {
    parts.push(POSITIONS_COPY.inactiveTeam);
  }

  parts.push(
    input.group === "drafts"
      ? "bozza"
      : input.group === "closed"
        ? "chiusa"
        : "pubblicata",
  );

  return `${parts.join(", ")}. Apri posizione.`;
}
