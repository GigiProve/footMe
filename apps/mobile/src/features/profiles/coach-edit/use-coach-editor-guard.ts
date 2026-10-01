/**
 * REV-PROF-05 — l'editor è raggiungibile solo dal proprietario di un profilo
 * Allenatore.
 *
 * La protezione a tre strati vive in `edit/use-profile-editor-guard`, la stessa
 * già adottata per il Calciatore, per lo Staff tecnico e per la gestione
 * carriera: qui si dichiara solo quale ruolo ci si aspetta.
 */
import { useProfileEditorGuard } from "../edit/use-profile-editor-guard";

export function useCoachEditorGuard(): { userId: string | null } {
  return useProfileEditorGuard("coach");
}
