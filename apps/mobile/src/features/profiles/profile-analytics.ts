/**
 * Analytics del Master Profile (REV-PROF-01 §42).
 *
 * Il payload è chiuso per costruzione: passano solo tipo di profilo, modalità
 * di visualizzazione, tab, metrica, tipo di contatto e tipo di media. Nome,
 * data di nascita, telefono, email, username social e URL non hanno un posto
 * dove finire, quindi non possono finirci per distrazione.
 */
import { trackEvent } from "../../lib/analytics";
import type { CareerMetric } from "./career/player-career-model";

export type ProfileViewerMode = "owner" | "visitor";

export type ProfileAnalyticsEvent =
  | "player_profile_viewed"
  | "player_profile_owner_viewed"
  | "player_profile_visitor_viewed"
  | "profile_tab_changed"
  | "profile_follow_tapped"
  | "profile_message_tapped"
  | "profile_share_tapped"
  | "profile_edit_tapped"
  | "career_section_viewed"
  | "career_metric_changed"
  | "media_filter_changed"
  | "profile_media_opened"
  | "profile_media_add_tapped"
  | "public_contact_tapped"
  // Master Profile Società (REV-PROF-17). Nessun nome di società, squadra
  // o persona entra in questi eventi: solo la superficie e la modalità.
  | "profile_unfollow_tapped"
  | "profile_filter_changed"
  | "society_teams_see_all_tapped"
  | "society_team_opened"
  | "society_team_tab_changed"
  | "society_team_squad_opened"
  | "society_affiliate_opened"
  | "society_manage_positions_tapped"
  // Modifica profilo Società (REV-PROF-18). La sezione e la superficie, mai
  // la denominazione, la categoria, la città o un recapito.
  | "society_profile_edit_opened"
  | "society_profile_structure_changed"
  | "society_profile_category_changed"
  | "society_profile_manage_teams_tapped"
  | "society_profile_structure_blocked"
  | "society_profile_venue_same_address_toggled"
  | "society_profile_conflict"
  // Editor profilo (REV-PROF-02 §Z)
  | "player_profile_edit_opened"
  | "profile_edit_section_opened"
  | "profile_edit_section_saved"
  | "profile_edit_section_save_failed"
  | "profile_photo_change_tapped"
  | "profile_cover_change_tapped"
  | "profile_area_mode_changed"
  | "current_experience_manage_tapped"
  | "award_add_tapped"
  | "award_created"
  | "award_edited"
  | "award_deleted"
  | "public_contact_visibility_changed"
  | "profile_media_edit_tapped"
  | "profile_media_featured_changed"
  | "profile_media_delete_tapped"
  | "profile_media_deleted"
  | "profile_media_upload_failed"
  // REV-PROF-05: hub e moduli della Modifica profilo Allenatore.
  | "coach_profile_edit_opened"
  | "profile_edit_view_profile_tapped"
  | "profile_edit_section_load_failed"
  | "profile_edit_unsaved_exit"
  | "profile_photo_change_completed"
  | "profile_cover_change_completed"
  | "profile_image_upload_failed"
  | "award_delete_failed"
  // Master Profile Allenatore (REV-PROF-03)
  | "profile_viewed"
  | "profile_owner_viewed"
  | "profile_visitor_viewed"
  | "profile_more_menu_opened"
  | "career_mode_changed"
  | "profile_club_tapped"
  | "career_empty_cta_tapped"
  | "profile_load_failed"
  | "profile_tab_load_failed"
  // Gestione carriera Allenatore (REV-PROF-04)
  | "coach_career_manager_opened"
  | "coach_career_add_tapped"
  | "coach_career_type_selected"
  | "coach_career_season_roles_opened"
  | "coach_career_experience_saved"
  | "coach_career_experience_edited"
  | "coach_career_experience_deleted"
  | "coach_career_group_edited"
  | "coach_career_group_deleted"
  | "coach_career_player_opened"
  | "coach_career_player_add_tapped"
  | "coach_career_cancelled"
  | "coach_career_unsaved_exit"
  | "coach_career_completed"
  | "coach_career_load_failed"
  | "coach_career_save_failed"
  | "coach_career_delete_failed"
  // Master Profile Staff tecnico (REV-PROF-06)
  | "profile_additional_career_tapped"
  | "profile_career_add_tapped"
  // Gestione carriera Staff tecnico (REV-PROF-07)
  | "staff_career_manager_opened"
  | "staff_career_add_tapped"
  | "staff_career_type_selected"
  | "staff_career_season_roles_opened"
  | "staff_career_experience_saved"
  | "staff_career_experience_edited"
  | "staff_career_experience_deleted"
  | "staff_career_group_edited"
  | "staff_career_group_deleted"
  | "staff_career_paths_opened"
  | "staff_career_coach_opened"
  | "staff_career_coach_add_tapped"
  | "staff_career_player_opened"
  | "staff_career_player_add_tapped"
  | "staff_career_cancelled"
  | "staff_career_unsaved_exit"
  | "staff_career_completed"
  | "staff_career_load_failed"
  | "staff_career_save_failed"
  | "staff_career_delete_failed"
  // Modifica profilo Staff tecnico (REV-PROF-08)
  | "staff_profile_edit_opened"
  | "staff_primary_role_changed"
  // Gestione carriera Dirigente (REV-PROF-10)
  | "director_career_manager_opened"
  | "director_career_add_tapped"
  | "director_career_type_selected"
  | "director_career_season_roles_opened"
  | "director_career_experience_saved"
  | "director_career_experience_edited"
  | "director_career_experience_deleted"
  | "director_career_group_edited"
  | "director_career_group_deleted"
  | "director_career_paths_opened"
  | "director_career_coach_opened"
  | "director_career_coach_add_tapped"
  | "director_career_staff_opened"
  | "director_career_staff_add_tapped"
  | "director_career_player_opened"
  | "director_career_player_add_tapped"
  | "director_career_other_opened"
  | "director_career_other_add_tapped"
  | "director_career_cancelled"
  | "director_career_unsaved_exit"
  | "director_career_completed"
  | "director_career_load_failed"
  | "director_career_save_failed"
  | "director_career_delete_failed"
  // Modifica profilo Dirigente (REV-PROF-11)
  | "director_profile_edit_opened"
  | "director_primary_role_changed"
  // Master Profile Procuratore (REV-PROF-13)
  | "agent_assistito_tapped"
  | "agent_assistiti_see_all_tapped"
  // Gestione carriera Procuratore (REV-PROF-15)
  | "agent_career_manager_opened"
  | "agent_career_add_tapped"
  | "agent_career_type_selected"
  | "agent_career_organization_search_started"
  | "agent_career_organization_search_empty"
  | "agent_career_organization_selected"
  | "agent_career_manual_opened"
  | "agent_career_manual_completed"
  | "agent_career_experience_saved"
  | "agent_career_independent_saved"
  | "agent_career_primary_set"
  | "agent_career_experience_edited"
  | "agent_career_organization_changed"
  | "agent_career_assignment_ended"
  | "agent_career_experience_deleted"
  | "agent_career_paths_opened"
  | "agent_career_director_opened"
  | "agent_career_coach_opened"
  | "agent_career_staff_opened"
  | "agent_career_player_opened"
  | "agent_career_director_add_tapped"
  | "agent_career_coach_add_tapped"
  | "agent_career_staff_add_tapped"
  | "agent_career_player_add_tapped"
  | "agent_career_cancelled"
  | "agent_career_unsaved_exit"
  | "agent_career_completed"
  | "agent_career_closed"
  | "agent_career_load_failed"
  | "agent_career_search_failed"
  | "agent_career_save_failed"
  | "agent_career_update_failed"
  | "agent_career_end_failed"
  | "agent_career_delete_failed"
  // Modifica profilo Procuratore (REV-PROF-16)
  | "agent_profile_edit_opened"
  | "agent_license_toggled"
  | "agent_federation_changed"
  | "agent_federation_visibility_changed"
  | "agent_career_manage_tapped"
  | "agent_primary_activities_limit_reached"
  | "agent_featured_assistiti_opened"
  | "agent_featured_assistito_changed"
  | "agent_featured_assistiti_reordered"
  | "agent_featured_assistiti_limit_reached"
  | "agent_featured_assistiti_manage_tapped"
  | "agent_featured_assistiti_load_failed"
  // Master Profile Tifoso (REV-PROF-19). Il tipo di contenuto è un enum, mai
  // il testo di un'opinione, la domanda di un sondaggio o il nome di una
  // squadra: quei valori non hanno un campo dove finire.
  | "fan_create_sheet_opened"
  | "fan_create_sheet_closed"
  | "fan_create_option_selected"
  | "fan_composer_open_failed"
  | "fan_content_opened"
  | "fan_favorite_club_tapped";

/** Tipo del contatto, mai il suo valore. */
export type PublicContactType =
  | "email"
  | "facebook"
  | "instagram"
  /** REV-PROF-16: ottavo canale, aggiunto con la Modifica profilo Procuratore. */
  | "linkedin"
  | "phone"
  | "tiktok"
  | "website"
  | "youtube";

/** Sezione dell editor: un identificatore fisso, mai il contenuto del form. */
export type ProfileEditSectionKey =
  | "photo"
  | "personal"
  | "technical"
  | "opportunities"
  | "situation"
  | "career"
  | "awards"
  | "contacts"
  | "media"
  /** REV-PROF-05: "Filosofia e stile di gioco", solo Allenatore. */
  | "philosophy"
  /** REV-PROF-08: "Profilo professionale", Staff tecnico e Dirigente. */
  | "professional"
  /** REV-PROF-08: "Percorsi aggiuntivi", Staff tecnico e Dirigente. */
  | "paths"
  /** REV-PROF-11: "Responsabilità e focus", solo Dirigente. */
  | "responsibilities"
  /** REV-PROF-11: "Bio e lingue", solo Dirigente. */
  | "bio"
  /** REV-PROF-16: "Attivita e mercati", solo Procuratore. */
  | "activities"
  /** REV-PROF-16: "Assistiti in evidenza", solo Procuratore. */
  | "assistiti"
  /** REV-PROF-18: i cinque moduli e i quattro entry point della Società. */
  | "identity"
  | "sport"
  | "venue"
  | "description"
  | "teams"
  | "affiliates"
  | "positions";

/** Modalità temporale scelta, mai la società, il ruolo o le date. */
export type CoachExperienceMode =
  | "MULTI_SEASON"
  | "SINGLE_SEASON"
  | "CUSTOM_PERIOD";

type ProfileAnalyticsProps = {
  /** Tipo di riconoscimento, mai la competizione o la squadra. */
  awardType?: string;
  careerMetric?: CareerMetric;
  /**
   * Carriera mostrata dal selettore (REV-PROF-03; REV-PROF-06 aggiunge
   * "staff"; REV-PROF-09 "director" e "other"; REV-PROF-13 "agent"). È un
   * identificatore di
   * percorso, mai una società o un ruolo.
   */
  careerMode?: "agent" | "coach" | "director" | "other" | "player" | "staff";
  /** REV-PROF-04: modalità temporale dell'esperienza, mai il suo contenuto. */
  experienceMode?: CoachExperienceMode;
  /**
   * REV-PROF-15: come l'incarico è stato svolto — presso un'organizzazione
   * oppure per conto proprio. Mai il nome dell'organizzazione.
   */
  organizationMode?: "agency" | "independent";
  /** Quante stagioni sono state selezionate, non quali. */
  seasonCount?: number;
  /** Quanti ruoli sono selezionati, non quali. */
  roleCount?: number;
  contactType?: PublicContactType;
  /**
   * REV-PROF-19: tipo di contenuto del Tifoso. Un enum chiuso — mai il titolo,
   * il testo, la domanda, le opzioni o i giocatori taggati.
   */
  contentType?: "formation" | "opinion" | "photo" | "poll" | "proposal";
  /** Modalita geografica scelta, mai i nomi dei territori. */
  geographicMode?: string;
  mediaFilter?: "all" | "photo" | "video";
  mediaType?: "image" | "video";
  profileType?: string;
  section?: ProfileEditSectionKey;
  /** Da dove arriva la visita: un identificatore di superficie, mai un url. */
  source?: string;
  /** Quanti elementi sono selezionati, non quali (REV-PROF-16). */
  selectionCount?: number;
  /** Quanti territori sono selezionati, non quali. */
  territoryCount?: number;
  /** Esito di un salvataggio: nessun messaggio di errore, nessun payload. */
  success?: boolean;
  tab?: string;
  viewerMode?: ProfileViewerMode;
  /** Un contatto e stato reso pubblico o privato. Il valore non passa di qui. */
  visible?: boolean;
};

export function trackProfileEvent(
  name: ProfileAnalyticsEvent,
  props: ProfileAnalyticsProps = {},
): void {
  trackEvent(name, {
    ...(props.awardType ? { award_type: props.awardType } : {}),
    ...(props.careerMetric ? { career_metric: props.careerMetric } : {}),
    ...(props.careerMode ? { career_mode: props.careerMode } : {}),
    ...(props.experienceMode ? { experience_mode: props.experienceMode } : {}),
    ...(typeof props.seasonCount === "number"
      ? { season_count: props.seasonCount }
      : {}),
    ...(typeof props.roleCount === "number"
      ? { role_count: props.roleCount }
      : {}),
    ...(props.source ? { source: props.source } : {}),
    ...(props.geographicMode ? { geographic_mode: props.geographicMode } : {}),
    ...(props.section ? { section: props.section } : {}),
    ...(typeof props.success === "boolean" ? { success: props.success } : {}),
    ...(typeof props.selectionCount === "number"
      ? { selection_count: props.selectionCount }
      : {}),
    ...(typeof props.territoryCount === "number"
      ? { territory_count: props.territoryCount }
      : {}),
    ...(typeof props.visible === "boolean" ? { visible: props.visible } : {}),
    ...(props.contactType ? { contact_type: props.contactType } : {}),
    ...(props.contentType ? { content_type: props.contentType } : {}),
    ...(props.mediaFilter ? { media_filter: props.mediaFilter } : {}),
    ...(props.mediaType ? { media_type: props.mediaType } : {}),
    ...(props.profileType ? { profile_type: props.profileType } : {}),
    ...(props.tab ? { tab: props.tab } : {}),
    ...(props.viewerMode ? { viewer_mode: props.viewerMode } : {}),
  });
}

/**
 * Visualizzazione del profilo: un solo invio per profilo aperto (§42). Un
 * rebuild o un cambio tab non devono generare un secondo evento, quindi la
 * chiave già vista viene ricordata finché la schermata resta montata.
 */
export function trackPlayerProfileViewed(
  seenKey: string,
  viewerMode: ProfileViewerMode,
  seen: Set<string>,
): void {
  if (seen.has(seenKey)) {
    return;
  }

  seen.add(seenKey);

  trackProfileEvent("player_profile_viewed", {
    profileType: "player",
    viewerMode,
  });
  trackProfileEvent(
    viewerMode === "owner"
      ? "player_profile_owner_viewed"
      : "player_profile_visitor_viewed",
    { profileType: "player", viewerMode },
  );
}

/**
 * Variante per tipologia di profilo (REV-PROF-03). Stessa regola di
 * `trackPlayerProfileViewed` — un solo invio per profilo aperto — con il tipo
 * di profilo e la sorgente della visita al posto del "player" fisso.
 *
 * `source` è un identificatore di superficie ("search", "feed"), mai un url e
 * mai un identificativo di persona.
 */
export function trackProfileViewed(
  seenKey: string,
  {
    profileType,
    seen,
    source,
    viewerMode,
  }: {
    profileType: string;
    seen: Set<string>;
    source?: string;
    viewerMode: ProfileViewerMode;
  },
): void {
  if (seen.has(seenKey)) {
    return;
  }

  seen.add(seenKey);

  const props = {
    profileType,
    viewerMode,
    ...(source ? { source } : {}),
  };

  trackProfileEvent("profile_viewed", props);
  trackProfileEvent(
    viewerMode === "owner" ? "profile_owner_viewed" : "profile_visitor_viewed",
    props,
  );
}
