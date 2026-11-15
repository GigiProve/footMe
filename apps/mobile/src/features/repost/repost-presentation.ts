/**
 * Derivazioni pure del Repost fuori dal composer (HOM-10 §2, §45–§60, §73–§76,
 * §100–§114, §120–§123, §173–§177, §186–§192, §273–§279, §290–§292).
 *
 * Tutto ciò che si calcola dai dati sta qui e non nei componenti, così le regole si
 * testano senza renderizzare:
 *  • la riga «Repost» del pannello Condividi (§2, §122, §273–§274);
 *  • la riga discreta del reposter nel Feed (§73–§74, §187, §291);
 *  • il modello della card incorporata, uguale in Feed, dettaglio, composer e
 *    Modifica (§45–§46, §110–§114, §173–§177, §276);
 *  • la conversione da `data.reference` / `fetch_repost_state` alla reference del
 *    composer.
 *
 * Le regole del composer (testo significativo, CTA, blocchi) stanno in
 * `repost-composer-presentation.ts`.
 *
 * Nessuna terminologia tecnica verso l'utente (§65): né «Simple Repost», né
 * «reference», né «wrapper», né «quote».
 */

import type { FeedContentType, FeedReference, FeedRepostContext } from "../feed/feed-types";
import { readReference } from "../feed/feed-post-mapper";
import type { ComposerIdentity, ComposerReference } from "../post-composer/composer-types";
import { sharePreviewAccessibilityLabel, snapshotToPreview } from "../share/share-presentation";
import { isShareContentType, type SharePreview } from "../share/share-types";
import { REPOST_COMPOSER_COPY } from "./repost-composer-presentation";
import type { RepostContentRef, RepostIdentity, RepostState, SimpleRepostFailure } from "./repost-types";

export const REPOST_COPY = {
  /** §276: lo screen reader lo dice PRIMA dei metadata dell'originale. */
  embeddedLabel: "Contenuto originale incorporato",
  repostedBy: "ha ripostato",
  /** §122, §274. */
  shareActiveAccessibility: "Repost. Hai già ripostato questo contenuto",
  shareActiveSubtitle: "Hai già ripostato questo contenuto",
  /** §273. */
  shareAccessibility: "Repost, condividi pubblicamente questo contenuto con la tua rete",
  shareSubtitle: "Condividi questo contenuto con la tua rete",
  shareTitle: "Repost",
  /** §175: copy consigliata, non tecnica (§174). */
  unavailableBody: "Questo contenuto è stato eliminato o non è più disponibile.",
  unavailableTitle: "Contenuto originale non disponibile",
} as const;

/* ------------------------------------------------------------------ */
/* Pannello Condividi (§2, §120–§123)                                  */
/* ------------------------------------------------------------------ */

export type ShareRepostRow = {
  /** §122: «Repost ✓» — l'identità Home ha già ripostato; il tap apre comunque il composer (§123). */
  active: boolean;
  title: string;
  subtitle: string;
  accessibilityLabel: string;
  /** L'identità con cui aprire il composer (quella Home, se può ripostare). */
  identityId: string | null;
};

/** Le identità che compaiono in «Reposta come»: solo quelle con `can_repost` (§30). */
export function repostIdentities(state: RepostState): RepostIdentity[] {
  return state.identities.filter((identity) => identity.canRepost);
}

/**
 * §29–§31: le identità di «Reposta come» nella forma del composer. Solo quelle con
 * `can_repost`, nell'ordine del server, con le capability che il composer rivaluta
 * dopo ogni cambio (§37): `canSchedule`, `canPublishPost`, `hasSimpleRepost`.
 */
export function composerIdentitiesFromState(state: RepostState): ComposerIdentity[] {
  return repostIdentities(state).map((identity) => ({
    avatarUrl: identity.avatarUrl,
    canPublishPost: identity.canPublishPost,
    canSchedule: identity.canSchedule,
    contextLabel: identity.contextLabel,
    hasSimpleRepost: identity.hasSimpleRepost,
    id: identity.id,
    isVerified: identity.isVerified,
    name: identity.name,
    type: identity.type,
  }));
}

/**
 * §2, §43, §296: la riga c'è solo se il contenuto è ripostabile dal viewer E
 * almeno un'identità può farlo (§32): senza, un tap porterebbe a un composer senza
 * nessuno che possa pubblicare. `home` è l'identità di interazione (HOM-07 §10): se
 * non può ripostare si ricade sulla prima che può.
 */
export function shareRepostRow(
  state: RepostState | null | undefined,
  home: { type: string; id: string } | null,
): ShareRepostRow | null {
  if (!state || !state.repostable) {
    return null;
  }

  const candidates = repostIdentities(state);

  if (candidates.length === 0) {
    return null;
  }

  const current =
    (home ? candidates.find((identity) => identity.type === home.type && identity.id === home.id) : undefined) ??
    candidates[0];
  const active = current.hasSimpleRepost === true;

  return {
    accessibilityLabel: active ? REPOST_COPY.shareActiveAccessibility : REPOST_COPY.shareAccessibility,
    active,
    identityId: current.id,
    subtitle: active ? REPOST_COPY.shareActiveSubtitle : REPOST_COPY.shareSubtitle,
    title: REPOST_COPY.shareTitle,
  };
}

/* ------------------------------------------------------------------ */
/* Riga del reposter nel Feed (§73–§74, §187–§191, §291)               */
/* ------------------------------------------------------------------ */

/**
 * «Marco Bianchi ha ripostato» / «Marco Bianchi e altre 3 persone hanno ripostato».
 * Con un solo altro reposter «e un'altra persona» (la forma con «altre 1 persone»
 * non è italiano). Mai un avatar stack (§188), mai un contatore pubblico (§85).
 */
export function reposterRowLabel(repost: Pick<FeedRepostContext, "additionalCount"> & {
  reposter: Pick<FeedRepostContext["reposter"], "name">;
}): string {
  const { name } = repost.reposter;
  const others = Math.max(0, Math.floor(repost.additionalCount));

  if (others === 0) {
    return `${name} ${REPOST_COPY.repostedBy}`; // §291
  }

  const rest = others === 1 ? "un'altra persona" : `altre ${others} persone`;

  return `${name} e ${rest} hanno ripostato`;
}

/* ------------------------------------------------------------------ */
/* Card incorporata (§45–§60, §110–§114, §173–§177, §276)              */
/* ------------------------------------------------------------------ */

export type EmbeddedReferenceModel =
  | {
      kind: "available";
      contentType: FeedContentType;
      contentId: string;
      preview: SharePreview;
      accessibilityLabel: string;
    }
  | {
      kind: "unavailable";
      title: string;
      body: string;
      accessibilityLabel: string;
    };

type ReferenceLike = Pick<ComposerReference, "contentId" | "contentType" | "available" | "preview">;

/**
 * Il modello unico della card: disponibile (apribile, con la preview) o non
 * disponibile (generica, non tappabile §177). Disponibile solo se il server lo
 * conferma, c'è una preview e il tipo è apribile: una reference senza uno dei tre
 * non diventa una route rotta.
 */
export function embeddedReferenceModel(reference: ReferenceLike): EmbeddedReferenceModel {
  if (reference.available && reference.preview && isShareContentType(reference.contentType)) {
    return {
      accessibilityLabel: `${REPOST_COPY.embeddedLabel}. ${sharePreviewAccessibilityLabel(reference.preview)}`,
      contentId: reference.contentId,
      contentType: reference.contentType,
      kind: "available",
      preview: reference.preview,
    };
  }

  return {
    accessibilityLabel: `${REPOST_COPY.embeddedLabel}. ${REPOST_COPY.unavailableTitle}. ${REPOST_COPY.unavailableBody}`,
    body: REPOST_COPY.unavailableBody,
    kind: "unavailable",
    title: REPOST_COPY.unavailableTitle,
  };
}

/** Il modello della card per `data.reference` del Feed e del dettaglio (§100, §60). */
export function embeddedModelFromFeed(reference: FeedReference): EmbeddedReferenceModel {
  return embeddedReferenceModel(composerReferenceFromFeed(reference));
}

/** Da `data.reference` del Feed o del dettaglio alla reference del composer (§139, §161). */
export function composerReferenceFromFeed(reference: FeedReference): ComposerReference {
  const preview = reference.snapshot ? snapshotToPreview(reference.snapshot) : null;

  return {
    available: reference.available && preview !== null,
    contentId: reference.contentId,
    contentType: reference.contentType,
    preview,
  };
}

/** Dal jsonb `reference` di `fetch_post_for_edit` / `fetch_content_for_editor`. */
export function composerReferenceFromWire(raw: unknown): ComposerReference | null {
  const reference = readReference({ reference: raw });

  return reference ? composerReferenceFromFeed(reference) : null;
}

/** Dallo stato di `fetch_repost_state`: l'originale che si sta per ripostare (§45). */
export function composerReferenceFromState(ref: RepostContentRef, state: RepostState): ComposerReference {
  return {
    available: state.repostable && state.preview !== null,
    contentId: ref.contentId,
    contentType: ref.contentType,
    preview: state.preview,
  };
}

/* ------------------------------------------------------------------ */
/* Errori del Simple Repost (§72, §229)                                */
/* ------------------------------------------------------------------ */

/**
 * La copy per l'utente: l'originale sparito ha la sua frase (§229), il permesso
 * perso la sua (§39), il resto è §72.
 */
export function simpleRepostFailureCopy(failure: SimpleRepostFailure): string {
  switch (failure) {
    case "unavailable":
      return REPOST_COMPOSER_COPY.unavailable;
    case "forbidden":
      return REPOST_COMPOSER_COPY.permissionLost;
    case "error":
      return REPOST_COMPOSER_COPY.simpleFailure;
  }
}
