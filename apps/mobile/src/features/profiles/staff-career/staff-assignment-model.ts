/**
 * Righe della carriera Staff tecnico ⇄ assegnazioni canoniche (REV-PROF-07).
 *
 * Non c'è nessun secondo modello: la lettura passa da `recordToAssignments`,
 * la stessa funzione che serve l'Allenatore, perché `staff_career_entries` e
 * `coach_career_entries` hanno le stesse colonne. Qui resta solo quello che le
 * distingue davvero — la chiave esterna verso il profilo e le due colonne che
 * lo Staff tecnico porta in più (`head_coach_name`, `description`), che non
 * appartengono all'assegnazione e vanno conservate invece di essere azzerate.
 */
import {
  assignmentToRecordFields,
  type CoachAssignment,
} from "../coach-career/coach-assignment-model";
import type { StaffCareerEntryRecord } from "../profile-service";

export function assignmentsToStaffRecords(
  assignments: readonly CoachAssignment[],
  staffProfileId: string,
  previousById: ReadonlyMap<string, StaffCareerEntryRecord> = new Map(),
): StaffCareerEntryRecord[] {
  return assignments.map((assignment, index) => {
    const previous = previousById.get(assignment.id);

    return {
      ...assignmentToRecordFields(assignment, index),
      // Campi che il modulo carriera non tocca: se la riga li aveva, li tiene.
      description: previous?.description ?? null,
      head_coach_name: previous?.head_coach_name ?? null,
      results: previous?.results ?? [],
      staff_profile_id: staffProfileId,
    } satisfies StaffCareerEntryRecord;
  });
}

/** Indice per id delle righe già salvate, per non perdere i campi non gestiti. */
export function indexStaffRecords(
  records: readonly StaffCareerEntryRecord[],
): Map<string, StaffCareerEntryRecord> {
  return new Map(records.map((record) => [record.id, record]));
}
