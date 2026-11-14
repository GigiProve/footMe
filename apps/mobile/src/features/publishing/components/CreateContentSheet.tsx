/**
 * Foglio «Crea contenuto» del «+» (HOM-06.2 §4–§10; mockup 1).
 *
 * Righe semplici, NON tre grandi card (§10): icona circolare, titolo, nota, freccia.
 *  • sopra il divisore le creazioni: Post «Testo, foto e video», Articolo «Crea un
 *    contenuto editoriale» solo con `can_publish_article` (§8);
 *  • sotto, «Bozze e programmati» solo con `can_view_drafts`, indipendente
 *    dall'Articolo (§9) — un Calciatore che pubblica solo Post ci arriva comunque;
 *  • «Posizione aperta» per il club_admin: azione reale che il vecchio menu già
 *    offriva (§4), non una voce di mockup.
 *
 * Quali righe esistono lo decide `launcherRows` (pura, testata); qui solo il
 * disegno. Un solo accent (§244): l'icona non cambia colore per identità (§245).
 * Il tocco minimo è 44pt (§255) e i testi vanno a capo con i font grandi (§250).
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, sizes, spacing } from "../../../styles";
import { AppText, BottomSheet } from "../../../ui";
import type { LauncherRowId } from "../publishing-presentation";

type RowCopy = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string };

const ROWS: Record<Exclude<LauncherRowId, "drafts">, RowCopy> = {
  article: { icon: "document-text-outline", subtitle: "Crea un contenuto editoriale", title: "Articolo" },
  open_position: { icon: "briefcase-outline", subtitle: "Pubblica una ricerca", title: "Posizione aperta" },
  post: { icon: "create-outline", subtitle: "Testo, foto e video", title: "Post" },
};

type Props = {
  visible: boolean;
  rows: { primary: LauncherRowId[]; secondary: LauncherRowId[] };
  /** «I tuoi contenuti salvati», o «1 pubblicazione non riuscita» (`draftsEntrySubtitle`). */
  draftsSubtitle: string;
  onClose: () => void;
  onSelect: (row: LauncherRowId) => void;
};

function LauncherRow({ copy, onPress, testID }: { copy: RowCopy; onPress: () => void; testID: string }) {
  return (
    <Pressable
      accessibilityLabel={`${copy.title}. ${copy.subtitle}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View style={styles.iconCircle}>
        <Ionicons color={colors.accent} name={copy.icon} size={20} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="titleSm">{copy.title}</AppText>
        <AppText color="secondary" variant="bodySm">
          {copy.subtitle}
        </AppText>
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

export function CreateContentSheet({ visible, rows, draftsSubtitle, onClose, onSelect }: Props) {
  const copyFor = (row: LauncherRowId): RowCopy =>
    row === "drafts"
      ? { icon: "folder-open-outline", subtitle: draftsSubtitle, title: "Bozze e programmati" }
      : ROWS[row];

  const renderRow = (row: LauncherRowId) => (
    <LauncherRow copy={copyFor(row)} key={row} onPress={() => onSelect(row)} testID={`launcher-row-${row}`} />
  );

  return (
    <BottomSheet onClose={onClose} title="Crea contenuto" visible={visible}>
      <View>
        {rows.primary.map(renderRow)}
        {rows.primary.length > 0 && rows.secondary.length > 0 ? <View style={styles.divider} /> : null}
        {rows.secondary.map(renderRow)}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing[4],
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[14],
    minHeight: sizes.touchTarget + spacing[12],
    paddingVertical: spacing[10],
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
});
