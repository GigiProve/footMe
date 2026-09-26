import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import {
  CoachExperiencesStep,
  type ExperienceFormCopy,
  type ExperiencesStepCopy,
} from "../coach/CoachExperiencesStep";
import type { CoachCareerEntry } from "../coach/coach-career-types";
import {
  getDirectorGenericRoleOptions,
  type DirectorPreviousRole,
} from "./director-previous-roles";

/**
 * Editor generico per i ruoli precedenti che non hanno ancora un onboarding
 * carriera dedicato — Scout, Procuratore, Arbitro, Altro (REV-ONB-07 §AF–§AG).
 *
 * §AG: nessun nuovo dominio applicativo. Sono gli stessi componenti già
 * approvati, con organizzazione, ruolo, categoria, periodo e descrizione
 * facoltativa.
 */
const GENERIC_COPY: ExperiencesStepCopy = {
  addButtonLabel: "Aggiungi esperienza",
  emptyDescription:
    "Aggiungi le esperienze maturate in questi ruoli. Puoi anche proseguire senza inserirne.",
  emptyTitle: "Nessuna esperienza aggiunta",
  listSubtitle: "Aggiungi le esperienze maturate in questi ruoli.",
  listTitle: "Altre esperienze",
  seasonRoleDescription:
    "Il ruolo può cambiare da una stagione all'altra nella stessa organizzazione.",
  summarySubtitle: "Controlla le esperienze aggiunte.",
  summaryTitle: "Le tue altre esperienze",
  typeSelectorSubtitle: "Scegli come vuoi inserire questa esperienza.",
  typeSelectorTitle: "Aggiungi esperienza",
};

const GENERIC_FORM_COPY: ExperienceFormCopy = {
  descriptionLabel: "Attività svolte",
  descriptionPlaceholder:
    "Riassumi in una o due righe le attività svolte in questo ruolo.",
  showDescription: true,
  teamLabel: "Organizzazione / Società",
  teamPlaceholder: "Cerca l'organizzazione",
};

type DirectorGenericExperiencesStepProps = {
  currentStep: number;
  entries: CoachCareerEntry[];
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onExperienceSaved?: (isEditing: boolean) => void;
  onRegisterBack?: (handler: (() => void) | null) => void;
  onUpdateEntries: (entries: CoachCareerEntry[]) => void;
  /** Ruoli precedenti dichiarati: definiscono le opzioni di ruolo (§AG). */
  selection: DirectorPreviousRole[];
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Sotto-flusso "Altre esperienze" del Dirigente (REV-ONB-07 §AF–§AG).
 *
 * Un solo passo per Scout, Procuratore, Arbitro e Altro: il ruolo si sceglie
 * dentro la singola esperienza, così dichiararne tre non produce tre
 * schermate quasi identiche.
 */
export function DirectorGenericExperiencesStep({
  currentStep,
  entries,
  isBusy,
  onBack,
  onContinue,
  onExperienceSaved,
  onRegisterBack,
  onUpdateEntries,
  searchTeams,
  selection,
  stepLabel,
  totalSteps,
}: DirectorGenericExperiencesStepProps) {
  const roleOptions = getDirectorGenericRoleOptions(selection);

  return (
    <CoachExperiencesStep
      allowOngoing
      copy={GENERIC_COPY}
      currentStep={currentStep}
      defaultRole={roleOptions.length === 1 ? roleOptions[0].value : ""}
      entries={entries}
      formCopy={GENERIC_FORM_COPY}
      isBusy={isBusy}
      onBack={onBack}
      onContinue={onContinue}
      onExperienceSaved={onExperienceSaved}
      onRegisterBack={onRegisterBack}
      onUpdateEntries={onUpdateEntries}
      roleOptions={roleOptions}
      searchTeams={searchTeams}
      stepLabel={stepLabel}
      testIDPrefix="director-other"
      totalSteps={totalSteps}
    />
  );
}
