/**
 * Copy e presentazione di Ruoli, permessi, ambito e ownership (§29).
 *
 * I testi del master stanno qui e non nelle schermate: la stessa frase
 * compare nel centro, nell'editor, nel dettaglio e nelle conferme, e quattro
 * copie divergerebbero alla prima correzione.
 *
 * I nomi di Società e persona sono dinamici e interpolati qui: §29 chiede
 * che siano «protetti da sanitizzazione», e un solo punto di costruzione è
 * la condizione per poterlo garantire.
 */
import type { RolesErrorCode } from "./roles-service";
import type { AreaLevel } from "./roles-types";

export const ROLES_COPY = {
  centerTitle: "Ruoli e permessi",
  centerHelper: "I permessi di un ruolo si applicano a chi lo utilizza.",
  createCta: "Crea ruolo",
  createTitle: "Crea ruolo",
  editTitle: "Modifica ruolo",
  nameLabel: "Nome ruolo",
  namePlaceholder: "Es. Responsabile settore giovanile",
  permissionsSection: "Permessi",
  saveCta: "Salva modifiche",
  cancelCta: "Annulla",
  confirmCta: "Conferma",
  confirmPermissionsCta: "Conferma permessi",
  customizeLink: "Personalizza singoli permessi",
  customizeTitle: "Personalizza permessi",
  customizeHelper: "Applicherai le modifiche salvando il ruolo.",
  customActive: "Configurazione personalizzata attiva",
  impactTitle: "Modifica da salvare",
  emptyTitle: "Nessun ruolo configurato",
  emptyHelper: "Crea un ruolo e scegli quali aree potrà utilizzare.",
  noAreasHelper: "Questo ruolo non concede accesso alle aree di gestione.",
  archiveCta: "Archivia ruolo",
  archiveTitle: "Archiviare questo ruolo?",
  archiveBody:
    "Non sarà più assegnabile. I riferimenti storici restano invariati.",
  archiveConfirm: "Archivia ruolo",
  archiveKeep: "Mantieni ruolo",
  createdToast: "Ruolo creato",
  updatedToast: "Ruolo aggiornato",
  archivedToast: "Ruolo archiviato",
  exitTitle: "Uscire senza salvare?",
  exitBody: "Le modifiche effettuate andranno perse.",
  exitKeep: "Continua a modificare",
  exitLeave: "Esci senza salvare",
  offline: "Sei offline · Dati non aggiornati",
  readOnly: "Hai accesso in sola lettura a questa configurazione.",
} as const;

/** «5 aree abilitate · 2 amministratori» (§8). Singolari gestiti davvero. */
export function roleRowMeta(input: {
  adminsCount: number;
  areasEnabled: number;
}): string {
  const areas =
    input.areasEnabled === 1 ? "1 area abilitata" : `${input.areasEnabled} aree abilitate`;
  const admins =
    input.adminsCount === 1
      ? "1 amministratore"
      : `${input.adminsCount} amministratori`;

  return `${areas} · ${admins}`;
}

/** «Utilizzato da 2 amministratori» (§10). Zero compreso. */
export function roleUsageLabel(adminsCount: number): string {
  if (adminsCount === 0) {
    return "Non ancora utilizzato";
  }

  return adminsCount === 1
    ? "Utilizzato da 1 amministratore"
    : `Utilizzato da ${adminsCount} amministratori`;
}

/**
 * «Si applicherà a 2 amministratori. Gli ambiti non cambiano.» (§10)
 *
 * «Gestisci singolare e zero utilizzatori correttamente»: con zero non c'è
 * nessuna platea da annunciare, e inventarne una sarebbe rumore.
 */
export function roleImpactLabel(adminsCount: number): string | null {
  if (adminsCount === 0) {
    return null;
  }

  const who =
    adminsCount === 1 ? "1 amministratore" : `${adminsCount} amministratori`;

  return `Si applicherà a ${who}. Gli ambiti non cambiano.`;
}

/** «Visualizza → Gestisci» (§10). */
export function levelTransition(
  previous: AreaLevel,
  next: AreaLevel,
  label: (level: AreaLevel) => string,
): string {
  return `${label(previous)} → ${label(next)}`;
}

/**
 * Copy degli errori (§29).
 *
 * «Errori vicino al campo quando pertinenti; nessun codice HTTP, stack trace
 * o valore sensibile nel messaggio.» Il codice non compare mai: la mappa è
 * esaustiva e `UNKNOWN` ha una frase propria.
 */
export const ROLES_ERROR_COPY: Record<RolesErrorCode, string> = {
  ADMIN_ACCESS_NOT_AUTHENTICATED: "Accedi di nuovo per continuare.",
  ADMIN_ACCESS_NOT_AUTHORIZED: "Non hai i permessi per questa operazione.",
  ADMIN_DETAIL_NOT_AUTHORIZED: "Non hai i permessi per vedere questo accesso.",
  ADMIN_INVITE_NOT_AUTHORIZED: "Non hai i permessi per gestire questo invito.",
  ADMIN_INVITE_REVISION_CONFLICT:
    "Questo invito è cambiato. Ricarica i dati per continuare.",
  ADMIN_INVITE_UNAVAILABLE: "Questo invito non è più disponibile.",
  ADMIN_MEMBERSHIP_NOT_FOUND:
    "Questa persona non ha più un accesso amministrativo.",
  ADMIN_OWNER_PROTECTED:
    "L'Owner non può essere modificato da qui. Trasferisci prima la gestione.",
  ADMIN_ROLE_NOT_GRANTABLE: "Non puoi assegnare questo ruolo.",
  ADMIN_ROLE_UNAVAILABLE: "Questo ruolo non è più disponibile.",
  ADMIN_SCOPE_EMPTY: "Seleziona almeno una squadra.",
  ADMIN_SCOPE_INVALID: "Scegli un ambito valido.",
  ADMIN_SCOPE_NOT_GRANTABLE: "Non puoi assegnare questo ambito.",
  ADMIN_TEAM_UNAVAILABLE:
    "Una delle squadre non è più disponibile. Controlla la selezione.",
  ADMIN_VERSION_CONFLICT:
    "Questa configurazione è stata modificata. Rivedi i dati prima di salvare.",
  OWNER_CANDIDATE_INVALID:
    "Questo amministratore non è più disponibile per il trasferimento.",
  OWNER_CHANGED:
    "La gestione della società è cambiata. Ricarica i dati per continuare.",
  OWNER_LEGACY_CONFIG_REQUIRED:
    "Scegli il ruolo e l'ambito che manterrai dopo il trasferimento.",
  OPERATION_CONTENT_CHANGED:
    "Questa operazione è già stata inviata con dati diversi. Ricarica e riprova.",
  OWNER_TRANSFER_NOT_AUTHENTICATED: "Accedi di nuovo per continuare.",
  OWNER_TRANSFER_NOT_AUTHORIZED:
    "Solo l'Owner può trasferire la gestione della società.",
  ROLE_ARCHIVED: "Questo ruolo è stato archiviato.",
  ROLE_CATALOG_CHANGED:
    "I permessi disponibili sono cambiati. Controlla le modifiche prima di salvare.",
  ROLE_IMPACT_CHANGED:
    "Gli amministratori interessati sono cambiati. Rivedi il riepilogo prima di salvare.",
  ROLE_NAME_DUPLICATE: "Esiste già un ruolo con questo nome.",
  ROLE_NAME_INVALID: "Inserisci un nome ruolo valido.",
  ROLE_NAME_RESERVED: "Questo nome è riservato. Scegline un altro.",
  ROLE_NOT_FOUND: "Questo ruolo non è più disponibile.",
  ROLE_PERMISSION_NOT_GRANTABLE:
    "Non puoi concedere tutti i permessi di questa configurazione.",
  ROLE_STILL_IN_USE:
    "Il ruolo è ancora utilizzato. Gestisci le assegnazioni e gli inviti prima di archiviarlo.",
  ROLE_VERSION_CONFLICT:
    "Questa configurazione è stata modificata. Rivedi i dati prima di salvare.",
  ROLES_NOT_AUTHENTICATED: "Accedi di nuovo per continuare.",
  ROLES_NOT_AUTHORIZED: "Non hai i permessi per gestire i ruoli.",
  UNKNOWN: "Non è stato possibile salvare le modifiche. Riprova.",
};

export function describeRolesError(code: RolesErrorCode): string {
  return ROLES_ERROR_COPY[code] ?? ROLES_ERROR_COPY.UNKNOWN;
}

/** Errori di caricamento, distinti dai comandi (§29). */
export const ROLES_LOAD_ERROR = {
  catalog: "Non siamo riusciti a caricare i permessi. Riprova.",
  list: "Non siamo riusciti a caricare i ruoli. Riprova.",
  teams: "Non siamo riusciti a caricare le squadre. Riprova.",
} as const;

/**
 * Validazione del nome, identica a `club_admin_role_normalize_name` (§9).
 *
 * «Usa un limite condiviso di 2–60 caratteri percepiti, evitando limiti
 * diversi fra client e server.» Il server rifiuta comunque: questa è la
 * validazione inline che §29 chiede «vicino al campo», non la protezione.
 */
export function normalizeRoleName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateRoleName(value: string): string | null {
  const normalized = normalizeRoleName(value);

  if (normalized.length < 2 || normalized.length > 60) {
    return ROLES_ERROR_COPY.ROLE_NAME_INVALID;
  }

  if (/[<>]/.test(normalized)) {
    return ROLES_ERROR_COPY.ROLE_NAME_INVALID;
  }

  if (
    ["owner", "proprietario", "owner della società", "accesso personalizzato"].includes(
      normalized.toLowerCase(),
    )
  ) {
    return ROLES_ERROR_COPY.ROLE_NAME_RESERVED;
  }

  return null;
}
