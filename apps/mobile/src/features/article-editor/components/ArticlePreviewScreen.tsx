/**
 * Anteprima dell'Articolo (HOM-06.2 §72–§80, §7K, §7U; mockup 4).
 *
 * Usa il renderer REALE (§73): `ArticleDocumentView` per NATIVE e IMPORTED_TEXT,
 * `ArticleSourceCard` per EXTERNAL_LINK, `ArticleAttribution` per un testo già
 * pubblicato altrove — gli stessi componenti del dettaglio pubblico, così ciò che
 * si vede è ciò che si pubblica. Mostra identity con verifica, la data simulata
 * (quella programmata, altrimenti oggi), titolo, copertina, corpo, link e tag
 * (§74).
 *
 *  • non è mai un passaggio obbligatorio (§75): si pubblica anche senza aprirla;
 *  • azioni (§76): «Modifica» (torna all'editor) e la CTA primaria dinamica, la
 *    STESSA dell'editor e inviata dallo stesso controller (§77–§79): «Pubblica» con
 *    Ora, «Programma» con una data futura, mai «Programma» con Ora (§80);
 *  • legge lo store condiviso: se la sessione non c'è più (riapertura da deep
 *    link) lo dice e chiude.
 *
 * Dopo un invio riuscito chiude prima se stessa; l'editor sotto, tornato a fuoco,
 * chiude a sua volta verso l'origin.
 */

import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../../styles";
import { AppText, Button, ConfirmModal, VerifiedCheck } from "../../../ui";
import { ComposerAvatar } from "../../post-composer/components/ComposerAvatar";
import { tagSummary } from "../../post-composer/composer-presentation";
import { formatScheduleFull } from "../../publishing/publishing-presentation";
import { blockerCopy, domainOrNull } from "../article-presentation";
import { articleStore, selectArticleView } from "../article-store";
import { useArticleStoreState } from "../use-article-store";
import { ArticleAttribution } from "./ArticleAttribution";
import { ArticleDocumentView } from "./ArticleDocumentView";
import { ArticleHeader } from "./ArticleHeader";
import { ArticleMessage } from "./ArticleMessage";
import { ArticlePublishError } from "./ArticlePublishError";
import { ArticleSourceCard } from "./ArticleSourceCard";

type FocusNavigation = {
  addListener: (type: "focus", callback: () => void) => () => void;
  isFocused: () => boolean;
};

/** «20 agosto 2026»: la data simulata (§74), nel fuso della programmazione quando c'è. */
function simulatedDate(publication: { mode: "now" } | { mode: "scheduled"; scheduledAt: string; timezone: string }): string {
  const iso = publication.mode === "scheduled" ? publication.scheduledAt : new Date().toISOString();
  const timeZone = publication.mode === "scheduled" ? publication.timezone : undefined;
  return formatScheduleFull(iso, timeZone).split(" · ")[0];
}

export function ArticlePreviewScreen() {
  const router = useRouter();
  const navigation = useNavigation() as unknown as FocusNavigation;
  const state = useArticleStoreState();
  const [confirmSource, setConfirmSource] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Invio riuscito (da qui o dall'editor): l'Anteprima si chiude, poi l'editor.
  const submitted = state.submitted;
  useEffect(() => {
    const check = () => {
      if (mountedRef.current && articleStore.getState().submitted && router.canGoBack()) router.back();
    };
    check();
    return navigation.addListener("focus", check);
  }, [submitted, navigation, router]);

  function close() {
    if (router.canGoBack()) router.back();
  }

  if (!state.session) {
    return <ArticleMessage message="Il contenuto non è più disponibile." onClose={close} />;
  }

  const view = selectArticleView(state);
  const identity = view.identity;
  const external = state.mode === "external_link";
  const source = state.source;
  const imported = state.mode === "imported_text";
  const showAttribution = imported && state.provenance.publishedElsewhere === true;
  const summary = tagSummary(state.tagged);
  const coverUri = state.cover ? (state.cover.localUri ?? state.cover.url) : null;
  const ready = view.blocker === null && identity !== null;
  const hint = view.blocker && view.significant ? blockerCopy(view.blocker) : null;
  const title = view.draft.title.trim();

  /** §77: stessa CTA, stesso invio dell'editor. §219: l'URL di un pubblicato cambiato chiede conferma. */
  async function send(confirmSourceChange = false) {
    const outcome = await articleStore.getController()?.submit({ confirmSourceChange });
    // Il server può chiedere la conferma anche quando il client non se n'è accorto.
    if (outcome === "needs_source_confirmation" && mountedRef.current) setConfirmSource(true);
  }

  function submit() {
    const controller = articleStore.getController();
    if (!controller) return;
    if (controller.needsSourceConfirmation()) {
      setConfirmSource(true);
      return;
    }
    void send();
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <ArticleHeader leftIcon="back" onLeft={close} title="Anteprima" />

      <ScrollView contentContainerStyle={styles.content} style={styles.flex} testID="article-preview">
        {identity ? (
          <View style={styles.author}>
            <ComposerAvatar name={identity.name} size="md" square={identity.type !== "person"} uri={identity.avatarUrl} />
            <View style={styles.authorText}>
              <View style={styles.nameRow}>
                <AppText numberOfLines={1} style={styles.name} variant="titleMd">
                  {identity.name}
                </AppText>
                {identity.isVerified ? <VerifiedCheck /> : null}
              </View>
              <AppText color="secondary" variant="feedMeta">
                {simulatedDate(state.publication)}
              </AppText>
            </View>
          </View>
        ) : null}

        {external ? (
          source.status === "ready" ? (
            <View style={styles.padded}>
              <ArticleSourceCard
                publisherName={identity?.name ?? ""}
                source={{
                  description: source.snapshot.description,
                  domain: source.domain,
                  faviconUrl: source.snapshot.favicon_url,
                  imageUrl: source.snapshot.image_url,
                  openUrl: source.finalUrl,
                  siteName: source.siteName,
                  title: source.snapshot.title?.trim() || state.manualTitle.trim() || null,
                }}
              />
            </View>
          ) : (
            <AppText color="secondary" style={styles.padded} variant="bodyLg">
              {domainOrNull(source.status === "empty" ? null : source.url) ?? "Collega un articolo per vederne l'anteprima."}
            </AppText>
          )
        ) : (
          <>
            {title.length > 0 ? (
              <AppText accessibilityRole="header" style={styles.title} variant="headingLg">
                {title}
              </AppText>
            ) : null}
            {coverUri ? <Image accessibilityLabel="Copertina dell'articolo" resizeMode="cover" source={{ uri: coverUri }} style={styles.cover} /> : null}
            <View style={styles.padded}>
              <ArticleDocumentView document={view.document} testID="article-preview-document" />
            </View>
            {showAttribution ? (
              <View style={styles.padded}>
                <ArticleAttribution
                  originalAuthor={state.provenance.originalAuthor.trim() || null}
                  originalUrl={state.provenance.noOriginalLink ? null : state.provenance.originalUrl.trim() || null}
                  publisherName={identity?.name ?? ""}
                  sourceName={state.provenance.sourceName.trim() || null}
                />
              </View>
            ) : null}
          </>
        )}

        {summary ? (
          <AppText color="secondary" style={styles.tags} variant="feedMeta">
            {summary}
          </AppText>
        ) : null}
      </ScrollView>

      <ArticlePublishError duplicateRef={state.publish.duplicateRef} error={state.publish.error} />

      <View style={styles.footer}>
        {hint ? (
          <AppText color="secondary" style={styles.hint} variant="feedMeta">
            {hint}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button disabled={view.submitting} fullWidth label="Modifica" onPress={close} size="lg" testID="article-preview-edit" variant="outline" />
          </View>
          <View style={styles.action}>
            <Button
              accessibilityHint={hint ?? undefined}
              disabled={!ready || view.submitting}
              fullWidth
              label={view.ctaLabel}
              loading={view.submitting}
              onPress={submit}
              size="lg"
              testID="article-preview-cta"
            />
          </View>
        </View>
      </View>

      <ConfirmModal
        cancelLabel="Continua a modificare"
        confirmLabel="Conferma"
        message="Il link e l'anteprima pubblici verranno aggiornati. Controlla che sia ancora lo stesso contenuto."
        onCancel={() => setConfirmSource(false)}
        onConfirm={() => {
          setConfirmSource(false);
          void send(true);
        }}
        title="Cambiare il link dell'articolo?"
        visible={confirmSource}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[12],
  },
  author: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  authorText: {
    flex: 1,
    gap: spacing[4],
  },
  content: {
    paddingBottom: spacing[24],
  },
  cover: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[16],
    marginHorizontal: spacing[16],
    marginVertical: spacing[8],
    overflow: "hidden",
  },
  flex: {
    flex: 1,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  hint: {
    textAlign: "right",
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  padded: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  tags: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  title: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
});
