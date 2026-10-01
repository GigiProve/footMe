/**
 * REV-PROF-08 — l'editor è raggiungibile solo dal proprietario di un profilo
 * Staff tecnico.
 *
 * La protezione a tre strati vive in `edit/use-profile-editor-guard`, la stessa
 * già adottata per Calciatore, Allenatore e gestione carriera: qui si dichiara
 * solo quale ruolo ci si aspetta.
 */
import { useProfileEditorGuard } from "../edit/use-profile-editor-guard";

export function useStaffEditorGuard(): { userId: string | null } {
  return useProfileEditorGuard("staff");
}
