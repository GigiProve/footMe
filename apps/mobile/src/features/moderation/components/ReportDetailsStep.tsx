/**
 * Secondo passo di Segnala: sottocategoria e dettagli (HOM-11 §88–§97, §184, §202–§204,
 * §206, mockup 6).
 *
 * Mostra solo ciò che la categoria scelta richiede, senza schermate inutili (§90):
 *  • la categoria scelta con «Modifica» (torna alla scelta, il testo resta, §98);
 *  • «In cosa consiste il problema?» con le sottocategorie del server come radio — il
 *    `Radio` di sistema, che comunica lo stato selezionato in modo semantico (§202) —
 *    solo se la categoria la richiede (§88–§89);
 *  • «Aggiungi dettagli (facoltativo)» con contatore 0/500, solo se la categoria ammette
 *    testo libero (§91–§92); la label parlata è associata alla textarea (§203);
 *  • «Invia segnalazione»: disabilitata finché manca una selezione obbligatoria (§95),
 *    loading leggero NEL bottone, mai uno spinner a tutto schermo (§97), non risponde
 *    dopo il tap (§96).
 *
 * L'errore (§156) si annuncia (§204) e lascia tutto com'è (§157): il retry è la stessa
 * CTA, con la stessa chiave di idempotenza. Il rosso compare solo nel testo d'errore
 * (§214). La CTA sta dentro il form, così resta sopra la tastiera (`KeyboardAwareForm`).
 */

import { useEffect } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText, Button, Input, Radio } from "../../../ui";
import {
  REPORT_DETAILS_A11Y_LABEL,
  REPORT_DETAILS_LABEL,
  REPORT_DETAILS_MAX,
  REPORT_DETAILS_OPTIONAL,
  REPORT_DETAILS_PLACEHOLDER,
  REPORT_EDIT_CATEGORY,
  REPORT_SELECTED_CATEGORY_LABEL,
  REPORT_SUBCATEGORY_TITLE,
  REPORT_SUBMIT,
  REPORT_SUBMIT_ERROR,
  detailsCounter,
} from "../moderation-presentation";
import type { ReportCategory, ReportDraft, ReportPhase } from "../moderation-types";

type ReportDetailsStepProps = {
  category: ReportCategory;
  draft: ReportDraft;
  phase: ReportPhase;
  subcategories: readonly ReportCategory[];
  showSubcategories: boolean;
  showDetails: boolean;
  canSubmit: boolean;
  onEditCategory: () => void;
  onSelectSubcategory: (subcategory: ReportCategory) => void;
  onChangeDetails: (value: string) => void;
  onSubmit: () => void;
};

export function ReportDetailsStep({
  canSubmit,
  category,
  draft,
  onChangeDetails,
  onEditCategory,
  onSelectSubcategory,
  onSubmit,
  phase,
  showDetails,
  showSubcategories,
  subcategories,
}: ReportDetailsStepProps) {
  const hasError = phase === "error";

  // §204: l'errore si annuncia quando compare.
  useEffect(() => {
    if (hasError) {
      AccessibilityInfo.announceForAccessibility(REPORT_SUBMIT_ERROR);
    }
  }, [hasError]);

  return (
    <KeyboardAwareForm contentContainerStyle={styles.content} testID="report-details-step">
      <View style={styles.block}>
        <AppText color="secondary" variant="feedMeta">
          {REPORT_SELECTED_CATEGORY_LABEL}
        </AppText>
        <View style={styles.selected}>
          <AppText style={styles.selectedLabel} variant="bodyLg">
            {category.label}
          </AppText>
          <Pressable
            accessibilityLabel={`${REPORT_EDIT_CATEGORY} categoria`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onEditCategory}
            style={styles.edit}
            testID="report-edit-category"
          >
            <AppText color="accent" variant="actionLabel">
              {REPORT_EDIT_CATEGORY}
            </AppText>
          </Pressable>
        </View>
      </View>

      {showSubcategories ? (
        <View style={styles.block}>
          <AppText accessibilityRole="header" variant="titleMd">
            {REPORT_SUBCATEGORY_TITLE}
          </AppText>
          <View accessibilityRole="radiogroup">
            {subcategories.map((subcategory) => (
              <Radio
                checked={draft.subcategoryId === subcategory.categoryId}
                key={subcategory.categoryId}
                label={subcategory.label}
                onPress={() => onSelectSubcategory(subcategory)}
                testID={`report-subcategory-${subcategory.categoryId}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {showDetails ? (
        <View style={styles.block}>
          <View style={styles.detailsLabel}>
            <AppText variant="titleSm">{REPORT_DETAILS_LABEL}</AppText>
            <AppText color="secondary" variant="bodySm">
              {REPORT_DETAILS_OPTIONAL}
            </AppText>
          </View>
          <Input
            accessibilityLabel={REPORT_DETAILS_A11Y_LABEL}
            maxLength={REPORT_DETAILS_MAX}
            multiline
            onChangeText={onChangeDetails}
            placeholder={REPORT_DETAILS_PLACEHOLDER}
            style={styles.textarea}
            testID="report-details-input"
            value={draft.details}
          />
          <AppText align="right" color="muted" variant="caption">
            {detailsCounter(draft.details.length)}
          </AppText>
        </View>
      ) : null}

      {hasError ? (
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          color="danger"
          variant="bodySm"
        >
          {REPORT_SUBMIT_ERROR}
        </AppText>
      ) : null}

      <Button
        disabled={!canSubmit}
        fullWidth
        label={REPORT_SUBMIT}
        loading={phase === "submitting"}
        onPress={onSubmit}
        size="lg"
        testID="report-submit"
      />
    </KeyboardAwareForm>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[8],
  },
  content: {
    gap: spacing[24],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  detailsLabel: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
  },
  edit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[4],
  },
  selected: {
    alignItems: "center",
    backgroundColor: colors.inputBackground,
    borderRadius: radius[16],
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingLeft: spacing[16],
    paddingRight: spacing[12],
  },
  selectedLabel: {
    flex: 1,
  },
  textarea: {
    minHeight: sizes.multilineFieldMinHeight,
  },
});
