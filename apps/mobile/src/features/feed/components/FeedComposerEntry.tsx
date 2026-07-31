/**
 * Punto di accesso alla creazione contenuto dal "+" dell'header (§2).
 *
 * Il §2 è netto: "Il pulsante apre il flusso di creazione contenuto già
 * previsto. Questa task deve implementare solamente il punto di accesso. Non
 * ridisegnare il composer o i flussi di pubblicazione."
 *
 * Non esiste un composer globale: la creazione vive in modali locali dentro le
 * viste di profilo (FanProfileView, MediaProfileView) e nell'area contenuti
 * società (ClubMediaTabContent). Questo ActionSheet elenca quindi solo le
 * superfici che il ruolo può realmente usare e naviga alla vista che le ospita
 * con `?compose=`, che quella vista legge per aprire da sola il PROPRIO modal
 * già esistente. Zero composer nuovi, zero duplicazione.
 *
 * Per i ruoli che oggi non hanno alcuna superficie di pubblicazione non si
 * inventa nulla: si dice che non è disponibile.
 */

import { ActionSheet, useToast, type ActionSheetAction } from "../../../ui";

/** Valori accettati dal param `compose` delle viste di profilo. */
export type ComposeIntent = "fan" | "media" | "club";

type FeedComposerEntryProps = {
  role: string | null | undefined;
  visible: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
};

export function FeedComposerEntry({
  role,
  visible,
  onClose,
  onNavigate,
}: FeedComposerEntryProps) {
  const { showToast } = useToast();
  const actions: ActionSheetAction[] = [];

  if (role === "fan") {
    actions.push({
      icon: "create-outline",
      label: "Post in bacheca",
      onPress: () => onNavigate("/(tabs)/profile?compose=fan"),
      subtitle: "Foto, video e opinioni dalla tua tribuna",
    });
  }

  if (role === "media") {
    actions.push({
      icon: "document-text-outline",
      label: "Articolo",
      onPress: () => onNavigate("/(tabs)/profile?compose=media"),
      subtitle: "Pubblica un contenuto editoriale",
    });
  }

  if (role === "club_admin") {
    actions.push({
      icon: "megaphone-outline",
      label: "Contenuto della società",
      onPress: () => onNavigate("/(tabs)/profile?compose=club"),
      subtitle: "Highlights, interviste, comunicati",
    });
    actions.push({
      icon: "briefcase-outline",
      label: "Posizione aperta",
      onPress: () => onNavigate("/(tabs)/announcements"),
      subtitle: "Pubblica una ricerca",
    });
  }

  if (actions.length === 0) {
    actions.push({
      icon: "information-circle-outline",
      label: "Nessuna pubblicazione disponibile",
      onPress: () =>
        showToast({
          message: "La creazione di contenuti non è ancora attiva per il tuo profilo.",
        }),
      subtitle: "Il tuo profilo non pubblica contenuti in questa versione",
    });
  }

  return (
    <ActionSheet
      actions={actions}
      onClose={onClose}
      title="Crea"
      visible={visible}
    />
  );
}
