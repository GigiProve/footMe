/**
 * Adattatore della carriera da ex calciatore dello Staff tecnico.
 *
 * Il raggruppamento degli incarichi non vive più qui: dopo REV-PROF-06 la
 * carriera nello staff e quella da allenatore passano dal modello condiviso
 * `coach-career-model`, lo stesso del Master Profile Allenatore.
 *
 * Dopo REV-PROF-07 anche la conversione del percorso da calciatore è quella
 * del modulo di gestione: il Master Profile deve leggere esattamente i campi
 * che la gestione scrive — minuti, riconoscimenti, periodo parziale e gruppo
 * compresi — altrimenti mostrerebbe una versione impoverita di quello che
 * l'utente ha inserito.
 */
import type { StaffPlayerCareerEntryRecord } from "../profile-service";
import { staffPlayerRecordsToForms } from "../staff-career/staff-player-career";
import type { PlayerExperienceForm } from "../player-sports";

export function mapStaffPlayerEntriesToPlayerExperiences(
  entries: StaffPlayerCareerEntryRecord[],
): PlayerExperienceForm[] {
  return staffPlayerRecordsToForms(entries);
}
