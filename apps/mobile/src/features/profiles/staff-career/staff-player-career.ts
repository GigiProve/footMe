/**
 * Ponte fra il percorso da calciatore dello Staff tecnico e il modello già
 * approvato per il Calciatore (REV-PROF-07).
 *
 * La task è esplicita: la carriera da calciatore usa il modello e il flusso del
 * Calciatore, e il modello dello Staff non va piegato per contenere statistiche
 * da giocatore. Qui non nasce quindi nessun modello nuovo — solo la traduzione
 * fra le righe di `staff_player_career_entries` e il `PlayerExperienceForm` che
 * il flusso di REV-ONB-02 sa già leggere.
 *
 * È la stessa conversione già scritta per l'Allenatore: cambia solo la tabella
 * di destinazione.
 */
import type { PlayerExperienceForm } from "../player-sports";
import type { StaffPlayerCareerEntryRecord } from "../profile-service";

function statToInput(value: number | null): string {
  // `null` = statistica mai inserita: resta un campo vuoto, non uno zero.
  return value === null ? "" : String(value);
}

function inputToStat(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function monthNumberToInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function inputToMonthNumber(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

export function staffPlayerRecordsToForms(
  records: readonly StaffPlayerCareerEntryRecord[],
): PlayerExperienceForm[] {
  return [...records]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((record) => ({
      appearances: statToInput(record.appearances),
      assists: statToInput(record.assists),
      awards: record.awards ?? "",
      ...(record.career_type ? { careerType: record.career_type } : {}),
      category: record.category?.trim() ?? "",
      clubId: null,
      clubName: record.team_name?.trim() || "Società non indicata",
      goals: statToInput(record.goals),
      // Senza gruppo la riga ricade sul proprio id: resta un'esperienza a sé,
      // invece di finire accorpata a un'altra per somiglianza di nome.
      groupId: record.experience_group_id ?? record.id,
      id: record.id,
      minutesPlayed: statToInput(record.minutes_played),
      periodEndMonth: monthNumberToInput(record.period_end_month),
      periodStartMonth: monthNumberToInput(record.period_start_month),
      seasonLabel: record.season,
      seasonPeriod: record.season_period,
      teamCity: "",
      teamLogoUrl: record.team_logo_url ?? "",
    }));
}

/**
 * `previousById` serve a non perdere `position`: il flusso Calciatore non
 * chiede il ruolo in campo per stagione, quindi il valore che un'esperienza
 * porta già va conservato invece di essere azzerato a ogni salvataggio.
 */
export function formsToStaffPlayerRecords(
  forms: readonly PlayerExperienceForm[],
  staffProfileId: string,
  previousById: ReadonlyMap<string, StaffPlayerCareerEntryRecord>,
): StaffPlayerCareerEntryRecord[] {
  return forms.map((form, index) => {
    const previous = form.id ? previousById.get(form.id) : undefined;

    return {
      appearances: inputToStat(form.appearances),
      assists: inputToStat(form.assists),
      awards: form.awards.trim() || null,
      career_type: form.careerType ?? null,
      category: form.category.trim() || null,
      experience_group_id: form.groupId ?? null,
      goals: inputToStat(form.goals),
      id: form.id ?? `staff-player-${index}-${Date.now()}`,
      minutes_played: inputToStat(form.minutesPlayed),
      period_end_month: inputToMonthNumber(form.periodEndMonth),
      period_start_month: inputToMonthNumber(form.periodStartMonth),
      position: previous?.position ?? null,
      season: form.seasonLabel,
      season_period: form.seasonPeriod === "partial" ? "partial" : "full",
      sort_order: index,
      staff_profile_id: staffProfileId,
      team_logo_url: form.teamLogoUrl || null,
      team_name: form.clubName,
    } satisfies StaffPlayerCareerEntryRecord;
  });
}
