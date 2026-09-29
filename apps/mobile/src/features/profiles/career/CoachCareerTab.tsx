/**
 * Tab Carriera del Master Profile Allenatore (REV-PROF-03).
 *
 * "Percorso da allenatore": incarichi in ordine cronologico, raggruppati per
 * società e composti da singole stagioni. Nessuna statistica da giocatore, e
 * nessun controllo di modifica inline — la carriera si modifica solo dal flusso
 * esistente, esattamente come nel Master Profile Calciatore.
 *
 * Il selettore Allenatore/Calciatore compare solo se una carriera da ex
 * calciatore esiste davvero, e non ricarica nulla: le due viste sono già in
 * memoria, cambia solo quale viene renderizzata.
 */
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { ProfileFilterChips } from "../master/ProfileFilterChips";
import { ProfileSectionError } from "../master/ProfileSectionBlock";
import { CareerTotals } from "./CareerTotals";
import {
  buildCoachPlayerCareerForms,
  type CoachCareerView,
} from "./coach-career-model";
import { CoachCareerExperienceBlock } from "./CoachCareerExperienceBlock";
import { buildPlayerCareerView } from "./player-career-model";
import { PlayerCareerExperience } from "./PlayerCareerExperience";
import type { CoachPlayerCareerEntryRecord } from "../profile-service";

export type CoachCareerMode = "coach" | "player";

const MODE_OPTIONS = [
  { label: "Allenatore", value: "coach" as const },
  { label: "Calciatore", value: "player" as const },
];

type CoachCareerTabProps = {
  careerView: CoachCareerView;
  isOwner: boolean;
  onAddExperience?: () => void;
  onModeChange?: (mode: CoachCareerMode) => void;
  playerCareerEntries: readonly CoachPlayerCareerEntryRecord[];
};

export function CoachCareerTab({
  careerView,
  isOwner,
  onAddExperience,
  onModeChange,
  playerCareerEntries,
}: CoachCareerTabProps) {
  // Allenatore è sempre la modalità predefinita (vincolo esplicito).
  const [mode, setMode] = useState<CoachCareerMode>("coach");
  const hasPlayerCareer = playerCareerEntries.length > 0;

  /*
    Un errore in una delle due carriere non deve portarsi via l'altra: la
    costruzione della vista da ex calciatore è isolata e, se fallisce, quella
    da allenatore resta intatta e navigabile.
  */
  const playerCareer = useMemo(() => {
    if (!hasPlayerCareer) {
      return { failed: false, view: null };
    }

    try {
      return {
        failed: false,
        view: buildPlayerCareerView(
          buildCoachPlayerCareerForms(playerCareerEntries),
        ),
      };
    } catch {
      return { failed: true, view: null };
    }
  }, [hasPlayerCareer, playerCareerEntries]);

  // Il selettore sparisce se la carriera da calciatore sparisce: la modalità
  // non può restare appesa a una vista che non esiste più.
  const activeMode: CoachCareerMode = hasPlayerCareer ? mode : "coach";

  function handleModeChange(next: CoachCareerMode) {
    setMode(next);
    onModeChange?.(next);
  }

  return (
    <View style={styles.section} testID="coach-career-tab">
      <AppText accessibilityRole="header" variant="titleMd">
        {activeMode === "coach"
          ? "Percorso da allenatore"
          : "Percorso da calciatore"}
      </AppText>

      {hasPlayerCareer ? (
        <ProfileFilterChips
          accessibilityLabel="Carriera"
          onChange={handleModeChange}
          options={MODE_OPTIONS}
          testID="coach-career-mode"
          value={activeMode}
        />
      ) : null}

      {activeMode === "coach" ? (
        <CoachCareerBody
          careerView={careerView}
          isOwner={isOwner}
          onAddExperience={onAddExperience}
        />
      ) : playerCareer.view ? (
        <View>
          {playerCareer.view.experiences.map((experience, index) => (
            <PlayerCareerExperience
              experience={experience}
              isLast={index === playerCareer.view.experiences.length - 1}
              key={experience.id}
            />
          ))}
          <CareerTotals totals={playerCareer.view.totals} />
        </View>
      ) : (
        <ProfileSectionError
          message="Non è stato possibile mostrare la carriera da calciatore."
          testID="coach-player-career-error"
        />
      )}
    </View>
  );
}

function CoachCareerBody({
  careerView,
  isOwner,
  onAddExperience,
}: {
  careerView: CoachCareerView;
  isOwner: boolean;
  onAddExperience?: () => void;
}) {
  if (careerView.experiences.length === 0) {
    return (
      <View style={styles.empty} testID="coach-career-empty">
        <AppText variant="titleMd">
          {isOwner ? "Completa la tua carriera" : "Nessuna esperienza"}
        </AppText>
        <AppText color="secondary" variant="bodySm">
          {isOwner
            ? "Aggiungi le tue esperienze per raccontare il tuo percorso professionale."
            : "Questo allenatore non ha ancora aggiunto esperienze professionali."}
        </AppText>
        {isOwner && onAddExperience ? (
          <Button
            label="Aggiungi esperienza"
            onPress={onAddExperience}
            size="sm"
            variant="secondary"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {careerView.experiences.map((experience, index) => (
        <CoachCareerExperienceBlock
          experience={experience}
          isLast={index === careerView.experiences.length - 1}
          key={experience.id}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "flex-start",
    gap: spacing[8],
    paddingVertical: spacing[16],
  },
  section: {
    backgroundColor: colors.surface,
    gap: spacing[8],
    paddingBottom: spacing[18],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[18],
  },
});
