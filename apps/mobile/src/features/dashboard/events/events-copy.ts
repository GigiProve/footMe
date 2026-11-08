/**
 * Copy canonica del dominio eventi di selezione (DAS-REV-28 §25).
 *
 * «Centralizza label, plurali e messaggi italiani. Usa Società, mai Society
 * nella UI; Provino, Stage, Open day con capitalizzazione coerente.»
 *
 * Vive in un file proprio, senza dipendenze, perché la leggono tre posti —
 * la riga della Dashboard, il Centro e il wizard — e la Dashboard non deve
 * importare la presentazione del Centro per conoscere un titolo.
 */
import type {
  ConfirmationMode,
  ParticipationMode,
  SelectionEventType,
} from "./events-types";

/** §4, §7: nome del modulo, mai abbreviato in «Eventi» nella UI. */
export const SELECTION_EVENTS_MODULE_TITLE = "Centro Provini, stage e open day";

export const SELECTION_EVENTS_MODULE_DESCRIPTION =
  "Organizza eventi di selezione e gestisci i partecipanti";

export const EVENT_TYPE_LABELS: Record<SelectionEventType, string> = {
  open_day: "Open day",
  stage: "Stage",
  tryout: "Provino",
};

/** Ordine del selector: quello dello spec, non alfabetico. */
export const EVENT_TYPE_ORDER: readonly SelectionEventType[] = [
  "tryout",
  "stage",
  "open_day",
];

export const PARTICIPATION_LABELS: Record<
  ParticipationMode,
  { helper: string; label: string }
> = {
  invite_only: {
    helper: "Possono partecipare solo i profili invitati dalla Società.",
    label: "Solo su invito",
  },
  open_registration: {
    /* §17: helper neutro. Il link pubblico arriva con la 29, non un URL
       fittizio adesso. */
    helper: "Gli utenti possono iscriversi tramite PROLINK.",
    label: "Iscrizioni aperte",
  },
};

export const CONFIRMATION_LABELS: Record<
  ConfirmationMode,
  { helper: string; label: string }
> = {
  automatic: {
    helper: "Le iscrizioni vengono confermate automaticamente.",
    label: "Automatica",
  },
  manual: {
    helper:
      "La Società valuta ogni richiesta prima di confermare la partecipazione.",
    label: "Manuale",
  },
};

export const EVENTS_COPY = {
  centerSupporting:
    "Organizza e gestisci gli eventi di selezione della Società.",
  createEvent: "Crea evento",
  sectionUpcoming: "In programma",
  sectionDrafts: "Bozze",
  sectionHistory: "Storico",
  untitled: "Evento senza titolo",
  dateMissing: "Data da completare",
  dateIncomplete: "Data non disponibile",
  completed: "Concluso",
  cancelled: "Annullato",
  full: "Posti esauriti",
  showMore: "Mostra altri eventi",
  emptyTitle: "Nessun evento",
  emptyBody: "Crea un provino, uno stage o un open day per iniziare.",
  loadError: "Impossibile caricare gli eventi",
  loadErrorBody: "Si è verificato un errore. Riprova più tardi.",
  retry: "Riprova",
  refreshFailed: "Aggiornamento non riuscito. I dati mostrati potrebbero non essere aggiornati.",
  offlineBody: "Connettiti a Internet per caricare gli eventi.",
  notAuthorizedTitle: "Non hai accesso agli eventi della società.",
  notAuthorizedBody: "Chiedi alla società l'accesso a questa area.",
  sectionError: "Non siamo riusciti a caricare questa sezione.",
  draftSaved: "Bozza salvata",
  published: "Evento pubblicato",

  // Wizard
  stepInfo: "Informazioni evento",
  stepDetails: "Dettagli e regole",
  stepParticipation: "Partecipazione",
  cancel: "Annulla",
  saveDraft: "Salva bozza",
  continue: "Continua",
  back: "Torna al passaggio precedente",
  publish: "Pubblica evento",
  fieldType: "Tipologia evento",
  fieldTitle: "Titolo evento",
  fieldTeam: "Squadra",
  fieldDate: "Data",
  fieldStart: "Ora di inizio",
  fieldEnd: "Ora di fine (facoltativa)",
  sectionVenue: "Luogo",
  fieldVenue: "Nome struttura",
  fieldAddress: "Indirizzo",
  fieldDescription: "Descrizione evento (facoltativa)",
  fieldRequirements: "Requisiti e informazioni (facoltativo)",
  fieldYears: "Anni di nascita di riferimento (facoltativo)",
  fieldCapacity: "Numero massimo partecipanti",
  capacityHelper: "Il limite considera solo i partecipanti confermati.",
  /* §16: helper canonico. Mai «Anni ammessi», mai promesse di blocco. */
  yearsHelper:
    "PROLINK segnalerà eventuali differenze rispetto all'anno di nascita indicato nel profilo, senza bloccare automaticamente l'iscrizione.",
  yearsNone: "Nessun riferimento",
  yearsSheetTitle: "Anni di nascita di riferimento",
  yearsSheetHelper: "Indica un singolo anno o un intervallo.",
  yearsFrom: "Da",
  yearsTo: "A",
  confirm: "Conferma",
  teamSheetTitle: "Seleziona squadra",
  teamsEmpty: "Nessuna squadra disponibile per creare eventi.",
  teamsError: "Impossibile caricare le squadre.",
  typeSheetTitle: "Tipologia evento",
  fieldMode: "Modalità di partecipazione",
  fieldConfirmation: "Conferma delle iscrizioni",
  fieldDeadline: "Termine iscrizioni (facoltativo)",
  fieldDeadlineTime: "Ora",
  deadlineHelper:
    "Se non impostato, le iscrizioni restano aperte fino all'inizio dell'evento.",
  deadlineRemove: "Rimuovi termine",
  inviteOnlySwitchNotice:
    "Con Solo su invito la conferma e il termine delle iscrizioni non si applicano.",
  pickDate: "Scegli una data",
  pickTime: "Scegli un orario",
  noTeamsAvailable:
    "Nessuna squadra è disponibile per creare eventi. Chiedi l'accesso a una squadra attiva.",
  saveError: "Impossibile salvare l'evento. Riprova.",
  publishError: "Impossibile pubblicare l'evento. Riprova.",
  offlineAction: "Connessione assente. Riprova quando sei online.",
  conflict: "I dati dell'evento sono cambiati. Controlla le modifiche prima di salvare.",
  conflictKeptLocal:
    "Alcuni campi sono stati modificati anche da un altro dispositivo: sono stati mantenuti i tuoi valori. Controllali prima di salvare.",
  accessRevoked: "Non hai più accesso a questo evento.",
  loadDraftError: "Impossibile caricare la bozza.",
  exitTitle: "Uscire senza salvare?",
} as const;

/**
 * Messaggi di validazione (§25, elenco minimo). Le chiavi sono i codici del
 * server e del validator client: lo stesso codice produce sempre le stesse
 * parole, in qualunque punto compaia.
 */
export const VALIDATION_COPY = {
  title_missing: "Inserisci un titolo per l'evento.",
  title_too_long: "Il titolo è troppo lungo.",
  type_missing: "Seleziona una tipologia evento.",
  team_missing: "Seleziona una squadra.",
  team_inactive: "La squadra selezionata non è più attiva. Seleziona un'altra squadra.",
  team_not_authorized:
    "Non puoi più gestire eventi per questa squadra. Seleziona un'altra squadra.",
  start_missing: "Inserisci data e ora di inizio.",
  start_past: "Scegli una data e un'ora di inizio future.",
  start_time_nonexistent:
    "Questo orario non esiste nel giorno del cambio d'ora. Scegli un altro orario.",
  start_time_ambiguous:
    "Questo orario si ripete nel giorno del cambio d'ora. Scegli un altro orario.",
  end_time_nonexistent:
    "Questo orario non esiste nel giorno del cambio d'ora. Scegli un altro orario.",
  end_time_ambiguous:
    "Questo orario si ripete nel giorno del cambio d'ora. Scegli un altro orario.",
  end_before_start: "L'ora di fine deve essere successiva all'ora di inizio.",
  end_without_start: "Inserisci data e ora di inizio.",
  multi_day: "L'evento deve svolgersi in una sola giornata.",
  venue_missing: "Inserisci il nome della struttura.",
  venue_too_long: "Il nome della struttura è troppo lungo.",
  address_missing: "Inserisci un indirizzo.",
  address_too_long: "L'indirizzo è troppo lungo.",
  description_too_long: "La descrizione è troppo lunga.",
  requirements_too_long: "Il testo dei requisiti è troppo lungo.",
  years_inverted: "L'anno finale non può essere precedente all'anno iniziale.",
  years_invalid: "Inserisci un anno valido.",
  years_incomplete: "Inserisci un anno valido.",
  capacity_invalid: "Inserisci un numero maggiore di zero.",
  capacity_below_confirmed:
    "Il limite non può essere inferiore ai partecipanti già confermati.",
  mode_missing: "Seleziona una modalità di partecipazione.",
  confirmation_missing: "Seleziona come confermare le iscrizioni.",
  deadline_after_start:
    "Il termine delle iscrizioni non può essere successivo all'inizio dell'evento.",
  deadline_incomplete: "Indica data e ora del termine delle iscrizioni.",
  deadline_time_nonexistent:
    "Questo orario non esiste nel giorno del cambio d'ora. Scegli un altro orario.",
  deadline_time_ambiguous:
    "Questo orario si ripete nel giorno del cambio d'ora. Scegli un altro orario.",
  structure_locked:
    "Questo campo non può essere modificato dopo l'avvio delle partecipazioni.",
  malformed: "Alcuni dati non sono validi. Controlla i campi e riprova.",
} as const;

export type ValidationCode = keyof typeof VALIDATION_COPY;

/** §15: avviso, non errore. Il termine passato non viene spostato. */
export const DEADLINE_PAST_WARNING =
  "Il termine indicato è già trascorso: le iscrizioni spontanee saranno chiuse.";
