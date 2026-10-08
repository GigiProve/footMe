/**
 * REV-PROF-16 — l'editor è raggiungibile solo dal proprietario di un profilo
 * Procuratore.
 *
 * La protezione a tre strati vive in `edit/use-profile-editor-guard`, la
 * stessa già adottata per Calciatore, Allenatore, Staff tecnico, Dirigente e
 * per la gestione carriera: qui si dichiara solo quale ruolo ci si aspetta.
 * Non è una CTA nascosta — chi arriva sulla rotta senza esserne il
 * proprietario viene rimandato indietro, e le RLS fermano comunque ogni
 * scrittura.
 */
import { useProfileEditorGuard } from "../edit/use-profile-editor-guard";

export function useAgentEditorGuard(): { userId: string | null } {
  return useProfileEditorGuard("agent");
}
