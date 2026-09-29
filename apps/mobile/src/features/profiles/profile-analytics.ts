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
  | "profile_media_deleted";

/** Tipo del contatto, mai il suo valore. */
export type PublicContactType =
  | "email"
  | "facebook"
  | "instagram"
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
  | "media";

type ProfileAnalyticsProps = {
  /** Tipo di riconoscimento, mai la competizione o la squadra. */
  awardType?: string;
  careerMetric?: CareerMetric;
  contactType?: PublicContactType;
  /** Modalita geografica scelta, mai i nomi dei territori. */
  geographicMode?: string;
  mediaFilter?: "all" | "photo" | "video";
  mediaType?: "image" | "video";
  profileType?: string;
  section?: ProfileEditSectionKey;
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
    ...(props.geographicMode ? { geographic_mode: props.geographicMode } : {}),
    ...(props.section ? { section: props.section } : {}),
    ...(typeof props.success === "boolean" ? { success: props.success } : {}),
    ...(typeof props.territoryCount === "number"
      ? { territory_count: props.territoryCount }
      : {}),
    ...(typeof props.visible === "boolean" ? { visible: props.visible } : {}),
    ...(props.contactType ? { contact_type: props.contactType } : {}),
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
