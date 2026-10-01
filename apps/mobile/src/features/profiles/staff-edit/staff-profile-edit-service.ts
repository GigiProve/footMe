/**
 * Salvataggio per sezione della Modifica profilo Staff tecnico (REV-PROF-08).
 *
 * Non c'è niente di specifico da aggiungere: `ProfileFormState` rappresenta già
 * tutti i campi che questa task scrive — anagrafica, immagini, ruoli staff,
 * ruolo principale, disponibilità, zone e visibilità dei contatti — quindi il
 * salvataggio è quello condiviso, con le sue due trappole (la RPC che cancella
 * le carriere assenti dal payload e la data di nascita da reimpostare) già
 * gestite in un posto solo.
 *
 * Conseguenza voluta: nessun modulo di questa task tocca le esperienze di
 * carriera. `buildFullUpdatePayload` le rilegge identiche dal profilo appena
 * caricato, quindi salvare i contatti non riscrive una stagione.
 */
export { useProfileSectionSave as useStaffSectionSave } from "../edit/profile-section-save";
export {
  completeProfileQueryKey,
  useCompleteProfileQuery,
} from "../edit/player-profile-edit-service";
