/**
 * Menu di creazione dal "+" dell'header, per chi ha PIÙ di un formato (HOM-01.1
 * §2, HOM-06.1 §2–3).
 *
 * Chi può creare solo Post non vede mai questo menu: il «+» apre direttamente il
 * composer (`resolveComposerEntry` → `direct`, decisione in FeedScreen). Qui
 * arrivano i ruoli con formati legacy — Tifoso, Media, Società — e «Nuovo post» è
 * la PRIMA voce (decisione Luigi 2026-11-13). Il vecchio avviso «non ancora
 * attiva» non esiste più: ogni ruolo ha almeno il Post, e se non ha identity per
 * pubblicarlo è il composer a dirlo (§172).
 *
 * I formati legacy non hanno un composer globale: vivono in modali locali dentro
 * le viste di profilo (FanProfileView, MediaProfileView) e nell'area contenuti
 * società (ClubMediaTabContent). Le loro voci navigano alla vista che le ospita
 * con `?compose=`, che quella vista legge per aprire da sola il PROPRIO modal già
 * esistente. Zero composer nuovi, zero duplicazione; HOM-06.2 li riassorbirà.
 *
 * L'elenco delle voci segue `composerFormatsForRole`: una sola fonte di verità
 * per «quali formati ha questo ruolo», la stessa che decide `direct` o `menu`.
 */

import { ActionSheet, type ActionSheetAction } from "../../../ui";
import { composerFormatsForRole, type ComposerFormat } from "../../post-composer/composer-entry";
import { composerHref } from "../../post-composer/composer-routes";
import type { ComposerOrigin } from "../../post-composer/composer-types";

/** Valori accettati dal param `compose` delle viste di profilo. */
export type ComposeIntent = "fan" | "media" | "club";

type FeedComposerEntryProps = {
  role: string | null | undefined;
  /** La tab Home da cui si apre: diventa l'origin del composer (§5, §123). */
  origin: ComposerOrigin;
  visible: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
};

function legacyAction(format: ComposerFormat, onNavigate: (href: string) => void): ActionSheetAction | null {
  switch (format) {
    case "fan_post":
      return {
        icon: "create-outline",
        label: "Post in bacheca",
        onPress: () => onNavigate("/(tabs)/profile?compose=fan"),
        subtitle: "Foto, video e opinioni dalla tua tribuna",
      };
    case "media_article":
      return {
        icon: "document-text-outline",
        label: "Articolo",
        onPress: () => onNavigate("/(tabs)/profile?compose=media"),
        subtitle: "Pubblica un contenuto editoriale",
      };
    case "club_content":
      return {
        icon: "megaphone-outline",
        label: "Contenuto della società",
        onPress: () => onNavigate("/(tabs)/profile?compose=club"),
        subtitle: "Highlights, interviste, comunicati",
      };
    case "open_position":
      return {
        icon: "briefcase-outline",
        label: "Posizione aperta",
        onPress: () => onNavigate("/(tabs)/announcements"),
        subtitle: "Pubblica una ricerca",
      };
    case "post":
      return null;
  }
}

export function FeedComposerEntry({ role, origin, visible, onClose, onNavigate }: FeedComposerEntryProps) {
  const actions: ActionSheetAction[] = [];

  for (const format of composerFormatsForRole(role)) {
    if (format === "post") {
      actions.push({
        icon: "create-outline",
        label: "Nuovo post",
        onPress: () => onNavigate(composerHref({ origin })),
        subtitle: "Testo, foto, video e link",
      });
      continue;
    }

    const action = legacyAction(format, onNavigate);

    if (action) {
      actions.push(action);
    }
  }

  return <ActionSheet actions={actions} onClose={onClose} title="Crea" visible={visible} />;
}
