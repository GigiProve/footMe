/**
 * Primo passo di Segnala: la scelta della categoria (HOM-11 §80–§90, §205–§206, §212–§215,
 * mockup 5).
 *
 * Titolo «Perché vuoi segnalare questo contenuto?» (o «…questo commento?», §81),
 * sottotitolo di riservatezza e una lista verticale SEMPLICE: righe aperte con hairline
 * `divider` e chevron, non card (§82, §212–§213). Le categorie sono quelle del server
 * (§83): nessuna etichetta, nessun id o enum a schermo (§86), nessuna icona per riga —
 * richiederebbe di conoscere gli id che il client non possiede. Tap = categoria scelta e
 * passo successivo; con una categoria semplice non c'è nessuna schermata in mezzo (§90).
 *
 * Righe da 44pt minimi, testo che va a capo con font grandi (§205–§206). Il rosso qui
 * non c'è: il flow è calmo (§214–§215).
 */

import { useEffect } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import {
  REPORT_CATEGORIES_ERROR,
  REPORT_PRIVACY_NOTICE,
  REPORT_RETRY,
  REPORT_SUBMIT_ERROR,
  reportCopy,
} from "../moderation-presentation";
import type { ReportCategory, ReportPhase, ReportTargetType } from "../moderation-types";

type ReportCategoryStepProps = {
  targetType: ReportTargetType;
  status: "loading" | "error" | "ready";
  categories: readonly ReportCategory[];
  /**
   * `error` anche qui: con `invalid_category` il flow torna alla scelta (le categorie erano
   * vecchie) e l'errore generico deve restare visibile e annunciato (§156, §204).
   */
  phase: ReportPhase;
  onSelect: (category: ReportCategory) => void;
  onRetry: () => void;
};

export function ReportCategoryStep({
  categories,
  onRetry,
  onSelect,
  phase,
  status,
  targetType,
}: ReportCategoryStepProps) {
  const hasError = phase === "error";

  useEffect(() => {
    if (hasError) {
      AccessibilityInfo.announceForAccessibility(REPORT_SUBMIT_ERROR);
    }
  }, [hasError]);

  return (
    <ScrollView contentContainerStyle={styles.content} testID="report-category-step">
      <View style={styles.intro}>
        <AppText accessibilityRole="header" align="center" variant="headingMd">
          {reportCopy(targetType).title}
        </AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          {REPORT_PRIVACY_NOTICE}
        </AppText>
      </View>

      {hasError ? (
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          align="center"
          color="danger"
          variant="bodySm"
        >
          {REPORT_SUBMIT_ERROR}
        </AppText>
      ) : null}

      {status === "loading" ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : status === "error" ? (
        <View style={styles.state}>
          <AppText align="center" color="secondary" variant="bodySm">
            {REPORT_CATEGORIES_ERROR}
          </AppText>
          <Pressable
            accessibilityLabel={REPORT_RETRY}
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.retry}
          >
            <AppText color="accent" variant="actionLabel">
              {REPORT_RETRY}
            </AppText>
          </Pressable>
        </View>
      ) : (
        <View accessibilityRole="list">
          {categories.map((category, index) => (
            <Pressable
              accessibilityLabel={category.label}
              accessibilityRole="button"
              key={category.categoryId}
              onPress={() => onSelect(category)}
              style={({ pressed }) => [
                styles.row,
                index > 0 ? styles.rowDivider : null,
                pressed ? styles.pressed : null,
              ]}
              testID={`report-category-${category.categoryId}`}
            >
              <View style={styles.rowText}>
                <AppText variant="bodyLg">{category.label}</AppText>
                {category.description ? (
                  <AppText color="secondary" variant="caption">
                    {category.description}
                  </AppText>
                ) : null}
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[20],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  intro: {
    gap: spacing[8],
    paddingHorizontal: spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
  retry: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  rowDivider: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
  state: {
    alignItems: "center",
    gap: spacing[8],
    paddingVertical: spacing[24],
  },
});
