/**
 * Copy dell'accesso amministrativo (§14–§23, §29).
 *
 * Le frasi delle conferme distruttive sono qui perché §34 chiede che
 * «annuncino persona, Società ed effetto»: costruirle in un posto solo è la
 * condizione per non dimenticare uno dei tre.
 */
import type { AdminInviteDetail, AdminInviteState } from "./access-types";

export const ACCESS_COPY = {
  detailTitle: "Amministratore",
  ownerTitle: "Owner",
  inviteTitle: "Invito",
  scopeTitle: "Ambito",
  transferTitle: "Trasferisci Owner",
  permissionsTitle: "Permessi",

  activeStatus: "Accesso amministrativo attivo",
  ownerStatus: "Accesso completo",
  ownerDescription:
    "Responsabile principale della gestione di {society} su PROLINK.",

  roleRow: "Ruolo",
  scopeRow: "Ambito",
  viewPermissions: "Visualizza permessi",
  saveRoleCta: "Salva ruolo",

  revokeCta: "Revoca accesso",
  revokeScopeHelper:
    "Riguarda solo l'accesso amministrativo {a} {society}.",
  revokeKeep: "Mantieni accesso",
  revokeBodyOne: "Non potrà più accedere alla Dashboard di {society}. Le attività già effettuate resteranno nello storico.",
  revokeBodyTwo: "Il suo profilo e i rapporti sportivi restano invariati.",
  revokeSelfBody: "Non avrai più accesso alla Dashboard della società.",
  revokedToast: "Accesso revocato",

  scopeSocietyLabel: "Intera società",
  scopeSocietyHelper: "Tutte le squadre interne, attuali e future.",
  scopeTeamsLabel: "Seleziona squadre",
  scopeTeamsHelper: "Soltanto le squadre che scegli.",
  scopeEditSelection: "Modifica selezione",
  scopeEmptyTeams: "Seleziona almeno una squadra.",
  scopeUnchangedHelper: "Il ruolo e i suoi permessi non cambiano.",
  scopeSaveCta: "Salva ambito",
  scopeUpdatedToast: "Ambito aggiornato",
  roleAssignedToast: "Ruolo assegnato",

  teamPickerTitle: "Seleziona squadre",
  teamPickerCta: "Conferma selezione",
  teamPickerEmpty: "Nessuna squadra disponibile",

  cancelInviteCta: "Annulla invito",
  cancelInviteKeep: "Mantieni invito",
  cancelInviteBody: "L'invito non potrà più essere accettato.",
  cancelledToast: "Invito annullato",
  inviteAccepted: "L'invito è già stato accettato.",

  transferCta: "Trasferisci Owner",
  transferOpenCta: "Trasferisci Owner",
  transferPickerTitle: "Seleziona il nuovo Owner",
  transferContinueCta: "Continua",
  transferQuestion: "Trasferire la gestione principale?",
  transferNewOwnerSection: "Nuovo Owner",
  transferNewOwnerBadge: "Nuovo Owner",
  transferAfterSection: "Il tuo accesso dopo il trasferimento",
  transferAfterHelper: "Resterai amministratore, ma non sarai più Owner.",
  transferEmptyTitle: "Nessun amministratore disponibile",
  transferEmptyHelper:
    "Puoi trasferire la gestione a un amministratore attivo della società.",
  transferredToast: "Owner trasferito",
  transferCancelCta: "Annulla",

  societyFunctionsNotice:
    "Alcuni permessi del ruolo si applicano all'intera società. L'ambito limita le funzionalità legate alle squadre.",
  accessRevoked: "Non hai più accesso alla Dashboard di {society}.",
  offline: "Connessione assente. Riprova quando sei online.",
  pendingOutcome: "Stiamo verificando l'esito dell'operazione.",
  noAssignableRoles: "Non ci sono ruoli disponibili per questa assegnazione.",
  candidatesError: "Non siamo riusciti a caricare gli amministratori. Riprova.",
  inviteError: "Non siamo riusciti a caricare l'invito. Riprova.",
} as const;

/**
 * «a» o «ad» davanti a un nome proprio.
 *
 * Il master scrive «Revocare l'accesso **ad** Andrea Verdi?» e «l'accesso
 * amministrativo **ad** AC Como»: in italiano la d eufonica compare davanti
 * a vocale. Con un nome che inizia per consonante — «a Paolo Neri» — la d
 * sarebbe un errore, quindi la scelta non può essere una costante.
 *
 * La regola si ferma alla vocale iniziale: le varianti più fini della d
 * eufonica non sono osservabili in questa superficie, e inseguirle
 * produrrebbe una funzione che nessuno può verificare.
 */
export function prepositionFor(name: string): "a" | "ad" {
  return /^[aeiouàèéìòóù]/i.test(name.trim()) ? "ad" : "a";
}

/** Interpolazione dei nomi dinamici in un posto solo (§29). */
export function withSociety(template: string, societyName: string): string {
  return template
    .replace("{a}", prepositionFor(societyName))
    .replace("{society}", societyName);
}

export function revokeQuestion(fullName: string): string {
  return `Revocare l'accesso ${prepositionFor(fullName)} ${fullName}?`;
}

export function cancelInviteQuestion(name: string): string {
  return `Annullare l'invito ${prepositionFor(name)} ${name}?`;
}

export function newOwnerHelper(fullName: string, societyName: string): string {
  return `${fullName} diventerà Owner di ${societyName}.`;
}

/**
 * «Stai aggiungendo Under 18.» / «Stai rimuovendo Under 17.» (§15)
 *
 * «Per una riduzione chiarisci quali squadre escono dal perimetro, senza
 * usare un avviso rosso da revoca dell'intero account»: è una riga
 * informativa, e questa funzione produce soltanto il testo.
 */
export function scopeChangeNotice(input: {
  nextMode: "society" | "teams";
  nextNames: string[];
  previousMode: "society" | "teams";
  previousNames: string[];
}): string | null {
  if (input.previousMode === input.nextMode && input.nextMode === "society") {
    return null;
  }

  if (input.nextMode === "society" && input.previousMode === "teams") {
    return "Stai estendendo l'ambito a tutta la società.";
  }

  if (input.nextMode === "teams" && input.previousMode === "society") {
    return "Stai limitando l'ambito alle squadre selezionate.";
  }

  const previous = new Set(input.previousNames);
  const next = new Set(input.nextNames);
  const added = input.nextNames.filter((name) => !previous.has(name));
  const removed = input.previousNames.filter((name) => !next.has(name));

  const parts: string[] = [];

  if (added.length > 0) {
    parts.push(`Stai aggiungendo ${listNames(added)}.`);
  }

  if (removed.length > 0) {
    parts.push(`Stai rimuovendo ${listNames(removed)}.`);
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

function listNames(names: string[]): string {
  if (names.length === 1) {
    return names[0];
  }

  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** «2 squadre selezionate» (§16). Singolare gestito. */
export function teamSelectionLabel(countValue: number): string {
  return countValue === 1
    ? "1 squadra selezionata"
    : `${countValue} squadre selezionate`;
}

/**
 * Riepilogo della selezione nella pagina Ambito (§15).
 *
 * «Una selezione confermata mostra uno o pochi nomi leggibili, oppure un
 * count con accesso alla lista completa.» Due nomi è la stessa soglia di
 * `club_admin_scope_label`, così la riga e il server non si contraddicono.
 */
export function scopeSummary(names: string[]): string | null {
  if (names.length === 0) {
    return null;
  }

  return names.length <= 2 ? names.join(" · ") : `${names.length} squadre`;
}

/** Etichetta di stato di un invito (DAS-REV-13 §7.2, riusata). */
export const INVITE_STATE_LABEL: Record<AdminInviteState, string> = {
  accepted: "Invito accettato",
  expired: "Invito scaduto",
  pending: "Invito inviato",
  rejected: "Invito rifiutato",
  revoked: "Invito annullato",
};

export function inviteStatusLabel(invite: AdminInviteDetail): string {
  /* Un link esterno appena preparato non è una consegna: §23 vuole il suo
     stato reale. */
  if (invite.state === "pending" && invite.recipientKind === "email") {
    return "Link pronto";
  }

  return INVITE_STATE_LABEL[invite.state];
}

export function inviteRecipientName(invite: AdminInviteDetail): string {
  return invite.fullName ?? invite.emailDisplay ?? "Destinatario";
}
