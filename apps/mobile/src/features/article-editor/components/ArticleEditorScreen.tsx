/**
 * Editor Articolo: Nuovo articolo, Modifica articolo e, dopo «Importa nell'editor»,
 * l'articolo di un testo importato (HOM-06.2 §28–§45, §55–§62, §72, §81, §7E, §7T,
 * §217–§218; mockup 2–3).
 *
 * UN editor per NATIVE e IMPORTED_TEXT (§7E, §7T): cambiano solo le sezioni
 * (Fonte e attribuzione compare solo per il testo importato) e non esiste alcun
 * `PasteArticleEditor`. Full-screen, fuori da `(tabs)`: niente chrome Home (§29).
 * Ordine (§30): identity, titolo, copertina, toolbar, corpo, Tagga, Pubblicazione,
 * autosave. Spazio bianco e hairline, nessuna card (§242–§243).
 *
 * Toolbar: in linea sotto la copertina a tastiera chiusa (come il mockup), sopra la
 * tastiera quando si scrive nel corpo (§45); a tastiera aperta nel corpo il piè con
 * la CTA lascia il posto alla toolbar.
 *
 * Header: «Annulla | Nuovo articolo | Anteprima»; su un Articolo pubblicato
 * «Annulla | Modifica articolo | Salva» e nessuna CTA nel piè (§218, §227).
 */

import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing, textVariants } from "../../../styles";
import { COMPOSER_FALLBACK_HREF } from "../../post-composer/composer-routes";
import { ComposerStatusBanner } from "../../post-composer/components/ComposerStatusBanner";
import { useSession } from "../../auth/use-session";
import { trackArticle } from "../article-analytics";
import { blockerCopy, editorHeaderTitle } from "../article-presentation";
import { ARTICLE_PREVIEW_PATH, articleHandoffHref, parseArticleParams } from "../article-routes";
import { articleStore, type ArticleInit } from "../article-store";
import { useArticleEditor } from "../use-article-editor";
import { useArticleSource } from "../use-article-source";
import { useBlockEditing } from "../use-block-editing";
import { ArticleBlockEditor } from "./ArticleBlockEditor";
import { ArticleCoverField } from "./ArticleCoverField";
import { ArticleExitDialogs } from "./ArticleExitDialogs";
import { ArticleFooter } from "./ArticleFooter";
import { ArticleHeader } from "./ArticleHeader";
import { ArticleIdentityBar } from "./ArticleIdentityBar";
import { ArticleLoading, ArticleMessage, openErrorCopy } from "./ArticleMessage";
import { ArticleModeChange } from "./ArticleModeChange";
import { ArticlePublication } from "./ArticlePublication";
import { ArticlePublishError } from "./ArticlePublishError";
import { ArticleTagRow } from "./ArticleTagRow";
import { ArticleToolbar } from "./ArticleToolbar";
import { InlineLinkSheet } from "./InlineLinkSheet";
import { ProvenanceFields } from "./ProvenanceFields";

export const ARTICLE_TITLE_PLACEHOLDER = "Inserisci un titolo";
export const ARTICLE_IMPORT_WARNING = "Alcuni elementi non supportati non sono stati importati. Controlla l'articolo prima di pubblicarlo.";

type SearchParams = Record<string, string | string[] | undefined>;

/* ------------------------------------------------------------------ */
/* Guscio: carica, poi monta il form                                   */
/* ------------------------------------------------------------------ */

export function ArticleEditorScreen({ search }: { search: SearchParams }) {
  const router = useRouter();
  const { profile, session } = useSession();
  const userId = session?.user.id ?? profile?.id ?? "";
  const profileId = profile?.id ?? userId;

  const source = useArticleSource({ kind: "editor", params: parseArticleParams(search), userId });

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

  return <ArticleEditorForm init={source.init} profileId={profileId} userId={userId} />;
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

type FormProps = { init: ArticleInit | null; userId: string; profileId: string };

function ArticleEditorForm({ init, userId, profileId }: FormProps) {
  const router = useRouter();
  // La sessione si apre PRIMA del primo render dei figli (idempotente: vedi `articleStore.begin`).
  useState<null>(() => {
    if (init) articleStore.begin(init);
    return null;
  });

  const editor = useArticleEditor({ profileId, userId });
  const editing = useBlockEditing();
  const { state, view } = editor;
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const redirected = useRef(false);

  // §37 di HOM-06.1: l'inset dell'home indicator serve solo a tastiera chiusa.
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Una bozza «Da link» aperta da questo percorso prosegue sulla sua schermata (stessa sessione).
  const wrongMode = state.mode === "external_link";
  const { navigateAway } = editor;
  const origin = state.session?.origin;
  const identityId = state.identityId;
  useEffect(() => {
    if (!wrongMode || !origin || redirected.current) return;
    redirected.current = true;
    navigateAway(articleHandoffHref("external_link", origin, identityId));
  }, [wrongMode, origin, identityId, navigateAway]);

  if (!state.session || wrongMode) {
    return null;
  }

  const submitting = view.submitting;
  const publishedEdit = view.editing === "published";
  const stickyToolbar = keyboardOpen && editing.bodyFocused;
  const ready = view.blocker === null && view.identity !== null;
  const hint = view.blocker && view.significant ? blockerCopy(view.blocker) : null;

  function openPreview() {
    trackArticle({ mode: state.mode, name: "preview_opened" });
    void editor.flush();
    router.push(ARTICLE_PREVIEW_PATH as never);
  }

  function onTitleChange(text: string) {
    if (/\n/.test(text)) {
      articleStore.dispatch({ title: text.replace(/\n/g, ""), type: "titleChanged" });
      editing.focusFirst();
      return;
    }
    articleStore.dispatch({ title: text, type: "titleChanged" });
  }

  const toolbar = (variant: "inline" | "sticky") => (
    <ArticleToolbar
      enabled={editing.toolbarEnabled && !submitting}
      formats={editing.formats}
      onBold={editing.commands.toggleBold}
      onBullet={editing.commands.toggleBullet}
      onHeading={editing.commands.toggleHeading}
      onItalic={editing.commands.toggleItalic}
      onLink={editing.commands.openLink}
      onNumbered={editing.commands.toggleNumbered}
      variant={variant}
    />
  );

  return (
    <SafeAreaView edges={keyboardOpen ? ["top"] : ["top", "bottom"]} style={styles.root}>
      <ArticleHeader
        leftDisabled={submitting}
        onLeft={editor.exit.request}
        right={
          publishedEdit
            ? {
                label: "Salva",
                onPress: () => {
                  void editor.submit();
                },
                state: submitting ? "loading" : ready ? "enabled" : "disabled",
                testID: "article-header-save",
              }
            : { label: "Anteprima", onPress: openPreview, state: submitting ? "disabled" : "enabled", testID: "article-header-preview" }
        }
        title={editorHeaderTitle(state.mode, view.editing ? "published" : null)}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          style={styles.flex}
        >
          <ArticleIdentityBar picker={editor.identityPicker} />
          <View style={styles.hairline} />

          {state.importWarning ? (
            <ComposerStatusBanner
              actionLabel="Chiudi"
              message={ARTICLE_IMPORT_WARNING}
              onAction={() => articleStore.dispatch({ type: "importWarningDismissed" })}
              tone="notice"
            />
          ) : null}

          <TextInput
            accessibilityLabel="Titolo"
            allowFontScaling
            autoCapitalize="sentences"
            editable={!submitting}
            maxLength={state.limits.maxTitleLength}
            multiline
            onChangeText={onTitleChange}
            onSubmitEditing={editing.focusFirst}
            placeholder={ARTICLE_TITLE_PLACEHOLDER}
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
            scrollEnabled={false}
            selectionColor={colors.accent}
            style={styles.title}
            submitBehavior="submit"
            testID="article-title-input"
            textAlignVertical="top"
            underlineColorAndroid="transparent"
            value={state.title}
          />

          <ArticleCoverField
            cover={state.cover}
            disabled={submitting}
            notice={editor.cover.notice}
            onPick={() => {
              void editor.cover.pick();
            }}
            onRemove={editor.cover.remove}
            onRetry={editor.cover.retry}
          />

          {stickyToolbar ? null : toolbar("inline")}

          <ArticleBlockEditor editable={!submitting} editing={editing} lines={state.lines} />

          {state.mode === "imported_text" ? (
            <>
              <View style={styles.hairline} />
              <ProvenanceFields
                blocker={view.blocker}
                disabled={submitting}
                lockElsewhere={publishedEdit && state.session.loadedElsewhere}
                provenance={state.provenance}
                rightsConfirmed={state.rightsConfirmed}
              />
            </>
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
          duplicateRef={state.publish.duplicateRef}
          error={state.publish.error}
          onReload={editor.reloadHref() ? () => editor.navigateAway(editor.reloadHref() ?? "") : null}
        />

        {stickyToolbar ? toolbar("sticky") : null}

        {publishedEdit || stickyToolbar ? null : (
          <ArticleFooter
            autosave={editor.autosave.status}
            busy={submitting}
            ctaDisabled={!ready || submitting}
            ctaLabel={view.ctaLabel}
            hint={hint}
            onReload={editor.reloadHref() ? () => editor.navigateAway(editor.reloadHref() ?? "") : null}
            onSubmit={() => {
              void editor.submit();
            }}
            showAutosave={view.editing === null}
          />
        )}
      </KeyboardAvoidingView>

      <InlineLinkSheet onApply={editing.link.apply} onClose={editing.link.close} onRemove={editing.link.remove} sheet={editing.link.sheet} />
      <ArticleExitDialogs exit={editor.exit} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing[24],
  },
  flex: {
    flex: 1,
  },
  hairline: {
    backgroundColor: colors.divider,
    height: 1,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  title: {
    ...textVariants.headingLg,
    color: colors.textPrimary,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
});
