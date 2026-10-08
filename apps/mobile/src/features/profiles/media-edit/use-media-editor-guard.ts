/**
 * REV-PROF-22 — l'editor è raggiungibile solo da chi può gestire quella
 * realtà editoriale.
 *
 * La protezione a tre strati vive in `edit/use-profile-editor-guard`, la
 * stessa dei sette ruoli già rilasciati: la rotta non porta un `id`, quindi
 * l'identificativo della realtà arriva dalla sessione e non dalla
 * navigazione — non si apre l'editor di un'altra realtà cambiando un
 * parametro; le RLS `is_current_user` di `media_profiles`, `profiles` e
 * `profile_contacts` fermano comunque ogni scrittura su una riga altrui; e
 * questo hook rimanda indietro chi apre la rotta, anche via deep link, senza
 * essere un Media/Creator.
 *
 * Nel modello attuale una realtà editoriale ha un solo gestore — il
 * proprietario — e `fetch_public_media_profile` calcola `can_edit_profile`
 * esattamente così. Non esiste quindi una capability separata da controllare
 * qui: il giorno in cui esisteranno collaboratori cambierà quel calcolo, e
 * questo hook leggerà la capability invece del ruolo. La forma della
 * superficie non cambia.
 */
import { useProfileEditorGuard } from "../edit/use-profile-editor-guard";

export function useMediaEditorGuard(): { userId: string | null } {
  return useProfileEditorGuard("media");
}
