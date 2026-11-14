/**
 * Interazioni del dettaglio contenuto Media/Creator (REV-PROF-21,
 * "Dettagli contenuto"; HOM-08 §1, §3).
 *
 * Il Master Profile mostra anteprime; il dettaglio condiviso è responsabile
 * di Salva. Prima di REV-PROF-21 quell'azione viveva in una modale dentro il
 * profilo — un secondo dettaglio, che la task vieta. Sta qui, nel dettaglio,
 * come REV-PROF-12 prescrive: nessuna icona Salvati nelle griglie.
 *
 * HOM-08: i commenti NON vivono più qui. Un solo dominio (`content_comments`),
 * una sola sezione (`features/comments`, montata dal dettaglio): la lista piatta
 * e l'input «Invia» che questo componente portava sono stati tolti, non
 * duplicati. Resta il Salva, per entrambe le superfici Media (articoli e
 * Tribuna), che hanno lo stesso contratto di interazione.
 */
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { setSavedTracked } from "../../saved/saved-commands";
import { saveFailureMessage } from "../../saved/saved-copy";
import { contentSavedTarget, useIsSaved } from "../../saved/saved-store";

export type MediaContentInteractionsProps = {
  /** Quale superficie: decide il target dello store Salvati. */
  contentType: "media_profile" | "media_tribuna";
  initialIsSaved: boolean;
  /** HOM-07 §141: istante (ms) della richiesta che ha prodotto `initialIsSaved`; 0 = ignoto. */
  initialIsSavedAt?: number;
  postId: string;
  viewerProfileId: string | null;
};

export function MediaContentInteractions({
  contentType,
  initialIsSaved,
  initialIsSavedAt = 0,
  postId,
  viewerProfileId,
}: MediaContentInteractionsProps) {
  // HOM-07 §133: il Salva è nello store Salvati, seminato dal payload del
  // dettaglio; lo stesso contenuto salvato dal Feed o da Cerca compare qui.
  const savedTarget = contentSavedTarget(contentType, postId);
  const isSaved = useIsSaved(savedTarget, initialIsSaved, initialIsSavedAt);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggleSave() {
    if (!viewerProfileId) {
      Alert.alert("Accesso richiesto", "Accedi per salvare questo contenuto.");
      return;
    }

    setIsSaving(true);

    try {
      // Ottimistico con rollback sullo store: un salvataggio non riuscito non
      // resta a schermo come fatto (§97–§98).
      await setSavedTracked(savedTarget, !isSaved, "content_detail");
    } catch {
      Alert.alert("Errore", saveFailureMessage("content", !isSaved));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.root} testID="media-content-interactions">
      <View style={styles.rail}>
        <Pressable
          accessibilityLabel={isSaved ? "Rimuovi dai salvati" : "Salva contenuto"}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSaving, selected: isSaved }}
          disabled={isSaving}
          hitSlop={8}
          onPress={() => {
            void handleToggleSave();
          }}
          style={({ pressed }) => [
            styles.railAction,
            pressed ? styles.pressed : null,
          ]}
          testID="media-content-save"
        >
          <Ionicons
            color={isSaved ? colors.accent : colors.textSecondary}
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={18}
          />
          <AppText color={isSaved ? "accent" : "secondary"} variant="actionLabel">
            {isSaved ? "Salvato" : "Salva"}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  rail: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    // Il rail azioni del design system: 44 px, hairline sopra, azioni a
    // sinistra.
    minHeight: 44,
  },
  railAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: 44,
    paddingRight: spacing[8],
  },
  root: {
    gap: spacing[16],
  },
});
