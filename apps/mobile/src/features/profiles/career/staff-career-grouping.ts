/**
 * Adattatore della carriera da ex calciatore dello Staff tecnico.
 *
 * Il raggruppamento degli incarichi non vive più qui: dopo REV-PROF-06 la
 * carriera nello staff e quella da allenatore passano dal modello condiviso
 * `coach-career-model`, lo stesso del Master Profile Allenatore. Resta solo
 * la conversione al formato che il Master Profile Calciatore già sa leggere.
 */
import type { StaffPlayerCareerEntryRecord } from "../profile-service";
import type { PlayerExperienceForm } from "../player-sports";

export function mapStaffPlayerEntriesToPlayerExperiences(
  entries: StaffPlayerCareerEntryRecord[],
): PlayerExperienceForm[] {
  return entries.map((entry) => ({
    id: entry.id,
    appearances: entry.appearances > 0 ? String(entry.appearances) : "",
    assists: entry.assists > 0 ? String(entry.assists) : "",
    awards: "",
    category: entry.category ?? "",
    clubId: null,
    clubName: entry.team_name,
    goals: entry.goals > 0 ? String(entry.goals) : "",
    minutesPlayed: "",
    periodEndMonth: "",
    periodStartMonth: "",
    seasonLabel: entry.season,
    seasonPeriod: "full",
    teamCity: "",
    teamLogoUrl: entry.team_logo_url ?? "",
  }));
}
