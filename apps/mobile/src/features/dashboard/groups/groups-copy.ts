/**
 * Copy dei Gruppi operativi (DAS-REV-32). I testi tra virgolette basse nella
 * task sono riportati alla lettera; il paragrafo è accanto a ciascuno.
 */
export const GROUPS_MODULE_TITLE = "Gruppi";

export const GROUPS_COPY = {
  // §9 — riga della Dashboard Società
  dashboardSection: "Messaggi e comunicazioni",
  dashboardRowTitle: "Gruppi",
  dashboardRowBody: "Crea e gestisci le conversazioni operative della Società.",

  // §10 — Centro
  centerSupporting: "Gestisci i gruppi della Società.",
  createGroup: "Crea gruppo",
  searchPlaceholder: "Cerca gruppo",
  societyContext: "Società",
  people: (count: number) => (count === 1 ? "1 persona" : `${count} persone`),

  // §27 — stati del Centro
  emptyTitle: "Nessun gruppo",
  emptyBody: "Crea un gruppo per coordinare squadra, staff o altre attività della Società.",
  emptyBodyReadOnly: "La Società non ha ancora gruppi operativi.",
  searchEmptyTitle: "Nessun gruppo trovato",
  searchEmptyBody: "Modifica o cancella la ricerca.",
  clearSearch: "Cancella ricerca",
  loadError: "Non è stato possibile caricare i gruppi. Riprova.",
  refreshFailed: "Aggiornamento non riuscito. Stai vedendo gli ultimi dati disponibili.",
  offlineBody: "Connessione assente. Riprova quando sei online.",
  notAuthorizedTitle: "Gruppi non disponibili",
  notAuthorizedBody: "Non hai accesso ai gruppi di questa Società.",
  noSociety: "Seleziona la società da amministrare.",
  backToDashboard: "Torna alla Dashboard",

  // §11 — dettaglio
  detailContext: (clubName: string) => `Gruppo operativo · ${clubName}`,
  detailTeam: "Squadra",
  detailPeople: "Persone",
  detailAdmins: "Amministratori",
  detailStatus: "Stato",
  statusActive: "Attivo",
  statusArchived: "Archiviato",
  openConversation: "Apri conversazione",
  detailNotFound: "Gruppo non disponibile",
  detailNotFoundBody: "Il gruppo non esiste o non rientra più nel tuo ambito.",
  conversationNoLongerAvailable: "Non hai più accesso a questa conversazione.",

  // §12 — launcher e Società preliminare
  newConversation: "Nuova conversazione",
  newMessage: "Nuovo messaggio",
  createFor: "Crea gruppo per",
  createForSupporting: "Scegli la Società.",
  societyKind: "Società",
  continue: "Continua",

  // §13 — wizard
  stepOf: (step: 1 | 2 | 3) => `${step} di 3`,
  exitTitle: "Uscire senza salvare?",
  exitBody: "Le modifiche effettuate andranno perse.",
  exitKeep: "Continua a modificare",
  exitLeave: "Esci senza salvare",

  // §14 — step 1
  stepInfo: "Informazioni",
  imageOptional: "Immagine gruppo · opzionale",
  addImage: "Aggiungi immagine",
  changeImage: "Modifica immagine",
  removeImage: "Rimuovi immagine",
  nameLabel: "Nome gruppo",
  namePlaceholder: "Es. Staff Primavera",
  nameRequired: "Inserisci un nome per il gruppo.",
  nameInvalid: "Il nome contiene caratteri non validi.",
  nameTooLong: (limit: number) => `Il nome può contenere fino a ${limit} caratteri.`,
  teamLabelOptional: "Squadra (opzionale)",
  teamLabel: "Squadra",
  teamHelpScoped: "Scegli una delle squadre che puoi gestire",
  teamNone: "Nessuna squadra",
  teamChoose: "Seleziona squadra",
  teamUnavailable: "La squadra selezionata non è più disponibile. Scegline un'altra.",
  teamChangedSelections: "Alcune persone selezionate non sono disponibili con la nuova squadra e sono state rimosse.",

  // §18 — step 2
  stepPeople: "Aggiungi persone",
  searchPeople: "Cerca persone",
  creatorHelp: "Tu sarai aggiunto automaticamente come amministratore.",
  otherPeople: "Altre persone della Società",
  selectAll: "Seleziona tutti",
  selectAllA11y: (teamName: string) => `Seleziona tutte le persone eleggibili della ${teamName}`,
  selected: (count: number) => (count === 1 ? "1 selezionato" : `${count} selezionati`),
  peopleRequired: "Seleziona almeno una persona",
  peopleLoadError: "Non è stato possibile caricare le persone. Riprova.",
  peopleEmptyTitle: "Nessuna persona disponibile",
  peopleEmptyBody: "Servono persone ufficialmente collegate alla Società e visibili nel tuo ambito.",
  peopleSearchEmpty: "Nessuna persona trovata.",
  peopleUnavailable: "Alcune persone selezionate non sono più disponibili. Controlla e riprova.",
  tooMany: (max: number) => `Un gruppo può contenere al massimo ${max} persone. Scegli un sottoinsieme.`,

  // §20 — step 3
  stepSummary: "Riepilogo",
  summarySociety: "Società",
  summaryTeam: "Squadra",
  summaryPeople: "Persone",
  summaryAdmin: "Amministratore iniziale",
  summaryIncluded: "Persone incluse",
  peopleIncludingYou: (count: number) => `${count} incluse te`,
  you: "Tu",
  more: (count: number) => `+${count}`,
  editInfo: "Modifica informazioni",
  editPeople: "Modifica persone",

  // §23-§24 — esiti
  verifying: "Stiamo verificando la creazione del gruppo.",
  createError: "Non è stato possibile creare il gruppo. Riprova.",
  createRevoked: "Non puoi più creare gruppi per questa Società.",
  offline: "Connessione assente. Riprova quando sei online.",
  imageError: "Non è stato possibile caricare l'immagine. Riprova.",
  imageFormat: "Formato immagine non supportato. Usa JPG, PNG o WebP.",
  imageTooLarge: "L'immagine è troppo grande.",
  imagePermission: "Consenti l'accesso alle foto per scegliere un'immagine.",
  retry: "Riprova",

  // §13-§19 — stati locali del wizard (chiavi aggiunte con il wizard)
  back: "Indietro",
  goBack: "Torna indietro",
  loading: "Caricamento…",
  societyVerified: "Società verificata",
  addImageA11y: "Aggiungi immagine al gruppo",
  imageUploading: "Caricamento immagine…",
  teamsLoadError: "Non è stato possibile caricare le squadre. Riprova.",
  selectingAll: "Selezione in corso…",
  selectAllError: "Non è stato possibile selezionare le persone. Riprova.",
  selectedPerson: (name: string) => `${name}, selezionato`,
  summaryYou: (name: string) => `${name} · Tu`,
  moreSelectedPeople: (count: number) => (count === 1 ? "+1 altra persona" : `+${count} altre persone`),

  // §25 — chat appena creata
  chatReadyTitle: (name: string) => `${name} è pronto`,
  chatReadyBody: "Ora puoi iniziare a scrivere al gruppo.",
  chatSubtitle: (clubName: string | null, people: number) =>
    [clubName, people === 1 ? "1 persona" : `${people} persone`].filter(Boolean).join(" · "),
} as const;
