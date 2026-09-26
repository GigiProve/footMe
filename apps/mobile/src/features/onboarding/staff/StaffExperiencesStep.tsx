import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import {
  CoachExperiencesStep,
  type ExperiencesStepCopy,
} from "../coach/CoachExperiencesStep";
import type {
  CoachCareerEntry,
  CoachExperienceType,
} from "../coach/coach-career-types";
import { getStaffExperienceRoleOptions } from "./staff-options";

/**
 * Copy dello Staff tecnico sulle stesse schermate dell'Allenatore
 * (REV-ONB-04 §P, §Q, §T).
 *
 * "Stagioni precedenti" e "Seleziona stagioni" sono copy definitive del
 * Master e vivono dentro il selector stagioni condiviso: qui non vanno
 * riscritte (§T).
 */
const STAFF_COPY: ExperiencesStepCopy = {
  addButtonLabel: "Aggiungi un'altra esperienza",
  emptyDescription:
    "Aggiungi la tua prima esperienza per completare il profilo.",
  emptyTitle: "Nessuna esperienza aggiunta",
  listSubtitle: "Scegli come vuoi inserire le tue esperienze professionali.",
  listTitle: "La tua esperienza nello staff",
  seasonRoleDescription:
    "Il ruolo può cambiare da una stagione all'altra nella stessa squadra.",
  summarySubtitle: "Controlla le esperienze aggiunte.",
  summaryTitle: "Le tue esperienze",
  typeSelectorSubtitle:
    "Scegli come vuoi inserire le tue esperienze professionali.",
  typeSelectorTitle: "La tua esperienza nello staff",
};

type StaffExperiencesStepProps = {
  currentStep: number;
  /** Ruoli dichiarati nello Screen 4: sono le opzioni preferite (§R). */
  declaredRoles: string[];
  /** Ruolo principale del profilo: default della nuova esperienza (§R). */
  defaultRole: string;
  entries: CoachCareerEntry[];
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onExperienceAdded?: () => void;
  onExperienceEdited?: () => void;
  onExperienceTypeSelected?: (type: CoachExperienceType) => void;
  onRegisterBack?: (handler: (() => void) | null) => void;
  onUpdateEntries: (entries: CoachCareerEntry[]) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Passo "La tua esperienza nello staff" (REV-ONB-04 §P–§AD).
 *
 * Non è un secondo editor: è lo step delle esperienze professionali senza
 * statistiche già approvato per l'Allenatore (REV-ONB-03), con la tassonomia
 * dei ruoli Staff e la copy di questa task. Tre modalità, ruolo per stagione,
 * riepilogo ordinato e modifica riaprono esattamente gli stessi componenti
 * (§Q, §V, §W, §AB).
 */
export function StaffExperiencesStep({
  currentStep,
  declaredRoles,
  defaultRole,
  entries,
  isBusy,
  onBack,
  onContinue,
  onExperienceAdded,
  onExperienceEdited,
  onExperienceTypeSelected,
  onRegisterBack,
  onUpdateEntries,
  searchTeams,
  stepLabel,
  totalSteps,
}: StaffExperiencesStepProps) {
  /**
   * §R: le opzioni sono i ruoli dichiarati, più gli eventuali ruoli storici
   * già presenti nelle esperienze e non più fra quelli selezionati.
   */
  const roleOptions = getStaffExperienceRoleOptions(
    declaredRoles,
    entries.flatMap((entry) => [
      entry.role,
      ...Object.values(entry.seasonDetails ?? {}).map((detail) => detail.role),
    ]),
  );

  return (
    <CoachExperiencesStep
      allowOngoing
      copy={STAFF_COPY}
      currentStep={currentStep}
      defaultRole={defaultRole}
      entries={entries}
      isBusy={isBusy}
      onBack={onBack}
      onContinue={onContinue}
      onExperienceSaved={(isEditing) =>
        isEditing ? onExperienceEdited?.() : onExperienceAdded?.()
      }
      onExperienceTypeSelected={onExperienceTypeSelected}
      onRegisterBack={onRegisterBack}
      onUpdateEntries={onUpdateEntries}
      roleOptions={roleOptions}
      searchTeams={searchTeams}
      stepLabel={stepLabel}
      testIDPrefix="staff"
      totalSteps={totalSteps}
    />
  );
}
