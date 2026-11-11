/**
 * CTA Segui del Feed (HOM-01.1 §21, §38).
 *
 * Compatta e in outline, mai piena: accanto a ogni riga suggerita un bottone
 * blu pieno farebbe dominare il colore sullo schermo (§59–60). `secondary` è
 * l'outline blu del mockup; lo stato seguito passa all'outline grigio con
 * l'etichetta "Seguito", la stessa del resto dell'app, così la differenza non
 * dipende solo dal colore (§96).
 *
 * Solo presentazione: la mutazione è quella del sistema Follow globale,
 * passata da chi usa il componente. Nessuna logica di follow Home-specifica.
 */

import { Button } from "../../../../ui";
import { FEED_FOLLOW_CTA, FEED_FOLLOWING_LABEL } from "../../feed-labels";

type FollowActionProps = {
  name: string;
  isFollowing: boolean;
  isBusy?: boolean;
  onPress: () => void;
};

export function FollowAction({ name, isFollowing, isBusy = false, onPress }: FollowActionProps) {
  return (
    <Button
      accessibilityLabel={isFollowing ? `Smetti di seguire ${name}` : `Segui ${name}`}
      // Il bottone `sm` è alto 32pt: lo slop porta l'area di tocco a 44 (§67).
      hitSlop={6}
      label={isFollowing ? FEED_FOLLOWING_LABEL : FEED_FOLLOW_CTA}
      loading={isBusy}
      onPress={onPress}
      selected={isFollowing}
      size="sm"
      variant={isFollowing ? "outline" : "secondary"}
    />
  );
}
