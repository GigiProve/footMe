/**
 * Schermata 3 — Più stagioni complete, passo 1 di 2 (REV-PROF-04).
 *
 * Qui si scelgono soltanto società e stagioni. Ruolo e categoria **non**
 * compaiono: metterli qui reintrodurrebbe il ruolo globale che la task
 * elimina, e suggerirebbe che tutte le stagioni ne condividano uno.
 *
 * Le stagioni non devono essere consecutive e non vengono mai completate in
 * automatico: se l'utente sceglie 2024/25 e 2022/23, nel riepilogo compaiono
 * due stagioni, non tre.
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { MultiSeasonSelector } from "../../../onboarding/career/MultiSeasonSelector";
import { FieldShell, InfoMessage, OnboardingSection } from "../../../onboarding/ui";
import { TeamAutocompleteInput } from "../../player-sports-section";
import type { TeamAutocompleteOption } from "../../player-sports";
import type { CoachDraftErrors, CoachExperienceDraft } from "../coach-career-draft";

type CoachSeasonsStepProps = {
  draft: CoachExperienceDraft;
  errors: CoachDraftErrors;
  onChangeDraft: (patch: Partial<CoachExperienceDraft>) => void;
  onToggleSeason: (seasonKey: string) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
};

export function CoachSeasonsStep({
  draft,
  errors,
  onChangeDraft,
  onToggleSeason,
  searchTeams,
}: CoachSeasonsStepProps) {
  return (
    <View style={styles.container}>
      <OnboardingSection>
        <FieldShell errorMessage={errors.teamName} label="Squadra">
          <TeamAutocompleteInput
            onChangeText={(value) =>
              onChangeDraft({
                clubId: null,
                teamLogoUrl: "",
                teamName: value,
              })
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

        {/*
          Il selettore è lo stesso del Calciatore: nessuna stagione disabilitata,
          perché una sovrapposizione qui è ammessa e viene segnalata al
          salvataggio, non impedita in anticipo.
        */}
        <MultiSeasonSelector
          errorMessage={errors.seasons}
          helperText="Seleziona tutte le stagioni svolte nella stessa società."
          label="Stagioni complete"
          onToggle={onToggleSeason}
          selectedSeasons={draft.seasons}
          testID="coach-career-seasons"
        />
      </OnboardingSection>

      <InfoMessage message="Ruolo e categoria potranno essere modificati per ogni stagione." />

      <AppText
        accessibilityLiveRegion="polite"
        color="muted"
        style={styles.counter}
        variant="meta"
      >
        {draft.seasons.length === 1
          ? "1 stagione selezionata"
          : `${draft.seasons.length} stagioni selezionate`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  counter: {
    textAlign: "right",
  },
});
