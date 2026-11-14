/**
 * «Come vuoi creare l'articolo?» (HOM-06.2 §7A, §7B, §118; screen integrativo).
 *
 * Il tap su «Articolo» del launcher risolve le modalità realmente disponibili per
 * le identity autorizzate (§7B: mai hardcodate sul ruolo):
 *  • due o più → questa schermata: «Nuovo articolo», «Come vuoi creare
 *    l'articolo?», tre righe compatte selezionabili e «Continua». Una sola
 *    selezionata, lo stato non è solo colore, default «Scrivi su PROLINK» salvo il
 *    ripristino di una bozza locale in un'altra modalità;
 *  • una sola → fast path verso quella modalità, senza un selector inutile;
 *  • nessuna → lo dice.
 *
 * Aprire il selector non crea nulla sul server (§118, §7A): nessuna bozza, nessun
 * salvataggio. «Continua» SOSTITUISCE questa route con la schermata della modalità,
 * così indietro torna all'origin e non al selector.
 */

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../../../styles";
import { AppText, Button } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { COMPOSER_FALLBACK_HREF } from "../../post-composer/composer-routes";
import { localDraftKey, readLocalDraft } from "../../publishing/draft-local-store";
import type { ArticleCreationMode } from "../../publishing/publishing-types";
import { trackArticle } from "../article-analytics";
import { articleKeys } from "../article-keys";
import { availableModes, defaultMode, modeEntry } from "../article-presentation";
import { articleModeHref, parseArticleParams } from "../article-routes";
import { fetchArticleComposerContext } from "../article-service";
import { isRestorableSnapshot, type ArticleLocalSnapshot } from "../article-store";
import { ArticleHeader } from "./ArticleHeader";
import { ArticleLoading, ArticleMessage, openErrorCopy } from "./ArticleMessage";
import { ArticleModeOptions } from "./ArticleModeOptions";

export const MODE_SCREEN_TITLE = "Nuovo articolo";
export const MODE_SCREEN_QUESTION = "Come vuoi creare l'articolo?";

type SearchParams = Record<string, string | string[] | undefined>;

export function ArticleModeScreen({ search }: { search: SearchParams }) {
  const router = useRouter();
  const { profile, session } = useSession();
  const userId = session?.user.id ?? profile?.id ?? "";
  const params = parseArticleParams(search);

  const quiet = { gcTime: 0, refetchOnReconnect: false, refetchOnWindowFocus: false, staleTime: 0 } as const;
  const context = useQuery({
    ...quiet,
    enabled: userId.length > 0,
    queryFn: fetchArticleComposerContext,
    queryKey: articleKeys.context(userId),
    retry: 1,
  });
  // Una bozza locale non ancora salvata sul server decide il default (§7A «ripristino di una bozza»).
  const local = useQuery({
    ...quiet,
    enabled: userId.length > 0,
    queryFn: () => readLocalDraft<ArticleLocalSnapshot>(localDraftKey(userId, "article", null)),
    queryKey: articleKeys.local(userId, "new"),
    retry: false,
  });

  const [choice, setChoice] = useState<ArticleCreationMode | null>(null);
  const redirected = useRef(false);
  const announced = useRef(false);

  const identities = context.data?.identities ?? [];
  // Un'identity contestuale valida restringe le modalità a quelle che può usare (§22–§23).
  const contextual = params.identityId ? identities.filter((identity) => identity.id === params.identityId) : [];
  const modes = availableModes(contextual.length > 0 ? contextual : identities);
  const entry = modeEntry(modes);

  const snapshot = local.data?.snapshot;
  const restoredMode =
    snapshot && Array.isArray(snapshot.lines) && Array.isArray(snapshot.tagged) && isRestorableSnapshot(snapshot) ? snapshot.mode : null;

  const origin = params.origin;
  const contextualId = params.identityId;
  const ready = context.data !== undefined && local.data !== undefined;
  const directMode = entry.kind === "direct" ? entry.mode : null;

  // Una sola modalità: niente selector inutile (§7A).
  useEffect(() => {
    if (!ready || directMode === null || redirected.current) return;
    redirected.current = true;
    router.replace(articleModeHref(directMode, origin, contextualId) as never);
  }, [ready, directMode, origin, contextualId, router]);

  const selectorShown = ready && entry.kind === "selector";
  useEffect(() => {
    if (!selectorShown || announced.current) return;
    announced.current = true;
    trackArticle({ available: modes.length, name: "article_creation_mode_opened" });
  }, [selectorShown, modes.length]);

  function close() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(COMPOSER_FALLBACK_HREF as never);
    }
  }

  if (context.error) {
    return <ArticleMessage message={openErrorCopy("network")} onClose={close} onRetry={() => void context.refetch()} />;
  }

  if (!ready || directMode !== null) {
    return <ArticleLoading />;
  }

  if (entry.kind === "none") {
    return <ArticleMessage message={openErrorCopy("article_mode_not_allowed")} onClose={close} />;
  }

  const selected = choice ?? defaultMode(modes, restoredMode);

  function next() {
    if (!selected) return;
    trackArticle({ mode: selected, name: "article_creation_mode_selected" });
    router.replace(articleModeHref(selected, origin, contextualId) as never);
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <ArticleHeader onLeft={close} title={MODE_SCREEN_TITLE} />

      <ScrollView contentContainerStyle={styles.content} style={styles.flex}>
        <AppText accessibilityRole="header" variant="headingSm">
          {MODE_SCREEN_QUESTION}
        </AppText>
        <ArticleModeOptions modes={modes} onSelect={setChoice} selected={selected} />
      </ScrollView>

      <View style={styles.footer}>
        <Button disabled={!selected} fullWidth label="Continua" onPress={next} size="lg" testID="article-mode-continue" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[16],
    padding: spacing[16],
  },
  flex: {
    flex: 1,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
