import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Skeleton } from "../../../ui";

/**
 * Stati globali della Dashboard (DAS-REV-02 §13, §19, §20).
 *
 * Quattro superfici distinte che il codice precedente confondeva in una sola:
 * la Dashboard personale mostrava "Nessuna notifica" anche quando la query
 * falliva, cioè presentava un errore come un empty. Qui ogni stato ha un
 * componente, un'icona e una copy propri — e nessuno dei quattro può essere
 * raggiunto per caso, perché la condizione che li sceglie vive in
 * `state/dashboard-state.ts`.
 */

/**
 * Scheletro del primo caricamento (master 03).
 *
 * Placeholder **generico**: prima di conoscere eligibility e composizione non
 * si possono disegnare gli skeleton dei moduli reali — sarebbe
 * un'anticipazione visiva di un permesso non ancora verificato. Niente nomi
 * di modulo, conteggi, avatar dimostrativi o testo di dominio.
 *
 * `accessibilityElementsHidden` + `importantForAccessibility` tengono i
 * placeholder **fuori** dalla sequenza dei contenuti: §32 chiede che lo
 * skeleton non diventi una lista di elementi annunciabili, e che il
 * caricamento sia comunicato una volta sola.
 */
export function DashboardSkeleton() {
  return (
    <View
      accessibilityElementsHidden
      accessibilityLabel="Caricamento della Dashboard"
      accessibilityRole="progressbar"
      importantForAccessibility="no-hide-descendants"
      style={styles.block}
    >
      <Skeleton.Row style={styles.skeletonSummary} />

      <View style={styles.sectionGap}>
        <Skeleton.Row style={styles.skeletonSectionTitle} />
        <Skeleton.Row style={styles.skeletonRow} />
        <Skeleton.Row style={styles.skeletonRow} />
        <Skeleton.Row style={styles.skeletonRow} />
      </View>

      <View style={styles.sectionGap}>
        <Skeleton.Row style={styles.skeletonSectionTitle} />
        <Skeleton.Row style={styles.skeletonRow} />
        <Skeleton.Row style={styles.skeletonRow} />
      </View>
    </View>
  );
}

type GlobalStateProps = {
  actionLabel: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  onAction: () => void;
  title: string;
  /** Pastiglia rossa sull'icona: identifica un guasto reale, non allarma. */
  showFaultBadge?: boolean;
};

/**
 * Superficie comune ai master 07 e 08.
 *
 * Errore generale, offline senza dati ed empty reale condividono geometria,
 * tipografia e posizione del pulsante: cambiano icona e copy. Tre componenti
 * separati produrrebbero tre spaziature leggermente diverse per tre stati
 * che l'utente vede come "la stessa pagina in una condizione diversa".
 */
function DashboardGlobalState({
  actionLabel,
  body,
  icon,
  onAction,
  showFaultBadge = false,
  title,
}: GlobalStateProps) {
  return (
    <View style={styles.centered}>
      <View style={styles.globalIcon}>
        <Ionicons color={colors.textMuted} name={icon} size={56} />
        {showFaultBadge ? (
          <View style={styles.faultBadge}>
            <Ionicons color={colors.surface} name="alert" size={12} />
          </View>
        ) : null}
      </View>

      <AppText accessibilityRole="header" style={styles.centeredText} variant="headingMd">
        {title}
      </AppText>

      <AppText color="secondary" style={styles.centeredText} variant="bodyLg">
        {body}
      </AppText>

      <Button
        label={actionLabel}
        onPress={onAction}
        size="md"
        style={styles.globalAction}
        variant="primary"
      />
    </View>
  );
}

/**
 * Errore generale (master 07): nessuna Dashboard sufficientemente affidabile
 * da mostrare.
 *
 * Header, identità legittimamente nota e bottom navigation restano sopra —
 * li disegna la Foundation. Qui non compaiono riepiloghi fittizi, contatori a
 * zero o CTA di creazione: dipenderebbero da dati che non sono stati
 * caricati.
 *
 * Il "Riprova" è una **lettura**: rivaluta accesso, composizione, priorità e
 * dati. Non ripubblica contenuti, non invia messaggi, non tocca candidature.
 */
export function DashboardGlobalError({
  body = "Riprova tra poco.",
  onRetry,
  title = "Non riusciamo a caricare la Dashboard",
}: {
  /** Copy contestuale: il dettaglio Squadra nomina la squadra, non la Dashboard. */
  body?: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <DashboardGlobalState
      actionLabel="Riprova"
      body={body}
      icon="cloud-offline-outline"
      onAction={onRetry}
      showFaultBadge
      title={title}
    />
  );
}

/**
 * Offline senza dati utilizzabili (§19).
 *
 * Stesso pattern del Global Error, copy diversa: questo stato **non** si
 * chiama "nessuna attività". Se la rete è ancora assente il tap non deve
 * innescare un ciclo di richieste — la Foundation aggiorna lo stato di
 * connessione e mantiene il feedback coerente.
 */
export function DashboardGlobalOffline({ onRetry }: { onRetry: () => void }) {
  return (
    <DashboardGlobalState
      actionLabel="Riprova"
      body="Connettiti a Internet per caricare la tua Dashboard."
      icon="cloud-offline-outline"
      onAction={onRetry}
      title="Sei offline"
    />
  );
}

export type DashboardEmptyCopy = {
  actionLabel: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
};

/**
 * Empty reale (master 08): risposte valide, nessuna attività da mostrare.
 *
 * La CTA è opzionale: §20 vieta il pulsante disabled che pubblicizza un
 * permesso mancante. Se non esiste una prossima azione utile e consentita,
 * lo stato resta senza pulsante — ed è valido così.
 */
export function DashboardGlobalEmpty({
  copy,
  onAction,
}: {
  copy: DashboardEmptyCopy;
  onAction: (() => void) | null;
}) {
  if (!onAction) {
    return (
      <View style={styles.centered}>
        <View style={styles.globalIcon}>
          <Ionicons color={colors.textMuted} name={copy.icon} size={56} />
        </View>

        <AppText accessibilityRole="header" style={styles.centeredText} variant="headingMd">
          {copy.title}
        </AppText>

        <AppText color="secondary" style={styles.centeredText} variant="bodyLg">
          {copy.body}
        </AppText>
      </View>
    );
  }

  return (
    <DashboardGlobalState
      actionLabel={copy.actionLabel}
      body={copy.body}
      icon={copy.icon}
      onAction={onAction}
      title={copy.title}
    />
  );
}

/**
 * Nessuna identità operativa disponibile (DAS-REV-01 §13).
 *
 * Il copy non è tecnico: l'actor non deve dedurre di aver perso un permesso
 * da un messaggio di sistema.
 */
export function DashboardNoIdentity() {
  return (
    <View style={styles.centered}>
      <AppText color="secondary" style={styles.centeredText} variant="bodyLg">
        Non hai attività da gestire al momento.
      </AppText>
    </View>
  );
}

/** Empty di modulo: risposta valida, nessuna attività. */
export function DashboardModuleEmpty({ message }: { message: string }) {
  return (
    <View style={styles.emptyBox}>
      <AppText color="secondary" variant="bodyLg">
        {message}
      </AppText>
    </View>
  );
}

/**
 * Indicatore offline con dati ancora utilizzabili (master 05).
 *
 * Compatto e **sotto il contesto**, non un overlay: §27 vieta di disabilitare
 * la Dashboard. Riepilogo, priorità, azioni e candidature restano leggibili
 * con i normali colori; sono le singole CTA a comportarsi secondo la loro
 * capacità effettiva.
 */
export function DashboardOfflineNotice() {
  return (
    <View
      accessibilityLabel="Sei offline. I dati mostrati non sono aggiornati."
      accessibilityRole="alert"
      style={styles.offlineNotice}
    >
      <Ionicons
        color={colors.textSecondary}
        name="cloud-offline-outline"
        size={16}
      />
      <AppText color="secondary" numberOfLines={2} style={styles.offlineText} variant="meta">
        Sei offline · Dati non aggiornati
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[20],
  },
  sectionGap: {
    gap: spacing[10],
  },
  skeletonSummary: {
    borderRadius: radius[12],
    height: 76,
    marginBottom: 0,
  },
  skeletonSectionTitle: {
    height: 20,
    marginBottom: 0,
    width: "46%",
  },
  skeletonRow: {
    borderRadius: radius[12],
    height: 56,
    marginBottom: 0,
  },
  centered: {
    alignItems: "center",
    gap: spacing[10],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[40],
  },
  centeredText: {
    textAlign: "center",
  },
  globalIcon: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[6],
  },
  faultBadge: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    bottom: 2,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 18,
  },
  globalAction: {
    marginTop: spacing[10],
    minWidth: 160,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    padding: spacing[14],
  },
  offlineNotice: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  offlineText: {
    flexShrink: 1,
  },
});
