/**
 * Corpo dell'Articolo (HOM-06.2 §41–§44, §63–§71, §242–§243, §251; mockup 2–3).
 *
 * L'elemento principale della schermata, non una textarea in una card (§42): righe
 * di testo sul fondo bianco, senza bordi, con la formattazione visibile mentre si
 * scrive. Le righe sono quelle dello store (`EditorLine`); i rich link sono blocchi
 * con la X (§71). Il tocco sotto l'ultima riga porta il cursore alla fine, così il
 * corpo si può continuare a scrivere anche dopo un rich link.
 *
 * Placeholder «Inizia a scrivere…» (§41) solo sulla prima riga di un corpo vuoto.
 */

import { Pressable, StyleSheet, View } from "react-native";

import { spacing } from "../../../styles";
import { isTextLine, removeLine } from "../article-document";
import { articleStore } from "../article-store";
import type { EditorLine } from "../article-types";
import type { BlockEditing } from "../use-block-editing";
import { EditorRichLink } from "./EditorRichLink";
import { RichLineInput } from "./RichLineInput";

export const ARTICLE_BODY_PLACEHOLDER = "Inizia a scrivere…";

type Props = {
  lines: EditorLine[];
  editing: BlockEditing;
  editable: boolean;
};

export function ArticleBlockEditor({ lines, editing, editable }: Props) {
  const onlyEmptyLine = lines.length === 1 && isTextLine(lines[0]) && lines[0].text.length === 0;

  return (
    <View accessibilityLabel="Corpo dell'articolo" style={styles.body} testID="article-body">
      {lines.map((line, index) =>
        line.kind === "rich_link" ? (
          <EditorRichLink
            key={line.id}
            line={line}
            onRemove={() => articleStore.dispatch({ lines: removeLine(articleStore.getState().lines, line.id), type: "linesChanged" })}
          />
        ) : (
          <RichLineInput
            editable={editable}
            focusRequest={editing.focusRequest}
            key={line.id}
            line={line}
            onBackspaceAtStart={editing.handlers.onBackspaceAtStart}
            onBlur={editing.handlers.onBlur}
            onChangeText={editing.handlers.onChangeText}
            onFocus={editing.handlers.onFocus}
            onFocusRequestHandled={editing.clearFocusRequest}
            onSelection={editing.handlers.onSelection}
            ordinal={line.kind === "numbered" ? editing.orderedIndexOf(line.id) : null}
            placeholder={onlyEmptyLine && index === 0 ? ARTICLE_BODY_PLACEHOLDER : undefined}
          />
        ),
      )}
      {editable ? <Pressable accessible={false} onPress={editing.focusLast} style={styles.tail} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  tail: {
    minHeight: 96,
  },
});
