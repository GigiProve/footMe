/**
 * Sheet «{Nome} è in shortlist» (DAS-REV-25 §11, screen 09).
 *
 * È ciò in cui `✓ In shortlist` si trasforma nel dettaglio candidatura: §11
 * — «Il controllo confermato resta neutro e diventa un accesso ad azioni …
 * Non annunciarlo come rimozione e non rimuovere al tap.»
 *
 * Mostra «priorità, soltanto se valorizzata e leggibile; stato corrente, se
 * leggibile; azioni autorizzate» — e nient'altro: «Non caricare l'intera
 * nota privata per riempire lo sheet», che infatti arriva da una lettura
 * senza nota, e «L'assenza di priorità non genera un warning o una
 * richiesta di completamento».
 *
 * Lo sfondo resta la candidatura: §11 — «Lo sfondo dello sheet è il
 * dettaglio candidatura, non Profilo in shortlist. Chiusura/X/back non
 * modificano dati.»
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet } from "../../../../ui";
import { SHORTLIST_COPY, evaluationLine } from "../shortlist-presentation";
import type { ShortlistEntryDetail } from "../shortlist-types";

type Props = {
  entry: ShortlistEntryDetail;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onSeeInShortlist: () => void;
  visible: boolean;
};

type ActionProps = {
  destructive?: boolean;
  label: string;
  onPress: () => void;
  testID: string;
};

function SheetAction({ destructive = false, label, onPress, testID }: ActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <AppText
        color={destructive ? "danger" : "neutral"}
        style={styles.actionLabel}
        variant="bodyLg"
      >
        {label}
      </AppText>

      {destructive ? null : (
        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      )}
    </Pressable>
  );
}

export function ShortlistEntrySheet({
  entry,
  onClose,
  onEdit,
  onRemove,
  onSeeInShortlist,
  visible,
}: Props) {
  const context = [entry.positionTitle, entry.scopeLabel]
    .filter((part): part is string => !!part && part.length > 0)
    .join(" · ");

  /* §17: «Modifica valutazione è disponibile quando almeno un campo del
     modulo è realmente scrivibile.» */
  const canEdit = entry.canEditStatus || entry.canEditNote;

  return (
    <BottomSheet
      onClose={onClose}
      title={`${entry.name} è in shortlist`}
      visible={visible}
    >
      <View style={styles.context}>
        {context ? (
          <AppText color="neutral" variant="bodySm">
            {context}
          </AppText>
        ) : null}

        {/* §11: priorità e stato soltanto se leggibili, senza warning
            quando la priorità manca. */}
        <AppText color="neutralMuted" variant="meta">
          {evaluationLine(entry)}
        </AppText>
      </View>

      <View style={styles.actions}>
        <SheetAction
          label={SHORTLIST_COPY.sheetSeeInShortlist}
          onPress={onSeeInShortlist}
          testID="shortlist-sheet-see"
        />

        {/* §11: «Mostra soltanto quelle effettivamente disponibili.» Non
            disabilitate: §8 — «Nascondi azioni non autorizzate». */}
        {canEdit ? (
          <SheetAction
            label={SHORTLIST_COPY.sheetEdit}
            onPress={onEdit}
            testID="shortlist-sheet-edit"
          />
        ) : null}

        {entry.canRemove ? (
          <SheetAction
            destructive
            label={SHORTLIST_COPY.sheetRemove}
            onPress={onRemove}
            testID="shortlist-sheet-remove"
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  context: {
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  actions: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing[8],
  },
  action: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  actionLabel: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
