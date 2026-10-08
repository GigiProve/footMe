/**
 * REV-PROF-20 — l'editor è raggiungibile solo dal proprietario di un profilo
 * Tifoso.
 *
 * La protezione a tre strati vive in `edit/use-profile-editor-guard`, la
 * stessa dei sei ruoli già rilasciati: la rotta non porta un `id`, quindi
 * l'identificativo arriva dalla sessione; le RLS di `fan_profiles` fermano
 * comunque ogni scrittura su una riga altrui; e questo hook rimanda indietro
 * chi apre la rotta — anche via deep link — senza essere un Tifoso.
 */
import { useProfileEditorGuard } from "../edit/use-profile-editor-guard";

export function useFanEditorGuard(): { userId: string | null } {
  return useProfileEditorGuard("fan");
}
