/**
 * Foglio «Link» dell'Articolo (HOM-06.2 §59–§62, §67; mockup 3, bottone Link).
 *
 * Un link nel testo si crea selezionando una parte e dandole un indirizzo (§59);
 * senza selezione si scrivono testo e indirizzo e si inseriscono al cursore. Un
 * link esistente si apre per cambiare testo e indirizzo o per toglierlo lasciando
 * il testo (§62). L'URL completo resta nei dati, nel testo si vede solo il tratto
 * cliccabile (§60–§61); gli indirizzi non sicuri (javascript:, data:, …) non si
 * accettano (§67).
 *
 * Perché un Modal proprio e non `BottomSheet`: ha due campi di testo e il foglio
 * condiviso non gestisce la tastiera, che coprirebbe i campi e i bottoni. Stessa
 * resa (fondo `background`, bordo superiore raggio 16, titolo + chiudi).
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../styles";
import { AppText, Button, Input } from "../../../ui";
import { withScheme } from "../article-editing";
import type { LinkSheetState } from "../use-block-editing";

export const LINK_INVALID_COPY = "Inserisci un indirizzo valido, per esempio https://sito.it/articolo.";

type Props = {
  sheet: LinkSheetState | null;
  onApply: (text: string, url: string) => boolean;
  onRemove: () => void;
  onClose: () => void;
};

type FormProps = Omit<Props, "sheet"> & { sheet: LinkSheetState };

function LinkForm({ sheet, onApply, onRemove, onClose }: FormProps) {
  const editing = sheet.target.kind === "edit";
  const [text, setText] = useState(sheet.target.kind === "edit" ? sheet.target.text : sheet.target.selectedText);
  const [url, setUrl] = useState(sheet.target.kind === "edit" ? sheet.target.link.url : "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (text.trim().length === 0) {
      setError("Scrivi il testo del link.");
      return;
    }
    if (!onApply(text, withScheme(url))) {
      setError(LINK_INVALID_COPY);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <Pressable accessibilityLabel="Chiudi" onPress={onClose} style={styles.overlay}>
          <Pressable accessibilityViewIsModal style={styles.sheet}>
            <View style={styles.header}>
              <AppText accessibilityRole="header" numberOfLines={1} style={styles.title} variant="titleMd">
                {editing ? "Modifica link" : "Aggiungi link"}
              </AppText>
              <Pressable accessibilityLabel="Chiudi" accessibilityRole="button" hitSlop={8} onPress={onClose} style={styles.close}>
                <Ionicons color={colors.textPrimary} name="close" size={22} />
              </Pressable>
            </View>

            <View style={styles.fields}>
              <Input
                autoCapitalize="sentences"
                label="Testo del link"
                onChangeText={(value) => {
                  setText(value);
                  setError(null);
                }}
                placeholder="Per esempio: il comunicato ufficiale"
                value={text}
              />
              <Input
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={sheet.target.kind === "new" && sheet.target.selectedText.length > 0}
                error={error !== null}
                helperText={error ?? undefined}
                keyboardType="url"
                label="Indirizzo (URL)"
                onChangeText={(value) => {
                  setUrl(value);
                  setError(null);
                }}
                onSubmitEditing={submit}
                placeholder="https://"
                returnKeyType="done"
                value={url}
              />
            </View>

            <View style={styles.actions}>
              <Button fullWidth label={editing ? "Salva link" : "Aggiungi link"} onPress={submit} testID="inline-link-confirm" />
              {editing ? <Button fullWidth label="Rimuovi link" onPress={onRemove} testID="inline-link-remove" variant="neutralOutline" /> : null}
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function InlineLinkSheet({ sheet, ...rest }: Props) {
  if (!sheet) {
    return null;
  }
  // Si monta a ogni apertura: i campi ripartono dal link o dalla selezione corrente.
  return <LinkForm sheet={sheet} {...rest} />;
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[8],
    marginTop: spacing[16],
  },
  close: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  fields: {
    gap: spacing[12],
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[16],
  },
  overlay: {
    backgroundColor: "rgba(8, 16, 37, 0.45)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius[16],
    borderTopRightRadius: radius[16],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
  },
  title: {
    flex: 1,
  },
});
