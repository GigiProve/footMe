/**
 * «Incolla un articolo» (HOM-06.2 §7O–§7T): importa un testo scritto altrove nel
 * editor canonico, modalità IMPORTED_TEXT.
 */
import { useLocalSearchParams } from "expo-router";

import { ArticlePasteScreen } from "../../src/features/article-editor/components/ArticlePasteScreen";

export default function ArticleComposePasteRoute() {
  const search = useLocalSearchParams();

  return <ArticlePasteScreen search={search} />;
}
