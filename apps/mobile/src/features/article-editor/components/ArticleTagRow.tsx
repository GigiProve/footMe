/**
 * Riga «Tagga persone o società ›» dell'Articolo e foglio di selezione (HOM-06.2
 * §56–§58, §251; mockup 2–3). Il selettore è `TagPeopleSheet` di HOM-06.1: nessun
 * secondo selector (§57). Con dei tag la riga mostra quanti sono e sotto compare la
 * sintesi «Con Marco Bianchi e AC Como» (`ComposerTagSummary`), tappabile per
 * riaprire il foglio.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../styles";
import { AppText } from "../../../ui";
import { ComposerTagSummary } from "../../post-composer/components/ComposerTagSummary";
import { TagPeopleSheet } from "../../post-composer/components/TagPeopleSheet";
import { tagSummary } from "../../post-composer/composer-presentation";
import type { ArticleTags } from "../use-article-tags";

export function ArticleTagRow({ tags, disabled = false }: { tags: ArticleTags; disabled?: boolean }) {
  const summary = tagSummary(tags.tagged);

  return (
    <View>
      <Pressable
        accessibilityHint="Scegli persone o società da taggare"
        accessibilityLabel={tags.tagged.length > 0 ? `Tagga persone o società, ${tags.tagged.length} selezionate` : "Tagga persone o società"}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={tags.openSheet}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID="article-tag-row"
      >
        <Ionicons color={colors.textPrimary} name="person-add-outline" size={20} />
        <AppText style={styles.label} variant="bodySm">
          Tagga persone o società
        </AppText>
        {tags.tagged.length > 0 ? (
          <AppText color="secondary" variant="numeric">
            {tags.tagged.length}
          </AppText>
        ) : null}
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      </Pressable>

      {summary ? (
        <ComposerTagSummary
          highlightedNames={tags.tagged.slice(0, 2).map((identity) => identity.displayName)}
          onPress={tags.openSheet}
          text={summary}
        />
      ) : null}

      <TagPeopleSheet {...tags.sheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flex: 1,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
});
