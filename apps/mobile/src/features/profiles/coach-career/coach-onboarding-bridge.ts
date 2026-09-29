/**
 * Conversione fra la bozza dell'onboarding Allenatore e le assegnazioni
 * canoniche (REV-PROF-04).
 *
 * L'onboarding continua a lavorare sul suo `CoachCareerEntry` — schermate,
 * copy e flusso approvati restano identici — ma quando salva deve produrre le
 * stesse righe che produce Gestisci carriera, altrimenti nascerebbero due
 * carriere con due forme diverse e un'esperienza inserita in onboarding non
 * sarebbe modificabile dal profilo.
 *
 * La conversione vive qui e non dentro l'onboarding perché è il modello di
 * persistenza a dettarla, non il flusso che la alimenta.
 */
import type { CoachCareerEntry } from "../../onboarding/coach/coach-career-types";
import { computeCoachSeasonsFromPeriod } from "../../onboarding/coach/coach-career-utils";
import type { CoachAssignment } from "./coach-assignment-model";

/**
 * Un'esperienza dell'onboarding diventa una riga per stagione, tutte legate
 * dallo stesso `groupId`. Ruolo e categoria vengono da `seasonDetails` quando
 * la stagione ne ha uno — è lì che l'onboarding registra la variazione — e
 * altrimenti dai valori di testata, che sono quelli applicati a tutte.
 */
export function coachEntriesToAssignments(
  entries: readonly CoachCareerEntry[],
): CoachAssignment[] {
  return entries.flatMap((entry): CoachAssignment[] => {
    const base = {
      clubId: entry.clubId ?? null,
      groupId: entry.id,
      teamLogoUrl: entry.teamLogoUrl ?? "",
      teamName: entry.teamName.trim(),
    };

    if (entry.type === "CUSTOM_PERIOD") {
      const period = entry.period;

      if (!period?.startYear) {
        return [];
      }

      return [
        {
          ...base,
          category: entry.category,
          id: entry.id,
          // Nessuna data di fine = incarico ancora aperto.
          isOngoing: !period.endYear,
          mode: "CUSTOM_PERIOD" as const,
          period,
          role: entry.role,
          seasonKey: "",
        },
      ];
    }

    const seasons = [...new Set(entry.seasons.filter((season) => season?.trim()))];

    if (seasons.length === 0) {
      return [];
    }

    return seasons
      .sort((left, right) => right.localeCompare(left))
      .map((seasonKey, index) => {
        const detail = entry.seasonDetails?.[seasonKey];

        return {
          ...base,
          category: detail?.category?.trim() || entry.category,
          // La prima stagione tiene l'id dell'esperienza, le altre ne ricevono
          // uno derivato e stabile: rilanciare il salvataggio non moltiplica
          // le righe.
          id: index === 0 ? entry.id : `${entry.id}-${seasonKey}`,
          isOngoing: false,
          mode: seasons.length > 1 ? ("MULTI_SEASON" as const) : ("SINGLE_SEASON" as const),
          period: null,
          role: detail?.role?.trim() || entry.role,
          seasonKey,
        } satisfies CoachAssignment;
      });
  });
}

/** Stagioni coperte da un'esperienza dell'onboarding, periodo compreso. */
export function coachEntrySeasons(entry: CoachCareerEntry): string[] {
  if (entry.type === "CUSTOM_PERIOD" && entry.period) {
    return computeCoachSeasonsFromPeriod(entry.period);
  }

  return entry.seasons;
}
