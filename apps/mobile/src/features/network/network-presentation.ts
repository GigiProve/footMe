/**
 * Copy e derivazioni della Rete societaria (§8, §9, §23, §29).
 *
 * Qui vive l'italiano; il servizio resta sui codici. La separazione è la
 * stessa del Centro Squadre e serve a una cosa concreta: un messaggio non
 * può nascere da un errore che il backend non ha davvero sollevato.
 */
import type {
  LinkEligibility,
  NetworkCapability,
  NetworkHeader,
  NetworkRequestItem,
  PendingInviteItem,
  RelationshipType,
  RelationshipView,
} from "./network-types";
import type { NetworkErrorCode } from "./network-service";

export function hasNetworkCapability(
  header: NetworkHeader | null,
  capability: NetworkCapability,
): boolean {
  return header?.capabilities.includes(capability) ?? false;
}

/** "Cantù, CO" — città e sigla provincia, come nel master. */
export function locationLabel(
  city: string | null,
  province: string | null,
  region: string | null,
): string | null {
  const parts = [city, province ?? region].filter(
    (part): part is string => !!part && part.length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * "2 collegamenti attivi" (§8).
 *
 * `null` non diventa "0 collegamenti": un conteggio non consultabile si
 * omette, non si inventa.
 */
export function activeCountLabel(total: number | null): string | null {
  if (total == null) {
    return null;
  }

  return total === 1 ? "1 collegamento attivo" : `${total} collegamenti attivi`;
}

export type NetworkSection = {
  data: RelationshipView[];
  key: string;
  title: string;
};

/**
 * Raggruppa per tipo **e prospettiva** (§8).
 *
 * Il backend ordina già per `group_sort` e nome: qui non si riordina, si
 * accorpa. Un gruppo vuoto non esiste — §8: «Non mostrare sezioni senza
 * contenuti» — perché nasce solo dalle righe che arrivano.
 */
export function groupActiveRelationships(
  items: readonly RelationshipView[],
): NetworkSection[] {
  const sections: NetworkSection[] = [];

  for (const item of items) {
    const title = item.groupLabel ?? item.typeLabel;
    const key = `${item.typeId}:${item.viewerSide}`;
    const last = sections[sections.length - 1];

    if (last && last.key === key) {
      last.data.push(item);
      continue;
    }

    sections.push({ data: [item], key, title });
  }

  return sections;
}

export type RequestSection = {
  data: NetworkRequestItem[];
  key: "received" | "sent";
  title: string;
};

/**
 * Ricevute e Inviate come heading leggeri (§9).
 *
 * «Separare attraverso heading leggeri Ricevute e Inviate, senza creare
 * altri due livelli di tab.» Gli inviti esterni stanno fra le Inviate: sono
 * proposte partite da questa Società, anche se il destinatario canonico non
 * è ancora noto.
 */
export function groupRequests(
  items: readonly NetworkRequestItem[],
): RequestSection[] {
  const received = items.filter((item) => item.kind === "received");
  const sent = items.filter((item) => item.kind !== "received");
  const sections: RequestSection[] = [];

  if (received.length > 0) {
    sections.push({ data: received, key: "received", title: "Ricevute" });
  }

  if (sent.length > 0) {
    sections.push({ data: sent, key: "sent", title: "Inviate" });
  }

  return sections;
}

/** Stato esplicito di una riga della tab Richieste (§9). */
export function requestStatusLabel(item: NetworkRequestItem): string {
  if (item.kind === "received") {
    return `${item.relationship.typeLabel} · Richiesta ricevuta`;
  }

  if (item.kind === "sent") {
    return `${item.relationship.typeLabel} · In attesa`;
  }

  return `${item.invite.typeLabel} · ${inviteStateLabel(item.invite)}`;
}

/**
 * §17: «rappresentare il percorso come Invito esterno con stato reale, per
 * esempio Link disponibile o In attesa della società».
 */
export function inviteStateLabel(invite: PendingInviteItem): string {
  switch (invite.state) {
    case "valid":
      return "Invito esterno · Link disponibile";
    case "expired":
      return "Invito esterno · Scaduto";
    case "revoked":
      return "Invito esterno · Revocato";
    case "resolved":
    default:
      return "Invito esterno · In attesa della società";
  }
}

export function inviteTitle(invite: PendingInviteItem): string {
  return invite.descriptiveName ?? "Invito esterno";
}

/** §10: lo stato del risultato di ricerca, mai un booleano generico. */
export function eligibilityLabel(
  eligibility: LinkEligibility | undefined,
): string | null {
  if (!eligibility) {
    return null;
  }

  switch (eligibility.state) {
    case "linked":
      return eligibility.availableTypeIds.length > 0
        ? "Già collegata · altri collegamenti possibili"
        : "Già collegata";
    case "pending":
      return eligibility.availableTypeIds.length > 0
        ? "Richiesta in attesa · altri collegamenti possibili"
        : "Richiesta in attesa";
    case "self":
      return "Questa è la tua società";
    case "eligible":
    default:
      return null;
  }
}

export function isSelectableResult(
  eligibility: LinkEligibility | undefined,
): boolean {
  if (!eligibility) {
    return true;
  }

  if (eligibility.state === "self") {
    return false;
  }

  return eligibility.availableTypeIds.length > 0;
}

/** Periodo dello storico: "12 mar – 11 set 2026" (§23). */
export function historyPeriodLabel(item: RelationshipView): string | null {
  if (!item.acceptedAt || !item.endedAt) {
    return null;
  }

  const start = new Date(item.acceptedAt);
  const end = new Date(item.endedAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const sameYear = start.getFullYear() === end.getFullYear();

  return `${shortDate(start, !sameYear)} – ${shortDate(end, true)}`;
}

const MONTHS = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

function shortDate(value: Date, withYear: boolean): string {
  const base = `${value.getDate()} ${MONTHS[value.getMonth()]}`;

  return withYear ? `${base} ${value.getFullYear()}` : base;
}

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
];

/** "12 marzo 2026" — la data di `accepted_at` nel dettaglio (§21). */
export function longDateLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getDate()} ${LONG_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Ruoli proponibili per un tipo direzionale (§11).
 *
 * Il campo "AC Como sarà" offre i ruoli del catalogo, non due stringhe
 * scritte nella schermata.
 */
export function roleOptions(
  type: RelationshipType | undefined,
): { id: string; label: string }[] {
  if (!type || !type.isDirectional) {
    return [];
  }

  const options: { id: string; label: string }[] = [];

  if (type.roleAId && type.roleALabel) {
    options.push({ id: type.roleAId, label: type.roleALabel });
  }

  if (type.roleBId && type.roleBLabel) {
    options.push({ id: type.roleBId, label: type.roleBLabel });
  }

  return options;
}

/**
 * Frase della proposta prima dell'invio (§11).
 *
 * «Il testo della proposta deve descrivere ciò che sarà effettivamente
 * inviato.» Il template arriva dal catalogo e i due nomi dalla direzione
 * scelta: invertire il ruolo riscrive la frase perché riscrive i lati, non
 * perché una condizione nel client ha scambiato due etichette.
 */
export function buildDraftSentence(input: {
  currentName: string;
  roleId: string | null;
  targetName: string;
  type: RelationshipType | undefined;
}): string | null {
  const { currentName, roleId, targetName, type } = input;

  if (!type) {
    return null;
  }

  if (!type.isDirectional) {
    return applyTemplate(type.draftTemplate, currentName, targetName);
  }

  if (!roleId) {
    return null;
  }

  return roleId === type.roleAId
    ? applyTemplate(type.draftTemplate, currentName, targetName)
    : applyTemplate(type.draftTemplate, targetName, currentName);
}

/**
 * Stesso motore delle frasi del backend (§7).
 *
 * `{to_a}` / `{to_b}` producono "a Como" o "ad AC Como": l'elisione davanti a
 * vocale è una regola della lingua, e duplicarla a mano in ogni schermata
 * significherebbe sbagliarla in una.
 */
export function applyTemplate(
  template: string,
  nameA: string,
  nameB: string,
): string {
  return template
    .replace("{to_a}", prepositionA(nameA))
    .replace("{to_b}", prepositionA(nameB))
    .replace("{a}", nameA)
    .replace("{b}", nameB);
}

export function prepositionA(name: string): string {
  if (!name) {
    return "";
  }

  return /^[aeiouAEIOU]/.test(name) ? `ad ${name}` : `a ${name}`;
}

/** §29 — copy di errore. Nessun HTTP, nessuno stack, nessun nome di tabella. */
export function describeNetworkError(code: NetworkErrorCode): string {
  switch (code) {
    case "NETWORK_NOT_AUTHORIZED":
      return "Non puoi gestire questa richiesta con la società selezionata.";
    case "RELATIONSHIP_SELF_LINK":
      return "Non puoi collegare una società a sé stessa.";
    case "RELATIONSHIP_TYPE_INVALID":
      return "Seleziona un tipo di collegamento.";
    case "RELATIONSHIP_ROLE_REQUIRED":
      return "Seleziona il ruolo della società.";
    case "RELATIONSHIP_ROLE_NOT_APPLICABLE":
      return "Questo tipo di collegamento non prevede un ruolo.";
    case "REQUEST_ALREADY_PENDING":
      return "Esiste già una richiesta per questo collegamento.";
    case "RELATIONSHIP_ALREADY_ACTIVE":
      return "Questo collegamento è già attivo.";
    case "RELATIONSHIP_EXCLUSIVITY_CONFLICT":
      // §19: l'invito è valido, ma fra le due società esiste già un
      // collegamento strutturale di tipo diverso.
      return "Esiste già un collegamento tra queste due società.";
    case "REQUEST_ALREADY_HANDLED":
      return "La richiesta è già stata gestita. I dati sono stati aggiornati.";
    case "PROPOSAL_CHANGED":
      return "La proposta è cambiata. Controlla i dettagli prima di continuare.";
    case "RELATIONSHIP_NOT_ACTIVE":
      return "Questo collegamento non è più attivo. I dati sono stati aggiornati.";
    case "RELATIONSHIP_NOT_FOUND":
    case "RELATIONSHIP_TARGET_INVALID":
      return "Questo collegamento non è più disponibile.";
    case "INVITE_REVOKED":
    case "INVITE_INVALID":
    case "INVITE_ALREADY_RESOLVED":
      return "Questo invito non è più disponibile.";
    case "INVITE_EXPIRED":
      return "Questo invito è scaduto. Chiedi alla società un nuovo link.";
    case "OPERATION_CONTENT_CHANGED":
      return "La proposta è cambiata. Controlla i dettagli prima di continuare.";
    case "RATE_LIMIT":
      return "Hai raggiunto il limite di richieste. Riprova più tardi.";
    case "UNKNOWN":
    default:
      return "Non è stato possibile completare l'operazione. Riprova.";
  }
}

/** §29 — empty state per superficie. */
export const NETWORK_EMPTY = {
  history: {
    body: "I collegamenti conclusi resteranno consultabili qui.",
    title: "Nessun collegamento nello storico",
  },
  links: {
    body: "Le relazioni accettate con altre società compariranno qui.",
    title: "Nessun collegamento attivo",
  },
  requests: {
    body: "Le richieste inviate e ricevute compariranno qui.",
    title: "Nessuna richiesta in attesa",
  },
  search: {
    body: "La società che cerchi potrebbe non essere ancora su PROLINK.",
    title: "Nessuna società trovata",
  },
} as const;
