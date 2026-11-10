/**
 * Derivazioni pure di gestione e lifecycle dei Gruppi (DAS-REV-33). Nessun
 * I/O: tutto ciò che qui si decide è testato in
 * `groups-manage-presentation.test.ts` senza renderizzare nulla.
 *
 * Il client non decide permessi (§5): riceve 13 capability dal server e qui si
 * traducono in *cosa mostrare* — mai in *cosa è consentito*. Ciò che il server
 * non concede si nasconde, non si disabilita (§5); una regola di dominio che
 * blocca un'azione autorizzata (ultimo ADMIN) riceve invece feedback
 * contestuale (§14).
 */
import { GROUP_MANAGE_COPY as C, GROUPS_COPY } from "./groups-copy";
import { groupNameIssue, groupNameMessage, groupRowMeta, normalizeGroupName } from "./groups-presentation";
import type { GroupsError } from "./groups-service";
import type {
  ArchivedGroupRow,
  GroupCapabilities,
  GroupCommandName,
  GroupCommandResult,
  GroupLimits,
  GroupManagement,
  GroupMember,
} from "./groups-types";

// ── Date (§9) ───────────────────────────────────────────────────────────────

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"] as const;

/** «13 set 2026». `null` se il server non manda una data leggibile: nessuna data inventata. */
export function formatCreatedDate(iso: string | null): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return null;

  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** «Creato il 13 set 2026 · Attivo»: riga compatta secondaria (§9, QA-014). */
export function createdLineOf(m: Pick<GroupManagement, "createdAt" | "status">): string | null {
  const date = formatCreatedDate(m.createdAt);

  return date ? C.createdLine(date, m.status) : null;
}

// ── Info gruppo (§9, screen 01-03, 14, 16, 19) ──────────────────────────────

/** Variante osservata, solo per analytics: non cambia nessuna regola. */
export function infoVariantOf(m: Pick<GroupManagement, "myRole">): "admin" | "manager" | "member" {
  return m.myRole === "admin" ? "admin" : m.myRole === "member" ? "member" : "manager";
}

export function teamValueOf(m: Pick<GroupManagement, "teamId" | "teamName">): string {
  return m.teamId ? (m.teamName ?? C.team) : C.teamNone;
}

/**
 * Contesto sotto il nome: Società (con il check solo se verificata) e, se c'è,
 * Squadra (§9). Il check appartiene alla Società, mai al nome del gruppo (§6).
 */
export function headerContextOf(m: Pick<GroupManagement, "clubIsVerified" | "clubName" | "teamId" | "teamName">): {
  clubName: string;
  clubVerified: boolean;
  teamName: string | null;
} {
  return {
    clubName: m.clubName,
    clubVerified: m.clubIsVerified && m.clubName.length > 0,
    teamName: m.teamId ? m.teamName : null,
  };
}

export function peopleLineOf(m: Pick<GroupManagement, "adminCount" | "peopleCount">): string {
  return C.peopleAndAdmins(m.peopleCount, m.adminCount);
}

export type GroupInfoActionKey = "add_people" | "archive" | "delete" | "leave" | "manage_people" | "reactivate";

export type GroupInfoAction = {
  key: GroupInfoActionKey;
  label: string;
  /** `primary` è la sola CTA blu della pagina (§6); `danger` è testo rosso, non una pagina rossa. */
  tone: "danger" | "neutral" | "primary";
};

/**
 * «Azioni gruppo» (§9): solo azioni realmente applicabili allo stato e alle
 * capability. ACTIVE con una sola persona non ha Lascia diretto (§19): offre
 * Aggiungi persone e, se autorizzate, Archivia/Elimina. ARCHIVED con zero ADMIN
 * offre «Gestisci persone» al manager; con almeno un ADMIN, Riattiva.
 */
export function infoActionsOf(m: Pick<GroupManagement, "capabilities" | "leavePath" | "status">): GroupInfoAction[] {
  const caps = m.capabilities;
  const actions: GroupInfoAction[] = [];

  if (m.status === "active") {
    if (m.leavePath === "add_people_first" && caps.canManagePeople) {
      actions.push({ key: "add_people", label: C.addPeopleCta, tone: "primary" });
    }

    if (caps.canLeave && m.leavePath !== "add_people_first") {
      actions.push({ key: "leave", label: C.leave, tone: "neutral" });
    }

    if (caps.canArchive) {
      actions.push({ key: "archive", label: C.archive, tone: "neutral" });
    }
  } else {
    if (caps.canRecover) {
      actions.push({ key: "manage_people", label: C.managePeople, tone: "primary" });
    }

    if (caps.canReactivate) {
      actions.push({ key: "reactivate", label: C.reactivate, tone: "primary" });
    }

    if (caps.canLeave) {
      actions.push({ key: "leave", label: C.leave, tone: "neutral" });
    }
  }

  if (caps.canDelete) {
    actions.push({ key: "delete", label: C.delete, tone: "danger" });
  }

  return actions;
}

/** Testo guida sopra la CTA primaria (§19, §22): spiega perché non c'è Lascia/Riattiva. */
export function infoNoticeOf(m: Pick<GroupManagement, "adminCount" | "capabilities" | "leavePath" | "status">): string | null {
  if (m.status === "active" && m.leavePath === "add_people_first") {
    return C.onlyPerson;
  }

  if (m.status === "archived" && m.adminCount === 0 && m.capabilities.canRecover) {
    return C.needsAdmin;
  }

  return null;
}

/** Il tap su Lascia: conferma ordinaria o successione (§18, §19). */
export function leaveFlowOf(m: Pick<GroupManagement, "leavePath" | "status">): "handover" | "ordinary" {
  return m.status === "active" && m.leavePath === "handover" ? "handover" : "ordinary";
}

/** Delete ACTIVE offre «Archivia» solo se l'actor può davvero archiviare; ARCHIVED mai (§23). */
export function deleteOffersArchive(m: Pick<GroupManagement, "capabilities" | "status">): boolean {
  return m.status === "active" && m.capabilities.canArchive;
}

/** Persone: riga interattiva solo con `can_view_people`; modifica Squadra solo con `can_edit_team` (§11). */
export function infoAffordancesOf(caps: GroupCapabilities) {
  return {
    avatarEditable: caps.canEditAvatar,
    nameEditable: caps.canEditName,
    peopleRow: caps.canViewPeople,
    teamEditable: caps.canEditTeam,
  };
}

// ── Nome (§10, screen 04) ───────────────────────────────────────────────────

export type NameSave = { kind: "invalid"; message: string } | { kind: "noop" } | { kind: "save"; name: string };

/**
 * Salva applica una patch del solo nome (§10). Vuoto/solo spazi → errore
 * inline, nessuna mutation; invariato dopo la normalizzazione → si chiude
 * l'editing senza comando (nessun evento per un no-op).
 */
export function nameSaveOf(draft: string, confirmed: string, limits: Pick<GroupLimits, "nameMax">): NameSave {
  const issue = groupNameIssue(draft, limits);

  if (issue) {
    return { kind: "invalid", message: groupNameMessage(issue, limits) ?? GROUPS_COPY.nameRequired };
  }

  const name = normalizeGroupName(draft);

  return name === normalizeGroupName(confirmed) ? { kind: "noop" } : { kind: "save", name };
}

/** Il draft differisce dal valore confermato: vale per il guard di uscita (§27). */
export function nameDraftDirty(draft: string, confirmed: string, editing: boolean): boolean {
  return editing && normalizeGroupName(draft) !== normalizeGroupName(confirmed);
}

// ── Persone (§12, screen 07, 09, 10) ────────────────────────────────────────

export type MemberSection = {
  data: GroupMember[];
  key: "admins" | "others";
  title: string;
};

/**
 * Una sola lista in due sezioni aperte (§12). I conteggi del titolo sono
 * quelli del server, indipendenti dalla pagina caricata; con una ricerca attiva
 * si omettono, perché descrivono il gruppo intero e non i risultati. Nessuna
 * PERSON compare due volte (deduplica per ID) e una sezione vuota non si
 * disegna.
 */
export function memberSectionsOf(
  members: readonly GroupMember[],
  counts: { adminCount: number; otherCount: number },
  query: string,
): MemberSection[] {
  const seen = new Set<string>();
  const unique = members.filter((member) => {
    if (seen.has(member.profileId)) return false;
    seen.add(member.profileId);
    return true;
  });
  const searching = query.trim().length > 0;
  const admins = unique.filter((member) => member.memberRole === "admin");
  const others = unique.filter((member) => member.memberRole !== "admin");
  const sections: MemberSection[] = [];

  if (admins.length) {
    sections.push({ data: admins, key: "admins", title: C.adminsSection(searching ? null : counts.adminCount) });
  }

  if (others.length) {
    sections.push({ data: others, key: "others", title: C.othersSection(searching ? null : counts.otherCount) });
  }

  return sections;
}

export function memberTitleOf(member: Pick<GroupMember, "fullName" | "isMe">): string {
  return member.isMe ? `${member.fullName} · ${C.you}` : member.fullName;
}

/** Ruolo professionale pubblico e stato amministratore sobrio, niente pill (§12). */
export function memberSubtitleOf(member: Pick<GroupMember, "memberRole" | "roleLabel">): string | null {
  const parts = [member.roleLabel, member.memberRole === "admin" ? C.adminLabel : null].filter(
    (part): part is string => !!part,
  );

  return parts.length ? parts.join(" · ") : null;
}

export type MemberActionKey = "demote" | "open_profile" | "promote" | "remove";

export type MemberAction = {
  destructive: boolean;
  key: MemberActionKey;
  label: string;
};

/**
 * Azioni dalla riga (§14, §15): le flag arrivano dal server per quella riga.
 * Promozione solo a un MEMBER, demozione solo a un ADMIN, Rimuovi mai sulla
 * propria riga (l'uscita personale è Lascia).
 */
export function memberActionsOf(
  member: Pick<GroupMember, "canDemote" | "canPromote" | "canRemove" | "isMe" | "memberRole">,
): MemberAction[] {
  const actions: MemberAction[] = [{ destructive: false, key: "open_profile", label: C.openProfile }];

  if (member.canPromote && member.memberRole === "member") {
    actions.push({ destructive: false, key: "promote", label: C.makeAdmin });
  }

  if (member.canDemote && member.memberRole === "admin") {
    actions.push({ destructive: false, key: "demote", label: C.removeAdmin });
  }

  if (member.canRemove && !member.isMe) {
    actions.push({ destructive: true, key: "remove", label: C.removeFromGroup });
  }

  return actions;
}

/** Senza azioni di gestione il tap apre direttamente il profilo: nessun menu con una sola voce (§12). */
export function memberTapOf(member: Parameters<typeof memberActionsOf>[0]): "menu" | "profile" {
  return memberActionsOf(member).length > 1 ? "menu" : "profile";
}

// ── Aggiunta e successione (§13, §19) ───────────────────────────────────────

/**
 * «Seleziona tutti» non troncato: le selezioni nuove più i già attivi devono
 * stare nel massimo centrale (§13). Il controllo è anche del server.
 */
export function addExceedsMax(activeCount: number, selectedCount: number, limits: Pick<GroupLimits, "maxPeople">): boolean {
  return activeCount + selectedCount > limits.maxPeople;
}

/**
 * §13, §19: un batch atomico fallito per target non più validi non aggiunge
 * nessuno; le selezioni ancora valide restano per la revisione e le altre
 * escono. Con gli ID validi del server si interseca; altrimenti si tolgono gli
 * invalidi noti. Mai un nuovo invio automatico.
 */
export function selectionAfterTargetsFailure(
  selected: readonly string[],
  failure: { personIds: readonly string[]; validIds: readonly string[] },
): string[] {
  if (failure.validIds.length > 0) {
    return selected.filter((id) => failure.validIds.includes(id));
  }

  return selected.filter((id) => !failure.personIds.includes(id));
}

/** CTA della successione attiva solo con almeno un sostituto e nessuna richiesta in corso (§19). */
export function canConfirmHandover(input: { count: number; pending: boolean }): boolean {
  return input.count >= 1 && !input.pending;
}

export function canConfirmAdd(input: { bulkPending: boolean; count: number; pending: boolean }): boolean {
  return input.count >= 1 && !input.bulkPending && !input.pending;
}

/**
 * Esito dell'uscita (§18). `changed` falso con periodo già chiuso = aveva già
 * lasciato (riconciliazione: si esce); con un periodo diverso = un nuovo
 * ingresso successivo alla schermata, che non si tocca (si ricarica).
 */
export function leaveOutcomeOf(
  result: Pick<GroupCommandResult, "changed" | "periodChanged" | "periodEnded">,
): "already_left" | "left" | "stale" {
  if (result.changed) return "left";
  if (result.periodEnded) return "already_left";

  return "stale";
}

// ── Gruppi archiviati (§21, screen 18) ──────────────────────────────────────

export function archivedMetaOf(row: Pick<ArchivedGroupRow, "peopleCount" | "teamId" | "teamName">): string {
  return groupRowMeta(row);
}

export function archivedStatusOf(row: Pick<ArchivedGroupRow, "needsRecovery">): string {
  return row.needsRecovery ? C.archivedNeedsAdmin : C.archivedStatus;
}

// ── Idempotenza (§25) ───────────────────────────────────────────────────────

export type Intent = { key: string; signature: string };

/**
 * Una chiave per **intenzione**, riusata nei retry: lo stesso payload dopo un
 * esito incerto conserva la chiave (il server restituisce l'esito già
 * registrato); un payload diverso è un'altra intenzione. La chiave non deriva
 * dal solo contenuto: ripetere lo stesso gesto dopo un esito definitivo è una
 * nuova azione e non deve riprendere il vecchio risultato.
 */
export function intentFor(previous: Intent | null, signature: string, mint: () => string): Intent {
  return previous && previous.signature === signature ? previous : { key: mint(), signature };
}

// ── Errori dei comandi (§27) ────────────────────────────────────────────────

export type GroupFailureKind =
  | "archived"
  | "avatar"
  | "conflict"
  | "deleted"
  | "forbidden"
  | "generic"
  | "handover_not_required"
  | "last_admin"
  | "name"
  | "not_member"
  | "offline"
  | "only_person"
  | "people_required"
  | "period_ended"
  | "reactivate_requires_admin"
  | "requires_handover"
  | "targets"
  | "team"
  | "too_many"
  | "uncertain";

export type GroupFailure = {
  /** Revoca dell'accesso: si chiude la superficie privata (§17, §23, §26). */
  accessLost: "deleted" | "ended" | null;
  kind: GroupFailureKind;
  message: string;
  /** Il dato osservato non è più affidabile: si rilegge dal server. */
  refetch: boolean;
  /** ID non più validi / ancora validi (TARGETS_UNAVAILABLE). */
  removeIds: string[];
  /**
   * L'intenzione è conclusa: il prossimo tentativo è una nuova azione con
   * una nuova chiave. Falso per un esito sconosciuto (rete, timeout): si
   * riprova con la stessa chiave (§27).
   */
  settled: boolean;
  validIds: string[];
};

const GENERIC_MESSAGE: Record<GroupCommandName, string> = {
  add_people: C.addFailed,
  archive: C.archiveFailed,
  avatar: C.imageUpdateFailed,
  delete: C.deleteFailed,
  demote: C.roleFailed,
  handover: C.handoverFailed,
  leave: C.leaveFailed,
  promote: C.roleFailed,
  reactivate: C.reactivateFailed,
  remove: C.removeFailed,
  rename: C.nameSaveFailed,
  team: C.teamSaveFailed,
};

const NAME_FIELD: Record<string, "invalid" | "required" | "too_long"> = {
  name_invalid: "invalid",
  name_required: "required",
  name_too_long: "too_long",
};

/**
 * Traduce un errore del server in esito d'interfaccia: copy, se rileggere, se
 * l'intenzione è chiusa e se l'accesso è perso. Mai codici, HTTP o ID nel
 * messaggio (§27). `VERSION_CONFLICT` → rilettura e bozza conservata (§10).
 */
export function groupFailureOf(
  error: Pick<GroupsError, "code" | "field" | "personIds" | "validIds">,
  command: GroupCommandName,
  limits: Pick<GroupLimits, "maxPeople" | "nameMax">,
): GroupFailure {
  const base: GroupFailure = {
    accessLost: null,
    kind: "generic",
    message: GENERIC_MESSAGE[command],
    refetch: false,
    removeIds: [],
    settled: true,
    validIds: [],
  };

  switch (error.code) {
    case "SOCIETY_GROUP_VERSION_CONFLICT":
      return { ...base, kind: "conflict", message: C.conflict, refetch: true };
    case "SOCIETY_GROUP_LAST_ADMIN":
      return { ...base, kind: "last_admin", message: C.lastAdmin, refetch: true };
    case "SOCIETY_GROUP_TARGETS_UNAVAILABLE":
    case "SOCIETY_GROUP_PEOPLE_UNAVAILABLE":
      return {
        ...base,
        kind: "targets",
        message: C.peopleUnavailable,
        refetch: true,
        removeIds: [...error.personIds],
        validIds: [...error.validIds],
      };
    case "SOCIETY_GROUP_TEAM_UNAVAILABLE":
      return { ...base, kind: "team", message: C.teamUnavailable, refetch: true };
    case "SOCIETY_GROUP_ARCHIVED":
      return { ...base, kind: "archived", message: C.archivedStale, refetch: true };
    case "SOCIETY_GROUP_DELETED":
      return { ...base, accessLost: "deleted", kind: "deleted", message: C.deleted };
    case "SOCIETY_GROUP_NOT_MEMBER":
      return { ...base, accessLost: "ended", kind: "not_member", message: C.notMember };
    case "SOCIETY_GROUP_FORBIDDEN":
    case "SOCIETY_GROUP_NOT_FOUND":
    case "SOCIETY_GROUPS_NOT_AUTHORIZED":
      return { ...base, kind: "forbidden", message: C.forbidden, refetch: true };
    case "SOCIETY_GROUP_REACTIVATE_REQUIRES_ADMIN":
      return { ...base, kind: "reactivate_requires_admin", message: C.needsAdmin, refetch: true };
    case "SOCIETY_GROUP_LEAVE_ONLY_PERSON":
      return { ...base, kind: "only_person", message: C.onlyPerson, refetch: true };
    case "SOCIETY_GROUP_LEAVE_REQUIRES_HANDOVER":
      return { ...base, kind: "requires_handover", message: "", refetch: true };
    case "SOCIETY_GROUP_HANDOVER_NOT_REQUIRED":
      return { ...base, kind: "handover_not_required", message: C.stateChanged, refetch: true };
    case "SOCIETY_GROUP_PERIOD_ENDED":
      return { ...base, kind: "period_ended", message: C.periodEnded, refetch: true };
    case "SOCIETY_GROUP_TOO_MANY_PEOPLE":
      return { ...base, kind: "too_many", message: GROUPS_COPY.tooMany(limits.maxPeople) };
    case "SOCIETY_GROUP_PEOPLE_REQUIRED":
      return { ...base, kind: "people_required", message: GROUPS_COPY.peopleRequired };
    case "SOCIETY_GROUP_INVALID": {
      const issue = error.field ? NAME_FIELD[error.field] : undefined;

      if (issue) {
        return { ...base, kind: "name", message: groupNameMessage(issue, limits) ?? base.message };
      }

      if (error.field?.startsWith("avatar")) {
        return { ...base, kind: "avatar", message: C.imageUpdateFailed };
      }

      return base;
    }
    case "NETWORK":
      return { ...base, kind: "offline", message: C.offline, settled: false };
    case "TIMEOUT":
      return { ...base, kind: "uncertain", message: C.verifying, settled: false };
    default:
      return base;
  }
}

/** Un errore di lettura: offline e generico si distinguono, il permesso perso è un altro stato (§27). */
export function loadFailureOf(error: Pick<GroupsError, "code"> | null, surface: "archived" | "info" | "people"): string {
  if (error?.code === "NETWORK") return C.offline;

  return surface === "info" ? C.infoLoadError : surface === "people" ? C.peopleLoadError : C.archivedLoadError;
}
