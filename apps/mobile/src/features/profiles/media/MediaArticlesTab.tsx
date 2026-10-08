/**
 * Tab Articoli del Master Profile Media/Creator (REV-PROF-21, Screen 1 e 2).
 *
 * La vetrina editoriale della realtà: tutti gli articoli pubblicati, qualunque
 * sia l'origine con cui sono stati creati, in una lista sola. Owner e Visitor
 * leggono gli stessi dati, con la stessa query e le stesse card: cambia solo
 * la presenza della CTA "Nuovo articolo", che è una capability e non una
 * modalità di rendering.
 *
 * I chip dei filtri arrivano dal backend — le categorie realmente presenti
 * fra gli articoli di questa realtà — e non da una lista scritta nel client.
 */
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { ProfileSectionError } from "../master/ProfileSectionBlock";
import type { MediaProfilePostTaggedTarget } from "../media-profile-post-service";
import { MediaArticleCard } from "./MediaArticleCard";
import type { MediaArticleViewModel } from "./media-article-view-model";

/** "Tutti" è sempre in prima posizione e non è una categoria. */
export const MEDIA_ARTICLE_FILTER_ALL = "all";

export type MediaArticlesTabProps = {
  articles: readonly MediaArticleViewModel[];
  /** Categoria attiva, oppure `MEDIA_ARTICLE_FILTER_ALL`. */
  activeCategory: string;
  canPublishArticle: boolean;
  /** Categorie configurate, nell'ordine deciso dal backend. */
  categories: readonly string[];
  entityName: string | null;
  errorMessage?: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isOwner: boolean;
  onCategoryChange: (category: string) => void;
  onLoadMore: () => void;
  onNewArticlePress?: () => void;
  onOpenArticle: (articleId: string) => void;
  onOpenTarget?: (target: MediaProfilePostTaggedTarget) => void;
  onRetry: () => void;
};

export function MediaArticlesTab({
  activeCategory,
  articles,
  canPublishArticle,
  categories,
  entityName,
  errorMessage,
  hasMore,
  isLoading,
  isLoadingMore,
  isOwner,
  onCategoryChange,
  onLoadMore,
  onNewArticlePress,
  onOpenArticle,
  onOpenTarget,
  onRetry,
}: MediaArticlesTabProps) {
  const filters = [MEDIA_ARTICLE_FILTER_ALL, ...categories];
  const isFiltered = activeCategory !== MEDIA_ARTICLE_FILTER_ALL;

  return (
    <View style={styles.root} testID="media-articles-tab">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="eyebrow">ARTICOLI</AppText>
          <AppText accessibilityRole="header" variant="titleMd">
            Ultimi articoli
          </AppText>
          {/*
            Il nome della realtà è interpolato solo quando c'è: senza nome
            editoriale la riga resta una descrizione, non "Notizie e
            approfondimenti di undefined".
          */}
          <AppText color="secondary" variant="bodySm">
            {entityName
              ? `Notizie e approfondimenti di ${entityName}.`
              : "Notizie e approfondimenti pubblicati da questa realtà."}
          </AppText>
        </View>

        {canPublishArticle && onNewArticlePress ? (
          <Button
            accessibilityLabel="Nuovo articolo"
            label="+ Nuovo articolo"
            onPress={onNewArticlePress}
            size="sm"
            testID="media-new-article-button"
            variant="chipAction"
          />
        ) : null}
      </View>

      {/*
        I chip restano visibili anche quando la categoria selezionata non ha
        più articoli: il filtro è configurato, e l'empty state filtrato dice
        che cosa fare.
      */}
      {categories.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.filterContent}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {filters.map((filter) => {
            const isActive = filter === activeCategory;
            const label =
              filter === MEDIA_ARTICLE_FILTER_ALL ? "Tutti" : filter;

            return (
              <Pressable
                accessibilityLabel={label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={filter}
                onPress={() => onCategoryChange(filter)}
                style={({ pressed }) => [
                  styles.chip,
                  isActive ? styles.chipActive : null,
                  pressed ? styles.pressed : null,
                ]}
                testID={`media-article-filter-${filter}`}
              >
                <AppText
                  color={isActive ? "inverse" : "primary"}
                  variant="chipLabel"
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {isLoading ? (
        <ArticleListSkeleton />
      ) : errorMessage ? (
        <View style={styles.state}>
          <ProfileSectionError
            message={errorMessage}
            onRetry={onRetry}
            testID="media-articles-error"
          />
        </View>
      ) : articles.length === 0 ? (
        <ArticlesEmptyState
          canPublishArticle={canPublishArticle}
          isFiltered={isFiltered}
          isOwner={isOwner}
          onNewArticlePress={onNewArticlePress}
          onShowAll={() => onCategoryChange(MEDIA_ARTICLE_FILTER_ALL)}
        />
      ) : (
        <View style={styles.list}>
          {articles.map((article) => (
            <MediaArticleCard
              article={article}
              key={article.id}
              onOpen={onOpenArticle}
              onOpenTarget={onOpenTarget}
            />
          ))}

          {hasMore ? (
            <Button
              accessibilityLabel="Mostra altri articoli"
              disabled={isLoadingMore}
              label={isLoadingMore ? "Caricamento…" : "Mostra altri"}
              onPress={onLoadMore}
              size="sm"
              testID="media-articles-load-more"
              variant="secondary"
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function ArticlesEmptyState({
  canPublishArticle,
  isFiltered,
  isOwner,
  onNewArticlePress,
  onShowAll,
}: {
  canPublishArticle: boolean;
  isFiltered: boolean;
  isOwner: boolean;
  onNewArticlePress?: () => void;
  onShowAll: () => void;
}) {
  if (isFiltered) {
    return (
      <View style={styles.empty} testID="media-articles-empty-filter">
        <AppText variant="titleSm">Nessun articolo in questa categoria</AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          Prova a selezionare un altro filtro.
        </AppText>
        <Button
          label="Mostra tutti"
          onPress={onShowAll}
          size="sm"
          variant="secondary"
        />
      </View>
    );
  }

  if (isOwner) {
    return (
      <View style={styles.empty} testID="media-articles-empty-owner">
        <AppText variant="titleSm">Pubblica il tuo primo articolo</AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          Condividi notizie e approfondimenti con la community.
        </AppText>
        {canPublishArticle && onNewArticlePress ? (
          <Button
            label="Nuovo articolo"
            onPress={onNewArticlePress}
            size="sm"
            testID="media-articles-empty-cta"
            variant="primary"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.empty} testID="media-articles-empty-visitor">
      <AppText variant="titleSm">Nessun articolo</AppText>
      <AppText align="center" color="secondary" variant="bodySm">
        Questo profilo non ha ancora pubblicato articoli.
      </AppText>
    </View>
  );
}

const SKELETON_CARDS = [0, 1, 2];

/** Celle della stessa misura delle card: nessun salto all'arrivo dei dati. */
function ArticleListSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Caricamento degli articoli in corso"
      accessibilityRole="progressbar"
      style={styles.list}
      testID="media-articles-skeleton"
    >
      {SKELETON_CARDS.map((card) => (
        <View key={card} style={styles.skeletonCard}>
          <View style={styles.skeletonThumbnail} />
          <View style={styles.skeletonText}>
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    // 44 pt di area toccabile con il padding verticale del contenitore.
    minHeight: 32,
    paddingHorizontal: spacing[14],
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  empty: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[32],
  },
  filterContent: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[6],
  },
  filterScroll: {
    flexGrow: 0,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  headerText: {
    flexShrink: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  list: {
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  pressed: {
    opacity: 0.7,
  },
  root: {
    gap: spacing[6],
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  skeletonLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[4],
    height: 12,
  },
  skeletonLineShort: {
    width: 80,
  },
  skeletonText: {
    flex: 1,
    gap: spacing[8],
  },
  skeletonThumbnail: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    height: 84,
    width: 84,
  },
  state: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
});
