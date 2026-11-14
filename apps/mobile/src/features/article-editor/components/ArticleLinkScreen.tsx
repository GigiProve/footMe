/**
 * «Collega da un link» (HOM-06.2 §7F–§7M, §7W, §7Y, §7K; screen integrativo A).
 * L'anteprima è `ArticleSourceCard`, la stessa del dettaglio: la sua CTA «Leggi sul
 * sito originale» apre l'URL da sola, qui `onOpen` serve solo agli analytics.
 *
 * Header «Annulla | Collega da un link | Anteprima». Contenuti, nell'ordine della
 * spec: identity, campo «URL dell'articolo originale», stato del caricamento,
 * anteprima editoriale reale (`ArticleSourceCard`), titolo manuale quando i
 * metadata non l'hanno (§7J), Tagga, Pubblicazione, autosave e CTA dinamica.
 *
 *  • l'URL non si perde mai (§7F): un errore recuperabile resta vicino al campo con
 *    «Riprova»; Pubblica/Programma restano bloccati finché la destinazione non è
 *    validata (§7L);
 *  • nessuna copertina arbitraria in V1 (§7J): l'immagine è quella della fonte;
 *  • il duplicato (§7M) compare sotto il campo con «Visualizza articolo»;
 *  • su un Articolo già pubblicato cambiare l'URL chiede conferma (§219).
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../../styles";
import { AppText, ConfirmModal, Input } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { COMPOSER_FALLBACK_HREF } from "../../post-composer/composer-routes";
import { trackArticle } from "../article-analytics";
import { blockerCopy, editorHeaderTitle, needsManualTitle, type ExternalSourceState } from "../article-presentation";
import { ARTICLE_PREVIEW_PATH, articleHandoffHref, parseArticleParams } from "../article-routes";
import { articleStore, type ArticleInit } from "../article-store";
import { useArticleEditor } from "../use-article-editor";
import { useArticleLink } from "../use-article-link";
import { useArticleSource } from "../use-article-source";
import { ArticleExitDialogs } from "./ArticleExitDialogs";
import { ArticleFooter } from "./ArticleFooter";
import { ArticleHeader } from "./ArticleHeader";
import { ArticleIdentityBar } from "./ArticleIdentityBar";
import { ArticleLoading, ArticleMessage, openErrorCopy } from "./ArticleMessage";
import { ArticleModeChange } from "./ArticleModeChange";
import { ArticlePublication } from "./ArticlePublication";
import { ArticlePublishError } from "./ArticlePublishError";
import { ArticleSourceCard } from "./ArticleSourceCard";
import { ArticleTagRow } from "./ArticleTagRow";

export const LINK_FIELD_LABEL = "URL dell'articolo originale";
export const LINK_FIELD_PLACEHOLDER = "Incolla il link dell'articolo";
export const LINK_LOADING_COPY = "Caricamento anteprima…";
export const LINK_LOADED_COPY = "Anteprima caricata";
export const MANUAL_TITLE_PLACEHOLDER = "Inserisci il titolo dell'articolo";

type SearchParams = Record<string, string | string[] | undefined>;

/* ------------------------------------------------------------------ */
/* Guscio                                                              */
/* ------------------------------------------------------------------ */

export function ArticleLinkScreen({ search }: { search: SearchParams }) {
  const router = useRouter();
  const { profile, session } = useSession();
  const userId = session?.user.id ?? profile?.id ?? "";
  const profileId = profile?.id ?? userId;

  const source = useArticleSource({ kind: "link", params: parseArticleParams(search), userId });

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(COMPOSER_FALLBACK_HREF as never);
    }
  }

  if (source.status === "loading") {
    return <ArticleLoading />;
  }

  if (source.status === "error") {
    const retryable = source.kind === "network" || source.kind === "unknown";
    return <ArticleMessage message={openErrorCopy(source.kind)} onClose={close} onRetry={retryable ? source.retry : undefined} />;
  }

  return <ArticleLinkForm init={source.init} profileId={profileId} userId={userId} />;
}

/* ------------------------------------------------------------------ */
/* Stato del caricamento                                               */
/* ------------------------------------------------------------------ */

function LinkStatus({ source, onRetry }: { source: ExternalSourceState; onRetry: () => void }) {
  if (source.status === "empty") {
    return null;
  }

  if (source.status === "loading") {
    return (
      <View accessibilityLiveRegion="polite" style={styles.status}>
        <ActivityIndicator color={colors.textSecondary} size="small" />
        <AppText color="secondary" variant="bodySm">
          {LINK_LOADING_COPY}
        </AppText>
      </View>
    );
  }

  if (source.status === "ready") {
    return (
      <View accessibilityLiveRegion="polite" style={styles.status}>
        <Ionicons color={colors.success} name="checkmark-circle-outline" size={18} />
        <AppText color="secondary" variant="bodySm">
          {LINK_LOADED_COPY}
        </AppText>
      </View>
    );
  }

  return (
    <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.status}>
      <Ionicons color={colors.danger} name="alert-circle-outline" size={18} />
      <AppText color="danger" style={styles.statusText} variant="bodySm">
        {blockerCopy("source_invalid")}
      </AppText>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetry} style={styles.retry} testID="article-link-retry">
        <AppText color="accent" variant="actionLabel">
          Riprova
        </AppText>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

type FormProps = { init: ArticleInit | null; userId: string; profileId: string };

function ArticleLinkForm({ init, userId, profileId }: FormProps) {
  const router = useRouter();
  useState<null>(() => {
    if (init) articleStore.begin(init);
    return null;
  });

  const editor = useArticleEditor({ profileId, userId });
  const link = useArticleLink();
  const { state, view } = editor;
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [confirmSource, setConfirmSource] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Una bozza di testo aperta da questo percorso prosegue sull'editor (stessa sessione).
  const wrongMode = state.mode !== "external_link";
  const { navigateAway } = editor;
  const origin = state.session?.origin;
  const identityId = state.identityId;
  const mode = state.mode;
  useEffect(() => {
    if (!wrongMode || !origin || redirected.current) return;
    redirected.current = true;
    navigateAway(articleHandoffHref(mode, origin, identityId));
  }, [wrongMode, origin, identityId, mode, navigateAway]);

  if (!state.session || wrongMode) {
    return null;
  }

  const submitting = view.submitting;
  const publishedEdit = view.editing === "published";
  const ready = view.blocker === null && view.identity !== null;
  const hint = view.blocker && view.significant ? blockerCopy(view.blocker) : null;
  const source = state.source;

  function openPreview() {
    trackArticle({ mode: "external_link", name: "preview_opened" });
    void editor.flush();
    router.push(ARTICLE_PREVIEW_PATH as never);
  }

  /** §219: l'URL di un pubblicato cambiato chiede conferma prima di inviare. */
  async function send(confirmSourceChange = false) {
    // Il server può chiedere la conferma anche quando il client non se n'è accorto.
    const outcome = await editor.submit({ confirmSourceChange });
    if (outcome === "needs_source_confirmation") setConfirmSource(true);
  }

  function save() {
    if (editor.needsSourceConfirmation()) {
      setConfirmSource(true);
      return;
    }
    void send();
  }

  return (
    <SafeAreaView edges={keyboardOpen ? ["top"] : ["top", "bottom"]} style={styles.root}>
      <ArticleHeader
        leftDisabled={submitting}
        onLeft={editor.exit.request}
        right={
          publishedEdit
            ? { label: "Salva", onPress: save, state: submitting ? "loading" : ready ? "enabled" : "disabled", testID: "article-header-save" }
            : { label: "Anteprima", onPress: openPreview, state: submitting ? "disabled" : "enabled", testID: "article-header-preview" }
        }
        title={editorHeaderTitle("external_link", view.editing ? "published" : null)}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" style={styles.flex}>
          <ArticleIdentityBar picker={editor.identityPicker} />
          <View style={styles.hairline} />

          <View style={styles.field}>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              disabled={submitting}
              error={source.status === "failed"}
              keyboardType="url"
              label={LINK_FIELD_LABEL}
              onBlur={link.commit}
              onChangeText={link.setText}
              onSubmitEditing={link.commit}
              placeholder={LINK_FIELD_PLACEHOLDER}
              returnKeyType="go"
              testID="article-link-input"
              value={link.text}
            />
            <LinkStatus onRetry={link.retry} source={source} />
            <ArticlePublishError
              duplicateRef={state.publish.duplicateRef}
              error={state.publish.error === "article_duplicate" ? state.publish.error : null}
            />
          </View>

          {source.status === "ready" ? (
            <View style={styles.preview}>
              <ArticleSourceCard
                onOpen={() => trackArticle({ name: "external_article_opened" })}
                publisherName={view.identity?.name ?? ""}
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
          ) : null}

          {needsManualTitle(view.draft) ? (
            <View style={styles.field}>
              <Input
                autoCapitalize="sentences"
                disabled={submitting}
                label="Titolo"
                maxLength={state.limits.maxTitleLength}
                onChangeText={(value) => articleStore.dispatch({ type: "manualTitleChanged", value })}
                placeholder={MANUAL_TITLE_PLACEHOLDER}
                testID="article-manual-title"
                value={state.manualTitle}
              />
            </View>
          ) : null}

          <View style={styles.hairline} />
          <ArticleModeChange editor={editor} state={state} />
          <ArticleTagRow disabled={submitting} tags={editor.tags} />
          {view.showPublicationRow ? (
            <>
              <View style={styles.hairline} />
              <ArticlePublication disabled={submitting} state={state} />
            </>
          ) : null}
        </ScrollView>

        <ArticlePublishError
          duplicateRef={null}
          error={state.publish.error === "article_duplicate" ? null : state.publish.error}
          onReload={editor.reloadHref() ? () => editor.navigateAway(editor.reloadHref() ?? "") : null}
        />

        {publishedEdit || keyboardOpen ? null : (
          <ArticleFooter
            autosave={editor.autosave.status}
            busy={submitting}
            ctaDisabled={!ready || submitting}
            ctaLabel={view.ctaLabel}
            hint={hint}
            onReload={editor.reloadHref() ? () => editor.navigateAway(editor.reloadHref() ?? "") : null}
            onSubmit={save}
            showAutosave={view.editing === null}
          />
        )}
      </KeyboardAvoidingView>

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
      <ArticleExitDialogs exit={editor.exit} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing[24],
  },
  field: {
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  flex: {
    flex: 1,
  },
  hairline: {
    backgroundColor: colors.divider,
    height: 1,
  },
  preview: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  retry: {
    justifyContent: "center",
    minHeight: 32,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  status: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  statusText: {
    flex: 1,
  },
});
