/**
 * Derivazioni pure sull'identità di interazione (HOM-07 §10–§12).
 *
 * In Home l'identità con cui si mette Mi piace NON si sceglie (§11: nessun «Metti
 * Mi piace come…»): è derivata dal contesto già usato dall'app. Ordine, deciso da
 * Luigi (2026-11-14):
 *  1. l'ultima identità usata in Dashboard, se è fra quelle autorizzate;
 *  2. altrimenti l'identità personale (person o media);
 *  3. altrimenti la prima.
 * «Autorizzata» = presente nell'elenco appena restituito dal server (§168): una
 * preferenza salvata non prova nulla da sola.
 *
 * Tutto qui è puro e testato: lo store, il motore del toggle e la lista Mi piace
 * non ripetono queste regole.
 */

import type {
  InteractionIdentity,
  InteractionIdentityType,
  LikeIdentityRef,
  LikeSnapshot,
} from "./interaction-types";

const IDENTITY_TYPES: readonly InteractionIdentityType[] = ["person", "society", "media"];

export function isInteractionIdentityType(value: unknown): value is InteractionIdentityType {
  return typeof value === "string" && IDENTITY_TYPES.includes(value as InteractionIdentityType);
}

/**
 * L'identità di interazione corrente. `identities` arriva ordinata per `rank`
 * dal server; qui non si riordina. `storedId` è la preferenza Dashboard, letta
 * e mai scritta da questo modulo.
 */
export function resolveInteractionIdentity(
  identities: readonly InteractionIdentity[],
  storedId?: string | null,
): InteractionIdentity | null {
  if (identities.length === 0) {
    return null;
  }

  const stored = storedId ? identities.find((identity) => identity.id === storedId) : undefined;
  if (stored) {
    return stored;
  }

  const personal = identities.find((identity) => identity.type !== "society");

  return personal ?? identities[0] ?? null;
}

export function toIdentityRef(identity: Pick<InteractionIdentity, "type" | "id">): LikeIdentityRef {
  return { id: identity.id, type: identity.type };
}

export function sameIdentity(a: LikeIdentityRef, b: LikeIdentityRef): boolean {
  return a.type === b.type && a.id === b.id;
}

/**
 * `liked_as` del payload: array di `{type, id}`. Una voce malformata si scarta
 * da sola (un client nuovo davanti a un payload sporco non cade), i doppioni
 * collassano.
 */
export function parseLikedAs(value: unknown): LikeIdentityRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: LikeIdentityRef[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const { type, id } = entry as { type?: unknown; id?: unknown };
    if (!isInteractionIdentityType(type) || typeof id !== "string" || id.length === 0) {
      continue;
    }
    if (!result.some((existing) => existing.type === type && existing.id === id)) {
      result.push({ id, type });
    }
  }

  return result;
}

/**
 * Il cuore da MOSTRARE finché l'identità di interazione non è risolta (query in
 * corso). Non si indovina da `liked_as` non vuoto: un Mi piace della Società che
 * l'utente amministra non è il suo. Si assume l'identità personale (person o
 * media), che è quella di default del resolver; se l'identità risolta è un'altra
 * il cuore si corregge al primo render utile, senza mai attribuire alla persona
 * il Mi piace di una Società.
 */
export function isLikedForDisplay(
  likedAs: readonly LikeIdentityRef[],
  identity: Pick<InteractionIdentity, "type" | "id"> | null,
): boolean {
  if (identity) {
    return isLikedBy(likedAs, identity);
  }

  return likedAs.some((entry) => entry.type === "person" || entry.type === "media");
}

/**
 * Mi piace messo dall'identità corrente? Senza identità risolta vale «il viewer
 * ha messo Mi piace con una qualsiasi sua identità» (`is_liked` del payload):
 * serve al motore per l'analytics di un tap senza identità, non alla UI, che usa
 * `isLikedForDisplay`.
 */
export function isLikedBy(
  likedAs: readonly LikeIdentityRef[],
  identity: Pick<InteractionIdentity, "type" | "id"> | null,
): boolean {
  if (!identity) {
    return likedAs.length > 0;
  }

  return likedAs.some((entry) => sameIdentity(entry, identity));
}

/** `likedAs` con l'identità aggiunta (liked) o tolta (unliked). Le altre restano. */
export function withLikeIdentity(
  likedAs: readonly LikeIdentityRef[],
  identity: Pick<InteractionIdentity, "type" | "id">,
  liked: boolean,
): LikeIdentityRef[] {
  const ref = toIdentityRef(identity);
  const others = likedAs.filter((entry) => !sameIdentity(entry, ref));

  return liked ? [...others, ref] : others;
}

/**
 * Lo stato ottimistico dopo un tap (§13–§15): il conteggio sale o scende di uno
 * secondo lo stato dell'IDENTITÀ CORRENTE, mai sotto zero. Il server prevale al
 * sync successivo (§19).
 */
export function nextLikeSnapshot(
  current: LikeSnapshot,
  identity: Pick<InteractionIdentity, "type" | "id">,
): LikeSnapshot {
  const liked = !isLikedBy(current.likedAs, identity);

  return {
    likedAs: withLikeIdentity(current.likedAs, identity, liked),
    likesCount: Math.max(0, current.likesCount + (liked ? 1 : -1)),
  };
}

/** Due stati uguali per valore: serve a non riscrivere lo store senza motivo. */
export function sameLikeSnapshot(a: LikeSnapshot, b: LikeSnapshot): boolean {
  return (
    a.likesCount === b.likesCount &&
    a.likedAs.length === b.likedAs.length &&
    a.likedAs.every((entry) => b.likedAs.some((other) => sameIdentity(entry, other)))
  );
}
