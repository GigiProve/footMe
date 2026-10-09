/**
 * Disponibilità reale delle destinazioni della Dashboard.
 *
 * §4 della task: «Se una funzione di destinazione è già disponibile, integra
 * il percorso reale. Se è prevista ma non implementata, registra il blocco e
 * il pack responsabile, implementa il contratto di integrazione e mantieni la
 * funzione non disponibile nella composizione di produzione tramite
 * configurazione.»
 *
 * Questo file è quella configurazione. Un modulo con `available: false` non
 * viene composto in produzione: non diventa una CTA morta, una schermata
 * "Prossimamente" o un dato finto. Il contratto esiste già (tipi, adapter,
 * colonne nella RPC), così il pack competente deve solo invertire il flag.
 *
 * Ogni voce falsa dichiara **perché** è falsa e **chi** la risolve: un flag
 * senza quelle due informazioni diventa debito invisibile.
 */

export type DashboardFeatureKey =
  | "personal_applications"
  | "personal_availability"
  | "personal_saved_positions"
  | "society_applications"
  | "society_content_create"
  | "society_drafts"
  | "society_invites"
  | "society_positions"
  | "society_recent_content"
  | "society_scheduled_content"
  | "society_teams";

type FeatureConfig = {
  available: boolean;
  /** Perché non è disponibile, e quale pack la rende tale. Vuoto se available. */
  blockedReason?: string;
  owner?: string;
};

export const DASHBOARD_FEATURES: Record<DashboardFeatureKey, FeatureConfig> = {
  // ── Disponibili: la destinazione esiste e funziona oggi ────────────────
  personal_applications: { available: true },
  personal_saved_positions: { available: true },
  personal_availability: { available: true },
  society_positions: { available: true },
  society_applications: { available: true },
  society_teams: { available: true },
  society_drafts: { available: true },
  society_recent_content: { available: true },
  society_content_create: { available: true },

  // ── Non disponibili: contratto pronto, dominio assente ─────────────────
  society_scheduled_content: {
    available: false,
    blockedReason:
      "club_media_posts.status ammette solo draft/published/archived: non " +
      "esiste uno stato 'scheduled' né un istante di pubblicazione futura. " +
      "La colonna scheduled_count della RPC resta null finché non esiste.",
    owner: "Pack editoriale Società (HOM)",
  },
  society_invites: {
    available: false,
    blockedReason:
      "Il flusso Inviti canonico della Società vive in /club-admin/invites ed " +
      "è gated su role === 'club_admin', non su capability. Esporlo come " +
      "azione rapida con capability invites_create aprirebbe una destinazione " +
      "che rifiuta un membro autorizzato.",
    owner: "DAS-REV — pack Inviti",
  },
};

export function isFeatureAvailable(key: DashboardFeatureKey): boolean {
  return DASHBOARD_FEATURES[key]?.available ?? false;
}

/** Elenco dei blocchi attivi, per la diagnostica e la consegna del pack. */
export function listBlockedFeatures(): {
  key: DashboardFeatureKey;
  owner: string;
  reason: string;
}[] {
  return (
    Object.entries(DASHBOARD_FEATURES) as [DashboardFeatureKey, FeatureConfig][]
  )
    .filter(([, config]) => !config.available)
    .map(([key, config]) => ({
      key,
      owner: config.owner ?? "non assegnato",
      reason: config.blockedReason ?? "non documentato",
    }));
}
