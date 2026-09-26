import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import {
  CoachExperiencesStep,
  type ExperienceFormCopy,
  type ExperiencesStepCopy,
} from "../coach/CoachExperiencesStep";
import type {
  CoachCareerEntry,
  CoachExperienceType,
} from "../coach/coach-career-types";
import { getDirectorExperienceRoleOptions } from "./director-taxonomy";

/**
 * Copy del Dirigente sulle stesse schermate dell'Allenatore (REV-ONB-07
 * §O–§W).
 *
 * §O: una sola frase, non tre bullet commerciali messi in fila.
 */
const DIRECTOR_COPY: ExperiencesStepCopy = {
  addButtonLabel: "Aggiungi esperienza",
  emptyDescription:
    "Valorizza il tuo percorso e fatti trovare dalle opportunità giuste.",
  emptyTitle: "Nessuna esperienza aggiunta",
  listSubtitle:
    "Valorizza il tuo percorso e fatti trovare dalle opportunità giuste.",
  listTitle: "La tua carriera dirigenziale",
  seasonRoleDescription:
    "Il ruolo può cambiare da una stagione all'altra nella stessa società.",
  summarySubtitle: "Controlla le esperienze aggiunte.",
  summaryTitle: "Le tue esperienze",
  typeSelectorSubtitle:
    "Scegli come vuoi inserire le tue esperienze dirigenziali.",
  typeSelectorTitle: "Aggiungi esperienza",
};

/** §Q, §U: si firma per una società, e la descrizione resta facoltativa. */
const DIRECTOR_FORM_COPY: ExperienceFormCopy = {
  descriptionLabel: "Attività svolte",
  descriptionPlaceholder:
    "Gestione mercato, scouting, rapporti con allenatori e pianificazione sportiva.",
  showDescription: true,
  teamLabel: "Società / Club",
  teamPlaceholder: "Cerca la società",
};

type DirectorCareerStepProps = {
  currentStep: number;
  /** Ruoli dichiarati nello step "Il tuo ruolo nel club" (§R). */
  declaredRoles: string[];
  /** Ruolo principale del profilo: default della nuova esperienza (§R, §S). */
  defaultRole: string;
  entries: CoachCareerEntry[];
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onExperienceAddStarted?: () => void;
  onExperienceSaved?: (isEditing: boolean) => void;
  onExperienceTypeSelected?: (type: CoachExperienceType) => void;
  onRegisterBack?: (handler: (() => void) | null) => void;
  onUpdateEntries: (entries: CoachCareerEntry[]) => void;
  /** Ruolo libero dichiarato con "Altro" (§H): entra fra le opzioni. */
  otherRoleLabel: string;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Passo "La tua carriera dirigenziale" (REV-ONB-07 §O–§Y).
 *
 * Non è un secondo editor: è lo step esperienze senza statistiche già
 * approvato per Allenatore e Staff (REV-ONB-03, REV-ONB-04), con la
 * tassonomia dei ruoli dirigenziali e la copy di questa task. Tre modalità,
 * ruolo per stagione, riepilogo ordinato e modifica riaprono esattamente gli
 * stessi componenti (§P, §R, §V, §W, §Y).
 *
 * §V: nessuna statistica sportiva, in nessuna modalità — l'editor non ne
 * prevede, quindi non c'è niente da disattivare.
 */
export function DirectorCareerStep({
  currentStep,
  declaredRoles,
  defaultRole,
  entries,
  isBusy,
  onBack,
  onContinue,
  onExperienceAddStarted,
  onExperienceSaved,
  onExperienceTypeSelected,
  onRegisterBack,
  onUpdateEntries,
  otherRoleLabel,
  searchTeams,
  stepLabel,
  totalSteps,
}: DirectorCareerStepProps) {
  /**
   * §R: le opzioni sono i ruoli dichiarati più gli eventuali ruoli storici
   * già salvati in un'esperienza e non più fra quelli selezionati.
   */
  const roleOptions = getDirectorExperienceRoleOptions(
    declaredRoles,
    otherRoleLabel,
    entries.flatMap((entry) => [
      entry.role,
      ...Object.values(entry.seasonDetails ?? {}).map((detail) => detail.role),
    ]),
  );

  return (
    <CoachExperiencesStep
      allowOngoing
      copy={DIRECTOR_COPY}
      currentStep={currentStep}
      defaultRole={defaultRole}
      entries={entries}
      formCopy={DIRECTOR_FORM_COPY}
      isBusy={isBusy}
      onBack={onBack}
      onContinue={onContinue}
      onExperienceAddStarted={onExperienceAddStarted}
      onExperienceSaved={onExperienceSaved}
      onExperienceTypeSelected={onExperienceTypeSelected}
      onRegisterBack={onRegisterBack}
      onUpdateEntries={onUpdateEntries}
      roleOptions={roleOptions}
      searchTeams={searchTeams}
      stepLabel={stepLabel}
      testIDPrefix="director"
      totalSteps={totalSteps}
    />
  );
}
