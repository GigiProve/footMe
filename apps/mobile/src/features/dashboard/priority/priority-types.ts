/**
 * Registro delle priorità operative (DAS-REV-02 §7).
 *
 * Un tipo di priorità è una **regola dichiarata**, non un messaggio: dice da
 * quale dominio nasce, chi è autorizzato a vederla, come si aggrega, quale
 * modulo promuove, se richiede un'azione, quanto pesa e — soprattutto — a
 * quale condizione canonica si considera risolta.
 *
 * Il testo visualizzato è derivato, mai la chiave: cinque candidature che
 * diventano due restano **la stessa priorità** perché la chiave nasce da
 * causa + identità + raggruppamento di dominio (§9).
 */

import type { DashboardCapability } from "../dashboard-types";
import type { DashboardFeatureKey } from "../modules/dashboard-features";
import type { DashboardModuleId } from "../modules/module-registry";

/**
 * Versione delle regole di ranking e aggregazione.
 *
 * Entra nella chiave di cache delle priorità (§14): una cache scritta con
 * regole diverse non è confrontabile con l'ordine che questa build calcola.
 * Va incrementata quando cambiano comparatore, livelli o impatti.
 */
export const PRIORITY_RULES_VERSION = 1;

/**
 * Livelli interni. **Non compaiono nella UI** (§8): non esiste un badge
 * "critical", e il colore non è mai l'unico segnale di stato.
 *
 * `critical` esiste nel tipo ma nessuna regola lo assegna: §8 vieta di
 * introdurlo senza un caso di dominio che lo giustifichi.
 */
export const PRIORITY_LEVELS = [
  "normal",
  "relevant",
  "attention",
  "critical",
] as const;

export type DashboardPriorityLevel = (typeof PRIORITY_LEVELS)[number];

/** Rango numerico del livello: più alto = più in cima. */
export const PRIORITY_LEVEL_RANK: Record<DashboardPriorityLevel, number> = {
  normal: 0,
  relevant: 1,
  attention: 2,
  critical: 3,
};

/**
 * Natura della priorità. A parità di livello un'azione precede
 * un'informazione (§8, criterio 2).
 */
export type PriorityNature = "action" | "info";

/**
 * Come si risolve. Ogni voce è **verificabile sul dominio** (§10): non
 * esiste una X universale né un "Completato" che tocchi solo la Dashboard.
 */
export type PriorityResolutionRule =
  /** Il conteggio canonico "da gestire" scende a zero. */
  | "canonical_count_zero"
  /** Il dominio conferma una transizione che elimina il fallimento. */
  | "domain_transition"
  /** Il dominio conferma il completamento dei requisiti effettivi. */
  | "domain_requirements_met"
  /** Acknowledgement esplicito, solo per i tipi che lo prevedono. */
  | "acknowledgement";

/**
 * Trattamento della scadenza (§8).
 *
 * `none` significa che il tipo **non ha** scadenze: una scadenza assente non
 * deve mai sembrare imminente, quindi non viene inventata.
 */
export type PriorityDeadlinePolicy = "none" | "real";

/** Che cosa apre la CTA. La destinazione è canonica, mai una lista Dashboard. */
export type PriorityTargetKind =
  | "position"
  | "content"
  | "profile_section";

/**
 * Metadati specifici del tipo, trasportati dal segnale senza entrare nel
 * contratto comune (DAS-REV-03 §21: «Le preview utilizzano ID canonici e soli
 * metadati necessari»).
 *
 * Qui non c'è testo precotto: il backend manda ruolo, società e squadra, il
 * client compone la riga con le stesse tabelle di localizzazione usate
 * altrove. `requirements` è l'elenco dei requisiti obbligatori mancanti, che
 * §13 chiede di far confluire in un solo elemento.
 */
export type PrioritySignalPayload = {
  adTitle?: string | null;
  clubName?: string | null;
  /** Fuso in cui il cutoff è espresso. Serve al dettaglio, non alla row. */
  deadlineTimezone?: string | null;
  /** Hub di modifica del ruolo, destinazione di più requisiti aggregati. */
  hubHref?: string | null;
  requirements?: { description: string; href: string; key: string }[];
  role?: string | null;
  teamName?: string | null;
};

export type DashboardPriorityTypeId =
  | "new_applications"
  | "publication_failed"
  | "saved_deadline"
  | "profile_requirements_missing";

/**
 * Segnale operativo normalizzato, così come arriva dall'adapter.
 *
 * È il contratto fra backend e client: il backend calcola eligibility,
 * conteggi e ranking; il client applica l'ordine e disegna (§8).
 */
export type PrioritySignal = {
  /**
   * Chiave di aggregazione stabile. Deriva da causa + identità + gruppo di
   * dominio — **mai** dal testo o dal conteggio (§9).
   */
  aggregationKey: string;
  /** Contesto localizzabile: "Attaccante · Prima squadra". Mai testo precotto. */
  contextLabel: string | null;
  /** Conteggio canonico ancora da gestire, dopo dedup server-side. */
  count: number;
  /** Scadenza reale del dominio. `null` = questo elemento non ne ha. */
  deadlineAt: string | null;
  /** Override di impatto deciso dal dominio; altrimenti vale quello del tipo. */
  impact: number | null;
  /** Istante dell'evento operativo reale, per la recency (§8). */
  occurredAt: string;
  /** Metadati del tipo, opzionali: i tipi Società non ne hanno bisogno. */
  payload?: PrioritySignalPayload;
  /** Revisione del dato: protegge da risposte obsolete (§10). */
  revision: number;
  targetId: string;
  targetKind: PriorityTargetKind;
  typeId: DashboardPriorityTypeId;
};

export type PriorityTypeDefinition = {
  /** Verbo specifico della CTA: "Valuta candidature", non "Apri". */
  actionLabel: string;
  /** Capability necessarie per vedere **e** per agire sulla destinazione. */
  capabilities: readonly DashboardCapability[];
  deadlinePolicy: PriorityDeadlinePolicy;
  /** Disponibilità reale della destinazione: senza, il tipo non è composto. */
  feature: DashboardFeatureKey;
  id: DashboardPriorityTypeId;
  /** Peso operativo 0–100, spareggio dopo livello e natura. */
  impact: number;
  level: DashboardPriorityLevel;
  /** Modulo promosso quando questa priorità vince. `null` = nessuna promozione. */
  moduleId: DashboardModuleId | null;
  nature: PriorityNature;
  /**
   * Trattamento dentro "Da gestire" (DAS-REV-03 §16).
   *
   * `card` è la superficie leggera con icona della Foundation. `row` è il
   * gruppo compatto con divider fra gli elementi che §16 chiede per le
   * scadenze: «Il link è leggero, non un grande pulsante.» Due scadenze non
   * devono diventare due cartelli.
   */
  presentation: "card" | "row";
  resolution: PriorityResolutionRule;
  /** Dominio di origine, per la diagnostica e per la copertura dei test. */
  source: string;
  /** Destinazione canonica dell'azione. */
  targetHref: (signal: PrioritySignal) => string;
  /** Titolo localizzato, al plurale corretto per il conteggio. */
  title: (signal: PrioritySignal) => string;
};

/** Priorità risolta e pronta per la presentazione. */
export type ResolvedPriority = {
  actionLabel: string;
  contextLabel: string | null;
  definition: PriorityTypeDefinition;
  href: string;
  key: string;
  signal: PrioritySignal;
  title: string;
};

/**
 * Esito del ranking. `totalEligible` si calcola **dopo** eligibility e
 * deduplicazione e **prima** del limite visuale (§9): è la ragione per cui
 * non si può presentare "3" come totale quando le priorità autorizzate sono
 * otto.
 */
export type PriorityRankingResult = {
  /** Modulo promosso, se un segnale lo giustifica. Al massimo uno (§11). */
  promotedModuleId: DashboardModuleId | null;
  /** Chiave della priorità che ha causato la promozione, per la diagnostica. */
  promotionReasonKey: string | null;
  /** Numero di priorità nascoste dal limite visuale, non risolte. */
  hiddenByLimit: number;
  totalEligible: number;
  visible: ResolvedPriority[];
};
