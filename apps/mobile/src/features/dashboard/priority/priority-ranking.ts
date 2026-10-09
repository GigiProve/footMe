/**
 * Ordinamento deterministico delle priorità (§8, §9).
 *
 * Funzioni pure: stesso input e stesso istante di valutazione producono
 * sempre lo stesso risultato, qualunque sia l'ordine di arrivo delle
 * risposte (QA-07). È la ragione per cui `now` è un parametro e non
 * `Date.now()` letto dentro il comparatore.
 *
 * Il client **applica** l'ordine, non ne calcola uno diverso: il backend
 * resta la fonte autorevole di eligibility e conteggi, qui si tiene solo la
 * comparazione stabile e il limite visuale.
 */

import { hasEveryCapability, type DashboardIdentity } from "../dashboard-types";
import { isFeatureAvailable } from "../modules/dashboard-features";
import type { DashboardModuleId } from "../modules/module-registry";
import { PRIORITY_REGISTRY } from "./priority-registry";
import {
  PRIORITY_LEVEL_RANK,
  type PriorityRankingResult,
  type PrioritySignal,
  type ResolvedPriority,
} from "./priority-types";

/** §9: «Mostrare al massimo tre priorità nella Dashboard principale.» */
export const MAX_VISIBLE_PRIORITIES = 3;

/**
 * Una scadenza assente non deve sembrare imminente (§8): sorta come
 * infinitamente lontana, quindi **dopo** qualunque scadenza reale, e mai
 * prima.
 */
function deadlineDistance(signal: PrioritySignal, now: number): number {
  if (!signal.deadlineAt) {
    return Number.POSITIVE_INFINITY;
  }

  const at = Date.parse(signal.deadlineAt);

  return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at - now;
}

function occurredAtMs(signal: PrioritySignal): number {
  const at = Date.parse(signal.occurredAt);

  // Una data illeggibile non diventa "adesso": finirebbe in cima. Diventa
  // l'evento più vecchio possibile, e lo spareggio finale sulla chiave
  // garantisce comunque un ordine stabile.
  return Number.isNaN(at) ? 0 : at;
}

/**
 * Precedenza V1, nell'ordine prescritto da §8:
 *
 *   1. livello operativo più alto;
 *   2. azione richiesta prima dell'informazione, a parità di livello;
 *   3. impatto operativo maggiore;
 *   4. prossimità di una scadenza reale, quando pertinente;
 *   5. recency dell'evento operativo;
 *   6. identificativo stabile come spareggio finale.
 */
export function comparePriorities(
  a: ResolvedPriority,
  b: ResolvedPriority,
  now: number,
): number {
  const levelDelta =
    PRIORITY_LEVEL_RANK[b.definition.level] -
    PRIORITY_LEVEL_RANK[a.definition.level];

  if (levelDelta !== 0) {
    return levelDelta;
  }

  const natureDelta =
    (b.definition.nature === "action" ? 1 : 0) -
    (a.definition.nature === "action" ? 1 : 0);

  if (natureDelta !== 0) {
    return natureDelta;
  }

  const impactDelta =
    (b.signal.impact ?? b.definition.impact) -
    (a.signal.impact ?? a.definition.impact);

  if (impactDelta !== 0) {
    return impactDelta;
  }

  const deadlineDelta =
    deadlineDistance(a.signal, now) - deadlineDistance(b.signal, now);

  // Due scadenze assenti danno Infinity - Infinity = NaN: il confronto è
  // indifferente e si passa al criterio successivo.
  if (deadlineDelta !== 0 && !Number.isNaN(deadlineDelta)) {
    return deadlineDelta;
  }

  const recencyDelta = occurredAtMs(b.signal) - occurredAtMs(a.signal);

  if (recencyDelta !== 0) {
    return recencyDelta;
  }

  return a.key.localeCompare(b.key);
}

/**
 * Deduplicazione cross-source (§9).
 *
 * Lo stesso evento consegnato da query, realtime e notifica di dominio non
 * deve incrementare due volte il conteggio: si tiene **una sola** occorrenza
 * per chiave, quella con la revisione più alta. I conteggi non si sommano
 * mai — il conteggio è già l'aggregato calcolato dalla fonte.
 */
export function dedupeSignals(signals: PrioritySignal[]): PrioritySignal[] {
  const byKey = new Map<string, PrioritySignal>();

  for (const signal of signals) {
    const existing = byKey.get(signal.aggregationKey);

    if (!existing || signal.revision > existing.revision) {
      byKey.set(signal.aggregationKey, signal);
    }
  }

  return [...byKey.values()];
}

/**
 * Eligibility **prima** del ranking (§6).
 *
 * È una seconda barriera, non la prima: il backend ha già filtrato. Serve
 * perché una cache scritta quando la capability esisteva non deve poter
 * rendere visibile una priorità dopo la revoca (§21).
 */
export function isPriorityEligible(
  signal: PrioritySignal,
  identity: DashboardIdentity | null,
): boolean {
  const definition = PRIORITY_REGISTRY[signal.typeId];

  if (!definition || !identity) {
    return false;
  }

  if (!isFeatureAvailable(definition.feature)) {
    return false;
  }

  if (signal.count <= 0) {
    return false;
  }

  return hasEveryCapability(identity, definition.capabilities);
}

function resolve(signal: PrioritySignal): ResolvedPriority {
  const definition = PRIORITY_REGISTRY[signal.typeId];

  return {
    actionLabel: definition.actionLabel,
    contextLabel: signal.contextLabel,
    definition,
    href: definition.targetHref(signal),
    key: signal.aggregationKey,
    signal,
    title: definition.title(signal),
  };
}

/**
 * Pipeline completa: eligibility → dedup → ordinamento → totale → limite.
 *
 * L'ordine dei passaggi è il requisito, non un dettaglio: §9 chiede che il
 * totale interno si calcoli **dopo** eligibility e deduplicazione e **prima**
 * del limite visuale, così "3 attività" non può essere presentato come
 * totale quando le priorità autorizzate sono otto.
 *
 * La promozione del modulo (§11) nasce qui perché deve usare lo stesso
 * vincitore del ranking: ricalcolarla altrove sarebbe un secondo algoritmo.
 */
export function rankPriorities(input: {
  eligibleModuleIds: readonly DashboardModuleId[];
  identity: DashboardIdentity | null;
  now: number;
  signals: PrioritySignal[];
}): PriorityRankingResult {
  const eligible = dedupeSignals(input.signals)
    .filter((signal) => isPriorityEligible(signal, input.identity))
    // Un tipo sconosciuto al client è già escluso da `isPriorityEligible`
    // (nessuna definizione): §7 chiede che venga omesso, non che rompa la
    // pagina.
    .map(resolve)
    .sort((a, b) => comparePriorities(a, b, input.now));

  const visible = eligible.slice(0, MAX_VISIBLE_PRIORITIES);

  // §11: zero oppure **un solo** modulo promosso. Vince il primo del ranking
  // che richiede un'azione, che dichiara un modulo e il cui modulo è
  // realmente nella composizione — promuovere un modulo assente sposterebbe
  // una sezione che non esiste.
  const promoter = visible.find(
    (priority) =>
      priority.definition.nature === "action" &&
      priority.definition.moduleId !== null &&
      input.eligibleModuleIds.includes(priority.definition.moduleId),
  );

  return {
    hiddenByLimit: eligible.length - visible.length,
    promotedModuleId: promoter?.definition.moduleId ?? null,
    promotionReasonKey: promoter?.key ?? null,
    totalEligible: eligible.length,
    visible,
  };
}
