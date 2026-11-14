/**
 * Una riga di testo dell'Articolo (HOM-06.2 §41–§44, §59–§60, §250, §254).
 *
 * Il corpo è una TextInput per riga. Grassetto, corsivo e link si vedono mentre si
 * scrive: la TextInput multilinea di React Native accetta come figli dei nodi
 * `Text` annidati (è il pattern di `react-native-controlled-mentions`) e, senza la
 * prop `value`, il testo mostrato è quello dei figli. Ogni tratto con la stessa
 * formattazione è un `AppText` annidato, così il carattere resta quello del design
 * system; la TextInput resta l'unico punto in cui il testo non è un semplice
 * `AppText`, come in `ComposerBodyInput`. `onChangeText` consegna il testo intero
 * e le operazioni sui marks stanno in `article-editing.ts`.
 *
 *  • Invio: la TextInput inserisce un «\n», che `applyChangeText` trasforma in una
 *    riga nuova (mai un a-capo dentro la riga);
 *  • Backspace con il cursore a zero: fusione con la riga precedente (§43). Dipende
 *    da `onKeyPress`, che su Android non arriva da tutte le tastiere;
 *  • elenco: il segno (• oppure «1.») è fuori dalla TextInput e nascosto agli
 *    screen reader, che leggono la voce con la sua posizione (§254);
 *  • Dynamic Type: `allowFontScaling` (§250).
 */

import { useEffect, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { colors, spacing, textVariants, typography, type TextVariant } from "../../../styles";
import { AppText } from "../../../ui";
import { lineSegments } from "../article-editing";
import type { TextLine, TextLineKind } from "../article-types";
import type { FocusRequest } from "../use-block-editing";

type Props = {
  line: TextLine;
  /** Posizione 1-based nella lista numerata; null fuori da una lista numerata. */
  ordinal: number | null;
  placeholder?: string;
  editable: boolean;
  focusRequest: FocusRequest | null;
  onFocusRequestHandled: () => void;
  onChangeText: (id: string, text: string) => void;
  onFocus: (id: string) => void;
  onBlur: (id: string) => void;
  onSelection: (id: string, selection: { start: number; end: number }) => void;
  onBackspaceAtStart: (id: string) => void;
};

const VARIANTS: Record<TextLineKind, TextVariant> = {
  bullet: "feedBody",
  heading: "headingSm",
  numbered: "feedBody",
  paragraph: "feedBody",
};

function accessibilityLabelFor(kind: TextLineKind, ordinal: number | null): string {
  switch (kind) {
    case "heading":
      return "Titolo di sezione";
    case "bullet":
      return "Voce dell'elenco puntato";
    case "numbered":
      return `Voce ${ordinal ?? 1} dell'elenco numerato`;
    default:
      return "Paragrafo";
  }
}

/** `setSelection` esiste sull'istanza nativa ma non in tutte le definizioni di tipo. */
function setCaret(input: TextInput | null, offset: number) {
  (input as unknown as { setSelection?: (start: number, end: number) => void } | null)?.setSelection?.(offset, offset);
}

export function RichLineInput({
  line,
  ordinal,
  placeholder,
  editable,
  focusRequest,
  onFocusRequestHandled,
  onChangeText,
  onFocus,
  onBlur,
  onSelection,
  onBackspaceAtStart,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const selection = useRef({ end: 0, start: 0 });
  const variant = VARIANTS[line.kind];

  useEffect(() => {
    if (!focusRequest || focusRequest.id !== line.id) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      setCaret(inputRef.current, focusRequest.offset);
      onFocusRequestHandled();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, line.id, onFocusRequestHandled]);

  const isList = line.kind === "bullet" || line.kind === "numbered";

  return (
    <View style={styles.row}>
      {isList ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.marker}>
          <AppText variant={variant}>{line.kind === "bullet" ? "•" : `${ordinal ?? 1}.`}</AppText>
        </View>
      ) : null}
      <TextInput
        accessibilityLabel={accessibilityLabelFor(line.kind, ordinal)}
        allowFontScaling
        autoCapitalize="sentences"
        editable={editable}
        multiline
        onBlur={() => onBlur(line.id)}
        onChangeText={(text) => onChangeText(line.id, text)}
        onFocus={() => onFocus(line.id)}
        onKeyPress={(event) => {
          if (event.nativeEvent.key === "Backspace" && selection.current.start === 0 && selection.current.end === 0) {
            onBackspaceAtStart(line.id);
          }
        }}
        onSelectionChange={(event) => {
          selection.current = event.nativeEvent.selection;
          onSelection(line.id, event.nativeEvent.selection);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        ref={inputRef}
        scrollEnabled={false}
        selectionColor={colors.accent}
        style={[styles.input, textVariants[variant]]}
        testID={`article-line-${line.id}`}
        textAlignVertical="top"
        underlineColorAndroid="transparent"
      >
        {lineSegments(line).map((segment, index) => (
          <AppText
            // Il tratto è identificato dalla posizione: il testo cambia a ogni tasto.
            key={index}
            style={[segment.bold ? styles.bold : null, segment.italic ? styles.italic : null, segment.link ? styles.link : null]}
            variant={variant}
          >
            {segment.text}
          </AppText>
        ))}
      </TextInput>
    </View>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: typography.fontWeight.bold,
  },
  input: {
    color: colors.textPrimary,
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: spacing[6],
  },
  italic: {
    fontStyle: "italic",
  },
  link: {
    color: colors.accent,
    textDecorationLine: "underline",
  },
  marker: {
    paddingRight: spacing[10],
    paddingVertical: spacing[6],
    width: spacing[28],
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
});
