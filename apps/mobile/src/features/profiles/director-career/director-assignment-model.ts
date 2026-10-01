/**
 * Carriera del Dirigente ⇄ assegnazioni canoniche (REV-PROF-10).
 *
 * Il Dirigente è l'unico ruolo la cui carriera non sta su una tabella: le
 * cinque corsie vivono dentro `director_profiles` come `jsonb`, nella forma
 * camelCase che l'onboarding scrive (`CoachCareerEntry`). Questo file è il
 * solo punto in cui quella forma incontra il modello condiviso, e non ne
 * introduce un secondo: la conversione passa comunque da
 * `recordToAssignments` e `assignmentToRecordFields`, le stesse funzioni che
 * servono Allenatore e Staff tecnico.
 *
 * **Qui vive la migrazione**, e non ha bisogno di una migrazione SQL.
 * L'onboarding scriveva un record per esperienza, con N stagioni dentro
 * `seasons` e ruolo/categoria per stagione dentro `seasonDetails`. La task
 * chiede invece un'assegnazione persistita per stagione. Siccome la lettura
 * espande già le righe multi-stagione e la scrittura emette una riga per
 * assegnazione, il passaggio avviene al primo salvataggio di quella carriera:
 *
 *  - niente riscrittura in blocco di dati che nessuno sta modificando;
 *  - nessuna finestra in cui metà dei profili è illeggibile, perché la vecchia
 *    forma resta leggibile per sempre;
 *  - ruolo e categoria della vecchia riga seguono la stagione a cui erano
 *    associati, perché `seasonDetails` vince già sui campi di testata.
 *
 * L'identità delle stagioni espanse (`<id>#<stagione>`) è derivata e stabile:
 * la stessa riga legacy produce sempre gli stessi id, quindi una modifica
 * resta una modifica anche quando è la prima dopo la migrazione.
 */
import type { CareerEntryLike } from "../career/coach-career-model";
import { parseDirectorCareerEntries } from "../career/director-career-model";
import {
  assignmentToRecordFields,
  recordToAssignments,
  type CoachAssignment,
} from "../coach-career/coach-assignment-model";

/**
 * Una riga della carriera del Dirigente come viene scritta nel `jsonb`.
 *
 * Resta la forma dell'onboarding — stessi nomi, stesso annidamento di
 * `period` — perché onboarding, gestione carriera e Master Profile leggono e
 * scrivono gli stessi record. `experienceGroupId` è l'unico campo aggiunto:
 * tiene insieme le stagioni di un inserimento multi-stagione senza che
 * nessuna riga dipenda dalle altre per essere letta o eliminata.
 */
export type DirectorCareerEntryJson = {
  category: string;
  clubId: string | null;
  description: string | null;
  experienceGroupId: string;
  id: string;
  period: {
    endMonth: string;
    endYear: string;
    startMonth: string;
    startYear: string;
  } | null;
  role: string;
  seasonDetails: Record<string, { category: string; role: string }>;
  seasons: string[];
  teamLogoUrl: string | null;
  teamName: string;
  type: "MULTI_SEASON" | "SINGLE_SEASON" | "CUSTOM_PERIOD";
};

/**
 * Le assegnazioni di una corsia del Dirigente.
 *
 * `prefix` dà un id alle righe che non ne hanno: serve solo alle righe
 * malformate, ed è lo stesso prefisso che il Master Profile già usa, così la
 * stessa riga non cambia identità fra le due letture.
 */
export function directorEntriesToAssignments(
  entries: readonly unknown[] | null | undefined,
  prefix: string,
): CoachAssignment[] {
  return parseDirectorCareerEntries(entries, prefix).flatMap((entry) =>
    recordToAssignments({
      ...entry,
      experience_group_id: entry.experience_group_id ?? null,
    }).map((assignment) => ({
      // `recordToAssignments` lavora sulle colonne condivise e la descrizione
      // non è una di quelle: la riporta questo file, che la conosce.
      ...assignment,
      description: entry.description ?? "",
    })),
  );
}

/**
 * Le assegnazioni nella forma persistita: una riga per assegnazione.
 *
 * `season_details` esce vuoto perché ruolo e categoria vivono ormai sulla
 * riga; resta la chiave letta per prima, quindi una riga riscritta continua a
 * essere interpretata allo stesso modo anche dalle versioni precedenti del
 * lettore.
 */
export function assignmentsToDirectorEntries(
  assignments: readonly CoachAssignment[],
): DirectorCareerEntryJson[] {
  return assignments.map((assignment, index) => {
    const fields = assignmentToRecordFields(assignment, index);
    const isPeriod = fields.experience_type === "CUSTOM_PERIOD";

    return {
      category: fields.category ?? "",
      clubId: fields.club_id,
      description: assignment.description?.trim() || null,
      experienceGroupId: fields.experience_group_id ?? fields.id,
      id: fields.id,
      period: isPeriod
        ? {
            endMonth: fields.period_end_month ?? "",
            endYear: fields.period_end_year ? String(fields.period_end_year) : "",
            startMonth: fields.period_start_month ?? "",
            startYear: fields.period_start_year
              ? String(fields.period_start_year)
              : "",
          }
        : null,
      role: fields.role,
      seasonDetails: {},
      seasons: fields.seasons,
      teamLogoUrl: fields.team_logo_url,
      teamName: fields.team_name,
      type: fields.experience_type,
    } satisfies DirectorCareerEntryJson;
  });
}

/**
 * Ruoli già usati nelle esperienze di una corsia.
 *
 * Servono a non far sparire dal selettore un ruolo storico quando l'utente
 * smette di dichiararlo nel profilo: modificare il profilo non deve svuotare
 * la carriera.
 */
export function collectDirectorHistoricalRoles(
  entries: readonly unknown[] | null | undefined,
  prefix: string,
): string[] {
  const roles: string[] = [];

  for (const entry of parseDirectorCareerEntries(entries, prefix)) {
    for (const role of collectEntryRoles(entry)) {
      if (role && !roles.includes(role)) {
        roles.push(role);
      }
    }
  }

  return roles;
}

function collectEntryRoles(entry: CareerEntryLike): string[] {
  return [
    entry.role?.trim() ?? "",
    ...Object.values(entry.season_details ?? {}).map(
      (detail) => detail.role?.trim() ?? "",
    ),
  ];
}
