/**
 * ContentActionSheet — il foglio condiviso delle azioni di un contenuto
 * (HOM-04 §11–13, §108–111, §134).
 *
 * Wrapper sottile dell'`ActionSheet` di sistema (nessun secondo foglio). Riceve
 * id, tipo, identità autrice e origine (§13, §135) e la lista di azioni già
 * composta: non calcola permessi. Aggiunge ciò che è specifico dei contenuti:
 * l'annuncio «Azioni contenuto» ai lettori di schermo, la maniglia per chiudere
 * trascinando verso il basso e l'evento `content_menu_open` a ogni apertura.
 */

import { useEffect } from "react";

import { ActionSheet, type ActionSheetAction } from "../../../ui";
import { CONTENT_ACTIONS_SHEET_LABEL } from "../content-actions-presentation";
import { trackFeed, type ContentAnalyticsProps } from "../feed-analytics";

type ContentActionSheetProps = {
  content: ContentAnalyticsProps;
  actions: ActionSheetAction[];
  title?: string;
  visible: boolean;
  onClose: () => void;
};

export function ContentActionSheet({
  actions,
  content,
  onClose,
  title,
  visible,
}: ContentActionSheetProps) {
  const { authorIdentityType, contentId, contentType, origin } = content;

  useEffect(() => {
    if (visible) {
      trackFeed({ authorIdentityType, contentId, contentType, name: "content_menu_open", origin });
    }
  }, [authorIdentityType, contentId, contentType, origin, visible]);

  return (
    <ActionSheet
      accessibilityLabel={CONTENT_ACTIONS_SHEET_LABEL}
      actions={actions}
      onClose={onClose}
      showGrabber
      title={title}
      visible={visible}
    />
  );
}
