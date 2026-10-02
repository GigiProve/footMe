/**
 * Analytics della gestione assistiti (REV-PROF-14).
 *
 * Il payload è chiuso per costruzione, come in `profile-analytics.ts`: passano
 * solo identificatori di tassonomia e conteggi. La query di ricerca, il nome
 * del calciatore, il token, il link, il messaggio e il canale di contatto non
 * hanno un campo dove finire, quindi non possono finirci per distrazione.
 */
import { trackEvent } from "../../../lib/analytics";
import type {
  AssistitiFilter,
  InviteChannel,
  RelationshipType,
  RepresentationVisibility,
  RequestsTab,
} from "./assistiti-model";

export type AssistitiAnalyticsEvent =
  | "assistiti_hub_opened"
  | "assistiti_filter_changed"
  | "assistiti_add_tapped"
  | "assistiti_search_started"
  | "assistiti_search_results"
  | "assistiti_search_empty"
  | "assistiti_search_failed"
  | "assistiti_manual_fallback_tapped"
  | "assistiti_candidate_selected"
  | "assistiti_request_opened"
  | "assistiti_request_type_selected"
  | "assistiti_request_visibility_selected"
  | "assistiti_request_sent"
  | "assistiti_request_failed"
  | "assistiti_request_cancelled"
  | "assistiti_manual_created"
  | "assistiti_manual_duplicate_shown"
  | "assistiti_manual_failed"
  | "assistiti_invite_created"
  | "assistiti_invite_channels_opened"
  | "assistiti_invite_channel_selected"
  | "assistiti_invite_link_copied"
  | "assistiti_invite_share_sheet_opened"
  | "assistiti_invite_resent"
  | "assistiti_invite_revoked"
  | "assistiti_invite_failed"
  | "assistiti_invite_postponed"
  | "assistiti_invite_opened"
  | "assistiti_invite_registration_started"
  | "assistiti_invite_reconciled"
  | "assistiti_invite_reconcile_failed"
  | "assistiti_relationship_updated"
  | "assistiti_relationship_ended"
  | "assistiti_relationship_removed"
  | "assistiti_requests_opened"
  | "assistiti_requests_tab_changed"
  | "assistiti_hub_completed";

type AssistitiAnalyticsProps = {
  /** Canale scelto dall'utente, mai il destinatario. */
  channel?: InviteChannel;
  /** Quanti risultati, non quali. */
  resultCount?: number;
  /** Quanti filtri sono attivi, non i loro valori. */
  activeFilters?: number;
  filter?: AssistitiFilter;
  relationshipType?: RelationshipType;
  /** Da dove arriva l'apertura: un identificatore di superficie, mai un url. */
  source?: string;
  success?: boolean;
  tab?: RequestsTab;
  visibility?: RepresentationVisibility;
};

export function trackAssistitiEvent(
  name: AssistitiAnalyticsEvent,
  props: AssistitiAnalyticsProps = {},
): void {
  trackEvent(name, {
    ...(props.channel ? { channel: props.channel } : {}),
    ...(typeof props.resultCount === "number"
      ? { result_count: props.resultCount }
      : {}),
    ...(typeof props.activeFilters === "number"
      ? { active_filters: props.activeFilters }
      : {}),
    ...(props.filter ? { filter: props.filter } : {}),
    ...(props.relationshipType
      ? { relationship_type: props.relationshipType }
      : {}),
    ...(props.source ? { source: props.source } : {}),
    ...(typeof props.success === "boolean" ? { success: props.success } : {}),
    ...(props.tab ? { tab: props.tab } : {}),
    ...(props.visibility ? { visibility: props.visibility } : {}),
  });
}
