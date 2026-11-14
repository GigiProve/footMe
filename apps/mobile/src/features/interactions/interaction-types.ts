/**
 * Tipi del dominio Mi piace per identità (HOM-07 §10–§12).
 *
 * Il Like appartiene all'identità che interagisce, non all'utente: PERSON,
 * SOCIETY o MEDIA. Un solo dominio per tutti i content type (§1); il tipo del
 * contenuto resta quello del Feed (`FeedContentType`).
 */

export type InteractionIdentityType = "person" | "society" | "media";

/** Identità con cui l'utente può interagire (§10), come la restituisce `fetch_interaction_identities`. */
export type InteractionIdentity = {
  type: InteractionIdentityType;
  /** `profiles.id` per person/media, `clubs.id` per society. */
  id: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  rank: number;
};

/** Riferimento a un'identità, senza dati di presentazione: ciò che `liked_as` porta. */
export type LikeIdentityRef = {
  type: InteractionIdentityType;
  id: string;
};

/**
 * Stato Mi piace di UN contenuto: conteggio pubblico (una sola definizione,
 * quella della lista, §68) e identità del viewer che hanno messo Mi piace. Mai
 * identità altrui: la lista le legge da `list_content_likers`.
 */
export type LikeSnapshot = {
  likesCount: number;
  likedAs: readonly LikeIdentityRef[];
};
