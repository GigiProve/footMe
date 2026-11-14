/**
 * Query key della lista Mi piace (HOM-07 §60).
 *
 * Porta ogni dimensione che la cache deve distinguere: tipo e id del contenuto
 * (l'uuid da solo non basta) e il viewer, perché ranking («chi segui prima»),
 * `is_following` e `is_self` sono relativi a lui.
 */

export const LIKES_QK = {
  list: (contentType: string, postId: string, viewerId: string) =>
    ["content-likers", contentType, postId, viewerId] as const,
};
