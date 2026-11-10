/**
 * Derivazioni pure dei Gruppi operativi (DAS-REV-32). Nessun I/O: tutto ciò
 * che qui si decide è testato in `groups-presentation.test.ts`.
 *
 * La validazione client è un aiuto (§14: «quella server determina il
 * risultato»): usa gli stessi limiti che il server restituisce.
 */
import type { GroupsError } from "./groups-service";
import { GROUPS_COPY } from "./groups-copy";
import type { EligiblePerson, GroupLimits, GroupTeamsLookup } from "./groups-types";

// ── Nome (§14) ──────────────────────────────────────────────────────────────

/** Stessa normalizzazione di `society_group_clean_name`: trim + spazi compressi. */
export function normalizeGroupName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type GroupNameIssue = "required" | "invalid" | "too_long" | null;

export function groupNameIssue(value: string, limits: Pick<GroupLimits, "nameMax">): GroupNameIssue {
  const normalized = normalizeGroupName(value);

  if (normalized.length === 0) {
    return "required";
  }

  /* Come il server: dopo la normalizzazione, qualunque carattere di
     controllo rende il nome non valido (`SOCIETY_GROUP_INVALID:name_invalid`). */
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    return "invalid";
  }

  if (Array.from(normalized).length > limits.nameMax) {
    return "too_long";
  }

  return null;
}

export function groupNameMessage(issue: GroupNameIssue, limits: Pick<GroupLimits, "nameMax">): string | null {
  if (issue === "required") return GROUPS_COPY.nameRequired;
  if (issue === "invalid") return GROUPS_COPY.nameInvalid;
  if (issue === "too_long") return GROUPS_COPY.nameTooLong(limits.nameMax);
  return null;
}

// ── Squadra (§15) ───────────────────────────────────────────────────────────

/**
 * `undefined` = non ancora scelta; `null` = «Nessuna squadra» (contesto
 * Società). Le due cose non coincidono: per un actor limitato a Team, null
 * non è un default valido (§15).
 */
export type TeamChoice = string | null | undefined;

export type TeamField = {
  /** Etichetta del campo: «(opzionale)» solo con scope societario. */
  label: string;
  /** Aiuto breve per l'actor limitato a Team. */
  help: string | null;
  /** «Nessuna squadra» è un'opzione legittima. */
  allowNone: boolean;
  /** Preimpostazione: solo se il contesto la determina (una sola squadra, niente contesto societario). */
  preset: TeamChoice;
};

export function teamFieldOf(lookup: GroupTeamsLookup | null): TeamField {
  if (!lookup) {
    return { allowNone: false, help: null, label: GROUPS_COPY.teamLabel, preset: undefined };
  }

  if (lookup.canCreateWithoutTeam) {
    return { allowNone: true, help: null, label: GROUPS_COPY.teamLabelOptional, preset: null };
  }

  return {
    allowNone: false,
    help: GROUPS_COPY.teamHelpScoped,
    label: GROUPS_COPY.teamLabel,
    preset: lookup.teams.length === 1 ? lookup.teams[0].teamId : undefined,
  };
}

/** La scelta è utilizzabile per il commit con questo lookup. */
export function teamChoiceValid(choice: TeamChoice, lookup: GroupTeamsLookup | null): boolean {
  if (!lookup || choice === undefined) return false;
  if (choice === null) return lookup.canCreateWithoutTeam;
  return lookup.teams.some((team) => team.teamId === choice);
}

export function teamValueLabel(choice: TeamChoice, lookup: GroupTeamsLookup | null): string {
  if (choice === null) return GROUPS_COPY.teamNone;
  if (choice === undefined) return GROUPS_COPY.teamChoose;
  return lookup?.teams.find((team) => team.teamId === choice)?.teamName ?? GROUPS_COPY.teamChoose;
}

export function canContinueInfo(input: {
  limits: Pick<GroupLimits, "nameMax">;
  lookup: GroupTeamsLookup | null;
  name: string;
  team: TeamChoice;
  uploading: boolean;
}): boolean {
  return (
    groupNameIssue(input.name, input.limits) === null &&
    teamChoiceValid(input.team, input.lookup) &&
    !input.uploading
  );
}

// ── Selezione (§18, §19) ────────────────────────────────────────────────────

/** Le selezioni sono ID, mai nomi o posizioni nella pagina (§18). */
export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id];
}

export function addToSelection(selected: readonly string[], ids: readonly string[], creatorId: string): string[] {
  const next = [...selected];

  for (const id of ids) {
    if (id !== creatorId && !next.includes(id)) {
      next.push(id);
    }
  }

  return next;
}

export function removeFromSelection(selected: readonly string[], ids: readonly string[]): string[] {
  return selected.filter((entry) => !ids.includes(entry));
}

/** Il creator non conta mai (§18). */
export function selectedCount(selected: readonly string[], creatorId: string): number {
  return selected.filter((id) => id !== creatorId).length;
}

export function canContinuePeople(input: { bulkPending: boolean; count: number }): boolean {
  return input.count >= 1 && !input.bulkPending;
}

/** Totale delle persone incluse nel gruppo: creator + selezionati (§20). */
export function totalPeople(selectedCountValue: number): number {
  return selectedCountValue + 1;
}

/** §19: il set completo supererebbe il massimo centrale. */
export function exceedsMax(count: number, limits: Pick<GroupLimits, "maxPeople">): boolean {
  return count + 1 > limits.maxPeople;
}

export type PeopleSection = {
  key: "team" | "others" | "all";
  title: string | null;
  people: EligiblePerson[];
};

/**
 * Sezioni dello step 2: con una squadra, prima le sue persone e poi «Altre
 * persone della Società»; senza squadra un solo elenco senza intestazione
 * fittizia (QA-072). Nessuna persona in due sezioni (deduplica per ID).
 */
export function peopleSections(people: readonly EligiblePerson[], teamName: string | null): PeopleSection[] {
  const seen = new Set<string>();
  const unique = people.filter((person) => {
    if (seen.has(person.profileId)) return false;
    seen.add(person.profileId);
    return true;
  });

  if (!teamName) {
    return unique.length ? [{ key: "all", people: unique, title: null }] : [];
  }

  const team = unique.filter((person) => person.inTeam);
  const others = unique.filter((person) => !person.inTeam);
  const sections: PeopleSection[] = [];

  if (team.length) sections.push({ key: "team", people: team, title: teamName });
  if (others.length) sections.push({ key: "others", people: others, title: GROUPS_COPY.otherPeople });

  return sections;
}

/** «Seleziona tutti»: solo con ricerca vuota e una squadra con persone (§19). */
export function showSelectAll(input: { query: string; teamId: string | null; teamTotal: number }): boolean {
  return input.teamId !== null && input.query.trim().length === 0 && input.teamTotal > 0;
}

// ── Riepilogo (§20) ─────────────────────────────────────────────────────────

export type SummaryPerson = {
  avatarUrl: string | null;
  fullName: string;
  isCreator: boolean;
  profileId: string;
  roleLabel: string | null;
};

/**
 * Elenco del riepilogo: il creator una volta sola, poi i selezionati di cui
 * si conoscono i dati; «+N» deriva dal totale reale (§20).
 */
export function summaryPeople(input: {
  creator: { avatarUrl: string | null; fullName: string; profileId: string };
  known: ReadonlyMap<string, EligiblePerson>;
  previewMax: number;
  selected: readonly string[];
}): { more: number; people: SummaryPerson[]; total: number } {
  const others = input.selected.filter((id) => id !== input.creator.profileId);
  const all: SummaryPerson[] = [
    { ...input.creator, isCreator: true, roleLabel: null },
    ...others
      .map((id) => input.known.get(id))
      .filter((person): person is EligiblePerson => !!person)
      .map((person) => ({
        avatarUrl: person.avatarUrl,
        fullName: person.fullName,
        isCreator: false,
        profileId: person.profileId,
        roleLabel: person.roleLabel,
      })),
  ];
  const total = totalPeople(others.length);
  const people = all.slice(0, input.previewMax);

  return { more: Math.max(0, total - people.length), people, total };
}

// ── Esito della create (§23, §24) ───────────────────────────────────────────

export type CreateFailure =
  | { kind: "people"; message: string; removeIds: string[]; step: 2 }
  | { kind: "team"; message: string; step: 1 }
  | { kind: "name"; message: string; step: 1 }
  | { kind: "avatar"; message: string; step: 1 }
  | { kind: "revoked"; message: string; step: 3 }
  | { kind: "uncertain"; message: string; step: 3 }
  | { kind: "error"; message: string; step: 3 };

/**
 * Dove torna il wizard e con quale copy. Un esito di trasporto è
 * **incerto** (§23): si ripete con la stessa chiave, non se ne crea una
 * nuova.
 */
export function createFailureOf(error: GroupsError, limits: Pick<GroupLimits, "maxPeople" | "nameMax">): CreateFailure {
  switch (error.code) {
    case "SOCIETY_GROUP_PEOPLE_UNAVAILABLE":
      return { kind: "people", message: GROUPS_COPY.peopleUnavailable, removeIds: error.personIds, step: 2 };
    case "SOCIETY_GROUP_PEOPLE_REQUIRED":
      return { kind: "people", message: GROUPS_COPY.peopleRequired, removeIds: [], step: 2 };
    case "SOCIETY_GROUP_TOO_MANY_PEOPLE":
      return { kind: "people", message: GROUPS_COPY.tooMany(limits.maxPeople), removeIds: [], step: 2 };
    case "SOCIETY_GROUP_TEAM_UNAVAILABLE":
      return { kind: "team", message: GROUPS_COPY.teamUnavailable, step: 1 };
    case "SOCIETY_GROUPS_NOT_AUTHORIZED":
      return { kind: "revoked", message: GROUPS_COPY.createRevoked, step: 3 };
    case "SOCIETY_GROUP_INVALID":
      if (error.field === "name_required") {
        return { kind: "name", message: GROUPS_COPY.nameRequired, step: 1 };
      }
      if (error.field === "name_invalid") {
        return { kind: "name", message: GROUPS_COPY.nameInvalid, step: 1 };
      }
      if (error.field === "name_too_long") {
        return { kind: "name", message: GROUPS_COPY.nameTooLong(limits.nameMax), step: 1 };
      }
      if (error.field?.startsWith("avatar")) {
        return { kind: "avatar", message: GROUPS_COPY.imageError, step: 1 };
      }
      return { kind: "error", message: GROUPS_COPY.createError, step: 3 };
    case "NETWORK":
    case "TIMEOUT":
      return { kind: "uncertain", message: GROUPS_COPY.verifying, step: 3 };
    default:
      return { kind: "error", message: GROUPS_COPY.createError, step: 3 };
  }
}

/**
 * Firma canonica del payload per la chiave di idempotenza (§23): ID
 * ordinati e deduplicati, creator escluso — come il fingerprint server.
 */
export function createSignature(input: {
  avatarAssetId: string | null;
  clubId: string;
  creatorId: string;
  name: string;
  personIds: readonly string[];
  teamId: string | null;
}): string {
  const people = Array.from(new Set(input.personIds.filter((id) => id !== input.creatorId))).sort();

  return JSON.stringify([input.clubId, normalizeGroupName(input.name), input.teamId, input.avatarAssetId, people]);
}

// ── Avatar (§5) ─────────────────────────────────────────────────────────────

/**
 * Iniziali del fallback: prima e ultima parola, oppure le prime due lettere
 * di un nome di una parola («Dirigenza» → «DR» nel PNG; qui «DI»). Rendono
 * distinguibili gruppi diversi senza colori per Società/Squadra (§5).
 */
export function groupInitials(name: string): string {
  const words = normalizeGroupName(name).split(" ").filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase();
}

// ── Centro (§10, §27) ───────────────────────────────────────────────────────

export function groupContextLabel(row: { teamName: string | null; teamId: string | null }): string {
  return row.teamId ? row.teamName ?? GROUPS_COPY.societyContext : GROUPS_COPY.societyContext;
}

export function groupRowMeta(row: { peopleCount: number; teamName: string | null; teamId: string | null }): string {
  return `${groupContextLabel(row)} · ${GROUPS_COPY.people(row.peopleCount)}`;
}

export type CenterBody = "loading" | "error" | "empty" | "search_empty" | "ready";

/** Vuoto ≠ ricerca senza match ≠ errore (§27, QA-020). */
export function centerBodyOf(input: { error: boolean; loaded: boolean; query: string; rows: number }): CenterBody {
  if (!input.loaded) return input.error ? "error" : "loading";
  if (input.rows > 0) return "ready";
  return input.query.trim().length > 0 ? "search_empty" : "empty";
}

/** Righe uniche per ID attraverso le pagine (QA-018). */
export function uniqueById<T extends { conversationId: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();

  return rows.filter((row) => {
    if (seen.has(row.conversationId)) return false;
    seen.add(row.conversationId);
    return true;
  });
}

/** Il wizard contiene modifiche da confermare prima di uscire (§13). */
export function hasMeaningfulDraft(input: {
  avatar: boolean;
  name: string;
  presetTeam: TeamChoice;
  selected: number;
  team: TeamChoice;
}): boolean {
  return (
    normalizeGroupName(input.name).length > 0 || input.avatar || input.selected > 0 || input.team !== input.presetTeam
  );
}
