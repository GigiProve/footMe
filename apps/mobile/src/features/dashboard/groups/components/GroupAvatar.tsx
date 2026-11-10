/**
 * Avatar di un gruppo operativo (DAS-REV-32 §5, §16).
 *
 * L'immagine sta in un bucket privato: si legge con un URL firmato, chiesto
 * solo da chi la policy autorizza. Senza immagine (o se l'URL non arriva) il
 * fallback sono le iniziali del nome su fondo neutro — mai il logo della
 * Società (§5, QA-009) e nessun colore per Società/Squadra/gruppo.
 *
 * Usato da Centro, dettaglio, riepilogo, header chat e Inbox: una sola resa.
 */
import { useQuery } from "@tanstack/react-query";

import { Avatar, type AvatarSize } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { GROUPS_QK } from "../groups-keys";
import { groupInitials } from "../groups-presentation";
import { fetchGroupAvatarUrl } from "../groups-service";

type Props = {
  name: string;
  path: string | null;
  /** Anteprima locale nel wizard, prima che l'asset sia collegato. */
  previewUri?: string | null;
  size?: AvatarSize;
};

export function GroupAvatar({ name, path, previewUri = null, size = "md" }: Props) {
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const urlQuery = useQuery({
    enabled: !!path && !!actorId && !previewUri,
    queryFn: () => fetchGroupAvatarUrl(path as string),
    queryKey: GROUPS_QK.avatarUrl(actorId, path ?? ""),
    // Gli URL firmati valgono un'ora: si rinnovano prima.
    staleTime: 45 * 60 * 1000,
  });

  return (
    <Avatar initials={groupInitials(name)} name={name} size={size} tone="muted" uri={previewUri ?? urlQuery.data ?? null} />
  );
}
