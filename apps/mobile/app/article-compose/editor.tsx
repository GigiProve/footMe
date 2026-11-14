/**
 * Editor Articolo (HOM-06.2 §28–§45, §7E, §7T, §217–§218). Modalità NATIVE e
 * IMPORTED_TEXT; una bozza o un Articolo pubblicato si riapre con
 * `?draft_type=&draft_id=` (`articleDraftHref`, `articleEditHref`).
 */
import { useLocalSearchParams } from "expo-router";

import { ArticleEditorScreen } from "../../src/features/article-editor/components/ArticleEditorScreen";

export default function ArticleComposeEditorRoute() {
  const search = useLocalSearchParams();

  return <ArticleEditorScreen search={search} />;
}
