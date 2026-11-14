import { POSITION_SAVED_INVALIDATIONS } from "../../saved/saved-position-invalidations";
import { useSetSaved } from "../../saved/use-set-saved";

type ToggleInput = {
  adId: string;
  /** Il salvato della riga, dal suo payload: lo store Salvati, se ne sa di più, vince. */
  saved: boolean;
};

/**
 * Bookmark istantaneo delle preview Posizioni (Per te, Esplora).
 *
 * HOM-07 §81, §129–§130: è lo stesso bookmark Posizioni di sempre, ora sulla
 * mutation unica `useSetSaved` e sullo store normalizzato — non una seconda
 * relazione. Salvata da Cerca compare in Salvati; rimossa da Salvati, il
 * bookmark di Cerca torna inattivo, senza ricaricare la lista visibile: le
 * righe leggono lo stato dallo store (`PositionPreviewRow`).
 */
export function useToggleSavedPosition() {
  const setSaved = useSetSaved();

  return {
    isPending: setSaved.isPending,
    mutate: ({ adId, saved }: ToggleInput) =>
      setSaved.toggle({ id: adId, type: "position" }, saved, {
        invalidate: POSITION_SAVED_INVALIDATIONS,
        surface: "position",
      }),
  };
}
