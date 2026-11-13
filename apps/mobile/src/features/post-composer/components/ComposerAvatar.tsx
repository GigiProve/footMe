/**
 * Avatar/logo del composer (HOM-06.1 §14, §19, §102–103, §111, §181–182).
 *
 * Un solo avatar condiviso da identità autore, «Pubblica come», suggerimenti
 * mention e selettore tag. Persona = tondo; Società e Media = quadrato con
 * fondo ink (logo). La differenza è di forma, mai di colore per ruolo (§182):
 * è la stessa convenzione già adottata da `Avatar` nel resto dell'app.
 */

import { Avatar, type AvatarSize } from "../../../ui";

type ComposerAvatarProps = {
  uri: string | null;
  name: string;
  size?: AvatarSize;
  /** true per Società e Media (logo), false per le persone. */
  square?: boolean;
};

export function ComposerAvatar({ uri, name, size = "md", square = false }: ComposerAvatarProps) {
  return (
    <Avatar name={name} size={size} square={square} tone={square ? "ink" : "accent"} uri={uri} />
  );
}

export type { ComposerAvatarProps };
