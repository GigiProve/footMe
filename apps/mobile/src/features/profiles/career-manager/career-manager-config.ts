/**
 * Configurazione del modulo "Gestisci carriera" (REV-PROF-07).
 *
 * Allenatore e Staff tecnico non sono due gestioni carriera: sono la stessa
 * macchina — hub, tipo di esperienza, stagioni, ruolo per stagione, riepilogo,
 * percorsi aggiuntivi — su tabelle diverse e con copy diversa. Quello che
 * cambia davvero è poco e sta tutto qui: le parole, la tassonomia dei ruoli,
 * quali percorsi aggiuntivi esistono e dove finiscono le scritture.
 *
 * Tenere la configurazione separata dal comportamento è ciò che impedisce alla
 * terza carriera di diventare una terza architettura.
 */
import type { ProfileAnalyticsEvent } from "../profile-analytics";

/**
 * Corsia di carriera dentro la sessione di gestione.
 *
 * `primary` è la carriera del profilo (Allenatore per l'Allenatore, Staff
 * tecnico per lo Staff, dirigenziale per il Dirigente); le altre sono percorsi
 * aggiuntivi. Le assegnazioni non si distinguono per ruolo testuale ma per
 * corsia, che è l'identificativo canonico del tipo carriera: è la corsia a
 * decidere dove finiscono le scritture, quindi un'esperienza da allenatore non
 * può finire nella carriera dirigenziale neanche se ne condividesse il ruolo.
 *
 * L'elenco cresce con i ruoli che hanno un percorso aggiuntivo, non con le
 * schermate: `staff` e `other` sono arrivati con il Dirigente (REV-PROF-10) e
 * non hanno aggiunto nessun passo al flusso.
 */
export type CareerLane = "primary" | "coach" | "staff" | "other" | "player";

/** Corsie che usano le schermate ad assegnazione (tutte tranne il Calciatore). */
export type AssignmentLane = Exclude<CareerLane, "player">;

/** Corsie ad assegnazione dei soli percorsi aggiuntivi. */
export type AdditionalAssignmentLane = Exclude<AssignmentLane, "primary">;

export type CareerPathKey = Exclude<CareerLane, "primary">;

export type CareerManagerCopy = {
  /** Eyebrow della seconda sezione dell'hub. */
  additionalEyebrow: string;
  /** App bar dell'hub. */
  hubTitle: string;
  /** Eyebrow della prima sezione dell'hub. */
  primaryEyebrow: string;
  primaryEmptyTitle: string;
  primaryEmptyText: string;
  /** App bar della scelta del tipo di esperienza della carriera principale. */
  typeSelectorTitle: string;
  /** Sottotitolo del riepilogo. */
  summarySubtitle: string;
  /** Riquadro informativo del periodo personalizzato. */
  periodHelpMessage: string;
  /** Sottotitolo della card "Periodo personalizzato". */
  customPeriodSubtitle: string;
  /**
   * Descrizione della schermata "Percorsi aggiuntivi". Senza, viene composta
   * dall'eyebrow della carriera principale.
   */
  additionalDescription?: string;
  /**
   * Il campo società si chiama "Squadra" per chi allena e "Società / Club" per
   * chi dirige: è la stessa entità, con il nome che quel ruolo le dà.
   */
  teamLabel?: string;
  teamPlaceholder?: string;
  /**
   * Rende modificabile la descrizione facoltativa dell'esperienza nelle
   * schermate a singola assegnazione. Spenta dove il flusso approvato non la
   * chiede: il dato resta comunque preservato.
   */
  showDescription?: boolean;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
};

/** Copy di un percorso aggiuntivo, nell'hub e nella schermata dedicata. */
export type CareerPathCopy = {
  /** App bar del sotto-flusso. */
  appBarTitle: string;
  emptyCtaLabel: string;
  emptyText: string;
  emptyTitle: string;
  /** Icona Ionicons della riga. */
  icon:
    | "person-outline"
    | "walk-outline"
    | "clipboard-outline"
    | "search-outline"
    | "ellipsis-horizontal-outline";
  key: CareerPathKey;
  /** Sottotitolo del riepilogo del percorso. */
  summarySubtitle?: string;
  /** App bar della scelta del tipo di esperienza dentro il percorso. */
  typeSelectorTitle?: string;
  /** Titolo della riga nell'hub e nella schermata Percorsi aggiuntivi. */
  title: string;
};

/** Eventi di un singolo percorso aggiuntivo. */
export type CareerPathEvents = {
  /** Tap su "Aggiungi esperienza" dentro il percorso. */
  addTapped?: ProfileAnalyticsEvent;
  /** Apertura del percorso dall'hub o da "Percorsi aggiuntivi". */
  opened: ProfileAnalyticsEvent;
};

/**
 * Eventi tracciati dal modulo. Nomi espliciti e non composti a runtime: la
 * tassonomia degli eventi resta leggibile in un solo posto e il payload non
 * può accogliere per distrazione una società o un ruolo.
 */
export type CareerManagerEvents = {
  addTapped: ProfileAnalyticsEvent;
  cancelled: ProfileAnalyticsEvent;
  completed: ProfileAnalyticsEvent;
  deleteFailed: ProfileAnalyticsEvent;
  experienceDeleted: ProfileAnalyticsEvent;
  experienceEdited: ProfileAnalyticsEvent;
  experienceSaved: ProfileAnalyticsEvent;
  groupDeleted: ProfileAnalyticsEvent;
  groupEdited: ProfileAnalyticsEvent;
  loadFailed: ProfileAnalyticsEvent;
  opened: ProfileAnalyticsEvent;
  /**
   * Eventi dei percorsi aggiuntivi, uno per corsia. Una mappa invece di una
   * coppia di campi per percorso: il Dirigente ne ha quattro e comporre i nomi
   * a runtime renderebbe la tassonomia illeggibile.
   */
  pathEvents: Partial<Record<CareerPathKey, CareerPathEvents>>;
  /** Apertura della schermata "Percorsi aggiuntivi". Assente per l'Allenatore. */
  pathsOpened?: ProfileAnalyticsEvent;
  saveFailed: ProfileAnalyticsEvent;
  seasonRolesOpened: ProfileAnalyticsEvent;
  typeSelected: ProfileAnalyticsEvent;
  unsavedExit: ProfileAnalyticsEvent;
};

export const CAREER_MANAGER_MESSAGES = {
  deleteError: "Non è stato possibile eliminare. Riprova.",
  duplicate: "Questa esperienza è già presente.",
  genericError: "Non è stato possibile completare l'operazione. Riprova.",
  saveError: "Non è stato possibile salvare. Riprova.",
} as const;

/** "1 esperienza aggiunta" / "3 esperienze aggiunte" / nessuna. */
export function formatPathSummary(count: number): string {
  if (count === 0) {
    return "Nessuna esperienza aggiunta";
  }

  return count === 1 ? "1 esperienza aggiunta" : `${count} esperienze aggiunte`;
}
