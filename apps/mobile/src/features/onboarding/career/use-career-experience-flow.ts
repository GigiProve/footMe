import { useCallback, useState } from "react";

import type { PlayerExperienceForm } from "../../profiles/player-sports";
import type { PlayerCareerEntry, PlayerCareerType } from "./player-career-types";
import {
  formsToPlayerEntries,
  generatePlayerEntryId,
  playerEntriesToForms,
  sortPlayerEntriesByRecency,
  splitPlayerEntryBySeasonDetails,
} from "./player-career-utils";

/**
 * Le tre schermate del flusso carriera (REV-ONB-02 §AB–§BG): elenco,
 * scelta della tipologia, editor. Sono le stesse per l'onboarding e per la
 * modifica dal profilo: qui vive solo il loro concatenamento.
 */
export type CareerFlowScreen =
  | { type: "list" }
  | { type: "select-type" }
  | { type: "form"; entry: PlayerCareerEntry; editIndex: number | null };

function createEmptyEntry(type: PlayerCareerType): PlayerCareerEntry {
  return {
    category: "",
    clubId: null,
    id: generatePlayerEntryId(),
    period: null,
    seasonDetails: {},
    seasons: [],
    teamCity: "",
    teamLogoUrl: "",
    teamName: "",
    type,
  };
}

export function useCareerExperienceFlow({
  careerEntries,
  onUpdateEntries,
}: {
  careerEntries: PlayerExperienceForm[];
  onUpdateEntries: (entries: PlayerExperienceForm[]) => void;
}) {
  const [screen, setScreen] = useState<CareerFlowScreen>({ type: "list" });

  /** Riepilogo sempre ordinato dalla più recente alla più vecchia (§BH). */
  const entries = sortPlayerEntriesByRecency(
    formsToPlayerEntries(careerEntries),
  );

  function startAdding() {
    setScreen({ type: "select-type" });
  }

  function selectType(type: PlayerCareerType) {
    setScreen({ editIndex: null, entry: createEmptyEntry(type), type: "form" });
  }

  function edit(index: number) {
    setScreen({ editIndex: index, entry: { ...entries[index] }, type: "form" });
  }

  function remove(index: number) {
    const next = entries.filter((_, entryIndex) => entryIndex !== index);

    onUpdateEntries(playerEntriesToForms(next));
    setScreen({ type: "list" });
  }

  /** Salvare una modifica aggiorna la stessa esperienza, non ne crea una (§BF). */
  function save(saved: PlayerCareerEntry) {
    const editIndex = screen.type === "form" ? screen.editIndex : null;
    const splitEntries = splitPlayerEntryBySeasonDetails(saved);

    const updated =
      editIndex === null
        ? [...entries, ...splitEntries]
        : [
            ...entries.slice(0, editIndex),
            ...splitEntries,
            ...entries.slice(editIndex + 1),
          ];

    onUpdateEntries(playerEntriesToForms(sortPlayerEntriesByRecency(updated)));
    setScreen({ type: "list" });
  }

  // Stabile: `PlayerCareerStep` la usa come dipendenza di un effetto.
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
