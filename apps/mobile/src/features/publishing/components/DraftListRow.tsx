/**
 * Riga di «Bozze e programmati» (HOM-06.2 §140–§145, §156–§160, §191–§195; mockup 6–8).
 *
 * Una riga per Post e per Articolo, stessa struttura:
 *   miniatura o tessera neutra · titolo (2 righe) · autore + check standard ·
 *   «Post · Modificato 12 min fa» · •••
 *  • Programmati: la data futura sta a destra, in blu e in Mulish (numeri, §157:
 *    più evidente dell'ultima modifica, che qui non c'è);
 *  • fallito (§191–§195): stato LEGGERO — icona e testo «Pubblicazione non riuscita»,
 *    nessuna area rossa (§193) — l'helper e le azioni in linea Riprova · Modifica ·
 *    Sposta nelle bozze (§195). Il contenuto non si perde mai (§198);
 *  • titoli di ripiego umani (§143–§145), mai id o null: lo decide `draftRowTitle`.
 *
 * Accessibilità (§254): la riga è UN'unità con etichetta coerente
 * (`draftRowAccessibilityLabel`) e l'azione «Altre azioni» come accessibility action;
 * le azioni in linea del fallito restano bottoni veri, fuori dall'unità. Bersagli
 * ≥ 44pt (§255), testi che vanno a capo con i font grandi (§250).
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, sizes, spacing } from "../../../styles";
import { AppText, Button, VerifiedCheck } from "../../../ui";
import {
  draftRowAccessibilityLabel,
  draftRowTitle,
  draftTypeLabel,
  editedAgoLabel,
  formatScheduleFull,
  formatScheduleStacked,
  itemMenu,
} from "../publishing-presentation";
import type { DraftListItem } from "../publishing-types";

export const FAILED_STATUS_COPY = "Pubblicazione non riuscita"; // §191
export const FAILED_HELPER_COPY = "Non è stato possibile pubblicare il contenuto programmato."; // §194

type Props = {
  item: DraftListItem;
  /** Un comando è in corso su questo elemento: nessun secondo comando (§263). */
  busy?: boolean;
  onOpen: () => void;
  onMenu: () => void;
  onRetry: () => void;
  onMoveToDraft: () => void;
};

function Thumbnail({ item }: { item: DraftListItem }) {
  if (item.thumbnailUrl) {
    return <Image accessibilityIgnoresInvertColors source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} />;
  }

  // Tessera neutra, senza illustrazione (§240): l'icona dice solo che tipo di contenuto è.
  return (
    <View style={[styles.thumbnail, styles.thumbnailNeutral]}>
      <Ionicons color={colors.textMuted} name={item.format === "article" ? "document-text-outline" : "create-outline"} size={22} />
    </View>
  );
}

export function DraftListRow({ item, busy = false, onOpen, onMenu, onRetry, onMoveToDraft }: Props) {
  const failed = item.status === "failed";
  const publishing = item.status === "publishing";
  const inDraftsTab = item.status === "draft";
  // §157: la data futura, più evidente di tutto il resto; per un fallito è nella riga di stato.
  const stacked = !inDraftsTab && !failed && item.scheduledAt ? formatScheduleStacked(item.scheduledAt) : null;
  const hasMenu = itemMenu(item).length > 0;
  const canOpen = item.canEdit && !publishing;
  const meta = inDraftsTab ? `${draftTypeLabel(item)} · ${editedAgoLabel(item.updatedAt)}` : draftTypeLabel(item);

  return (
    <View style={[styles.container, busy ? styles.busy : null]} testID={`draft-row-${item.ref.contentId}`}>
      <Pressable
        accessibilityActions={hasMenu ? [{ label: "Altre azioni", name: "more" }] : undefined}
        accessibilityLabel={draftRowAccessibilityLabel(item)}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: !canOpen }}
        disabled={!canOpen || busy}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "more") {
            onMenu();
          }
        }}
        onPress={onOpen}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      >
        <Thumbnail item={item} />

        <View style={styles.text}>
          <AppText numberOfLines={2} variant="titleSm">
            {draftRowTitle(item)}
          </AppText>
          <View style={styles.identityRow}>
            <AppText color="secondary" numberOfLines={1} style={styles.identityName} variant="bodySm">
              {item.identity.name}
            </AppText>
            {item.identity.isVerified ? <VerifiedCheck size={14} /> : null}
          </View>
          <AppText color="muted" variant="caption">
            {meta}
          </AppText>

          {failed ? (
            <View style={styles.statusRow}>
              <Ionicons color={colors.danger} name="alert-circle-outline" size={14} />
              <AppText color="danger" variant="caption">
                {FAILED_STATUS_COPY}
              </AppText>
            </View>
          ) : null}
          {publishing ? (
            <View style={styles.statusRow}>
              <Ionicons color={colors.textMuted} name="time-outline" size={14} />
              <AppText color="muted" variant="caption">
                Pubblicazione in corso
              </AppText>
            </View>
          ) : null}
          {failed && item.scheduledAt ? (
            <AppText color="muted" variant="caption">
              {formatScheduleFull(item.scheduledAt)}
            </AppText>
          ) : null}
        </View>

        <View style={styles.trailing}>
          {stacked ? (
            <View style={styles.date}>
              <AppText align="right" color="accent" variant="numeric">
                {stacked.day}
              </AppText>
              <AppText align="right" color="accent" variant="numeric">
                {stacked.time}
              </AppText>
            </View>
          ) : null}
          {hasMenu ? (
            <Pressable
              accessibilityLabel={`Altre azioni per ${draftRowTitle(item)}`}
              accessibilityRole="button"
              disabled={busy}
              hitSlop={4}
              onPress={onMenu}
              style={({ pressed }) => [styles.menu, pressed ? styles.pressed : null]}
              testID={`draft-menu-${item.ref.contentId}`}
            >
              <Ionicons color={colors.textPrimary} name="ellipsis-horizontal" size={20} />
            </Pressable>
          ) : null}
        </View>
      </Pressable>

      {failed ? (
        <View style={styles.failure}>
          <AppText color="secondary" variant="bodySm">
            {FAILED_HELPER_COPY}
          </AppText>
          <View style={styles.failureActions}>
            {item.canSchedule ? (
              <Button
                disabled={busy}
                label="Riprova"
                leftIcon={<Ionicons color={colors.accent} name="refresh" size={16} />}
                onPress={onRetry}
                size="lg"
                testID={`draft-retry-${item.ref.contentId}`}
                variant="outline"
              />
            ) : null}
            {item.canEdit ? (
              <>
                <Button
                  disabled={busy}
                  label="Modifica"
                  leftIcon={<Ionicons color={colors.textPrimary} name="create-outline" size={16} />}
                  onPress={onOpen}
                  size="lg"
                  testID={`draft-edit-${item.ref.contentId}`}
                  variant="outline"
                />
                <Button
                  disabled={busy}
                  label="Sposta nelle bozze"
                  onPress={onMoveToDraft}
                  size="lg"
                  testID={`draft-move-${item.ref.contentId}`}
                  variant="outline"
                />
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  busy: {
    opacity: 0.5,
  },
  container: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  date: {
    alignItems: "flex-end",
    gap: spacing[0],
  },
  failure: {
    gap: spacing[12],
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[16],
  },
  failureActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  identityName: {
    flexShrink: 1,
  },
  identityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  menu: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  row: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
  thumbnail: {
    borderRadius: radius[10],
    height: 56,
    width: 56,
  },
  thumbnailNeutral: {
    alignItems: "center",
    backgroundColor: colors.surfacePlaceholder,
    justifyContent: "center",
  },
  trailing: {
    alignItems: "flex-end",
    gap: spacing[4],
    justifyContent: "space-between",
  },
});
