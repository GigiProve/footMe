/**
 * Selector unificato «Aggiungi a shortlist» (DAS-REV-26 §11, §12 —
 * screen 02, 13, 14).
 *
 * Due gruppi nella stessa superficie, in quest'ordine: Per posizione, poi
 * Liste personalizzate (§11). Ogni gruppo ha il proprio stato — caricamento,
 * errore, pagina successiva — perché «Un gruppo in errore non è un gruppo
 * vuoto» e «Il caricamento delle Position non deve rendere irraggiungibili
 * le CUSTOM o Crea nuova lista» (§12).
 *
 * Il tap su una riga avvia **un solo** add (§11): nessuna checkbox, nessuna
 * conferma generale, nessuna scelta preliminare del tipo.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Button, Skeleton } from "../../../../../ui";
import {
  PROFILE_SHORTLIST_COPY,
  destinationLines,
  selectorPresentation,
} from "../profile-shortlist-presentation";
import type { ProfileDestination } from "../profile-shortlist-types";
import { ShortlistFlowRow } from "./ShortlistFlowRow";

export type DestinationGroupView = {
  error: boolean;
  hasMore: boolean;
  items: ProfileDestination[];
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
};

type Props = {
  canCreate: boolean;
  custom: DestinationGroupView;
  onCreate: () => void;
  onPick: (row: ProfileDestination) => void;
  /** Chiave della riga con un add in corso: le altre restano tappabili. */
  pendingKey: string | null;
  position: DestinationGroupView;
};

export function destinationKey(row: ProfileDestination): string {
  return row.kind === "position" ? `p:${row.positionId}` : `c:${row.shortlistId}`;
}

function GroupSkeleton() {
  return (
    <View style={styles.skeleton}>
      <Skeleton.Row style={styles.skeletonTitle} />
      <Skeleton.Row style={styles.skeletonMeta} />
    </View>
  );
}

function GroupError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.groupError}>
      <AppText color="danger" variant="bodySm">
        {message}
      </AppText>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={onRetry}
        style={styles.inlineAction}
        testID="profile-shortlist-group-retry"
      >
        <AppText color="accent" variant="actionLabel">
          {PROFILE_SHORTLIST_COPY.retry}
        </AppText>
      </Pressable>
    </View>
  );
}

function CreateRow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.createRow, pressed ? styles.pressed : null]}
      testID="profile-shortlist-create"
    >
      <Ionicons color={colors.accent} name="add" size={18} />
      <AppText color="accent" variant="actionLabel">
        {PROFILE_SHORTLIST_COPY.createList}
      </AppText>
    </Pressable>
  );
}

function Rows({
  group,
  onPick,
  pendingKey,
}: {
  group: DestinationGroupView;
  onPick: (row: ProfileDestination) => void;
  pendingKey: string | null;
}) {
  return (
    <>
      {group.items.map((row) => {
        const lines = destinationLines(row);
        const key = destinationKey(row);

        return (
          <ShortlistFlowRow
            busy={pendingKey === key}
            disabled={pendingKey !== null && pendingKey !== key}
            key={key}
            lines={[lines.meta]}
            onPress={() => onPick(row)}
            testID={`profile-shortlist-dest-${key}`}
            title={lines.title}
          />
        );
      })}
      {group.hasMore ? (
        <Pressable
          accessibilityRole="button"
          disabled={group.loadingMore}
          onPress={group.onLoadMore}
          style={styles.inlineAction}
        >
          <AppText color="accent" variant="actionLabel">
            {group.loadingMore ? "Caricamento…" : "Mostra altre"}
          </AppText>
        </Pressable>
      ) : null}
    </>
  );
}

export function ProfileShortlistSelector({
  canCreate,
  custom,
  onCreate,
  onPick,
  pendingKey,
  position,
}: Props) {
  const mode = selectorPresentation({
    custom: { error: custom.error, items: custom.items.length, loading: custom.loading },
    position: { error: position.error, items: position.items.length, loading: position.loading },
  });

  if (mode === "totalError") {
    return (
      <View style={styles.center}>
        <AppText align="center" color="neutral" variant="bodyLg">
          {PROFILE_SHORTLIST_COPY.selectorError}
        </AppText>
        <Button
          label={PROFILE_SHORTLIST_COPY.retry}
          onPress={() => {
            position.onRetry();
            custom.onRetry();
          }}
          variant="secondary"
        />
      </View>
    );
  }

  if (mode === "empty") {
    /* Screen 13: «Non spiegare il vuoto con nomi o quantità di liste
       inaccessibili.» La CTA solo se utile e autorizzata; senza, il
       pannello resta chiudibile con la X. */
    return (
      <View style={styles.center} testID="profile-shortlist-empty">
        <Ionicons color={colors.textNeutralSoft} name="document-text-outline" size={44} />
        <AppText align="center" color="neutral" variant="titleSm">
          {PROFILE_SHORTLIST_COPY.emptyTitle}
        </AppText>
        <AppText align="center" color="neutralMuted" variant="bodySm">
          {PROFILE_SHORTLIST_COPY.emptyBody}
        </AppText>
        {canCreate ? (
          <Button
            fullWidth
            label={PROFILE_SHORTLIST_COPY.createList}
            onPress={onCreate}
            testID="profile-shortlist-empty-create"
            variant="primary"
          />
        ) : null}
      </View>
    );
  }

  /* §11: «Le sezioni vuote possono essere omesse quando l'altra contiene
     destinazioni.» Un gruppo in caricamento o in errore resta visibile. */
  const showPositions = position.loading || position.error || position.items.length > 0;
  const showCustom =
    custom.loading || custom.error || custom.items.length > 0 || canCreate;

  return (
    <View>
      {showPositions ? (
        <View style={styles.group}>
          <AppText color="neutral" style={styles.groupTitle} variant="titleSm">
            {PROFILE_SHORTLIST_COPY.positionsGroup}
          </AppText>
          {position.loading ? <GroupSkeleton /> : null}
          {position.error ? (
            <GroupError message={PROFILE_SHORTLIST_COPY.positionsError} onRetry={position.onRetry} />
          ) : null}
          {!position.loading && !position.error ? (
            <Rows group={position} onPick={onPick} pendingKey={pendingKey} />
          ) : null}
        </View>
      ) : null}

      {showCustom ? (
        <View style={styles.group}>
          <AppText color="neutral" style={styles.groupTitle} variant="titleSm">
            {PROFILE_SHORTLIST_COPY.customGroup}
          </AppText>
          {custom.loading ? <GroupSkeleton /> : null}
          {custom.error ? (
            <GroupError message={PROFILE_SHORTLIST_COPY.customError} onRetry={custom.onRetry} />
          ) : null}
          {!custom.loading && !custom.error ? (
            <Rows group={custom} onPick={onPick} pendingKey={pendingKey} />
          ) : null}
          {canCreate ? <CreateRow onPress={onCreate} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[24],
  },
  group: {
    paddingBottom: spacing[12],
  },
  groupTitle: {
    paddingBottom: spacing[4],
    paddingTop: spacing[8],
  },
  groupError: {
    gap: spacing[6],
    paddingVertical: spacing[8],
  },
  inlineAction: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  createRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget,
  },
  pressed: {
    opacity: 0.6,
  },
  skeleton: {
    paddingVertical: spacing[12],
  },
  skeletonTitle: {
    width: "70%",
  },
  skeletonMeta: {
    height: 12,
    width: "45%",
  },
});
