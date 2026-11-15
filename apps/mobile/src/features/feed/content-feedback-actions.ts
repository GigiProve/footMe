/**
 * Le azioni HOM-11 del menu •••: Non mi interessa, Non seguire, Segnala (HOM-11 §1–§13,
 * §19–§27, §54–§57, §126–§131, D2, D4–D6, §229–§236, §246–§247).
 *
 * Logica pura, senza React: è ciò che rende testabile la matrice del menu senza
 * renderizzare niente. HOM-11 NON crea un menu (§1): estende il foglio HOM-04. Questo
 * modulo è «il dominio HOM-11» di §2 — fornisce le sue voci, e il foglio (`composeActionList`
 * in `FeedItemMenu`) compone solo quelle realmente disponibili (§2–§3):
 *
 *   Salva | Rimuovi dai salvati (HOM-07)  →  Non mi interessa  →  Non seguire <nome>
 *   →  divisore  →  Segnala | «Segnalazione inviata ✓» (non azionabile)
 *
 * Nessun menu uguale per tutti (§3): ogni voce dipende da origin, stato Follow, capability,
 * ownership. In particolare:
 *  • proprio o gestito (D5, §4–§7): se il menu ha azioni di gestione HOM-04 non compare
 *    nessuna delle tre — la capability viene dal server, mai da `author == viewer` (§5);
 *  • Non mi interessa: solo dove esiste una recommendation (§19–§27, D2) — nel Feed la
 *    capability del server (`can_mark_not_interested`), nel dettaglio l'origin Per te;
 *  • Non seguire: solo se il viewer segue DAVVERO (§54), mai «Segui» al suo posto (§56).
 *    Un Simple Repost si riferisce al reposter, seguito per costruzione (D4, §145);
 *  • Segnala: se `canReport`; già segnalato → riga non azionabile (D6, §130).
 *
 * Il client non deduce permessi (HOM-04 §21): traduce le capability in righe.
 */

import {
  NOT_INTERESTED_A11Y_HINT,
  NOT_INTERESTED_LABEL,
  isNotInterestedOrigin,
  reposterOf,
} from "../feed-feedback/feed-feedback-presentation";
import type { NotInterestedReposter } from "../feed-feedback/feed-feedback-types";
import { unfollowLabel, type FollowSource } from "../following/follow-source";
import {
  REPORTED_ACTION_A11Y_LABEL,
  REPORTED_ACTION_LABEL,
  REPORT_ACTION_LABEL,
} from "../moderation/moderation-presentation";
import type { ContentOrigin } from "./content-routes";
import { followSourceOfItem } from "./feed-signal-cache";
import type { FeedContentItem, FeedContentType } from "./feed-types";

/** Id stabili, indipendenti dal copy (come HOM-04 §133). */
export const FEEDBACK_ACTION_IDS = {
  notInterested: "NOT_INTERESTED",
  report: "REPORT_CONTENT",
  reported: "REPORT_SENT",
  unfollow: "UNFOLLOW_SOURCE",
} as const;

export type FeedbackActionId = (typeof FEEDBACK_ACTION_IDS)[keyof typeof FEEDBACK_ACTION_IDS];

/** Dove si apre il menu: la lista del Feed o il dettaglio del contenuto. */
export type FeedbackSurface = "feed" | "detail";

export type ContentFeedbackInput = {
  surface: FeedbackSurface;
  contentType: FeedContentType;
  contentId: string;
  origin: ContentOrigin | null;
  /** D5: il menu ha azioni di gestione HOM-04 (capability del server). */
  isManaged: boolean;
  /** `data.capabilities.can_mark_not_interested` (Feed). */
  serverCanMarkNotInterested: boolean;
  /** `data.capabilities.can_report` (server, già falso sul proprio/gestito). */
  canReport: boolean;
  /** `viewer_has_reported` del payload o `reported-store` di sessione. */
  hasReported: boolean;
  /** La fonte da offrire in «Non seguire»; `null` = nessuna voce. */
  unfollowSource: FollowSource | null;
  /** D4: il reposter di un Simple Repost, per il segnale «Non mi interessa». */
  reposter: NotInterestedReposter | null;
};

export type FeedbackActionDescriptor = {
  id: FeedbackActionId;
  label: string;
  icon: "eye-off-outline" | "person-remove-outline" | "flag-outline" | "checkmark-circle-outline";
  destructive?: boolean;
  dividerBefore?: boolean;
  /** D6: «Segnalazione inviata ✓» non è azionabile. */
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * §21–§27, §198–§199, D2: «Non mi interessa» è disponibile in Per te, e nel dettaglio
 * aperto da lì. Mai sul proprio o gestito (D5), mai da Profilo, Salvati, Cerca, Seguiti.
 */
export function canOfferNotInterested(input: ContentFeedbackInput): boolean {
  if (input.isManaged || !isNotInterestedOrigin(input.origin)) {
    return false;
  }
  // Nel Feed decide il server (`can_mark_not_interested`, emessa solo nella riga Feed). Nel
  // dettaglio il server non la emette: vale l'origin Per te (§27) AND `can_report`, che è
  // «non gestito dal viewer» (il server rifiuta comunque ogni altra origine con `not_allowed`).
  return input.surface === "feed" ? input.serverCanMarkNotInterested : input.canReport;
}

/** §54–§56, D5: «Non seguire» solo se la fonte è davvero seguita; mai «Segui». */
export function canOfferUnfollow(input: ContentFeedbackInput): boolean {
  return !input.isManaged && input.unfollowSource !== null;
}

/** D5–D6: Segnala (o la riga non azionabile «Segnalazione inviata ✓»), mai sul gestito. */
export function reportActionKind(input: ContentFeedbackInput): "report" | "reported" | null {
  if (input.isManaged) {
    return null;
  }
  if (input.hasReported) {
    return "reported";
  }
  return input.canReport ? "report" : null;
}

/**
 * Le voci HOM-11 nell'ordine di §11 e dello Screen 1. Capability falsa = riga assente,
 * mai disabilitata (come HOM-04 §28–§29); l'unica riga disabilitata è «Segnalazione
 * inviata ✓» (§130). Segnala sta dopo un divisore, in rosso con la bandierina: non
 * dipende dal solo colore (§201).
 */
export function buildViewerFeedbackActions(input: ContentFeedbackInput): FeedbackActionDescriptor[] {
  const actions: FeedbackActionDescriptor[] = [];

  if (canOfferNotInterested(input)) {
    actions.push({
      accessibilityHint: NOT_INTERESTED_A11Y_HINT,
      icon: "eye-off-outline",
      id: FEEDBACK_ACTION_IDS.notInterested,
      label: NOT_INTERESTED_LABEL,
    });
  }

  if (canOfferUnfollow(input) && input.unfollowSource) {
    actions.push({
      icon: "person-remove-outline",
      id: FEEDBACK_ACTION_IDS.unfollow,
      // §57: «Non seguire Marco Bianchi» / «Non seguire AC Como»; §200 lo stesso a voce.
      label: unfollowLabel(input.unfollowSource.name),
    });
  }

  const report = reportActionKind(input);
  if (report === "reported") {
    actions.push({
      accessibilityLabel: REPORTED_ACTION_A11Y_LABEL,
      dividerBefore: true,
      disabled: true,
      icon: "checkmark-circle-outline",
      id: FEEDBACK_ACTION_IDS.reported,
      label: REPORTED_ACTION_LABEL,
    });
  } else if (report === "report") {
    actions.push({
      accessibilityHint: "Apre la segnalazione",
      destructive: true,
      dividerBefore: true,
      icon: "flag-outline",
      id: FEEDBACK_ACTION_IDS.report,
      label: REPORT_ACTION_LABEL,
    });
  }

  return actions;
}

/**
 * Dall'elemento del Feed o del dettaglio all'ingresso di `buildViewerFeedbackActions`.
 * `unfollowedInSession` e `reportedInSession` sono gli insiemi di sessione (Non seguire
 * appena fatto, Segnala appena inviato): valgono prima che il refetch porti il dato del
 * server (§62, §126).
 */
export function buildFeedbackInput(
  item: FeedContentItem,
  options: {
    surface: FeedbackSurface;
    origin: ContentOrigin | null;
    isManaged: boolean;
    unfollowedInSession: boolean;
    reportedInSession: boolean;
  },
): ContentFeedbackInput {
  const source = followSourceOfItem(item);
  // D4, §145: un Simple Repost si riferisce al reposter, seguito per costruzione; altrimenti
  // l'autore, solo se il viewer lo segue davvero (§54).
  const follows = item.repost ? source !== null : item.isFollowingAuthor && source !== null;

  return {
    canReport: item.payload.capabilities.canReport,
    contentId: item.payload.postId,
    contentType: item.payload.contentType,
    hasReported: item.viewerHasReported === true || options.reportedInSession,
    // D5: il server nega `can_report` a chi gestisce il contenuto — anche il delegato Società con
    // la sola `content_create`, che non ha NESSUNA capability HOM-04 di gestione ma per il server
    // lo gestisce comunque. `!can_report` vale quindi come «gestito»: niente «Non seguire
    // <Società>» né le altre voci HOM-11. (Senza il dato del server, `can_report` è falso: nessuna voce.)
    isManaged: options.isManaged || !item.payload.capabilities.canReport,
    origin: options.origin,
    reposter: reposterOf(item.repost),
    serverCanMarkNotInterested: item.payload.capabilities.canMarkNotInterested === true,
    surface: options.surface,
    unfollowSource: follows && !options.unfollowedInSession ? source : null,
  };
}
