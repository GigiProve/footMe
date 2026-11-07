/**
 * Copy, formattazioni e semantica dei filtri del Centro Candidature.
 *
 * Funzioni pure, separate dalle schermate: sono la parte che §14 descrive
 * con più precisione — OR dentro la dimensione, AND fra dimensioni, pending
 * contro applicati, riepiloghi con i plurali giusti — ed è anche l'unica
 * verificabile senza montare un albero React.
 */
import {
  LIFECYCLE_COPY,
  formatLongDate,
} from "../../applications/lifecycle/lifecycle-presentation";
import type {
  ApplicantProfileType,
  ApplicationFilterOption,
  ApplicationRow,
  ApplicationsFilter,
  ApplicationsTab,
} from "./applications-types";

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

export const APPLICATIONS_COPY = {
  centerTitle: "Candidature ricevute",
  detailTitle: "Candidatura",

  /** §12: a filtri vuoti la riga dice che non filtra niente. */
  allApplications: "Tutte le candidature",

  /** §13. Stati neutri, mai un trattamento di errore. */
  newBadge: "Nuova",
  withdrawn: LIFECYCLE_COPY.withdrawn,
  positionClosed: LIFECYCLE_COPY.positionClosed,

  /** §15: l'eyebrow del contesto storico dell'invio. */
  appliedFor: "Candidatura per",
  sportsProfile: "Profilo sportivo",
  professionalProfile: "Profilo professionale",
  careerSummary: "Carriera in sintesi",
  /** §18: «la riga usa "Totali disponibili"», non "Totali". */
  availableTotals: "Totali disponibili",
  recentExperiences: "Esperienze recenti",
  openCareer: "Vedi carriera completa",
  openProfile: "Visualizza profilo completo",

  /** §20. */
  addToShortlist: "Aggiungi alla shortlist",
  inShortlist: "In shortlist",
  shortlistError:
    "Non è stato possibile aggiungere il candidato alla shortlist. Riprova.",

  /** §22. */
  message: "Messaggio",
  messageError: "Non è stato possibile aprire la conversazione. Riprova.",

  /** §23. */
  closedHistoryNote: "Le candidature ricevute restano consultabili.",

  /** §25: lo stato generico, identico per negato e non più disponibile. */
  unavailableTitle: "Contenuto non disponibile",
  unavailableBody:
    "Non hai accesso a questa candidatura oppure non è più disponibile.",
  backToDashboard: "Torna alla Dashboard",

  /** §27. */
  listErrorTitle: "Impossibile caricare le candidature",
  listErrorBody: "Riprova tra poco.",
  detailErrorTitle: "Impossibile caricare la candidatura",
  retry: "Riprova",
  offlineBody: "Connettiti a Internet per caricare le candidature.",

  /** §14: lo sheet. */
  filterTitle: "Filtra candidature",
  filterTeams: "Squadre",
  /** §14: «La label è Posizioni, perché la lista include anche ricerche chiuse.» */
  filterPositions: "Posizioni",
  filterActiveGroup: "Attive",
  filterClosedGroup: "Chiuse",
  filterReset: "Azzera",
  filterApply: "Applica filtri",
} as const;

export const APPLICATIONS_TABS: readonly {
  label: string;
  value: ApplicationsTab;
}[] = [
  { label: "Nuove", value: "new" },
  { label: "Tutte", value: "all" },
];

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Tempo relativo compatto della lista: «2h», «5h», «Ieri», «2g» (§33).
 *
 * «Ieri» e i giorni si contano su **giorni di calendario locali**, non su
 * multipli di 24 ore: un invio delle 23:00 di ieri è «Ieri» anche se sono
 * passate due ore. §10 — «Date relative e data completa del dettaglio devono
 * riferirsi allo stesso istante»: entrambe partono da questo stesso valore
 * UTC e lo formattano nel fuso di chi guarda.
 *
 * `null` quando la data non c'è o non è interpretabile: §32 vieta di
 * inventarla, e la riga omette il campo invece di stampare una stringa ISO.
 */
export function formatSubmittedAgo(
  value: string | null,
  now: Date = new Date(),
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days >= 2) {
    return `${days}g`;
  }

  if (days === 1) {
    return "Ieri";
  }

  /* Stesso giorno: le ore trascorse. Sotto l'ora resta «Ora», perché «0h»
     direbbe una cosa diversa da quella vera. */
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);

  if (minutes < 1) {
    return "Ora";
  }

  const hours = Math.floor(minutes / 60);

  return hours < 1 ? `${minutes}min` : `${hours}h`;
}

/**
 * «13 settembre 2026» (§15). Il dettaglio porta sempre l'anno.
 *
 * Delega al formattatore del dominio Candidature: DAS-REV-23 mostra la stessa
 * data sulle due sponde — «Inviata il …» per la persona, «Ricevuta il …» per
 * la Società — e due implementazioni finirebbero per divergere proprio sul
 * mese.
 */
export const formatSubmittedOn = formatLongDate;

/** §15: «Ricevuta il 13 settembre 2026», oppure niente. */
export function receivedLine(value: string | null): string | null {
  const formatted = formatSubmittedOn(value);

  return formatted ? LIFECYCLE_COPY.receivedOn(formatted) : null;
}

/** §19: il ritiro è un fatto separato, con la sua data. */
export function withdrawnLine(value: string | null): string {
  const formatted = formatSubmittedOn(value);

  return formatted
    ? LIFECYCLE_COPY.withdrawnOn(formatted)
    : APPLICATIONS_COPY.withdrawn;
}

// ---------------------------------------------------------------------------
// Riga
// ---------------------------------------------------------------------------

const PROFILE_TYPE_LABELS: Record<ApplicantProfileType, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
};

export function profileTypeLabel(
  value: ApplicantProfileType | null,
): string | null {
  return value ? PROFILE_TYPE_LABELS[value] : null;
}

/**
 * Seconda riga: «Calciatore · Svincolato» (§12).
 *
 * §16 distingue «dato non compilato» da «dato non pubblico»: in entrambi i
 * casi qui resta solo la tipologia, perché la riga non ha spazio per
 * spiegare la differenza e §16 vieta di «mostrare pile di card "Nessun
 * dato"». Il dettaglio è il posto dove quella distinzione si vede.
 */
export function personLine(row: {
  personRole: ApplicantProfileType | null;
  personSituation: string | null;
}): string {
  return [profileTypeLabel(row.personRole), row.personSituation]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Sottotitolo dell'identità nel dettaglio: «Calciatore · Centrocampista»,
 * «Staff · Preparatrice atletica» — ma «Allenatore» una volta sola (§15).
 *
 * §17 chiede «ruolo principale e secondari effettivi, **senza
 * duplicazioni**»: quando il ruolo dichiarato dal profilo coincide con la
 * tipologia, ripeterlo non aggiunge niente e la tavola infatti non lo fa.
 */
export function identityLine(
  typeLabel: string | null,
  roleLabel: string | null,
): string {
  const type = typeLabel?.trim() ?? "";
  const role = roleLabel?.trim() ?? "";

  if (!role || role.toLowerCase() === type.toLowerCase()) {
    return type;
  }

  return [type, role].filter(Boolean).join(" · ");
}

/**
 * Terza riga: «Centrocampista · Prima squadra», «Direttore sportivo · Intera
 * società» (§12).
 *
 * §13: «Le qualifiche o il ruolo attuale possono differire dal ruolo
 * richiesto dalla Position. Presenta chiaramente dato corrente della persona
 * e contesto della candidatura, senza riscrivere l'uno con l'altro.» Per
 * questo le due righe sono due funzioni distinte e non si fondono mai.
 */
export function positionLine(row: {
  roleLabel: string;
  teamLabel: string | null;
}): string {
  return [row.roleLabel, row.teamLabel].filter(Boolean).join(" · ");
}

/**
 * Lo stato operativo della riga (§13).
 *
 * Precedenza: ritiro, poi posizione chiusa, poi «Nuova». §13 — «Se coesistono
 * ritiro e chiusura, mantieni entrambi i fatti nel dettaglio. Nella riga
 * privilegia Ritirata e il contesto della posizione» — e «Non creare uno
 * stato ibrido Archiviata».
 *
 * `null` su una candidatura attiva già consultata: §13 — «Letta e attiva:
 * niente badge Nuova; conserva i metadati utili.»
 */
export function rowStatusLabel(row: {
  adStatus: ApplicationRow["adStatus"];
  isNew: boolean;
  state: ApplicationRow["state"];
}): string | null {
  if (row.state === "withdrawn") {
    return APPLICATIONS_COPY.withdrawn;
  }

  if (row.adStatus === "closed") {
    return APPLICATIONS_COPY.positionClosed;
  }

  return row.isNew ? APPLICATIONS_COPY.newBadge : null;
}

/**
 * §31: «row letta come unità coerente con nome, profilo, contesto e stato»,
 * e «Nuova, Ritirata e selezione tab annunciate anche senza colore».
 */
export function rowAccessibilityLabel(
  row: ApplicationRow,
  now: Date = new Date(),
): string {
  const status = rowStatusLabel(row);
  const ago = formatSubmittedAgo(row.latestSubmittedAt, now);

  return [
    row.personName,
    personLine(row),
    positionLine(row),
    status,
    ago ? `inviata ${ago}` : null,
  ]
    .filter(Boolean)
    .join(". ");
}

// ---------------------------------------------------------------------------
// Filtri
// ---------------------------------------------------------------------------

export function isEmptyFilter(filter: ApplicationsFilter): boolean {
  return filter.teamIds.length === 0 && filter.adIds.length === 0;
}

export function sameFilter(
  a: ApplicationsFilter,
  b: ApplicationsFilter,
): boolean {
  const same = (x: string[], y: string[]) =>
    x.length === y.length &&
    [...x].sort().every((value, index) => value === [...y].sort()[index]);

  return same(a.teamIds, b.teamIds) && same(a.adIds, b.adIds);
}

/**
 * §14: «Quando cambia una Squadra, rimuovi dalla selezione pending le
 * Position divenute incompatibili, con aggiornamento comprensibile. Non
 * lasciare filtri invisibili o contraddittori.»
 *
 * Incompatibile significa due cose precise, entrambe in §14:
 *
 *   · «Se vengono selezionate Squadre reali, le Position SOCIETY … non
 *     corrispondono al filtro» — una Position senza squadra non può stare in
 *     un filtro di squadre;
 *   · «… e quelle di squadre principali diverse» — la squadra confrontata è
 *     la **principale** della Position (§6), non una secondaria.
 *
 * A zero squadre selezionate non si toglie niente: «Con zero Squadre
 * selezionate possono essere comprese anche le Position SOCIETY autorizzate.»
 */
export function reconcilePendingFilter(
  filter: ApplicationsFilter,
  options: readonly ApplicationFilterOption[],
): { dropped: number; filter: ApplicationsFilter } {
  if (filter.teamIds.length === 0) {
    return { dropped: 0, filter };
  }

  const teams = new Set(filter.teamIds);
  const positions = new Map(
    options.flatMap((option) =>
      option.kind === "position" ? [[option.adId, option] as const] : [],
    ),
  );

  const kept = filter.adIds.filter((adId) => {
    const option = positions.get(adId);

    /* Un'opzione che non conosciamo non viene scartata: potrebbe essere una
       lista ancora in caricamento, e §27 vieta che «uno sheet con opzioni
       ancora in caricamento» cancelli selezioni precedenti. */
    if (!option || option.kind !== "position") {
      return true;
    }

    return option.teamId !== null && teams.has(option.teamId);
  });

  return {
    dropped: filter.adIds.length - kept.length,
    filter: kept.length === filter.adIds.length ? filter : { ...filter, adIds: kept },
  };
}

/**
 * §14: «Se permessi/scope cambiano, il server normalizza anche il filtro
 * applicato e restituisce i valori effettivi. Il client li riconcilia
 * insieme ai risultati, rimuovendo dati non più autorizzati.»
 *
 * Riconciliare significa adottare la risposta del server, non intersecarla
 * di nuovo: il dataset mostrato è quello, e §26 vieta che «il client continui
 * a mostrare un riepilogo diverso dal dataset restituito».
 */
export function adoptEffectiveFilter(
  applied: ApplicationsFilter,
  effective: ApplicationsFilter,
): ApplicationsFilter {
  return sameFilter(applied, effective) ? applied : effective;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}

/**
 * Riepilogo della riga filtro (§14):
 *
 *   una squadra → nome; più squadre → «2 squadre»;
 *   una Position → ruolo + ambito; più Position → «3 posizioni»;
 *   entrambe → «2 squadre · 3 posizioni».
 */
export function filterSummary(
  filter: ApplicationsFilter,
  options: readonly ApplicationFilterOption[],
): string {
  if (isEmptyFilter(filter)) {
    return APPLICATIONS_COPY.allApplications;
  }

  const teamOptions = new Map(
    options.flatMap((option) =>
      option.kind === "team" ? [[option.teamId, option.label] as const] : [],
    ),
  );
  const positionOptions = new Map(
    options.flatMap((option) =>
      option.kind === "position" ? [[option.adId, option] as const] : [],
    ),
  );

  const parts: string[] = [];

  if (filter.teamIds.length === 1) {
    parts.push(teamOptions.get(filter.teamIds[0]) ?? "1 squadra");
  } else if (filter.teamIds.length > 1) {
    parts.push(plural(filter.teamIds.length, "1 squadra", "squadre"));
  }

  if (filter.adIds.length === 1) {
    const option = positionOptions.get(filter.adIds[0]);

    parts.push(
      option && option.kind === "position"
        ? [option.label, option.sublabel].filter(Boolean).join(" · ")
        : "1 posizione",
    );
  } else if (filter.adIds.length > 1) {
    parts.push(plural(filter.adIds.length, "1 posizione", "posizioni"));
  }

  return parts.join(" · ");
}

/** §9, §23: «2 candidature · 1 nuova». */
export function countsLine(input: {
  newCount: number | null;
  total: number | null;
}): string | null {
  if (input.total === null) {
    return null;
  }

  const total = plural(input.total, "1 candidatura", "candidature");

  if (input.newCount === null || input.newCount === 0) {
    return total;
  }

  return `${total} · ${input.newCount} ${
    input.newCount === 1 ? "nuova" : "nuove"
  }`;
}

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

export type ApplicationsEmptyCopy = {
  actionLabel: string | null;
  body: string;
  title: string;
};

/**
 * I quattro empty di §27, distinti sul serio.
 *
 * L'ultimo è quello che si sbaglia più facilmente: a Nuove vuote con solo
 * candidature ritirate o di posizioni chiuse, §27 vieta la copy «le hai già
 * consultate tutte» — «usa una copy vera, per esempio "Puoi consultare lo
 * storico in Tutte."». Per distinguerli serve sapere se esista uno storico
 * **consultabile ma non operativo**, non solo se esista uno storico.
 */
export function emptyCopy(input: {
  filtered: boolean;
  hasHistory: boolean;
  /** Esistono righe in Tutte, ma nessuna sarebbe mai potuta essere Nuova. */
  historyIsInactiveOnly: boolean;
  tab: ApplicationsTab;
}): ApplicationsEmptyCopy {
  if (input.filtered) {
    return {
      actionLabel: "Azzera filtri",
      body: "Prova a modificare o azzerare i filtri.",
      title: "Nessuna candidatura trovata",
    };
  }

  if (input.tab === "all" || !input.hasHistory) {
    return {
      actionLabel: null,
      body: "Le candidature alle tue posizioni compariranno qui.",
      title: "Nessuna candidatura ricevuta",
    };
  }

  if (input.historyIsInactiveOnly) {
    return {
      actionLabel: "Vedi tutte",
      body: "Puoi consultare lo storico in Tutte.",
      title: "Nessuna nuova candidatura",
    };
  }

  return {
    actionLabel: "Vedi tutte",
    body: "Le candidature già consultate sono in Tutte.",
    title: "Nessuna nuova candidatura",
  };
}
