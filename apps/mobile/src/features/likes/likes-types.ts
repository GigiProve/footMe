/**
 * Tipi della lista Mi piace (HOM-07 §45–§69).
 *
 * `LikeActor` è la riga di `list_content_likers` in camelCase. I campi sono
 * GREZZI (ruolo, Società, categoria, tipologia Media, posizione), come
 * `author_meta` del Feed: il testo sintetico lo compone `likes-presentation.ts`
 * con gli stessi presentatori del Feed (`formatRole` → «Procuratore», §51).
 * Nessun dato su CHI ha toccato per conto di un'identità: il server non lo
 * restituisce e il client non lo cerca.
 */

import type { InteractionIdentityType } from "../interactions/interaction-types";

export type LikeActor = {
  /** `<actor_type>:<actor_id>`: chiave di lista e di dedupe (§60). */
  key: string;
  actorType: InteractionIdentityType;
  actorId: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
  /** `profiles.role` per person/media, `null` per society. */
  role: string | null;
  clubName: string | null;
  teamLabel: string | null;
  clubCategory: string | null;
  mediaKind: string | null;
  primaryPosition: string | null;
  /** L'attore è il viewer o una sua identità di interazione (§57: nessuna CTA). */
  isSelf: boolean;
  isFollowing: boolean;
};

/** Cursore keyset opaco: il client lo rimanda com'è (§60). */
export type LikesCursor = Record<string, unknown>;

export type LikesPage = {
  items: LikeActor[];
  /** `null` a lista finita. */
  nextCursor: LikesCursor | null;
};
