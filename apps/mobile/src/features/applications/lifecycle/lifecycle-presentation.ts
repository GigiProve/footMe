/**
 * Copy e stati del lifecycle della candidatura (DAS-REV-23 §29, §30).
 *
 * Un posto solo per le due sponde — la pagina personale (screen 01-04) e il
 * dettaglio della Società (screen 06-09) — perché il fatto è lo stesso visto
 * da due parti: una candidatura ritirata è «Candidatura ritirata» per
 * entrambe, e la data del ritiro è la stessa data.
 *
 * Funzioni pure, nessuna legge l'orologio: l'istante arriva dal server
 * (§14 — «Non fidarti del timestamp del tap, del clock del dispositivo o di
 * can_apply cached»), e qui si formatta soltanto.
 */

const LONG_MONTHS = [
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
 * «13 settembre 2026» (§30). `null` quando la data non c'è o non è
 * interpretabile: §32 vieta di inventarla, e una riga senza data resta
 * leggibile mentre una con la data sbagliata no.
 */
export function formatLongDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const month = LONG_MONTHS[date.getMonth()];

  return month ? `${date.getDate()} ${month} ${date.getFullYear()}` : null;
}

// ---------------------------------------------------------------------------
// Copy (§30)
// ---------------------------------------------------------------------------

export const LIFECYCLE_COPY = {
  /** Stati, screen 01/03/06-09. */
  submitted: "Candidatura inviata",
  withdrawn: "Candidatura ritirata",
  deadlinePassed: "Termine candidature scaduto",
  positionClosed: "Posizione chiusa",

  /** Spiegazioni sotto lo stato. */
  profileConsultable: "La società può consultare il tuo profilo aggiornato.",
  canReapply: "Puoi candidarti di nuovo finché la posizione accetta candidature.",
  receivingClosedNote: "Questa posizione non accetta più nuove candidature.",
  stillEvaluable: "Le candidature ricevute restano valutabili.",

  /** Metadati, con la data interpolata dai formattatori condivisi. */
  sentOn: (date: string) => `Inviata il ${date}`,
  receivedOn: (date: string) => `Ricevuta il ${date}`,
  withdrawnOn: (date: string) => `Ritirata il ${date}`,

  /** Azioni, screen 01-04. */
  withdrawAction: "Ritira candidatura",
  reapplyAction: "Candidati di nuovo",
  confirmApply: "Conferma candidatura",
  cancel: "Annulla",
  seePosition: "Vedi posizione",
  yourApplication: "La tua candidatura",

  /** Sheet 02. */
  withdrawTitle: "Ritirare la candidatura?",
  withdrawBodyOpen:
    "Non parteciperai più a questa posizione. Puoi candidarti di nuovo finché accetta candidature.",
  /** §10: «Quando la ricezione è già chiusa, usa una copy vera.» */
  withdrawBodyClosed:
    "Non parteciperai più a questa posizione. Al momento non accetta nuove candidature.",

  /** Sheet 04. */
  reapplyTitle: "Inviare di nuovo la candidatura?",
  reapplyBody: "La società potrà consultare il tuo profilo aggiornato.",

  /** Esiti (§30). */
  withdrawDone: "Candidatura ritirata.",
  applyDone: "Candidatura inviata.",
  withdrawFailed: "Non è stato possibile ritirare la candidatura. Riprova.",
  applyFailed: "Non è stato possibile inviare la candidatura. Riprova.",
  changedElsewhere: "La candidatura è cambiata. Controlla lo stato aggiornato.",
  deadlineDuringCommand: "Il termine per candidarsi è scaduto.",
  closedDuringCommand: "Questa posizione non accetta più candidature.",
  pendingOutcome: "Stiamo verificando l'esito dell'operazione.",
  offline: "Connessione assente. Riprova quando sei online.",

  /** §23, screen 12. */
  unavailableTitle: "Contenuto non disponibile",
  unavailableBody:
    "Non hai accesso a questa candidatura oppure non è più disponibile.",
  backToDashboard: "Torna alla Dashboard",
} as const;

// ---------------------------------------------------------------------------
// Il blocco di stato (§29)
// ---------------------------------------------------------------------------

/**
 * Il riquadro che le schermate 01, 03 e 06-09 mostrano sotto il contesto:
 * un titolo neutro e le righe che lo spiegano. Mai rosso — §29: «Ritirata /
 * Termine candidature scaduto / Posizione chiusa: stato neutro, label
 * esplicita, senza allarme rosso.»
 */
export type LifecycleStatus = {
  lines: string[];
  title: string;
};

/**
 * Lo stato della **propria** candidatura (screen 01, 03).
 *
 * Il ritiro vince sulla scadenza e sulla chiusura: §4 — le dimensioni sono
 * indipendenti, ma il blocco descrive la *partecipazione*, e quella è finita.
 * La riga che promette la ricandidatura compare solo quando è vera (§30 —
 * «L'helper che promette la possibilità di ricandidarsi è mostrato solo
 * quando la condizione è vera»).
 */
export function personalLifecycleStatus(input: {
  canApply: boolean;
  latestSubmittedAt: string | null;
  receivingOpen: boolean;
  state: "active" | "withdrawn";
  withdrawnAt: string | null;
}): LifecycleStatus {
  if (input.state === "withdrawn") {
    const date = formatLongDate(input.withdrawnAt);

    return {
      lines: [
        date ? LIFECYCLE_COPY.withdrawnOn(date) : null,
        input.canApply
          ? LIFECYCLE_COPY.canReapply
          : LIFECYCLE_COPY.receivingClosedNote,
      ].filter((line): line is string => line !== null),
      title: LIFECYCLE_COPY.withdrawn,
    };
  }

  const date = formatLongDate(input.latestSubmittedAt);

  return {
    lines: [
      date ? LIFECYCLE_COPY.sentOn(date) : null,
      /* §14, §15: la ricezione chiusa è un fatto della Position, non della
         candidatura, e non toglie alla società la possibilità di valutarla. */
      input.receivingOpen
        ? LIFECYCLE_COPY.profileConsultable
        : LIFECYCLE_COPY.stillEvaluable,
    ].filter((line): line is string => line !== null),
    title: LIFECYCLE_COPY.submitted,
  };
}

/**
 * Lo stato della candidatura **ricevuta** (screen 06-09).
 *
 * Tre fatti distinti e un solo blocco, nell'ordine in cui §17 e §15 li
 * mettono: il ritiro è della persona e viene prima; fra i due fatti della
 * Position la chiusura è quella terminale. `null` quando non c'è niente da
 * dire — una candidatura attiva su una ricerca aperta non ha bisogno di un
 * riquadro per dirlo.
 *
 * §17: «Se ritiro e Position CLOSED coesistono, conserva entrambi i fatti nel
 * dettaglio» — la riga della chiusura resta sotto quella del ritiro.
 */
export function societyLifecycleStatus(input: {
  adStatus: "published" | "closed";
  receivingClosed: boolean;
  state: "active" | "withdrawn";
  withdrawnAt: string | null;
}): LifecycleStatus | null {
  const closureLine =
    input.adStatus === "closed"
      ? LIFECYCLE_COPY.positionClosed
      : input.receivingClosed
        ? LIFECYCLE_COPY.deadlinePassed
        : null;

  if (input.state === "withdrawn") {
    const date = formatLongDate(input.withdrawnAt);

    return {
      lines: [
        date ? LIFECYCLE_COPY.withdrawnOn(date) : null,
        closureLine,
      ].filter((line): line is string => line !== null),
      title: LIFECYCLE_COPY.withdrawn,
    };
  }

  if (!closureLine) {
    return null;
  }

  return {
    /* §15, §16: «Le candidature ricevute restano valutabili.» La chiusura non
       è una ragione per ridurre il dettaglio, e questa riga lo dice. */
    lines: [LIFECYCLE_COPY.stillEvaluable],
    title: closureLine,
  };
}

// ---------------------------------------------------------------------------
// Errori di dominio (§30)
// ---------------------------------------------------------------------------

/**
 * Da codice del server a copy non tecnica (§24 — «Non mostrare ID, stack
 * trace, nomi di capability o codici HTTP»).
 *
 * `APPLICATION_REVISION_STALE` e `OPERATION_CONTENT_CHANGED` non sono
 * fallimenti: la candidatura è cambiata altrove, e §30 ha una frase apposta
 * che invita a guardare lo stato aggiornato invece di ripetere il comando.
 */
const DOMAIN_MESSAGES: Record<string, string> = {
  APPLICATION_NOT_ACTIVE: LIFECYCLE_COPY.changedElsewhere,
  APPLICATION_NOT_AVAILABLE: LIFECYCLE_COPY.unavailableBody,
  APPLICATION_REVISION_STALE: LIFECYCLE_COPY.changedElsewhere,
  APPLICATION_WITHDRAW_NOT_OWNER: LIFECYCLE_COPY.unavailableBody,
  OPERATION_CONTENT_CHANGED: LIFECYCLE_COPY.changedElsewhere,
  POSITION_APPLICANT_NOT_ELIGIBLE:
    "Il tuo profilo non è compatibile con questa posizione.",
  POSITION_CLOSED: LIFECYCLE_COPY.closedDuringCommand,
  POSITION_DEADLINE_PASSED: LIFECYCLE_COPY.deadlineDuringCommand,
  POSITION_NOT_AVAILABLE: "Questa posizione non è più disponibile.",
  POSITION_ROLE_NOT_SUPPORTED:
    "Il tuo profilo non è compatibile con questa posizione.",
};

export function lifecycleErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const code = Object.keys(DOMAIN_MESSAGES).find((key) => raw.includes(key));

  return code ? DOMAIN_MESSAGES[code] : fallback;
}

/**
 * Un esito **incerto** non è un fallimento (§27): la rete è caduta dopo il
 * tap, e il comando può essere passato lo stesso. §13 chiede di riconciliare
 * con la stessa chiave invece di indurre un nuovo invio.
 */
export function isUncertainOutcome(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : "";

  return (
    raw.includes("Network request failed") ||
    raw.includes("Failed to fetch") ||
    raw.includes("timeout") ||
    raw.includes("Timeout")
  );
}
