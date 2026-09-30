/**
 * Tab Carriera del Master Profile Staff tecnico (REV-PROF-06, Screen 2).
 *
 * "Percorso nello staff tecnico": incarichi raggruppati per società e composti
 * da singole stagioni, con ruolo e categoria propri di ogni stagione. È lo
 * stesso blocco approvato per l'Allenatore — non una seconda timeline.
 *
 * Il selettore mostra soltanto i percorsi che esistono davvero: con la sola
 * carriera nello staff sparisce del tutto, e il cambio non ricarica niente
 * perché le tre viste sono già in memoria.
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
import { buildPlayerCareerView } from "./player-career-model";
import { PlayerCareerExperience } from "./PlayerCareerExperience";
import { mapStaffPlayerEntriesToPlayerExperiences } from "./staff-career-grouping";
import {
  getAvailableStaffPaths,
  type StaffCareerPath,
  type StaffProfileCareer,
} from "./staff-career-model";
import type { StaffPlayerCareerEntryRecord } from "../profile-service";

const PATH_LABELS: Record<StaffCareerPath, string> = {
  coach: "Allenatore",
  player: "Calciatore",
  staff: "Staff tecnico",
};

const PATH_TITLES: Record<StaffCareerPath, string> = {
  coach: "Percorso da allenatore",
  player: "Percorso da calciatore",
  staff: "Percorso nello staff tecnico",
};

type StaffCareerTabProps = {
  career: StaffProfileCareer;
  isOwner: boolean;
  /** Punto d'ingresso esistente alla gestione carriera. Solo Owner. */
  onAddExperience?: () => void;
  onPathChange: (path: StaffCareerPath) => void;
  /** Percorso attivo: lo possiede la vista a tab, così i Dettagli lo guidano. */
  path: StaffCareerPath;
  playerCareerEntries: readonly StaffPlayerCareerEntryRecord[];
};

export function StaffCareerTab({
  career,
  isOwner,
  onAddExperience,
  onPathChange,
  path,
  playerCareerEntries,
}: StaffCareerTabProps) {
  const availablePaths = getAvailableStaffPaths(career);
  // Un percorso che sparisce (esperienze cancellate) non lascia la tab appesa
  // a una vista che non esiste più: si torna allo staff tecnico.
  const activePath = availablePaths.includes(path) ? path : "staff";

  /*
    Un errore in un percorso non deve portarsi via gli altri: la costruzione
    della vista da ex calciatore è isolata e, se fallisce, la carriera nello
    staff resta intatta e navigabile.
  */
  const playerCareer = useMemo(() => {
    if (playerCareerEntries.length === 0) {
      return { failed: false, view: null };
    }

    try {
      return {
        failed: false,
        view: buildPlayerCareerView(
          mapStaffPlayerEntriesToPlayerExperiences([...playerCareerEntries]),
        ),
      };
    } catch {
      return { failed: true, view: null };
    }
  }, [playerCareerEntries]);

  return (
    <View style={styles.section} testID="staff-career-tab">
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
          testID="staff-career-path"
          value={activePath}
        />
      ) : null}

      {activePath === "staff" ? (
        <StaffCareerBody
          isOwner={isOwner}
          onAddExperience={onAddExperience}
          view={career.staff}
        />
      ) : activePath === "coach" ? (
        <ExperienceList testIDPrefix="staff-coach" view={career.coach} />
      ) : playerCareer.view ? (
        <View>
          {playerCareer.view.experiences.map((experience, index) => (
            <PlayerCareerExperience
              experience={experience}
              isLast={index === playerCareer.view.experiences.length - 1}
              key={experience.id}
            />
          ))}
          {/* Le statistiche da giocatore vivono solo qui (§"Carriera Calciatore"). */}
          <CareerTotals totals={playerCareer.view.totals} />
        </View>
      ) : (
        <ProfileSectionError
          message="Non è stato possibile mostrare la carriera da calciatore."
          testID="staff-player-career-error"
        />
      )}
    </View>
  );
}

function StaffCareerBody({
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
      <View style={styles.empty} testID="staff-career-empty">
        <AppText variant="titleMd">
          {isOwner ? "Aggiungi il tuo percorso" : "Carriera non ancora disponibile"}
        </AppText>
        <AppText color="secondary" variant="bodySm">
          {isOwner
            ? "Racconta le esperienze maturate nello staff tecnico."
            : "Questo profilo non ha ancora aggiunto esperienze nello staff tecnico."}
        </AppText>
        {/* Nessuna CTA di modifica al Visitor, nemmeno a carriera vuota. */}
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

  return <ExperienceList testIDPrefix="staff" view={view} />;
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
