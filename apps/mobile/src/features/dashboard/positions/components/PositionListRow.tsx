import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  POSITIONS_COPY,
  applicationsLabel,
  formatClosedLabel,
  formatDraftUpdatedLabel,
  positionContextLine,
  positionTitle,
  rowAccessibilityLabel,
} from "../positions-presentation";
import type { PositionGroup, PositionRow } from "../positions-types";

type Props = {
  countsFailed?: boolean;
  group: PositionGroup;
  now?: Date;
  onPress: () => void;
  onRetryCounts?: () => void;
  row: PositionRow;
  showDivider?: boolean;
};

/**
 * Riga del Centro (§11, §12, §13).
 *
 * Un solo bersaglio: «L'intera riga apre il dettaglio gestionale canonico
 * della Position. Il conteggio candidature è informativo; non creare un
 * secondo target sul numero che compete con il tap principale.» Il chevron
 * non ha handler proprio ed è escluso dall'accessibilità, così §30 è
 * rispettato — «Il chevron non genera un secondo focus identico alla riga».
 *
 * Nessun badge di stato: la tab comunica già il gruppo, e §6 vieta
 * esplicitamente «badge verde Aperta» e la ripetizione di «Pubblicata» su
 * ogni riga. Le sole label presenti sono quelle che la tab **non** implica —
 * squadra non attiva e scadenza superata.
 *
 * L'unica eccezione al bersaglio unico è il retry dell'aggregato: §10 chiede
 * di offrirlo «fuori dal normale target della riga se serve a evitare tap
 * concorrenti», e un errore di conteggio non deve impedire di aprire la
 * Position.
 */
export function PositionListRow({
  countsFailed = false,
  group,
  now,
  onPress,
  onRetryCounts,
  row,
  showDivider = false,
}: Props) {
  const title = positionTitle(row);
  const context = positionContextLine(row);
  const counts = applicationsLabel({
    available: row.countsAvailable,
    failed: countsFailed,
    group,
    newCount: row.applicationsNew,
    total: row.applicationsTotal,
  });

  /* Metadato della riga: ultima modifica sulle Bozze, data di chiusura sulle
     Chiuse. Le Attive non espongono scadenze (§11); la sola label ammessa è
     quella neutra della ricezione interrotta (§17). */
  const meta =
    group === "drafts"
      ? formatDraftUpdatedLabel(row.updatedAt, now)
      : group === "closed"
        ? formatClosedLabel(row.closedAt)
        : row.receivingClosed
          ? POSITIONS_COPY.deadlinePassed
          : null;

  const showInactive = row.teamIsInactive && group !== "active";
  const showCountsRetry = countsFailed && Boolean(onRetryCounts);

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      <Pressable
        accessibilityLabel={rowAccessibilityLabel({
          counts: showCountsRetry ? null : counts,
          group,
          meta,
          row,
          title,
        })}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID={`position-row-${row.id}`}
      >
        <View style={styles.body}>
          <AppText color="neutral" style={styles.title} variant="titleSm">
            {title}
          </AppText>

          {context ? (
            <AppText color="neutralMuted" variant="meta">
              {context}
            </AppText>
          ) : null}

          {counts && !showCountsRetry ? (
            <ApplicationsLine label={counts} />
          ) : null}

          {meta ? (
            <AppText color="neutralMuted" variant="meta">
              {meta}
            </AppText>
          ) : null}

          {showInactive ? (
            <AppText color="neutralMuted" variant="meta">
              {POSITIONS_COPY.inactiveTeam}
            </AppText>
          ) : null}
        </View>

        {/* Decorativo: la riga è già un pulsante annunciato (§30). */}
        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      </Pressable>

      {showCountsRetry ? (
        <Pressable
          accessibilityLabel={`${POSITIONS_COPY.countsUnavailable} ${POSITIONS_COPY.retry}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onRetryCounts}
          style={styles.countsRetry}
          testID={`position-counts-retry-${row.id}`}
        >
          <AppText color="neutralMuted" variant="meta">
            {POSITIONS_COPY.countsUnavailable}
          </AppText>
          <AppText color="accent" variant="meta">
            {POSITIONS_COPY.retry}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * «12 candidature · 3 nuove».
 *
 * §6: «Nuove candidature | Testo semibold discreto; nel master nero, senza
 * badge colorato.» Il grassetto cade sulla sola parte nuove, che è ciò che
 * il master evidenzia; il totale resta un metadato grigio.
 */
function ApplicationsLine({ label }: { label: string }) {
  const [total, fresh] = label.split(" · ");

  return (
    <View style={styles.counts}>
      <AppText color="neutralMuted" variant="meta">
        {total}
      </AppText>

      {fresh ? (
        <>
          <AppText color="neutralMuted" variant="meta">
            ·
          </AppText>
          <AppText color="neutral" style={styles.countsNew} variant="meta">
            {fresh}
          </AppText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.dividerNeutral,
    height: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[14],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  title: {
    fontWeight: "700",
  },
  counts: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[4],
  },
  countsNew: {
    fontWeight: "600",
  },
  countsRetry: {
    flexDirection: "row",
    gap: spacing[8],
    paddingBottom: spacing[10],
  },
  pressed: {
    opacity: 0.6,
  },
});
