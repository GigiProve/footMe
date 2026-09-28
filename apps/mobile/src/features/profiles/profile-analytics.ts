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
  | "public_contact_tapped";

/** Tipo del contatto, mai il suo valore. */
export type PublicContactType =
  | "email"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "website"
  | "youtube";

type ProfileAnalyticsProps = {
  careerMetric?: CareerMetric;
  contactType?: PublicContactType;
  mediaFilter?: "all" | "photo" | "video";
  mediaType?: "image" | "video";
  profileType?: string;
  tab?: string;
  viewerMode?: ProfileViewerMode;
};

export function trackProfileEvent(
  name: ProfileAnalyticsEvent,
  props: ProfileAnalyticsProps = {},
): void {
  trackEvent(name, {
    ...(props.careerMetric ? { career_metric: props.careerMetric } : {}),
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
