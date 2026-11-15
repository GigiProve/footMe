/**
 * Il flow Segnala a schermo intero (HOM-11 §79–§122, D7, mockup 5–7).
 *
 * Una route fuori dalle tab (`/report/[targetType]/[id]`), senza bottom navigation né
 * chrome Home: la segnalazione richiede deliberazione (§211). Header «Segnala
 * contenuto» con × al primo passo e ← al secondo (§80, §93); sotto, uno solo fra
 *  • la scelta della categoria (`ReportCategoryStep`, Screen 5),
 *  • sottocategoria e dettagli (`ReportDetailsStep`, Screen 6),
 *  • uno stato terminale (`ReportTerminalState`, Screen 7): inviata, già segnalato,
 *    non più disponibile.
 *
 * Il passo si ricava dalla bozza (categoria scelta → dettagli), non da uno stato locale:
 * «Modifica» e la freccia tornano alla scelta senza perdere ciò che si è scritto
 * (§98). «Fine» e × tornano all'origine nello stack — tab, scroll e thread intatti
 * (§116–§119) — e solo senza stack alla Home (D7): mai «Torna al Feed» forzato (§116).
 *
 * Una route con parametri non validi non chiede una categoria per un target che non
 * esiste: mostra «non più disponibile» (§159–§160).
 */

import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { HOME_HREF } from "../../feed/content-routes";
import { REPORT_HEADER_TITLE, isTerminalPhase } from "../moderation-presentation";
import type { ReportTarget } from "../moderation-types";
import { useReportFlow } from "../use-report-flow";
import { ReportCategoryStep } from "./ReportCategoryStep";
import { ReportDetailsStep } from "./ReportDetailsStep";
import { ReportTerminalState } from "./ReportTerminalState";

/** D7: «Fine» = torna all'origine; senza stack (deep link) si costruisce la Home. */
function useReportExit() {
  const router = useRouter();

  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(HOME_HREF as never);
    }
  };
}

function ReportHeader({ onBack, onClose }: { onBack: (() => void) | null; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={onBack ? "Indietro" : "Chiudi"}
        accessibilityRole="button"
        onPress={onBack ?? onClose}
        style={styles.headerButton}
        testID={onBack ? "report-back" : "report-close"}
      >
        <Ionicons color={colors.textPrimary} name={onBack ? "arrow-back" : "close"} size={24} />
      </Pressable>
      <AppText accessibilityRole="header" align="center" style={styles.headerTitle} variant="titleMd">
        {REPORT_HEADER_TITLE}
      </AppText>
      <View style={styles.headerButton} />
    </View>
  );
}

function ReportFlow({ target }: { target: ReportTarget }) {
  const exit = useReportExit();
  const flow = useReportFlow(target);

  if (isTerminalPhase(flow.phase)) {
    return <ReportTerminalState onDone={exit} phase={flow.phase} targetType={target.targetType} />;
  }

  return (
    <>
      <ReportHeader
        onBack={flow.step === "details" ? flow.actions.clearCategory : null}
        onClose={exit}
      />

      {flow.step === "details" && flow.selectedCategory ? (
        <ReportDetailsStep
          canSubmit={flow.canSubmit}
          category={flow.selectedCategory}
          draft={flow.draft}
          onChangeDetails={flow.actions.setDetails}
          onEditCategory={flow.actions.clearCategory}
          onSelectSubcategory={flow.actions.chooseSubcategory}
          onSubmit={() => void flow.actions.submit()}
          phase={flow.phase}
          showDetails={flow.showDetails}
          showSubcategories={flow.showSubcategories}
          subcategories={flow.subcategories}
        />
      ) : (
        <ReportCategoryStep
          categories={flow.rootCategories}
          onRetry={flow.actions.retryCategories}
          onSelect={flow.actions.chooseCategory}
          phase={flow.phase}
          status={flow.categoriesStatus}
          targetType={target.targetType}
        />
      )}
    </>
  );
}

export function ReportFlowScreen({ target }: { target: ReportTarget | null }) {
  const exit = useReportExit();

  return (
    <SafeAreaView style={styles.root} testID="report-screen">
      <Stack.Screen options={{ headerShown: false }} />
      {target ? (
        <ReportFlow target={target} />
      ) : (
        <ReportTerminalState onDone={exit} phase="unavailable" targetType="CONTENT" />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
    paddingTop: spacing[8],
  },
  headerButton: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  headerTitle: {
    flex: 1,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
