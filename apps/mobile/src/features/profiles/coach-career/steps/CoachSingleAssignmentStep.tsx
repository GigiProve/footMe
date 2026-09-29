/**
 * Schermate 5 e 6 — Singola stagione e Periodo personalizzato (REV-PROF-04).
 *
 * Una sola schermata per due modalità: i campi comuni sono gli stessi e
 * nell'identico ordine, cambia solo il modo di indicare il tempo — una
 * stagione sportiva oppure due date mese+anno con l'opzione "Incarico in
 * corso". Duplicarla produrrebbe due copie che divergono alla prima modifica.
 *
 * Anche qui ruolo e categoria appartengono all'assegnazione: sono i valori di
 * quella stagione o di quel periodo, non della società.
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import {
  FieldShell,
  InfoMessage,
  OnboardingSection,
  OnboardingSelectField,
  PeriodField,
} from "../../../onboarding/ui";
import {
  coachPeriodFromDateValue,
  coachPeriodToDateValue,
  formatSeasonShort,
  getCoachSeasonOptions,
  getOlderCoachSeasonOptions,
} from "../../../onboarding/coach/coach-career-utils";
import { COACH_ROLE_OPTIONS } from "../../../onboarding/coach/coach-options";
import { TeamAutocompleteInput } from "../../player-sports-section";
import type { TeamAutocompleteOption } from "../../player-sports";
import {
  EMPTY_PERIOD,
  type CoachDraftErrors,
  type CoachExperienceDraft,
} from "../coach-career-draft";
import { COACH_CATEGORY_OPTIONS } from "./CoachSeasonRolesStep";

type CoachSingleAssignmentStepProps = {
  draft: CoachExperienceDraft;
  errors: CoachDraftErrors;
  onChangeDraft: (patch: Partial<CoachExperienceDraft>) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
};

/** Tutte le stagioni, recenti e non: l'elenco è generato, mai hardcodato. */
function buildSeasonOptions() {
  return [
    ...getCoachSeasonOptions().map((season) => ({
      label: formatSeasonShort(season),
      value: season,
    })),
    ...getOlderCoachSeasonOptions(),
  ];
}

export function CoachSingleAssignmentStep({
  draft,
  errors,
  onChangeDraft,
  searchTeams,
}: CoachSingleAssignmentStepProps) {
  const isPeriod = draft.mode === "CUSTOM_PERIOD";
  const period = draft.period ?? EMPTY_PERIOD;
  const startValue = coachPeriodToDateValue(period.startMonth, period.startYear);
  const endValue = coachPeriodToDateValue(period.endMonth, period.endYear);

  function patchPeriod(patch: Partial<typeof period>) {
    onChangeDraft({ period: { ...period, ...patch } });
  }

  return (
    <View style={styles.container}>
      <OnboardingSection>
        <FieldShell errorMessage={errors.teamName} label="Squadra">
          <TeamAutocompleteInput
            onChangeText={(value) =>
              onChangeDraft({ clubId: null, teamLogoUrl: "", teamName: value })
            }
            onSelectTeam={(team) =>
              onChangeDraft({
                clubId: team.id,
                teamLogoUrl: team.logoUrl ?? "",
                teamName: team.name,
              })
            }
            placeholder="Cerca la squadra"
            searchTeams={searchTeams}
            value={draft.teamName}
          />
        </FieldShell>

        {/* §Screen 5: Squadra → Stagione → Ruolo → Categoria, in quest'ordine. */}
        {!isPeriod ? (
          <OnboardingSelectField
            errorMessage={errors.seasons}
            label="Stagione"
            onChange={(value) =>
              onChangeDraft({ seasons: value ? [value] : [] })
            }
            options={buildSeasonOptions()}
            placeholder="Seleziona la stagione"
            searchable
            sheetTitle="Stagione"
            testID="coach-single-season"
            value={draft.seasons[0] ?? ""}
          />
        ) : null}

        <OnboardingSelectField
          errorMessage={errors.role}
          label="Ruolo"
          onChange={(value) => onChangeDraft({ role: value })}
          options={COACH_ROLE_OPTIONS}
          placeholder="Seleziona ruolo"
          sheetTitle="Ruolo"
          testID="coach-assignment-role"
          value={draft.role}
        />

        <OnboardingSelectField
          errorMessage={errors.category}
          label="Categoria"
          onChange={(value) => onChangeDraft({ category: value })}
          options={COACH_CATEGORY_OPTIONS}
          placeholder="Seleziona categoria"
          searchable
          sheetTitle="Categoria"
          testID="coach-assignment-category"
          value={draft.category}
        />

        {/* §Screen 6: Squadra → Ruolo → Categoria → Da → A → Incarico in corso. */}
        {isPeriod ? (
          <PeriodField
            currentLabel="Incarico in corso"
            endErrorMessage={errors.endDate}
            endLabel="A"
            endPlaceholder="Mese e anno di fine"
            endTestID="coach-period-end"
            endValue={endValue}
            isCurrent={draft.isOngoing}
            mode="monthYear"
            onCurrentChange={(value) => {
              // Un incarico in corso non ha data di fine: la si toglie invece
              // di lasciarla a schermo disattivata e ambigua.
              onChangeDraft({
                isOngoing: value,
                period: value
                  ? { ...period, endMonth: "", endYear: "" }
                  : period,
              });
            }}
            onEndChange={(value) => {
              const { month, year } = coachPeriodFromDateValue(value);

              patchPeriod({ endMonth: month, endYear: year });
            }}
            onStartChange={(value) => {
              const { month, year } = coachPeriodFromDateValue(value);

              patchPeriod({ startMonth: month, startYear: year });
            }}
            startErrorMessage={errors.startDate}
            startLabel="Da"
            startPlaceholder="Mese e anno di inizio"
            startTestID="coach-period-start"
            startValue={startValue}
          />
        ) : null}
      </OnboardingSection>

      {isPeriod ? (
        <InfoMessage message="Utile per subentri, incarichi brevi o periodi fuori stagione." />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
});
