/**
 * Copy, stati derivati e ancore del dettaglio gestionale (DAS-REV-17 §7,
 * §10, §19, §28).
 *
 * Funzioni pure: nessuna legge la rete, la sessione o l'orologio se non
 * attraverso un parametro. È ciò che permette a §34 di verificare la
 * matrice di pubblicabilità senza montare una schermata, e a §35 di non
 * «copiare le condizioni del componente come unica prova».
 *
 * La readiness **non** viene ricalcolata qui: §10 — «Il client può
 * anticiparla usando lo stesso schema, ma non costituisce l'autorità finale
 * per pubblicare» — e `readinessOf` del composer legge i `blockers` che il
 * server ha prodotto. Questo modulo li traduce in righe leggibili, non in
 * un secondo verdetto.
 */
import {
  COMPOSE_COPY,
  ageSummary,
  availabilitySummary,
  experienceSummary,
  listNames,
  playerExperienceSummary,
  readinessOf,
  situationSummary,
} from "../compose/compose-presentation";
import { POSITION_SCHEMAS } from "../compose/compose-schema";
import type {
  PositionBlocker,
  PositionCatalogs,
  PositionReadiness,
} from "../compose/compose-types";
import { DETAILS_SECTION_ANCHOR } from "./manage-routes";
import type { PositionManageDetail, PositionMissingItem } from "./manage-types";

/**
 * §28, più le frasi che §7, §15 e §19 citano letteralmente.
 *
 * Un posto solo: il dettaglio, l'editor, lo sheet di conferma e quello
 * informativo usano le stesse parole, e §28 chiede di «adattare le formule
 * al sistema di localizzazione esistente mantenendo il significato» — cosa
 * impossibile se la stessa frase vive in quattro componenti.
 */
export const MANAGE_COPY = {
  /** §7, bozza essenziale pubblicabile. */
  addDetailsAction: "Aggiungi dettagli",
  addDetailsGuidance:
    "Puoi pubblicare la posizione anche adesso oppure aggiungere altre informazioni utili ai candidati.",
  /** §7, bozza incompleta. */
  completeAction: "Completa posizione",
  completeGuidance:
    "Completa le informazioni obbligatorie prima di pubblicare la posizione.",
  /** §28. */
  accessLost: "Non hai più accesso a questa posizione.",
  ageInvalidRange: "Inserisci un intervallo di età valido.",
  ageUnset: "Imposta un intervallo oppure scegli Nessun limite di età.",
  editAction: "Modifica posizione",
  editDetailsAction: "Modifica dettagli",
  editLost: "Non puoi più modificare questa posizione.",
  editTitle: "Modifica posizione",
  exitBody: "Le modifiche effettuate andranno perse.",
  exitDiscard: "Esci senza salvare",
  exitKeep: "Continua a modificare",
  exitTitle: "Uscire senza salvare?",
  gone: "Questa posizione non è più disponibile.",
  /** §19, lo sheet informativo dello screen 10. */
  lockedAck: "Ho capito",
  lockedGroupLabel: "Informazioni della posizione",
  lockedGroupNote: "Queste informazioni restano fisse dopo la pubblicazione.",
  lockedInfoAction: "Perché non posso modificarle?",
  lockedInfoTail:
    "Se devi cercare un profilo diverso, chiudi questa posizione e creane una nuova.",
  lockedInfoTitle: "Informazioni non modificabili",
  manageApplications: "Gestisci candidature",
  offline: "Connessione assente. Riprova quando sei online.",
  /** §15, lo sheet di conferma dello screen 05. */
  publishAction: "Pubblica posizione",
  publishCancel: "Annulla",
  publishConsequence:
    "La posizione diventerà visibile su PROLINK e potrà ricevere candidature.",
  publishFailed: "Non è stato possibile pubblicare la posizione. Riprova.",
  publishPreview: "Vedi anteprima annuncio",
  publishSuccess: "Posizione pubblicata",
  readOnly: "Sola consultazione",
  /** §27. */
  retry: "Riprova",
  loadFailed: "Non è stato possibile caricare la posizione. Riprova.",
  /** §28. */
  saveAction: "Salva modifiche",
  saveFailed: "Non è stato possibile salvare le modifiche. Riprova.",
  saveSuccess: "Modifiche salvate",
  /** §7, bozza pronta. */
  readyLabel: "Pronta per la pubblicazione",
  sectionDetails: "Dettagli dell'annuncio",
  toComplete: "Da completare",
  toSet: "Da impostare",
  teamUnavailable:
    "La squadra selezionata non è più disponibile. Controlla la posizione.",
  versionConflict:
    "La posizione è stata aggiornata. Controlla la versione più recente prima di salvare.",
} as const;

/**
 * Lo stato neutro accanto al titolo (§18, §31).
 *
 * «"Bozza", "Attiva", "Da completare" e "Pronta per la pubblicazione" sono
 * stati sobri: niente grandi badge verdi.» Sono quindi testo, e la funzione
 * restituisce una stringa, non un tono.
 */
export function lifecycleLabel(detail: {
  lifecycle: PositionManageDetail["lifecycle"];
}): string {
  switch (detail.lifecycle) {
    case "published":
      return "Attiva";
    case "closed":
      return "Chiusa";
    default:
      return "Bozza";
  }
}

/**
 * La condizione della bozza, nei quattro casi di §7.
 *
 * Delegata a `readinessOf` del composer: §8 vieta di «duplicare tassonomie o
 * obbligatorietà nel dettaglio», e la differenza fra Allenatore pronto e
 * Staff da arricchire viene dalla `guidance` dello schema, non da un elenco
 * di eccezioni scritto qui.
 */
export function draftReadiness(detail: PositionManageDetail): PositionReadiness {
  return readinessOf(detail);
}

/**
 * Il titolo del blocco di guida nel dettaglio di una bozza (§7).
 *
 * `null` su una Position attiva: §18 vieta di presentarla «come un form da
 * completare».
 */
export function readinessHeadline(
  detail: PositionManageDetail,
): string | null {
  if (detail.lifecycle !== "draft") {
    return null;
  }

  switch (draftReadiness(detail)) {
    case "incomplete":
      return MANAGE_COPY.toComplete;
    case "suggest_details":
      return "Aggiungi dettagli per completare l'annuncio";
    default:
      return MANAGE_COPY.readyLabel;
  }
}

/** La frase sotto il titolo di guida. `null` quando non ce n'è una (§7). */
export function readinessBody(detail: PositionManageDetail): string | null {
  if (detail.lifecycle !== "draft") {
    return null;
  }

  switch (draftReadiness(detail)) {
    case "incomplete":
      return MANAGE_COPY.completeGuidance;
    case "suggest_details":
      return MANAGE_COPY.addDetailsGuidance;
    default:
      return null;
  }
}

/**
 * L'azione leggera accanto alla guida (§7, screen 01 e 04).
 *
 * «Aggiungi dettagli» su una bozza essenziale, «Modifica dettagli» su una
 * arricchita, nessuna azione su una incompleta — lì il comando è la
 * primaria «Completa posizione», e due inviti allo stesso form sarebbero
 * due modi di dire la stessa cosa.
 */
export function readinessLinkLabel(
  detail: PositionManageDetail,
): string | null {
  if (detail.lifecycle !== "draft" || draftReadiness(detail) === "incomplete") {
    return null;
  }

  return detail.hasDetails
    ? MANAGE_COPY.editDetailsAction
    : MANAGE_COPY.addDetailsAction;
}

/**
 * Il campo dell'editor a cui un blocker rimanda (§6).
 *
 * `null` quando il blocker non corrisponde a un campo di quel form — la
 * scadenza vive nell'anteprima, e un Team disattivato non si risolve
 * scrivendo in un input.
 */
export function blockerAnchor(blocker: PositionBlocker): string | null {
  switch (blocker) {
    case "AGE_OUT_OF_BOUNDS":
    case "AGE_RANGE_INCOMPLETE":
    case "AGE_RANGE_INVALID":
    case "AGE_UNSET":
      return "ageRange";
    case "CUSTOM_ROLE_MISSING":
      return "customRoleName";
    case "ROLE_INVALID":
    case "ROLE_MISSING":
      return "roleId";
    case "SCOPE_CONFLICT":
    case "SCOPE_NOT_ALLOWED":
      return "scope";
    case "TEAM_MISSING":
    case "TEAM_UNAVAILABLE":
      return "teamId";
    case "SECONDARY_TEAM_UNAVAILABLE":
      return "secondaryTeams";
    case "AVAILABILITY_DATE_INVALID":
    case "AVAILABILITY_INVALID":
    case "AVAILABILITY_SEASON_INVALID":
      return "availability";
    case "DESCRIPTION_TOO_LONG":
      return "description";
    case "REQUIREMENTS_TOO_LONG":
      return "requirements";
    case "RESPONSIBILITIES_TOO_LONG":
      return "responsibilities";
    case "STAFF_QUALIFICATION_TOO_LONG":
      return "staffQualification";
    case "QUALIFICATION_INVALID":
      return "coachQualificationId";
    case "EXPERIENCE_CATEGORY_INVALID":
    case "EXPERIENCE_INVALID":
    case "EXPERIENCE_NEEDS_TEAM_CONTEXT":
      return "experience";
    case "SITUATION_INVALID":
      return "playerSituation";
    default:
      return null;
  }
}

const BLOCKER_LABELS: Partial<Record<PositionBlocker, string>> = {
  AGE_OUT_OF_BOUNDS: "Fascia d'età",
  AGE_RANGE_INCOMPLETE: "Fascia d'età",
  AGE_RANGE_INVALID: "Fascia d'età",
  AGE_UNSET: "Fascia d'età",
  AVAILABILITY_DATE_INVALID: "Disponibilità richiesta",
  AVAILABILITY_INVALID: "Disponibilità richiesta",
  AVAILABILITY_SEASON_INVALID: "Disponibilità richiesta",
  CUSTOM_ROLE_MISSING: "Nome del ruolo",
  DEADLINE_PASSED: "Scadenza candidature",
  DESCRIPTION_TOO_LONG: "Descrizione",
  EXPERIENCE_CATEGORY_INVALID: "Esperienza richiesta",
  EXPERIENCE_INVALID: "Esperienza richiesta",
  EXPERIENCE_NEEDS_TEAM_CONTEXT: "Esperienza richiesta",
  POSITION_NOT_FOUND: "Posizione",
  QUALIFICATION_INVALID: "Patentino richiesto",
  REQUIREMENTS_TOO_LONG: "Requisiti aggiuntivi",
  RESPONSIBILITIES_TOO_LONG: "Aree di responsabilità",
  ROLE_INVALID: "Ruolo",
  ROLE_MISSING: "Ruolo",
  SCOPE_CONFLICT: "Ambito dell'incarico",
  SCOPE_NOT_ALLOWED: "Ambito dell'incarico",
  SECONDARY_TEAM_UNAVAILABLE: "Altre squadre coinvolte",
  SITUATION_INVALID: "Situazione del calciatore",
  STAFF_QUALIFICATION_TOO_LONG: "Qualifica richiesta",
  TEAM_MISSING: "Squadra",
  TEAM_UNAVAILABLE: "Squadra",
};

const BLOCKER_HINTS: Partial<Record<PositionBlocker, string>> = {
  AGE_OUT_OF_BOUNDS: MANAGE_COPY.ageInvalidRange,
  AGE_RANGE_INCOMPLETE: MANAGE_COPY.ageInvalidRange,
  AGE_RANGE_INVALID: MANAGE_COPY.ageInvalidRange,
  /* §10 cita questa frase per lettera, nel caso Attaccante dello screen 06. */
  AGE_UNSET: MANAGE_COPY.ageUnset,
  CUSTOM_ROLE_MISSING: COMPOSE_COPY.roleCustomRequired,
  DEADLINE_PASSED: "La scadenza è già passata. Scegli una nuova data o rimuovila.",
  ROLE_MISSING: COMPOSE_COPY.roleRequired,
  SCOPE_CONFLICT: COMPOSE_COPY.scopeRequired,
  SCOPE_NOT_ALLOWED: COMPOSE_COPY.scopeRequired,
  SECONDARY_TEAM_UNAVAILABLE: COMPOSE_COPY.teamUnavailable,
  TEAM_MISSING: COMPOSE_COPY.teamRequired,
  TEAM_UNAVAILABLE: COMPOSE_COPY.teamUnavailable,
};

/**
 * L'elenco «Da completare» (§7).
 *
 * «L'elenco deve derivare dagli errori reali e permettere di raggiungere i
 * campi corretti.» Deriva quindi dai `blockers` del server, non da un
 * controllo locale sui campi vuoti, e ogni riga porta l'ancora che apre
 * l'editor su quel campo.
 *
 * Il valore corrente accompagna la riga perché lo screen 06 lo mostra —
 * «Fascia d'età · Da impostare» — e perché un elenco di soli nomi non
 * direbbe se il problema è l'assenza o la forma.
 */
/**
 * Il valore che accompagna una riga mancante, quando dirlo aiuta.
 *
 * Lo screen 06 mostra «Fascia d'età · Da impostare»: la riga dice cosa manca
 * **e** com'è adesso. Per un blocker di forma — un intervallo invertito — il
 * valore corrente è già nel campo, e ripeterlo sulla riga di errore non
 * aggiunge nulla: `null`.
 */
function missingValue(
  detail: PositionManageDetail,
  blocker: PositionBlocker,
): string | null {
  switch (blocker) {
    case "AGE_UNSET":
    case "ROLE_MISSING":
    case "TEAM_MISSING":
      return MANAGE_COPY.toSet;
    case "AGE_RANGE_INCOMPLETE":
    case "AGE_RANGE_INVALID":
    case "AGE_OUT_OF_BOUNDS":
      return ageSummary(detail);
    case "TEAM_UNAVAILABLE":
      return detail.teamName;
    default:
      return null;
  }
}

export function missingItems(
  detail: PositionManageDetail,
): PositionMissingItem[] {
  const seen = new Set<string>();
  const out: PositionMissingItem[] = [];

  for (const blocker of detail.blockers) {
    const label = BLOCKER_LABELS[blocker];

    if (!label || seen.has(label)) {
      continue;
    }

    seen.add(label);

    out.push({
      anchor: blockerAnchor(blocker),
      hint: BLOCKER_HINTS[blocker] ?? COMPOSE_COPY.textTooLong,
      label,
      value: missingValue(detail, blocker),
    });
  }

  return out;
}

/**
 * L'ancora della primaria «Completa posizione» (§6).
 *
 * «Stesso editor, sul primo campo obbligatorio mancante.» Il primo è quello
 * dei blockers, non il primo dello schema: il server li produce
 * nell'ordine in cui li valuta, e quell'ordine è già ruolo → ambito →
 * squadra → età → dettagli.
 */
export function firstMissingAnchor(
  detail: PositionManageDetail,
): string | null {
  for (const blocker of detail.blockers) {
    const anchor = blockerAnchor(blocker);

    if (anchor) {
      return anchor;
    }
  }

  return DETAILS_SECTION_ANCHOR;
}

/**
 * Il corpo dello sheet «Informazioni non modificabili» (§19).
 *
 * «Per un incarico Intera società adatta la prima frase al contesto,
 * includendo l'ambito invece di una squadra inesistente.»
 */
export function lockedInfoBody(detail: {
  scope: PositionManageDetail["scope"];
}): string {
  return detail.scope === "society"
    ? "Profilo, ruolo e ambito dell'incarico non possono essere modificati dopo la pubblicazione."
    : "Profilo, ruolo e squadra principale non possono essere modificati dopo la pubblicazione.";
}

/**
 * La riga dei conteggi, quando autorizzati e noti (§18).
 *
 * «12 candidature · 3 nuove». `null` quando l'actor non li può vedere o
 * quando non sono ancora arrivati: §18 vieta di «sostituire un count
 * sconosciuto con zero», e una riga assente è diversa da una riga a zero.
 */
export function applicationsLine(detail: {
  applicationsNew: number | null;
  applicationsTotal: number | null;
  countsAvailable: boolean;
}): string | null {
  if (!detail.countsAvailable || detail.applicationsTotal === null) {
    return null;
  }

  const total = detail.applicationsTotal;
  const head = total === 1 ? "1 candidatura" : `${total} candidature`;

  if (!detail.applicationsNew) {
    return head;
  }

  return `${head} · ${detail.applicationsNew} nuove`;
}

/** Le sezioni leggibili del dettaglio (§7, §18). */
export type ManageSection = { key: string; label: string; value: string };

/**
 * Le sezioni compilate, nell'ordine dello schema del profilo.
 *
 * «Le informazioni facoltative effettivamente presenti appaiono come
 * sezioni leggibili; quelle vuote non producono blocchi "Non specificato"»
 * (§7) e «Le sezioni facoltative vuote sono omesse» (§18). Da qui il `push`
 * condizionale: una sezione nasce solo quando ha un valore.
 *
 * L'ordine viene dallo schema condiviso e non da una lista locale, così il
 * dettaglio non riordina ciò che l'editor ha appena mostrato.
 */
export function detailSections(
  detail: PositionManageDetail,
  catalogs: PositionCatalogs,
): ManageSection[] {
  const out: ManageSection[] = [];
  const push = (key: string, label: string, value: string | null | undefined) => {
    if (value) {
      out.push({ key, label, value });
    }
  };

  for (const field of POSITION_SCHEMAS[detail.profileType].fields) {
    switch (field.kind) {
      case "ageRange":
        push(field.key, field.label, ageSummary(detail));
        break;
      case "availability":
        push(
          field.key,
          field.label,
          availabilitySummary(detail.details.availability, catalogs.seasons),
        );
        break;
      case "coachQualification":
        push(
          field.key,
          field.label,
          catalogs.qualifications.find(
            (entry) => entry.id === detail.details.coachQualificationId,
          )?.label,
        );
        break;
      case "experienceMulti":
        push(
          field.key,
          field.label,
          experienceSummary(detail.details.experience, catalogs.experiences),
        );
        break;
      case "playerExperience":
        push(
          field.key,
          field.label,
          playerExperienceSummary(
            detail.details.playerExperience,
            catalogs.categories,
          ),
        );
        break;
      case "playerSituation":
        push(
          field.key,
          field.label,
          situationSummary(detail.details.playerSituation),
        );
        break;
      case "secondaryTeams":
        push(
          field.key,
          field.label,
          detail.secondaryTeams.length > 0
            ? listNames(detail.secondaryTeams.map((team) => team.name))
            : null,
        );
        break;
      default: {
        /* `description` è una colonna, gli altri testi vivono in `details`:
           la differenza è di persistenza, non di presentazione. */
        const value =
          field.key === "description"
            ? detail.description
            : ((detail.details as Record<string, unknown>)[field.key] as
                | string
                | undefined);

        push(field.key, field.label, value ?? null);
      }
    }
  }

  return out;
}
