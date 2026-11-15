/**
 * Query key della lista Mi piace (HOM-07 §60).
 *
 * Porta ogni dimensione che la cache deve distinguere: tipo e id del contenuto
 * (l'uuid da solo non basta) e il viewer, perché ranking («chi segui prima»),
 * `is_following` e `is_self` sono relativi a lui.
 */

/**
 * Radice di ogni lista Mi piace: HOM-11 §62 la invalida per prefisso dopo «Non seguire», perché
 * ogni attore porta lo stato Follow (`is_following`).
 */
export const LIKES_ROOT_KEY = "content-likers";

export const LIKES_QK = {
  list: (contentType: string, postId: string, viewerId: string) =>
    [LIKES_ROOT_KEY, contentType, postId, viewerId] as const,
};
