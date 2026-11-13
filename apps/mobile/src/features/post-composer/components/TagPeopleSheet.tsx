/**
 * Selettore «Tagga persone o società» (HOM-06.1 §99–106, §184–185, mockup
 * screen 6).
 *
 * Scelta di contenitore: `BottomSheet` di `ui` è un foglio ad altezza del
 * contenuto, con padding fisso e senza gestione della tastiera — non regge una
 * lista di ricerca con footer fisso. Si usa quindi un `Modal` a schermo intero
 * (slide) con «Annulla» in alto a sinistra e titolo, come nel mockup, coerente
 * con gli altri modali full-screen dell'app. Niente `pageSheet`: il
 * trascinamento verso il basso non notificherebbe lo stato del chiamante.
 *
 * La ricerca è quella condivisa di PROLINK (§101): questo componente è solo
 * presentazione, `results` arriva già dal motore esistente.
 *  • riga persona: avatar, nome + check, ruolo/contesto; Società: logo, nome +
 *    check, categoria — entrambe da `subtitle` (§102–103);
 *  • multi-select (§104) con indicatore circolare a destra: il check della riga
 *    è l'unica rappresentazione della selezione, niente chip in alto (§105).
 *    Il `Checkbox` del design system è quadrato e porta con sé l'etichetta,
 *    quindi non entra in una riga con avatar: l'indicatore qui è disegnato;
 *  • footer: «Fine» / «Fine (N)» come pill accent (§106, §186); sempre attiva,
 *    perché chiudere a zero tag è un esito valido (rimozione dei tag).
 *
 * Il Modal non è dentro una route: usa `SafeAreaView` per gli inset su Android
 * e per il tasto home di iOS.
 */

import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, SearchField, VerifiedCheck } from "../../../ui";
import type { ComposerTaggedIdentity } from "../composer-types";
import { ComposerAvatar } from "./ComposerAvatar";

export const TAG_SHEET_TITLE = "Tagga persone o società";
export const TAG_SHEET_SEARCH_PLACEHOLDER = "Cerca su PROLINK";

type TagPeopleSheetProps = {
  visible: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  results: ComposerTaggedIdentity[];
  isSelected: (identity: ComposerTaggedIdentity) => boolean;
  /** Numero di tag selezionati: pilota «Fine (N)». */
  selectedCount: number;
  onToggle: (identity: ComposerTaggedIdentity) => void;
  onDone: () => void;
  /** «Annulla»: chiude senza confermare; cosa fare delle modifiche è del chiamante. */
  onClose: () => void;
  loading?: boolean;
  errorMessage?: string | null;
  /** true a `max_tags`: le righe non selezionate non sono più tappabili. */
  limitReached?: boolean;
};

function rowLabel(identity: ComposerTaggedIdentity, selected: boolean): string {
  return [
    identity.displayName,
    identity.isVerified ? "profilo verificato" : null,
    identity.subtitle,
    selected ? "selezionato" : "non selezionato",
  ]
    .filter(Boolean)
    .join(", ");
}

export function TagPeopleSheet({
  visible,
  query,
  onQueryChange,
  results,
  isSelected,
  selectedCount,
  onToggle,
  onDone,
  onClose,
  loading = false,
  errorMessage = null,
  limitReached = false,
}: TagPeopleSheetProps) {
  const doneLabel = selectedCount > 0 ? `Fine (${selectedCount})` : "Fine";

  function renderEmpty() {
    if (loading) {
      return (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.textMuted} size="small" />
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View style={styles.empty}>
          <AppText align="center" color="secondary" variant="bodyLg">
            {errorMessage}
          </AppText>
        </View>
      );
    }

    if (query.trim().length > 0) {
      return (
        <View style={styles.empty}>
          <AppText align="center" color="secondary" variant="bodyLg">
            Nessun risultato
          </AppText>
        </View>
      );
    }

    return null;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      visible={visible}
    >
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.screen}
        >
          <View style={styles.header}>
            <View style={styles.headerSide}>
              <Pressable
                accessibilityLabel="Annulla"
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [styles.cancel, pressed ? styles.pressed : null]}
                testID="composer-tag-cancel"
              >
                <AppText variant="feedBody">Annulla</AppText>
              </Pressable>
            </View>
            <AppText
              accessibilityRole="header"
              align="center"
              numberOfLines={1}
              style={styles.title}
              variant="titleMd"
            >
              {TAG_SHEET_TITLE}
            </AppText>
            <View style={styles.headerSide} />
          </View>

          <View style={styles.search}>
            <SearchField
              onChangeText={onQueryChange}
              onClear={() => onQueryChange("")}
              placeholder={TAG_SHEET_SEARCH_PLACEHOLDER}
              testID="composer-tag-search"
              value={query}
            />
            {limitReached ? (
              <AppText color="secondary" style={styles.limit} variant="caption">
                Hai raggiunto il numero massimo di tag.
              </AppText>
            ) : null}
          </View>

          <FlatList
            contentContainerStyle={styles.listContent}
            data={results}
            extraData={isSelected}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={(identity) => `${identity.identityType}:${identity.identityId}`}
            ListEmptyComponent={renderEmpty}
            renderItem={({ item: identity }) => {
              const selected = isSelected(identity);
              const blocked = limitReached && !selected;

              return (
                <Pressable
                  accessibilityLabel={rowLabel(identity, selected)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled: blocked }}
                  disabled={blocked}
                  onPress={() => onToggle(identity)}
                  style={({ pressed }) => [
                    styles.row,
                    blocked ? styles.blocked : null,
                    pressed ? styles.pressed : null,
                  ]}
                  testID={`composer-tag-row-${identity.identityType}-${identity.identityId}`}
                >
                  <ComposerAvatar
                    name={identity.displayName}
                    size="md"
                    square={identity.identityType === "club"}
                    uri={identity.avatarUrl}
                  />
                  <View style={styles.text}>
                    <View style={styles.nameRow}>
                      <AppText numberOfLines={1} style={styles.name} variant="titleSm">
                        {identity.displayName}
                      </AppText>
                      {identity.isVerified ? <VerifiedCheck size={14} /> : null}
                    </View>
                    {identity.subtitle ? (
                      <AppText color="secondary" numberOfLines={1} variant="feedMeta">
                        {identity.subtitle}
                      </AppText>
                    ) : null}
                  </View>
                  <View style={[styles.indicator, selected ? styles.indicatorOn : null]}>
                    {selected ? (
                      <Ionicons color={colors.inkInvert} name="checkmark" size={16} />
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
            style={styles.list}
          />

          <View style={styles.footer}>
            <Button
              fullWidth
              label={doneLabel}
              onPress={onDone}
              size="lg"
              testID="composer-tag-done"
              variant="primary"
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  blocked: {
    opacity: 0.45,
  },
  cancel: {
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    paddingHorizontal: spacing[24],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 52,
    paddingHorizontal: spacing[16],
  },
  headerSide: {
    alignItems: "flex-start",
    flex: 1,
    justifyContent: "center",
  },
  indicator: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    borderWidth: 1.5,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  indicatorOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  limit: {
    marginTop: spacing[8],
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing[12],
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  search: {
    paddingBottom: spacing[8],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[4],
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  title: {
    flexShrink: 1,
  },
});
