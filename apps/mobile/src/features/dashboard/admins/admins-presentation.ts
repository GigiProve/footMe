/**
 * Copy e regole di presentazione del Centro Amministratori (§30).
 *
 * I testi del master stanno qui e non nelle schermate: la stessa frase
 * compare nel centro, nel composer e nella ricezione, e tre copie
 * divergerebbero alla prima correzione.
 */
import type {
  AdminCandidateStatus,
  AdminInviteRow,
  AdminScopeMode,
  MyAdminInviteState,
} from "./admins-types";
import type { AdminErrorCode } from "./admins-service";

export const ADMIN_COPY = {
  centerTitle: "Amministratori",
  activeSection: "Amministratori attivi",
  pendingSection: "Inviti in attesa",
  rolesRow: "Ruoli e permessi",
  inviteCta: "Invita amministratore",
  searchTitle: "Invita amministratore",
  searchPlaceholder: "Cerca per nome",
  notFoundQuestion: "Non trovi la persona?",
  externalCta: "Invitala su PROLINK",
  externalTitle: "Invita su PROLINK",
  recipientSection: "Destinatario",
  roleLabel: "Ruolo",
  scopeLabel: "Ambito",
  sendCta: "Invia invito",
  shareCta: "Condividi invito",
  shareHint: "WhatsApp, email o copia link",
  shareBody:
    "Condividi un link. Dopo l'accesso a PROLINK, la persona potrà verificare e accettare l'invito.",
  emailLabel: "Email del destinatario",
  reviewTitle: "Invito ad amministrare",
  invitingSociety: "Società invitante",
  acceptCta: "Accetta",
  rejectCta: "Rifiuta",
  reviewHelper: "L'accesso si attiverà dopo la tua accettazione.",
  landingHelper:
    "Apri l'invito nell'app. Se non l'hai, ti guideremo a scaricarla.",
  landingFooter: "L'accesso alla società si attiva solo dopo l'accettazione.",
  landingCta: "Apri invito su PROLINK",
  landingUnavailable: "Invito non disponibile",
  emptyPending: "Nessun invito in attesa",
  emptyAdmins: "Nessun amministratore in questo ambito",
  emptySearch: "Nessuna persona trovata",
  exitTitle: "Uscire senza inviare?",
  exitBody: "Le modifiche all'invito andranno perse.",
  exitKeep: "Continua a modificare",
  exitLeave: "Esci senza inviare",
  offline: "Sei offline · Dati non aggiornati",
} as const;

/** Stato di una persona nella ricerca (§8). Testo, non badge di warning. */
export const CANDIDATE_STATUS_LABEL: Record<AdminCandidateStatus, string | null> =
  {
    already_admin: "Già amministratore",
    already_invited: "Invito già inviato",
    eligible: null,
  };

/**
 * Etichetta di un invito pending (§7.2).
 *
 * «Nel master l'invito interno usa "Invito inviato". Per un link esterno
 * soltanto generato usa "Link pronto": apertura/chiusura del native share non
 * dimostrano consegna.»
 */
export function inviteChannelLabel(row: AdminInviteRow): string {
  return row.recipientKind === "member" ? "Invito inviato" : "Link pronto";
}

/** Nome visibile del destinatario di un invito, senza inventare account. */
export function inviteRecipientName(row: AdminInviteRow): string {
  return row.fullName ?? row.emailDisplay ?? "Destinatario";
}

export const SCOPE_MODE_LABEL: Record<AdminScopeMode, string> = {
  society: "Intera società",
  teams: "Seleziona squadre",
};

/**
 * Conteggio accanto al titolo di una sezione (§7.1).
 *
 * `null` non diventa "0": una sezione non leggibile non ha un numero, e
 * §25 vieta «un count zero accanto a dati non caricati».
 */
export function sectionCount(value: number | null): string | null {
  return value === null ? null : String(value);
}

/** Label accessibile della sezione, con pluralizzazione corretta (§31). */
export function sectionAccessibilityLabel(
  title: string,
  value: number | null,
  singular: string,
  plural: string,
): string {
  if (value === null) {
    return title;
  }

  return `${title}: ${value} ${value === 1 ? singular : plural}`;
}

/** Helper del composer, parametrico sul nome reale (§9). */
export function consentHelper(recipientName: string): string {
  return `${recipientName} potrà accettare o rifiutare l'invito. L'accesso si attiverà solo dopo l'accettazione.`;
}

/** Copy della landing e della ricezione, parametriche sulla Società (§13, §16). */
export function landingHeading(clubName: string): string {
  return `${clubName} ti invita su PROLINK`;
}

export function landingBody(clubName: string): string {
  return `Sei stato invitato ad amministrare ${clubName}.`;
}

export function reviewBody(clubName: string): string {
  return `${clubName} ti invita ad amministrare la società su PROLINK.`;
}

/** Testo condiviso dal native share (§12). Senza email né dati interni. */
export function shareMessage(input: {
  clubName: string;
  link: string;
}): string {
  return `${input.clubName} ti invita ad amministrare la società su PROLINK. Apri l'invito per verificarlo: ${input.link}`;
}

/**
 * Stato della ricezione diverso da `pending` (§25).
 *
 * «Hai già accettato questo invito. Accesso attuale verificato prima di
 * offrire Dashboard»: per questo `accepted` distingue i due casi invece di
 * promettere un accesso che potrebbe essere stato revocato.
 */
export function describeMyInviteState(
  state: MyAdminInviteState,
  membershipActive: boolean,
): string | null {
  switch (state) {
    case "accepted":
      return membershipActive
        ? "Hai già accettato questo invito."
        : "Hai accettato questo invito, ma l'accesso non è più attivo.";
    case "expired":
      return "Questo invito è scaduto.";
    case "rejected":
      return "Hai rifiutato questo invito.";
    case "revoked":
      return "Questo invito non è più disponibile.";
    default:
      return null;
  }
}

/**
 * Messaggio di errore per codice (§30).
 *
 * «Per esito incerto non usare un messaggio che affermi un rollback
 * avvenuto»: `UNKNOWN` non dice che l'operazione è fallita, dice che non si sa.
 */
export function describeAdminError(code: AdminErrorCode): string {
  switch (code) {
    case "ADMIN_CENTER_NOT_AUTHORIZED":
      return "Non hai più accesso a questa area della società.";
    case "ADMIN_INVITE_NOT_AUTHORIZED":
      return "Non puoi più inviare inviti per questa società.";
    case "ADMIN_INVITE_ALREADY_ADMIN":
      return "Questa persona è già amministratore.";
    case "ADMIN_INVITE_ALREADY_PENDING":
      return "Esiste già un invito in attesa per questa persona.";
    case "ADMIN_INVITE_EMAIL_INVALID":
      return "Inserisci un indirizzo email valido.";
    case "ADMIN_INVITE_ROLE_UNAVAILABLE":
      return "Questo ruolo non è più disponibile per l'invito.";
    case "ADMIN_INVITE_TEAM_UNAVAILABLE":
      return "Una delle squadre selezionate non è più disponibile.";
    case "ADMIN_INVITE_SCOPE_INVALID":
      return "Seleziona almeno una squadra.";
    case "ADMIN_INVITE_RECIPIENT_INVALID":
      return "Scegli un destinatario per l'invito.";
    case "ADMIN_INVITE_PROPOSAL_CHANGED":
    case "ADMIN_INVITE_REVISION_CONFLICT":
      return "L'invito è cambiato o non è più disponibile. Controlla i dettagli e riprova.";
    case "ADMIN_INVITE_GRANTOR_UNAUTHORIZED":
      return "Chi ha inviato questo invito non può più concedere questo accesso.";
    case "ADMIN_INVITE_UNAVAILABLE":
      return "Questo invito non è più disponibile.";
    case "ADMIN_INVITE_NOT_AUTHENTICATED":
      return "Accedi per continuare.";
    case "OPERATION_CONTENT_CHANGED":
      return "L'invito è cambiato o non è più disponibile. Controlla i dettagli e riprova.";
    case "RATE_LIMIT":
      return "Hai inviato troppi inviti. Riprova più tardi.";
    default:
      return "Stiamo verificando l'esito dell'operazione.";
  }
}

/** Validazione locale: non sostituisce quella del server, la anticipa (§30). */
export function validateDraft(input: {
  email?: string | null;
  isExternal: boolean;
  roleId: string | null;
  scopeMode: AdminScopeMode;
  teamIds: string[];
}): string | null {
  if (input.isExternal && !isValidEmail(input.email ?? "")) {
    return "Inserisci un indirizzo email valido.";
  }

  if (!input.roleId) {
    return "Seleziona un ruolo.";
  }

  if (input.scopeMode === "teams" && input.teamIds.length === 0) {
    return "Seleziona almeno una squadra.";
  }

  return null;
}

/**
 * Stessa forma accettata da `normalize_account_email` lato server.
 *
 * Non è la validazione autorevole — §12 la mette sul backend — ma deve
 * accettare e rifiutare le stesse stringhe, altrimenti il form bloccherebbe
 * indirizzi validi o passerebbe al server ciò che rifiuterà comunque.
 */
export function isValidEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}
