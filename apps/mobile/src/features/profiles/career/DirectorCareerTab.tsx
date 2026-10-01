/**
 * Tab Carriera del Master Profile Dirigente (REV-PROF-09, Screen 2).
 *
 * "Percorso dirigenziale": incarichi raggruppati per società e composti da
 * singole stagioni, con ruolo e categoria propri di ogni stagione. È lo stesso
 * blocco approvato per Allenatore e Staff tecnico — non una terza timeline.
 *
 * Il selettore mostra soltanto i percorsi che esistono davvero; con la sola
 * carriera dirigenziale sparisce del tutto. Il cambio percorso non ricarica
 * niente, perché le viste sono già tutte in memoria, e non mescola mai record
 * di tipi diversi: ogni percorso passa al renderer già approvato per il suo
 * modello.
 */
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { ProfileFilterChips } from "../master/ProfileFilterChips";
import { ProfileSectionError } from "../master/ProfileSectionBlock";
import { CareerTotals } from "./CareerTotals";
import { CoachCareerExperienceBlock } from "./CoachCareerExperienceBlock";
import type { CoachCareerView } from "./coach-career-model";
import {
  getAvailableDirectorPaths,
  type DirectorCareerPath,
  type DirectorProfileCareer,
} from "./director-career-model";
import { buildPlayerCareerView } from "./player-career-model";
import { PlayerCareerExperience } from "./PlayerCareerExperience";

const PATH_LABELS: Record<DirectorCareerPath, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  other: "Altri ruoli",
  player: "Calciatore",
  staff: "Staff tecnico",
};

const PATH_TITLES: Record<DirectorCareerPath, string> = {
  coach: "Percorso da allenatore",
  director: "Percorso dirigenziale",
  other: "Altre esperienze nel calcio",
  player: "Percorso da calciatore",
  staff: "Percorso nello staff tecnico",
};

type DirectorCareerTabProps = {
  career: DirectorProfileCareer;
  isOwner: boolean;
  /** Punto d'ingresso esistente alla gestione carriera. Solo Owner. */
  onAddExperience?: () => void;
  onPathChange: (path: DirectorCareerPath) => void;
  /** Percorso attivo: lo possiede la vista a tab, così i Dettagli lo guidano. */
  path: DirectorCareerPath;
};

export function DirectorCareerTab({
  career,
  isOwner,
  onAddExperience,
  onPathChange,
  path,
}: DirectorCareerTabProps) {
  const availablePaths = getAvailableDirectorPaths(career);
  // Un percorso che sparisce (esperienze cancellate) non lascia la tab appesa
  // a una vista che non esiste più: si torna al percorso dirigenziale.
  const activePath = availablePaths.includes(path) ? path : "director";

  /*
    Un errore in un percorso non deve portarsi via gli altri: la costruzione
    della vista da ex calciatore è isolata e, se fallisce, la carriera
    dirigenziale resta intatta e navigabile.
  */
  const playerCareer = useMemo(() => {
    if (career.playerForms.length === 0) {
      return { failed: false, view: null };
    }

    try {
      return { failed: false, view: buildPlayerCareerView([...career.playerForms]) };
    } catch {
      return { failed: true, view: null };
    }
  }, [career.playerForms]);

  return (
    <View style={styles.section} testID="director-career-tab">
      <AppText accessibilityRole="header" variant="titleMd">
        {PATH_TITLES[activePath]}
      </AppText>

      {availablePaths.length > 1 ? (
        <ProfileFilterChips
          accessibilityLabel="Percorso professionale"
          onChange={onPathChange}
          options={availablePaths.map((value) => ({
            label: PATH_LABELS[value],
            value,
          }))}
          testID="director-career-path"
          value={activePath}
        />
      ) : null}

      {activePath === "director" ? (
        <DirectorCareerBody
          isOwner={isOwner}
          onAddExperience={onAddExperience}
          view={career.director}
        />
      ) : activePath === "coach" ? (
        <ExperienceList testIDPrefix="director-coach" view={career.coach} />
      ) : activePath === "staff" ? (
        <ExperienceList testIDPrefix="director-staff" view={career.staff} />
      ) : activePath === "other" ? (
        <ExperienceList testIDPrefix="director-other" view={career.other} />
      ) : playerCareer.view ? (
        <View>
          {playerCareer.view.experiences.map((experience, index) => (
            <PlayerCareerExperience
              experience={experience}
              isLast={index === playerCareer.view.experiences.length - 1}
              key={experience.id}
            />
          ))}
          {/* Le statistiche da giocatore vivono solo qui: la carriera
              dirigenziale non ne mostra nessuna (§"Statistiche"). */}
          <CareerTotals totals={playerCareer.view.totals} />
        </View>
      ) : (
        <ProfileSectionError
          message="Non è stato possibile mostrare la carriera da calciatore."
          testID="director-player-career-error"
        />
      )}
    </View>
  );
}

function DirectorCareerBody({
  isOwner,
  onAddExperience,
  view,
}: {
  isOwner: boolean;
  onAddExperience?: () => void;
  view: CoachCareerView;
}) {
  if (view.experiences.length === 0) {
    return (
      <View style={styles.empty} testID="director-career-empty">
        <AppText variant="titleMd">
          {isOwner ? "Completa la tua carriera" : "Nessuna esperienza disponibile"}
        </AppText>
        <AppText color="secondary" variant="bodySm">
          {isOwner
            ? "Aggiungi le tue esperienze per raccontare il tuo percorso professionale."
            : "Questo profilo non ha ancora aggiunto esperienze dirigenziali."}
        </AppText>
        {/* Nessuna CTA di modifica al Visitor, nemmeno a carriera vuota. */}
        {isOwner && onAddExperience ? (
          <Button
            label="Aggiungi esperienza"
            onPress={onAddExperience}
            size="sm"
            testID="director-career-add"
            variant="secondary"
          />
        ) : null}
      </View>
    );
  }

  return <ExperienceList testIDPrefix="director" view={view} />;
}

function ExperienceList({
  testIDPrefix,
  view,
}: {
  testIDPrefix: string;
  view: CoachCareerView;
}) {
  return (
    <View>
      {view.experiences.map((experience, index) => (
        <CoachCareerExperienceBlock
          experience={experience}
          isLast={index === view.experiences.length - 1}
          key={experience.id}
          testIDPrefix={testIDPrefix}
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
