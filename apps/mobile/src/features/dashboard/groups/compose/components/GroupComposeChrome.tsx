/**
 * Cornice del wizard «Crea gruppo» (DAS-REV-32 §13; PNG 06-12): intestazione
 * con la Società sempre riconoscibile, avviso inline e footer sticky.
 *
 * §13: «La Società resta riconoscibile» e nessuna bottom navigation. Come nel
 * composer Posizioni, l'identità sta nella barra accanto al back, il titolo
 * funzionale centrato e «N di 3» sotto, come nel PNG. Il footer ha un'unica CTA primaria.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../../../ui";
import { GROUPS_COPY } from "../../groups-copy";
import type { ComposeSociety } from "../group-compose-model";

export type WizardStep = 1 | 2 | 3;

type HeaderProps = {
  onBack: () => void;
  society: ComposeSociety;
  step: WizardStep;
  title: string;
};

export function GroupComposeHeader({ onBack, society, step, title }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel={GROUPS_COPY.back}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
          testID="group-compose-back"
        >
          <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
        </Pressable>

        <Avatar name={society.name} size="sm" square tone="ink" uri={society.logoUrl ?? undefined} />

        <AppText color="neutral" numberOfLines={1} style={styles.societyName} variant="titleSm">
          {society.name}
        </AppText>

        {society.isVerified ? (
          <Ionicons
            accessibilityLabel={GROUPS_COPY.societyVerified}
            color={colors.accent}
            name="checkmark-circle"
            size={15}
          />
        ) : null}
      </View>

      <View style={styles.titleRow}>
        <AppText accessibilityRole="header" color="neutral" style={styles.title} variant="headingSm">
          {title}
        </AppText>
        <AppText accessibilityLiveRegion="polite" color="neutralMuted" testID="group-compose-step" variant="meta">
          {GROUPS_COPY.stepOf(step)}
        </AppText>
      </View>
    </View>
  );
}

type NoticeProps = {
  testID?: string;
  text: string;
  tone?: "error" | "info";
};

/** Avviso vicino al contenuto: errore rosso tenue con icona, o info neutra. */
export function GroupNotice({ testID, text, tone = "error" }: NoticeProps) {
  const isError = tone === "error";

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={isError ? "alert" : undefined}
      style={[styles.notice, isError ? styles.noticeError : styles.noticeInfo]}
      testID={testID}
    >
      <Ionicons
        color={isError ? colors.danger : colors.textNeutralMuted}
        name={isError ? "alert-circle-outline" : "time-outline"}
        size={18}
      />
      <AppText color={isError ? "danger" : "neutral"} style={styles.noticeText} variant="bodySm">
        {text}
      </AppText>
    </View>
  );
}

type FooterProps = {
  /** Contatore a sinistra (step 2): annunciato come regione live. */
  counter?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  testID?: string;
};

export function GroupComposeFooter({ counter, disabled = false, label, loading = false, onPress, testID }: FooterProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[12] }]}>
      {counter !== undefined ? (
        <View style={styles.footerRow}>
          <AppText
            accessibilityLiveRegion="polite"
            color="neutral"
            style={styles.counter}
            testID="group-compose-counter"
            variant="metaStrong"
          >
            {counter}
          </AppText>
          <View style={styles.action}>
            <Button disabled={disabled} fullWidth label={label} loading={loading} onPress={onPress} testID={testID} />
          </View>
        </View>
      ) : (
        <Button disabled={disabled} fullWidth label={label} loading={loading} onPress={onPress} testID={testID} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    minWidth: 150,
  },
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  counter: {
    flex: 1,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  header: {
    backgroundColor: colors.surface,
    gap: spacing[8],
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[20],
  },
  notice: {
    alignItems: "flex-start",
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[10],
    padding: spacing[12],
  },
  noticeError: {
    backgroundColor: colors.dangerSoft,
  },
  noticeInfo: {
    backgroundColor: colors.surfaceMuted,
  },
  noticeText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  societyName: {
    flexShrink: 1,
  },
  /* PNG 07-12: titolo funzionale centrato, «N di 3» subito sotto. */
  title: {
    textAlign: "center",
  },
  titleRow: {
    alignItems: "center",
    gap: spacing[4],
    paddingTop: spacing[4],
  },
});
