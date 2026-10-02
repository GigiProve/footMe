/**
 * Salvataggio per sezione della Modifica profilo Dirigente (REV-PROF-11).
 *
 * Il profilo completo è già letto da `useCompleteProfileQuery`, la stessa
 * query del Master Profile e degli altri editor: riusarla è ciò che fa
 * apparire una modifica ovunque senza refetch a catena e senza una seconda
 * copia dei dati.
 *
 * Qui c'è una trappola che il Dirigente non condivide con nessun altro ruolo:
 *
 * **`buildFullUpdatePayload` non produce `directorProfile`.** Serve i sette
 * ruoli attraverso `ProfileFormState`, che non rappresenta ruoli dirigenziali,
 * responsabilità, focus né destinatari. Allargarlo per un ruolo solo
 * significherebbe far crescere lo stato condiviso di tutti; quindi la parte
 * dirigenziale del payload si costruisce qui, con lo stesso pattern già usato
 * dall'Allenatore per i campi di `coach_profiles` che lo stato non modella.
 *
 * La conseguenza importante è che `director_profiles` viene scritta con un
 * `upsert` che **riscrive la riga intera**: il payload parte sempre dal
 * profilo appena letto, così salvare la bio non azzera la carriera e salvare
 * i ruoli non cancella i media. Le cinque colonne `jsonb` della carriera
 * (REV-PROF-10) ripassano identiche a ogni salvataggio, senza che nessun
 * modulo di questa task le tocchi.
 */
import type { UseMutationResult } from "@tanstack/react-query";

import type { ProfileFormState } from "../profile-edit-helpers";
import type {
  CompleteProfessionalProfile,
  CompleteProfessionalProfileUpdate,
} from "../profile-service";
import {
  buildProfileSectionPayload,
  useProfileSectionSave,
  type SaveProfileSectionVariables,
} from "../edit/profile-section-save";

export {
  completeProfileQueryKey,
  useCompleteProfileQuery,
} from "../edit/player-profile-edit-service";

/**
 * Campi di `director_profiles` che `ProfileFormState` non rappresenta.
 *
 * Ciò che non è nel patch resta com'era: il payload lo rilegge dal profilo
 * canonico, mai da una copia locale.
 */
export type DirectorProfilePatch = {
  availability_type?: string | null;
  director_roles?: string[];
  main_focus?: string | null;
  open_to_clubs?: boolean;
  open_to_others?: boolean;
  open_to_players?: boolean;
  open_to_staff?: boolean;
  open_to_work?: boolean;
  other_role_label?: string | null;
  preferred_provinces?: string[];
  preferred_regions?: string[];
  primary_role?: string | null;
  responsibilities?: string[];
};

export type DirectorSectionPatch = Partial<ProfileFormState> & {
  directorProfile?: DirectorProfilePatch;
};

export function buildDirectorSectionPayload(
  data: CompleteProfessionalProfile,
  patch: DirectorSectionPatch,
): CompleteProfessionalProfileUpdate {
  const { directorProfile: directorPatch, ...formPatch } = patch;
  const payload = buildProfileSectionPayload(
    data,
    formPatch as Partial<ProfileFormState>,
  );

  const current = data.directorProfile;

  if (!current) {
    return payload;
  }

  /*
    La riga parte intera dal profilo appena letto — carriere comprese — e solo
    dopo riceve il patch della sezione. Un modulo che non nomina una colonna la
    riscrive identica invece di azzerarla.
  */
  payload.directorProfile = {
    availability_type: current.availability_type,
    career_entries: current.career_entries,
    coach_career_entries: current.coach_career_entries,
    club_types: current.club_types,
    director_roles: current.director_roles,
    experience_categories: current.experience_categories,
    has_other_football_experience: current.has_other_football_experience,
    has_played_football: current.has_played_football,
    main_focus: current.main_focus,
    market_involvement: current.market_involvement,
    media_items: current.media_items,
    open_to_clubs: current.open_to_clubs,
    open_to_others: current.open_to_others,
    open_to_players: current.open_to_players,
    open_to_staff: current.open_to_staff,
    open_to_work: current.open_to_work,
    other_career_entries: current.other_career_entries,
    other_football_roles: current.other_football_roles,
    other_role_label: current.other_role_label,
    player_career_entries: current.player_career_entries,
    preferred_provinces: current.preferred_provinces,
    preferred_regions: current.preferred_regions,
    previous_roles: current.previous_roles,
    primary_role: current.primary_role,
    responsibilities: current.responsibilities,
    staff_career_entries: current.staff_career_entries,
    ...directorPatch,
  };

  return payload;
}

export type SaveDirectorSectionVariables =
  SaveProfileSectionVariables<DirectorSectionPatch>;

/**
 * Salvataggio di una sezione. Rilegge il profilo e riscrive la cache
 * condivisa, così hub e Master Profile sono aggiornati senza reload manuale.
 */
export function useDirectorSectionSave(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveDirectorSectionVariables
> {
  return useProfileSectionSave<DirectorSectionPatch>(profileId, {
    buildPayload: buildDirectorSectionPayload,
  });
}
