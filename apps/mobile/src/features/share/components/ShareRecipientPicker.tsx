/**
 * Passo «Invia a» (HOM-09 §43–§57, §66–§76; mockup 2).
 *
 * Header, campo di ricerca, lista unica con check, «Avanti (N)». Nessuna tab
 * Persone/Società/Gruppi/Chat (§46) e nessun motore di ricerca proprio (§47):
 * la lista è `search_share_recipients`. Nessuna fila di chip con i destinatari
 * scelti (§68): il check basta (§67) e il riepilogo è nel passo successivo.
 *
 * Stati della lista: caricamento, «Nessun risultato / Prova con un altro
 * nome» (§75), «Non è stato possibile completare la ricerca» con «Riprova»
 * (§76). Cursore e caricamento incrementale (§74). Multi-select non crea un
 * gruppo (§70): ogni destinazione riceve un invio separato (§71).
 */

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, SearchField } from "../../../ui";
import { trackShare } from "../share-analytics";
import { nextLabel, SHARE_COPY, SHARE_MAX_DESTINATIONS } from "../share-presentation";
import type { ShareRecipient } from "../share-types";
import { useShareRecipients } from "../use-share-recipients";
import { ShareRecipientRow } from "./ShareRecipientRow";
import { ShareStepHeader } from "./ShareStepHeader";

type ShareRecipientPickerProps = {
  profileId: string;
  selected: ShareRecipient[];
  onBack: () => void;
  onNext: () => void;
  onToggle: (recipient: ShareRecipient) => void;
};

export function ShareRecipientPicker({
  profileId,
  selected,
  onBack,
  onNext,
  onToggle,
}: ShareRecipientPickerProps) {
  const [query, setQuery] = useState("");
  const recipients = useShareRecipients({ enabled: true, profileId, query });
  const count = selected.length;
  const selectedKeys = new Set(selected.map((item) => item.key));
  const atLimit = count >= SHARE_MAX_DESTINATIONS;

  // §264: solo la lunghezza della ricerca, mai il testo.
  const searchedLength = recipients.effectiveQuery.length;
  useEffect(() => {
    if (searchedLength > 0) {
      trackShare({ name: "share_recipient_search", queryLength: searchedLength });
    }
  }, [searchedLength]);

  const isInitialLoading = recipients.isLoading && recipients.items.length === 0;

  return (
    <SafeAreaView style={styles.root} testID="share-picker">
      <ShareStepHeader leading="back" onLeadingPress={onBack} title={SHARE_COPY.recipientsTitle} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.search}>
          <SearchField
            onChangeText={setQuery}
            onClear={() => setQuery("")}
            placeholder={SHARE_COPY.searchPlaceholder}
            testID="share-search"
            value={query}
          />
        </View>

        {isInitialLoading ? (
          <View style={styles.centered} testID="share-picker-loading">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : recipients.isError ? (
          <View style={styles.centered} testID="share-picker-error">
            <AppText align="center" color="secondary">
              {SHARE_COPY.searchError}
            </AppText>
            <Button label={SHARE_COPY.retry} onPress={recipients.retry} variant="secondary" />
          </View>
        ) : recipients.items.length === 0 ? (
          <View style={styles.centered} testID="share-picker-empty">
            <AppText align="center" variant="titleMd">
              {SHARE_COPY.noResultsTitle}
            </AppText>
            <AppText align="center" color="secondary">
              {SHARE_COPY.noResultsBody}
            </AppText>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={recipients.items}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.key}
            ListFooterComponent={
              recipients.isFetchingNextPage ? (
                <ActivityIndicator color={colors.accent} style={styles.footerSpinner} />
              ) : recipients.isNextPageError ? (
                <Button
                  label={SHARE_COPY.retry}
                  onPress={recipients.loadMore}
                  style={styles.footerRetry}
                  variant="tertiary"
                />
              ) : null
            }
            onEndReached={recipients.loadMore}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => (
              <ShareRecipientRow
                onToggle={onToggle}
                recipient={item}
                selected={selectedKeys.has(item.key)}
              />
            )}
            style={styles.flex}
          />
        )}

        <View style={styles.footer}>
          {atLimit ? (
            <AppText align="center" color="muted" variant="caption">
              {SHARE_COPY.selectionLimit}
            </AppText>
          ) : null}
          <Button
            accessibilityLabel={nextLabel(count)}
            disabled={count === 0}
            label={nextLabel(count)}
            onPress={onNext}
            size="lg"
            testID="share-next"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[12],
    justifyContent: "center",
    padding: spacing[24],
  },
  flex: {
    flex: 1,
  },
  footer: {
    gap: spacing[8],
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  footerRetry: {
    alignSelf: "center",
  },
  footerSpinner: {
    padding: spacing[16],
  },
  list: {
    paddingHorizontal: spacing[20],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  search: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[8],
  },
});
