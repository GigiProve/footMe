import { useCallback, useState } from "react";

import type { CoachCareerEntry, CoachExperienceType } from "./coach-career-types";
import {
  generateCoachEntryId,
  sortCoachCareerEntriesBySeason,
  splitCoachEntryBySeasonDetails,
} from "./coach-career-utils";

/**
 * Le tre schermate del flusso carriera allenatore (REV-ONB-03 §O–§AC):
 * riepilogo, scelta della tipologia, editor. È lo stesso concatenamento del
 * Calciatore (`useCareerExperienceFlow`): cambia il modello, non il flusso.
 */
export type CoachFlowScreen =
  | { type: "list" }
  | { type: "select-type" }
  | { type: "form"; entry: CoachCareerEntry; editIndex: number | null };

function createEmptyEntry(
  type: CoachExperienceType,
  defaultRole: string,
): CoachCareerEntry {
  return {
    category: "",
    clubId: null,
    description: null,
    id: generateCoachEntryId(),
    period: null,
    role: defaultRole,
    seasonDetails: {},
    seasons: [],
    teamCity: "",
    teamLogoUrl: null,
    teamName: "",
    type,
  };
}

export function useCoachExperienceFlow({
  defaultRole = "",
  entries: rawEntries,
  onUpdateEntries,
}: {
  /** Ruolo principale del profilo: precompila le nuove esperienze (§T). */
  defaultRole?: string;
  entries: CoachCareerEntry[];
  onUpdateEntries: (entries: CoachCareerEntry[]) => void;
}) {
  const [screen, setScreen] = useState<CoachFlowScreen>({ type: "list" });

  /** Riepilogo sempre dalla più recente alla più vecchia (§AD). */
  const entries = sortCoachCareerEntriesBySeason(rawEntries);

  function startAdding() {
    setScreen({ type: "select-type" });
  }

  function selectType(type: CoachExperienceType) {
    setScreen({
      editIndex: null,
      entry: createEmptyEntry(type, defaultRole),
      type: "form",
    });
  }

  function edit(index: number) {
    setScreen({ editIndex: index, entry: { ...entries[index] }, type: "form" });
  }

  function remove(index: number) {
    onUpdateEntries(entries.filter((_, entryIndex) => entryIndex !== index));
    setScreen({ type: "list" });
  }

  /**
   * Salvare una modifica aggiorna la stessa esperienza, non ne crea una
   * seconda (§AB). Le stagioni con ruoli diversi diventano blocchi distinti:
   * è così che il modello conserva la variazione stagionale (§AW).
   */
  function save(saved: CoachCareerEntry) {
    const editIndex = screen.type === "form" ? screen.editIndex : null;
    const splitEntries = splitCoachEntryBySeasonDetails(saved);

    const updated =
      editIndex === null
        ? [...entries, ...splitEntries]
        : [
            ...entries.slice(0, editIndex),
            ...splitEntries,
            ...entries.slice(editIndex + 1),
          ];

    onUpdateEntries(sortCoachCareerEntriesBySeason(updated));
    setScreen({ type: "list" });
  }

  // Stabile: gli step la usano come dipendenza di un effetto.
  const cancel = useCallback(() => {
    setScreen({ type: "list" });
  }, []);

  return {
    cancel,
    edit,
    entries,
    remove,
    save,
    screen,
    selectType,
    startAdding,
  };
}
