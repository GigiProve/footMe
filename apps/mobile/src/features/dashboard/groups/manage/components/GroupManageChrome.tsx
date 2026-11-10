/**
 * Cornice condivisa dei flussi di gestione Gruppi (DAS-REV-33 §6, §27;
 * PNG 01-21): barra con back e titolo, sheet di conferma e scheletri.
 *
 * §6: Info focalizzata, Persone, Aggiungi, successione e conferme non aggiungono
 * bottom navigation. Il titolo funzionale sta accanto al back come nel PNG.
 * Gli sheet di conferma hanno un solo trattamento: CTA primaria blu (Archivia,
 * Lascia) o rossa (Rimuovi, Elimina), eventuale alternativa, «Annulla».
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button, Skeleton } from "../../../../../ui";
import { GROUP_MANAGE_COPY } from "../../groups-copy";

type HeaderProps = {
  onBack: () => void;
  title: string;
  trailing?: ReactNode;
};

export function GroupManageHeader({ onBack, title, trailing }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={GROUP_MANAGE_COPY.back}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        testID="group-manage-back"
      >
        <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
      </Pressable>

      <AppText accessibilityRole="header" color="neutral" numberOfLines={1} style={styles.headerTitle} variant="headingSm">
        {title}
      </AppText>

      {trailing ?? null}
    </View>
  );
}

type ConfirmProps = {
  /** Alternativa sotto la primaria (Delete ACTIVE: «Archivia», §23). */
  alternative?: { label: string; onPress: () => void };
  /** Operazione in corso: loading sulla CTA, niente doppio invio né chiusura (§27). */
  busy: boolean;
  /** Errore contestuale: la conferma resta aperta, l'azione si può ripetere. */
  error?: string | null;
  message?: string;
  /** Seconda riga di spiegazione (uscita: «Se verrai aggiunto di nuovo…»). */
  note?: string;
  onCancel: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  primaryTone: "danger" | "primary";
  testID?: string;
  title: string;
  visible: boolean;
};

export function GroupConfirmSheet({
  alternative,
  busy,
  error,
  message,
  note,
  onCancel,
  onPrimary,
  primaryLabel,
  primaryTone,
  testID,
  title,
  visible,
}: ConfirmProps) {
  return (
    <BottomSheet onClose={busy ? noop : onCancel} visible={visible}>
      <View style={styles.sheetBody} testID={testID}>
        <AppText accessibilityRole="header" align="center" color="neutral" variant="titleMd">
          {title}
        </AppText>

        {message ? (
          <AppText align="center" color="neutralMuted" variant="bodySm">
            {note ? `${message} ${note}` : message}
          </AppText>
        ) : null}

        {error ? (
          <AppText accessibilityLiveRegion="polite" accessibilityRole="alert" align="center" color="danger" variant="bodySm">
            {error}
          </AppText>
        ) : null}

        <View style={styles.sheetActions}>
          {/* Rosso pieno solo per rimozione/eliminazione (§6): è `primary` con
              il trattamento distruttivo del design system; Archivia e Lascia
              restano blu. */}
          <Button
            destructive={primaryTone === "danger"}
            fullWidth
            label={primaryLabel}
            loading={busy}
            onPress={onPrimary}
            testID={testID ? `${testID}-primary` : undefined}
            variant="primary"
          />

          {alternative ? (
            <Button
              disabled={busy}
              fullWidth
              label={alternative.label}
              onPress={alternative.onPress}
              testID={testID ? `${testID}-alternative` : undefined}
              variant="neutralOutline"
            />
          ) : null}

          <Button
            disabled={busy}
            fullWidth
            label={GROUP_MANAGE_COPY.cancel}
            onPress={onCancel}
            testID={testID ? `${testID}-cancel` : undefined}
            variant="secondary"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

function noop() {}

/** Scheletro di Info: stessa geometria dell'intestazione, nessun dato o permesso anticipato (§27). */
export function GroupInfoSkeleton() {
  return (
    <View
      accessibilityElementsHidden
      accessibilityLabel={GROUP_MANAGE_COPY.loading}
      accessibilityRole="progressbar"
      importantForAccessibility="no-hide-descendants"
      style={styles.skeleton}
      testID="group-info-skeleton"
    >
      <View style={styles.skeletonHero}>
        <Skeleton.Circle style={styles.skeletonAvatar} />
        <View style={styles.skeletonHeroText}>
          <Skeleton.Row style={styles.skeletonLineLong} />
          <Skeleton.Row style={styles.skeletonLineShort} />
          <Skeleton.Row style={styles.skeletonLineShort} />
        </View>
      </View>
      <Skeleton.Row style={styles.skeletonRow} />
      <Skeleton.Row style={styles.skeletonRow} />
    </View>
  );
}

/** Scheletro di una lista di persone o di gruppi: righe con avatar. */
export function GroupRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View
      accessibilityElementsHidden
      accessibilityLabel={GROUP_MANAGE_COPY.loading}
      accessibilityRole="progressbar"
      importantForAccessibility="no-hide-descendants"
      style={styles.skeleton}
      testID="group-rows-skeleton"
    >
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonPerson}>
          <Skeleton.Circle style={styles.skeletonPersonAvatar} />
          <View style={styles.skeletonHeroText}>
            <Skeleton.Row style={styles.skeletonLineLong} />
            <Skeleton.Row style={styles.skeletonLineShort} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  header: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: spacing[4],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[20],
  },
  headerTitle: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  sheetActions: {
    gap: spacing[8],
    paddingTop: spacing[8],
  },
  sheetBody: {
    gap: spacing[8],
  },
  skeleton: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  skeletonAvatar: {
    height: 64,
    width: 64,
  },
  skeletonHero: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[16],
  },
  skeletonHeroText: {
    flex: 1,
    gap: spacing[6],
  },
  skeletonLineLong: {
    marginBottom: 0,
    width: "70%",
  },
  skeletonLineShort: {
    height: 12,
    marginBottom: 0,
    width: "45%",
  },
  skeletonPerson: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  skeletonPersonAvatar: {
    height: 44,
    width: 44,
  },
  skeletonRow: {
    height: 44,
    marginBottom: 0,
  },
});
