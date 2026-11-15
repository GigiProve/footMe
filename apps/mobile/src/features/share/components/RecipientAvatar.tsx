/**
 * Avatar di un destinatario (HOM-09 §26–§28, §59–§64).
 *
 * Persona, DIRECT e Media: avatar tondo. Società: logo quadrato su fondo ink
 * in assenza di immagine. GROUP: stessa resa della riga Inbox (DAS-REV-32 §12) —
 * `GroupAvatar` se il gruppo ha un'immagine privata, altrimenti quadrato neutro
 * con le iniziali. Dentro PROLINK l'avatar è sempre un destinatario interno,
 * mai l'icona di un'app esterna (§164).
 */

import { Avatar, type AvatarSize } from "../../../ui";
import { GroupAvatar } from "../../dashboard/groups/components/GroupAvatar";
import type { ShareRecipient } from "../share-types";

type RecipientAvatarProps = {
  recipient: ShareRecipient;
  size?: AvatarSize;
};

export function RecipientAvatar({ recipient, size = "md" }: RecipientAvatarProps) {
  if (recipient.kind === "group") {
    return recipient.groupAvatarPath ? (
      <GroupAvatar name={recipient.displayName} path={recipient.groupAvatarPath} size={size} />
    ) : (
      <Avatar name={recipient.displayName} size={size} square tone="muted" uri={recipient.avatarUrl} />
    );
  }

  if (recipient.kind === "club") {
    return <Avatar name={recipient.displayName} size={size} square tone="ink" uri={recipient.avatarUrl} />;
  }

  return <Avatar name={recipient.displayName} size={size} uri={recipient.avatarUrl} />;
}
