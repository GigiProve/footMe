/**
 * La «fonte» di un Follow vista da un contenuto (HOM-11 §54–§65, §145, §284).
 *
 * Il Follow globale ha due tabelle — `profile_follows` per persone e Media,
 * `club_follows` per le Società (nessuna tabella polimorfa) — quindi una fonte è
 * `{ kind: 'profile' | 'club', id }`. Questo modulo sa solo mappare l'identità di un
 * contenuto o di un commento nella fonte giusta e darle una chiave: nessuna scrittura,
 * nessun React.
 *
 *  • l'autore di un elemento del Feed è già `profile` | `club`;
 *  • il reposter di un Simple Repost (§145) e l'autore di un commento hanno un tipo di
 *    identità (`person` | `media` | `society`): la Società è `club`, il resto `profile`.
 */

export type FollowSourceKind = "profile" | "club";

export type FollowSource = {
  kind: FollowSourceKind;
  id: string;
  /** Il nome per «Non seguire <nome>» e «Non segui più <nome>» (§57, §59, §224). */
  name: string;
};

/** Identità del sistema (`person` | `society` | `media`) → tabella del Follow. */
export function followKindOfIdentity(identityType: string): FollowSourceKind {
  return identityType === "society" ? "club" : "profile";
}

/** §57: «Non seguire Marco Bianchi» / «Non seguire AC Como»; §200 lo stesso a voce. */
export function unfollowLabel(name: string): string {
  return `Non seguire ${name}`;
}

/** Chiave stabile per set e confronti: tipo e id insieme. */
export function followSourceKey(source: Pick<FollowSource, "kind" | "id">): string {
  return `${source.kind}:${source.id}`;
}

export function sameFollowSource(
  a: Pick<FollowSource, "kind" | "id">,
  b: Pick<FollowSource, "kind" | "id">,
): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** Una fonte da un'identità con tipo di sistema; `null` senza id o senza nome da dire. */
export function followSourceOfIdentity(identity: {
  identityType: string;
  identityId: string;
  name: string;
}): FollowSource | null {
  if (!identity.identityId || identity.name.trim().length === 0) {
    return null;
  }
  return {
    id: identity.identityId,
    kind: followKindOfIdentity(identity.identityType),
    name: identity.name,
  };
}
