/**
 * L'editor dei commenti: testo multilinea con mention `@` (HOM-08 §21–§27, §102–§109,
 * §149–§152).
 *
 * UN solo editor per il composer in fondo e per la modifica (§152: «nessun editor
 * separato»): chi lo monta gli passa testo, mention e `onChange`, e come figli la sua
 * barra di controlli (contatore, Pubblica / Salva).
 *
 *  • Solo testo ed emoji (§26–§27): nessun allegato, media, GIF, sondaggio. Le emoji si
 *    scrivono con la tastiera di sistema: nessun pulsante emoji, perché React Native non
 *    può aprirla da codice.
 *  • Mention (§102–§109): stesso motore del composer Post (`useMentionAutocomplete`,
 *    `applyMention`, `reconcileMentions`) e stessa lista di suggerimenti
 *    (`MentionSuggestions`): nessun search engine dei commenti (§104). Modificare il
 *    testo aggiorna o toglie le mention non più presenti (§109).
 *  • Le mention già inserite non sono evidenziate nell'input: un `TextInput` controllato
 *    non tollera figli stilizzati senza perdere il cursore; la resa accent appartiene al
 *    commento pubblicato (stessa scelta di HOM-06.1).
 *  • L'input cresce fino a un'altezza massima e poi scorre dentro di sé: il composer è
 *    sticky e non deve coprire la schermata (§19, §244).
 *  • Il tasto «@» inserisce il carattere in coda e apre i suggerimenti: è il modo
 *    esplicito di cercare una persona, accanto a digitare «@».
 */

import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing, textVariants } from "../../../theme/tokens";
import { MentionSuggestions } from "../../post-composer/components/MentionSuggestions";
import { applyMention, reconcileMentions } from "../../post-composer/composer-presentation";
import type { ComposerTaggedIdentity } from "../../post-composer/composer-types";
import { useMentionAutocomplete } from "../../post-composer/use-mention-autocomplete";
import { COMMENT_INPUT_LABEL, COMMENT_MENTION_BUTTON, COMMENT_PLACEHOLDER } from "../comment-labels";
import type { CommentMentionRef } from "../comment-types";

type CommentEditorProps = {
  value: string;
  mentions: CommentMentionRef[];
  onChange: (body: string, mentions: CommentMentionRef[]) => void;
  /** Limiti del server (A3): il testo non può superare `maxLength`. */
  maxLength: number;
  maxMentions: number;
  /** Per la cache della ricerca identità (per utente). */
  userId: string;
  onMentionAdded?: (identityType: "profile" | "club") => void;
  /** Perso il focus: il composer in fondo si richiude solo se non c'è niente da perdere (§18–§19). */
  onBlur?: () => void;
  autoFocus?: boolean;
  /** Cresce per chiedere il focus a un input già montato (es. «Rispondi»). */
  focusToken?: number;
  editable?: boolean;
  placeholder?: string;
  /** Più alto, per la modifica a schermo intero; il composer in fondo resta compatto (§19). */
  expanded?: boolean;
  /** Il suo riquadro: bordo e fondo li decide chi monta l'editor. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** La barra di controlli sotto l'input (contatore, Pubblica / Salva). */
  children?: ReactNode;
};

export function CommentEditor({
  value,
  mentions,
  onChange,
  maxLength,
  maxMentions,
  userId,
  onMentionAdded,
  onBlur,
  autoFocus = false,
  focusToken = 0,
  editable = true,
  placeholder = COMMENT_PLACEHOLDER,
  expanded = false,
  style,
  testID = "comment-editor-input",
  children,
}: CommentEditorProps) {
  const inputRef = useRef<TextInput>(null);
  const mention = useMentionAutocomplete({ body: value, mentions, userId });

  useEffect(() => {
    if (focusToken > 0) {
      inputRef.current?.focus();
    }
  }, [focusToken]);

  function handleChange(next: string) {
    onChange(next, reconcileMentions(value, next, mentions));
  }

  function handleSelect(candidate: ComposerTaggedIdentity) {
    const query = mention.query;

    if (!query || mentions.length >= maxMentions) {
      return;
    }

    const result = applyMention(value, mentions, query.range, {
      displayName: candidate.displayName,
      identityId: candidate.identityId,
      identityType: candidate.identityType,
    });

    if (result.body.length > maxLength) {
      return;
    }

    onChange(result.body, result.mentions);
    onMentionAdded?.(candidate.identityType);
  }

  function handleAt() {
    if (!editable || value.length >= maxLength) {
      return;
    }

    const needsSpace = value.length > 0 && !/\s$/.test(value);
    const next = `${value}${needsSpace ? " " : ""}@`;

    onChange(next, reconcileMentions(value, next, mentions));
    mention.setSelection({ end: next.length, start: next.length });
    inputRef.current?.focus();
  }

  return (
    <View style={style}>
      <TextInput
        accessibilityLabel={COMMENT_INPUT_LABEL}
        allowFontScaling
        autoCapitalize="sentences"
        autoFocus={autoFocus}
        editable={editable}
        maxLength={maxLength}
        multiline
        onBlur={onBlur}
        onChangeText={handleChange}
        onSelectionChange={(event) => mention.setSelection(event.nativeEvent.selection)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        ref={inputRef}
        selectionColor={colors.accent}
        style={[styles.input, expanded ? styles.inputExpanded : styles.inputCompact]}
        testID={testID}
        textAlignVertical="top"
        underlineColorAndroid="transparent"
        value={value}
      />

      <MentionSuggestions
        candidates={mention.candidates}
        loading={mention.loading}
        onSelect={handleSelect}
      />

      <View style={styles.controls}>
        <Pressable
          accessibilityLabel={COMMENT_MENTION_BUTTON}
          accessibilityRole="button"
          accessibilityState={{ disabled: !editable }}
          disabled={!editable}
          hitSlop={4}
          onPress={handleAt}
          style={({ pressed }) => [styles.at, pressed ? styles.pressed : null]}
          testID="comment-editor-mention"
        >
          <Ionicons color={colors.textSecondary} name="at" size={22} />
        </Pressable>
        <View style={styles.trailing}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  at: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  input: {
    ...textVariants.feedBody,
    color: colors.textPrimary,
    minHeight: 48,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[8],
  },
  // §19, §244: il composer sticky cresce fino a ~6 righe e poi scorre dentro di sé.
  inputCompact: {
    maxHeight: 132,
  },
  // Modifica a schermo intero (mockup 8): un'area ampia da scrivere.
  inputExpanded: {
    maxHeight: 280,
    minHeight: 160,
  },
  pressed: {
    opacity: 0.6,
  },
  trailing: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
});
