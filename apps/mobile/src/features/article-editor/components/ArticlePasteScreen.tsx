/**
 * «Incolla un articolo» (HOM-06.2 §7O–§7T, §7Y; screen integrativo B).
 *
 * Header «Annulla | Incolla un articolo». Identity, l'area «Incolla qui il testo
 * dell'articolo», l'origine del testo con fonte, autore e link originali, la
 * conferma dei diritti (mai preselezionata) e la CTA «Importa nell'editor».
 *
 *  • il testo incollato non è mai HTML come source of truth (§7O): `parsePastedArticle`
 *    lo converte nel documento strutturato; gli appunti si leggono in formato ricco
 *    quando il sistema lo offre, altrimenti in testo semplice;
 *  • un errore (testo vuoto, troppo grande, troppi blocchi) resta in linea e NON
 *    cancella il testo (§7Y); gli elementi non supportati rimossi sono un avviso
 *    non bloccante nell'editor, non qui (§7R);
 *  • importare non pubblica nulla: apre l'editor di sempre con corpo e titolo
 *    proposto (§7S, §7T), e fonte e diritti restano modificabili là. Senza la
 *    conferma dei diritti il testo resta sul dispositivo e non si pubblica (§7Q);
 *  • nessun `PasteArticleEditor` (§7T): questo schermo finisce nell'editor
 *    canonico passando per lo store condiviso.
 */

import * as Clipboard from "expo-clipboard";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../../styles";
import { AppText, Button, ConfirmModal, Input } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { COMPOSER_FALLBACK_HREF } from "../../post-composer/composer-routes";
import { trackArticle } from "../article-analytics";
import { htmlToPlainText, parsePastedArticle, type PasteIssue } from "../article-paste";
import { articleHandoffHref, parseArticleParams } from "../article-routes";
import { articleStore, type ArticleInit } from "../article-store";
import { useArticleIdentityPicker } from "../use-article-identity";
import { useArticleSource } from "../use-article-source";
import { useArticleStoreState } from "../use-article-store";
import { ArticleHeader } from "./ArticleHeader";
import { ArticleIdentityBar } from "./ArticleIdentityBar";
import { ArticleLoading, ArticleMessage, openErrorCopy } from "./ArticleMessage";
import { ProvenanceFields } from "./ProvenanceFields";

export const PASTE_AREA_PLACEHOLDER = "Incolla qui il testo dell'articolo";

export function pasteIssueCopy(issue: PasteIssue): string {
  switch (issue) {
    case "too_large":
      return "Il testo è troppo lungo per essere importato. Dividilo in più parti.";
    case "too_many_blocks":
      return "Il testo ha troppe sezioni per essere importato. Riducilo e riprova.";
    default:
      return "Incolla il testo dell'articolo.";
  }
}

type SearchParams = Record<string, string | string[] | undefined>;

/* ------------------------------------------------------------------ */
/* Guscio                                                              */
/* ------------------------------------------------------------------ */

export function ArticlePasteScreen({ search }: { search: SearchParams }) {
  const router = useRouter();
  const { profile, session } = useSession();
  const userId = session?.user.id ?? profile?.id ?? "";

  const source = useArticleSource({ kind: "paste", params: parseArticleParams(search), userId });

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

  return <ArticlePasteForm init={source.init} userId={userId} />;
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

type ExitNavigation = {
  addListener: (type: "beforeRemove", callback: (event: { preventDefault: () => void }) => void) => () => void;
};

function ArticlePasteForm({ init, userId }: { init: ArticleInit | null; userId: string }) {
  const router = useRouter();
  const navigation = useNavigation() as unknown as ExitNavigation;
  useState<null>(() => {
    if (init) articleStore.begin(init);
    return null;
  });

  const state = useArticleStoreState();
  const picker = useArticleIdentityPicker(userId);
  const [text, setText] = useState("");
  // Il formato ricco degli appunti, valido finché il testo nell'area è quello letto da lì.
  const [html, setHtml] = useState<{ plain: string; html: string } | null>(null);
  const [issue, setIssue] = useState<PasteIssue | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const leavingRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const hasText = text.trim().length > 0;

  // Back hardware e gesture: con del testo incollato chiedono conferma (§7A «modifiche non salvate»).
  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (leavingRef.current || !hasText) return;
      event.preventDefault();
      setConfirmOpen(true);
    });
  }, [navigation, hasText]);

  if (!state.session) {
    return null;
  }

  function leave() {
    leavingRef.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(COMPOSER_FALLBACK_HREF as never);
    }
  }

  function markStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    trackArticle({ name: "article_paste_started" });
  }

  function onChange(next: string) {
    setText(next);
    setIssue(null);
    // Il testo non è più quello letto dagli appunti: il formato ricco non vale più.
    if (html && html.plain !== next) setHtml(null);
    if (next.trim().length > 0) markStarted();
  }

  /** §7O: formato ricco se il sistema lo offre, testo semplice altrimenti. */
  async function pasteFromClipboard() {
    try {
      const plain = await Clipboard.getStringAsync();
      let rich: string | null = null;
      try {
        rich = await Clipboard.getStringAsync({ preferredFormat: Clipboard.StringFormat.HTML });
      } catch {
        rich = null;
      }
      const richHtml = rich !== null && rich.trim().length > 0 && /<[a-z][\s\S]*>/i.test(rich) ? rich : null;
      // Se gli appunti hanno solo il formato ricco, nell'area si mostra il suo testo semplice.
      const shown = plain.trim().length > 0 || richHtml === null ? plain : htmlToPlainText(richHtml);
      setText(shown);
      setHtml(richHtml ? { html: richHtml, plain: shown } : null);
      setIssue(null);
      if (shown.trim().length > 0) markStarted();
    } catch {
      // Appunti non leggibili: l'utente può incollare a mano nell'area.
    }
  }

  function importText() {
    const result = parsePastedArticle({ html: html?.html ?? null, plain: text }, state.limits);

    if (!result.ok) {
      setIssue(result.issue);
      trackArticle({ kind: result.issue, name: "article_paste_parse_warning" });
      return;
    }

    articleStore.dispatch({
      document: result.document,
      proposedTitle: result.proposedTitle,
      removedUnsupported: result.removedUnsupported,
      type: "importApplied",
    });
    trackArticle({
      blocks: result.document.blocks.length,
      name: "article_paste_parsed",
      plainFallback: result.usedPlainFallback,
      proposedTitle: result.proposedTitle !== null,
    });
    if (result.removedUnsupported) trackArticle({ kind: "removed_unsupported", name: "article_paste_parse_warning" });
    if (result.usedPlainFallback) trackArticle({ kind: "plain_fallback", name: "article_paste_parse_warning" });

    leavingRef.current = true;
    router.replace(articleHandoffHref("imported_text", state.session?.origin ?? "HOME_PER_TE", state.identityId) as never);
  }

  function cancel() {
    if (hasText) {
      setConfirmOpen(true);
      return;
    }
    leave();
  }

  return (
    <SafeAreaView edges={keyboardOpen ? ["top"] : ["top", "bottom"]} style={styles.root}>
      <ArticleHeader onLeft={cancel} title="Incolla un articolo" />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" style={styles.flex}>
          <ArticleIdentityBar picker={picker} />
          <View style={styles.hairline} />

          <View style={styles.area}>
            <Input
              accessibilityLabel="Testo dell'articolo"
              autoCapitalize="sentences"
              error={issue !== null}
              helperText={issue ? pasteIssueCopy(issue) : undefined}
              multiline
              onChangeText={onChange}
              placeholder={PASTE_AREA_PLACEHOLDER}
              style={styles.areaInput}
              testID="article-paste-area"
              value={text}
            />
            <View style={styles.pasteAction}>
              <Button
                label="Incolla dagli appunti"
                onPress={() => {
                  void pasteFromClipboard();
                }}
                size="lg"
                testID="article-paste-clipboard"
                variant="outline"
              />
            </View>
          </View>

          <View style={styles.hairline} />
          <ProvenanceFields blocker={null} provenance={state.provenance} rightsConfirmed={state.rightsConfirmed} />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            accessibilityHint={hasText ? undefined : "Incolla prima il testo dell'articolo"}
            disabled={!hasText}
            fullWidth
            label="Importa nell'editor"
            onPress={importText}
            size="lg"
            testID="article-paste-import"
          />
          <AppText color="muted" style={styles.note} variant="caption">
            Non viene pubblicato nulla: potrai rivedere titolo e testo nell'editor.
          </AppText>
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        cancelLabel="Continua a modificare"
        confirmLabel="Esci"
        message="Il testo incollato non verrà conservato."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          leave();
        }}
        title="Uscire senza importare?"
        visible={confirmOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  area: {
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  areaInput: {
    minHeight: 220,
  },
  content: {
    paddingBottom: spacing[24],
  },
  flex: {
    flex: 1,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[6],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  hairline: {
    backgroundColor: colors.divider,
    height: 1,
  },
  note: {
    textAlign: "center",
  },
  pasteAction: {
    alignItems: "flex-start",
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
