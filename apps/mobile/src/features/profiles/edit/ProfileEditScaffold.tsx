/**
 * Scaffold di ogni schermata dell'editor profilo (§G, §R).
 *
 * Una sola forma per tutte le sezioni: navigation bar con back chevron, titolo,
 * contenuto scrollabile dentro la Safe Area e — quando la schermata salva — una
 * sola CTA primaria sticky in fondo.
 *
 * Il back è l'unico modo di uscire: nessuna X, nessuna CTA che appartiene alla
 * schermata sottostante, nessuna bottom navigation.
 */
import { type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";

type ProfileEditScaffoldProps = {
  children: ReactNode;
  /** Messaggio d'errore di sezione, mostrato sopra la CTA e non al posto del form. */
  errorMessage?: string | null;
  onBack: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  saving?: boolean;
  testID?: string;
  title: string;
};

export function ProfileEditScaffold({
  children,
  errorMessage,
  onBack,
  onSave,
  saveDisabled = false,
  saveLabel = "Salva modifiche",
  saving = false,
  testID,
  title,
}: ProfileEditScaffoldProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID={testID}>
      <View style={styles.navBar}>
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={styles.backButton}
          testID="profile-edit-back"
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={24} />
        </Pressable>
        <AppText numberOfLines={1} style={styles.navTitle} variant="titleMd">
          {title}
        </AppText>
        {/* Speculare al back: tiene il titolo centrato senza una seconda azione. */}
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          !onSave && { paddingBottom: spacing[24] + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
      >
        {children}
      </ScrollView>

      {onSave ? (
        <View
          style={[styles.footer, { paddingBottom: spacing[16] + insets.bottom }]}
        >
          {errorMessage ? (
            <AppText
              accessibilityLiveRegion="polite"
              color="danger"
              style={styles.footerError}
              variant="bodySm"
            >
              {errorMessage}
            </AppText>
          ) : null}
          <Button
            disabled={saveDisabled || saving}
            fullWidth
            label={saveLabel}
            loading={saving}
            onPress={onSave}
            size="lg"
            testID="profile-edit-save"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[8],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    flex: 1,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing[16],
    gap: spacing[16],
  },
  footer: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    gap: spacing[8],
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerError: {
    textAlign: "center",
  },
});
