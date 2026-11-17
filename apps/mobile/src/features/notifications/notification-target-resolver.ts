/**
 * HOM-14 — Target Resolver centralizzato (§146–§157, §167).
 *
 * Trasforma `target_type` + `target_id` + params nella destinazione di
 * navigazione. Mai dal copy (§147): il client non deduce nulla da «ha commentato
 * il tuo post». Vale anche per il tap da push (§167): stessa funzione, stesse
 * destinazioni, e queste rivalidano visibilità e Block al momento dell'apertura
 * (§165–§166): profilo, Società e contenuto mostrano da sé lo stato neutro
 * («Profilo non disponibile», «Contenuto non disponibile», §157–§159), quindi il
 * resolver non decide mai se qualcosa è visibile.
 *
 * I tipi operativi storici (richieste, candidature, eventi, inviti, ruoli…)
 * non hanno target: conservano la logica di destinazione che prima viveva nel
 * Centro, ora qui.
 *
 *   • «route»       → navigare a `href`.
 *   • «none»        → nessuna navigazione per scelta (es. rappresentanza rimossa).
 *   • «unavailable» → mancano gli identificativi: il tap apre comunque la
 *                     notifica, senza errore né pagina bianca (§157, §161), e
 *                     mostra il copy neutro di `notificationUnavailableMessage`
 *                     (HOM-15 §149–§150, §295).
 *
 * HOM-15 §57: ogni dettaglio contenuto aperto da qui porta `origin=NOTIFICATION`.
 */

import { BLOCK_COPY } from "../blocking/blocking-presentation";
import { CONTENT_UNAVAILABLE_TITLE } from "../feed/content-availability-presentation";
import { ROLE_LINK_HREFS } from "../role-link/role-link-routes";
import { contentDetailHref, type ContentOrigin } from "../feed/content-routes";
import type { FeedContentType } from "../feed/feed-types";
import { draftsHref } from "../publishing/publishing-routes";
import {
  isScheduledContentNotification,
  isSelectionEventNotification,
  scheduledContentNotificationHref,
  selectionEventNotificationHref,
} from "./notifications-helpers";
import type { NotificationTargetSource } from "./notification-types";

export type NotificationDestination =
  | { kind: "route"; href: string }
  | { kind: "none" }
  | { kind: "unavailable" };

/** I sei tipi di contenuto che il dettaglio sa aprire (HOM-08 §2). */
const CONTENT_TYPES: readonly string[] = [
  "profile_post",
  "club_media",
  "media_profile",
  "media_tribuna",
  "fan_tribuna",
  "fan_media",
];

const ROUTE = (href: string): NotificationDestination => ({ href, kind: "route" });
const UNAVAILABLE: NotificationDestination = { kind: "unavailable" };
const NONE: NotificationDestination = { kind: "none" };
/** HOM-15 §57: la superficie di origine dei dettagli aperti da una notifica. */
const FROM: ContentOrigin = "NOTIFICATION";

function text(source: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = source?.[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function contentTypeOf(value: string | null): FeedContentType | null {
  return value && CONTENT_TYPES.includes(value) ? (value as FeedContentType) : null;
}

/** Destinazione di un target strutturato (§148–§156). Null = tipo non riconosciuto. */
function resolveStructuredTarget(source: NotificationTargetSource): NotificationDestination | null {
  const target = source.target;

  if (!target) {
    return null;
  }

  switch (target.type) {
    case "profile":
      // §148: il profilo dell'attore. Una Società attrice apre la propria pagina (§35, §99).
      return ROUTE(source.actor?.type === "society" ? `/club/${target.id}` : `/profile/${target.id}`);

    case "content": {
      // §149, §153, §154, §155: Mi piace, Simple Repost, Post con testo, pubblicazione riuscita.
      const contentType = contentTypeOf(text(target.params, "content_type"));

      return contentType ? ROUTE(contentDetailHref(contentType, target.id, { origin: FROM })) : UNAVAILABLE;
    }

    case "comment": {
      // §47, §51, §57: contenuto + sezione Commenti + commento e thread raggiungibili.
      const contentType = contentTypeOf(text(target.params, "content_type"));
      const contentId = text(target.params, "content_id");

      if (!contentType || !contentId) {
        return UNAVAILABLE;
      }

      return ROUTE(
        contentDetailHref(contentType, contentId, {
          comment: text(target.params, "comment_id") ?? target.id,
          focus: "comments",
          origin: FROM,
          root: text(target.params, "root_comment_id"),
        }),
      );
    }

    case "scheduled_content":
      // §89, §156: l'elemento fallito si gestisce dove ha Riprova · Modifica · Sposta (HOM-06.2 §195).
      return ROUTE(draftsHref("scheduled"));

    default:
      return null;
  }
}

/**
 * Destinazione dei tipi operativi e delle righe storiche senza target. Ogni
 * ramo conserva il comportamento del Centro precedente a HOM-14.
 */
function resolveOperational(source: NotificationTargetSource): NotificationDestination {
  const { data, type } = source;

  if (type === "content_tag") {
    const contentType = contentTypeOf(text(data, "content_type"));
    const postId = text(data, "post_id");

    return contentType && postId ? ROUTE(contentDetailHref(contentType, postId, { origin: FROM })) : UNAVAILABLE;
  }

  if (isScheduledContentNotification(source)) {
    // HOM-06.2 §200–§201: il fallimento apre Programmati, il successo il contenuto pubblicato.
    const href = scheduledContentNotificationHref(source);

    return href ? ROUTE(href) : UNAVAILABLE;
  }

  if (
    type === "agent_representation_request" ||
    type === "agent_representation_responded" ||
    type === "agent_invite_reconciled" ||
    type === "agent_representation_visibility_proposed"
  ) {
    const representationId = text(data, "representation_id");

    if (!representationId) {
      return UNAVAILABLE;
    }

    // La richiesta apre il dettaglio del destinatario; l'esito e l'invito riconciliato
    // (REV-PROF-14) la gestione del rapporto appena nato; la proposta di visibilità la gestione.
    if (type === "agent_representation_request") {
      return ROUTE(`/representation/${representationId}`);
    }

    if (type === "agent_representation_visibility_proposed") {
      return ROUTE(`/representation/manage/${representationId}`);
    }

    return ROUTE(`/representation/assistito/${representationId}`);
  }

  if (type === "application_received" || type === "application_status") {
    return ROUTE("/(tabs)/announcements");
  }

  if (isSelectionEventNotification(source)) {
    // DAS-REV-29 §22, DAS-REV-30 §20, DAS-REV-31 §25: stesso evento con stato personale
    // corrente, mai un'azione automatica dalla notifica.
    const href = selectionEventNotificationHref(source);

    return href ? ROUTE(href) : UNAVAILABLE;
  }

  if (type === "society_invitation_created") {
    // DAS-REV-19 §27: la notifica porta l'ID, il contenuto lo rilegge la destinazione.
    const inviteId = text(data, "invite_id");

    return inviteId ? ROUTE(`/invitation/${inviteId}`) : UNAVAILABLE;
  }

  if (type === "role_request_created") {
    // DAS-REV-21 §41: lo stesso request_id; l'accesso lo rivalida il backend.
    const requestId = text(data, "request_id");

    return requestId ? ROUTE(ROLE_LINK_HREFS.societyRequest(requestId)) : UNAVAILABLE;
  }

  if (type === "role_request_approved" || type === "role_request_declined") {
    // L'esito della propria richiesta: il record personale, non il Centro della Società (§41).
    const requestId = text(data, "request_id");

    return requestId
      ? ROUTE(ROLE_LINK_HREFS.myRequest(requestId, { from: "notification" }))
      : UNAVAILABLE;
  }

  if (type.startsWith("role_assignment_")) {
    // §41: le modifiche già attive aprono il rapporto gestionale; il destinatario decide il lato.
    const clubId = text(data, "club_id");
    const personId = text(data, "profile_id");
    const assignmentId = text(data, "assignment_id");

    if (type.endsWith("_by_person") && clubId && personId) {
      return ROUTE(ROLE_LINK_HREFS.societyPerson(clubId, personId, { from: "notification" }));
    }

    return assignmentId ? ROUTE(ROLE_LINK_HREFS.assignment(assignmentId)) : UNAVAILABLE;
  }

  if (type.startsWith("role_link_")) {
    // §38: le terminazioni aprono un esito/storico autorizzato, non un detail con comandi invalidi.
    const clubId = text(data, "club_id");
    const personId = text(data, "profile_id");

    if (type === "role_link_left" && clubId && personId) {
      return ROUTE(ROLE_LINK_HREFS.societyPerson(clubId, personId, { from: "notification" }));
    }

    return ROUTE(ROLE_LINK_HREFS.societies);
  }

  if (type === "new_follower") {
    // Riga storica senza target strutturato: il follower resta nel payload.
    const followerProfileId = text(data, "follower_profile_id");

    return followerProfileId ? ROUTE(`/profile/${followerProfileId}`) : UNAVAILABLE;
  }

  // agent_representation_removed e tipi senza destinazione: la notifica si apre e basta.
  return NONE;
}

/**
 * HOM-15 §149–§150, §295: il copy del tap su una destinazione `unavailable`.
 * Il follower (target profilo o riga storica `new_follower`) è un profilo;
 * ogni altro target senza identificativi è un contenuto non più raggiungibile.
 */
export function notificationUnavailableMessage(source: NotificationTargetSource): string {
  return source.target?.type === "profile" || source.type === "new_follower"
    ? BLOCK_COPY.unavailableTitle
    : CONTENT_UNAVAILABLE_TITLE;
}

/** La destinazione del tap: il target strutturato (§146) prima, poi la logica dei tipi operativi. */
export function resolveNotificationTarget(source: NotificationTargetSource): NotificationDestination {
  return resolveStructuredTarget(source) ?? resolveOperational(source);
}
