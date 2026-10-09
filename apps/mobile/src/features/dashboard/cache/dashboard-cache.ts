/**
 * Cache locale della Dashboard (§14).
 *
 * La chiave distingue **actor, identità, tipo di identità, contesto di
 * autorizzazione, versione di schema e versione delle regole**. Una cache
 * indistinta "dashboard" o "current society" è esattamente ciò che §14 vieta,
 * e il nome visualizzato non è una chiave: due Società omonime, o la stessa
 * Società dopo un restringimento di scope, non devono condividere un record.
 *
 * Il contesto di autorizzazione entra come **fingerprint delle capability**:
 * se lo scope si restringe, il fingerprint cambia e il record precedente non
 * viene più trovato — non viene "filtrato dopo", semplicemente non si legge.
 *
 * Template di scrittura: `features/feed/feed-cache.ts` — prefisso versionato,
 * type guard scritti a mano, ogni accesso in try/catch che ingoia l'errore.
 * La cache è best-effort: se AsyncStorage fallisce si carica da rete.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DashboardIdentity, DashboardIdentityKind } from "../dashboard-types";
import { PRIORITY_RULES_VERSION } from "../priority/priority-types";
import {
  evaluateFreshness,
  isBeyondRetention,
  isOrgAccessWindowValid,
  type FreshnessProvider,
  type FreshnessVerdict,
} from "./freshness-policy";

const PREFIX = "@prolink/dashboard/v1/";

/**
 * Versione dello schema del payload Dashboard. Va incrementata quando cambia
 * la forma di `SocietyOverview` o `PersonalDashboardData`: un record scritto
 * con uno schema diverso viene scartato, non migrato attribuendolo
 * all'identità attualmente selezionata (§34).
 */
export const DASHBOARD_CACHE_SCHEMA_VERSION = 1;

export type DashboardCacheRecord<TPayload> = {
  /** Istante dell'ultima verifica server-side riuscita di accesso e scope. */
  accessVerifiedAt: number;
  /** Capability ordinate e serializzate: è il contesto di autorizzazione. */
  capabilitiesFingerprint: string;
  fetchedAt: number;
  identityId: string;
  identityKind: DashboardIdentityKind;
  payload: TPayload;
  /** Revisione del dato, per scartare risposte obsolete (§22). */
  revision: number;
  rulesVersion: number;
  schemaVersion: number;
  version: 1;
};

/** Esito della lettura: dice **perché** un record non è utilizzabile. */
export type CacheReadResult<TPayload> =
  | { reason: "miss"; status: "unusable" }
  | { reason: "incompatible"; status: "unusable" }
  | { reason: "expired"; status: "unusable" }
  | { reason: "access_window_expired"; status: "unusable" }
  | { freshness: FreshnessVerdict; record: DashboardCacheRecord<TPayload>; status: "usable" };

/**
 * Fingerprint del contesto di autorizzazione.
 *
 * Ordinato e serializzato: `["a","b"]` e `["b","a"]` sono lo stesso contesto
 * e devono produrre la stessa chiave, mentre perdere una capability deve
 * produrne una diversa.
 */
export function capabilitiesFingerprint(identity: DashboardIdentity): string {
  return [...identity.capabilities].sort().join(",");
}

/**
 * `scope` distingue due provider della **stessa** identità.
 *
 * DAS-REV-01 ne aveva uno solo per identità, perché Società e personale si
 * escludono a vicenda. DAS-REV-03 §22 chiede invece un errore locale per le
 * Posizioni salvate, quindi la Dashboard personale ha due provider e due
 * record: senza questo segmento il secondo sovrascriverebbe il primo.
 */
export function dashboardCacheKey(input: {
  actorId: string;
  identity: DashboardIdentity;
  scope?: string;
}): string {
  return [
    PREFIX + input.actorId,
    input.identity.id,
    input.identity.kind,
    capabilitiesFingerprint(input.identity),
    input.scope ?? "overview",
    `s${DASHBOARD_CACHE_SCHEMA_VERSION}`,
    `r${PRIORITY_RULES_VERSION}`,
  ].join("|");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parse<TPayload>(
  raw: string,
  isPayload: (value: unknown) => value is TPayload,
): DashboardCacheRecord<TPayload> | null {
  const parsed: unknown = JSON.parse(raw);

  if (!isRecord(parsed) || parsed.version !== 1) {
    return null;
  }

  if (
    parsed.schemaVersion !== DASHBOARD_CACHE_SCHEMA_VERSION ||
    parsed.rulesVersion !== PRIORITY_RULES_VERSION
  ) {
    return null;
  }

  if (
    typeof parsed.fetchedAt !== "number" ||
    typeof parsed.accessVerifiedAt !== "number" ||
    typeof parsed.identityId !== "string" ||
    typeof parsed.capabilitiesFingerprint !== "string" ||
    typeof parsed.revision !== "number" ||
    !isPayload(parsed.payload)
  ) {
    return null;
  }

  return parsed as unknown as DashboardCacheRecord<TPayload>;
}

/**
 * Lettura con verdetto.
 *
 * Tre barriere in ordine, e nessuna è ridondante:
 *   1. schema/regole incompatibili → record scartato (non migrato);
 *   2. scadenza rigida del payload → non mostrabile;
 *   3. finestra di accesso organizzativa → non mostrabile, anche se il
 *      payload è freschissimo.
 *
 * La 3 si applica solo alle identità organizzative: per l'identità personale
 * valgono la sessione e la cache privata dell'app, non una finestra di scope
 * che non esiste (§15).
 */
export async function readDashboardCache<TPayload>(input: {
  actorId: string;
  identity: DashboardIdentity;
  isPayload: (value: unknown) => value is TPayload;
  now: number;
  provider: FreshnessProvider;
  scope?: string;
}): Promise<CacheReadResult<TPayload>> {
  const key = dashboardCacheKey({
    actorId: input.actorId,
    identity: input.identity,
    scope: input.scope,
  });

  let record: DashboardCacheRecord<TPayload> | null = null;

  try {
    const raw = await AsyncStorage.getItem(key);

    if (!raw) {
      return { reason: "miss", status: "unusable" };
    }

    record = parse(raw, input.isPayload);
  } catch {
    // Cache corrotta o non decodificabile: si scarta il record e si tenta il
    // caricamento. Nessun crash, nessun logout, nessun valore dimostrativo.
    record = null;
  }

  if (!record) {
    await removeDashboardCache(key);

    return { reason: "incompatible", status: "unusable" };
  }

  if (isBeyondRetention({ fetchedAt: record.fetchedAt, now: input.now })) {
    await removeDashboardCache(key);

    return { reason: "expired", status: "unusable" };
  }

  const freshness = evaluateFreshness({
    fetchedAt: record.fetchedAt,
    now: input.now,
    provider: input.provider,
  });

  if (freshness === "expired") {
    return { reason: "expired", status: "unusable" };
  }

  if (
    input.identity.kind !== "person" &&
    !isOrgAccessWindowValid({
      accessVerifiedAt: record.accessVerifiedAt,
      now: input.now,
    })
  ) {
    return { reason: "access_window_expired", status: "unusable" };
  }

  return { freshness, record, status: "usable" };
}

/**
 * Scrittura: solo dopo un risultato **valido** della fonte.
 *
 * §14 è esplicito: la lettura dalla cache, un retry fallito e il passaggio in
 * foreground non aggiornano `fetchedAt` né prolungano la scadenza. Questa
 * funzione non ha un modo per essere chiamata "a vuoto" proprio per quello:
 * richiede il payload.
 */
export async function writeDashboardCache<TPayload>(input: {
  accessVerifiedAt: number;
  actorId: string;
  identity: DashboardIdentity;
  now: number;
  payload: TPayload;
  revision: number;
  scope?: string;
}): Promise<void> {
  const record: DashboardCacheRecord<TPayload> = {
    accessVerifiedAt: input.accessVerifiedAt,
    capabilitiesFingerprint: capabilitiesFingerprint(input.identity),
    fetchedAt: input.now,
    identityId: input.identity.id,
    identityKind: input.identity.kind,
    payload: input.payload,
    revision: input.revision,
    rulesVersion: PRIORITY_RULES_VERSION,
    schemaVersion: DASHBOARD_CACHE_SCHEMA_VERSION,
    version: 1,
  };

  try {
    await AsyncStorage.setItem(
      dashboardCacheKey({
        actorId: input.actorId,
        identity: input.identity,
        scope: input.scope,
      }),
      JSON.stringify(record),
    );
  } catch {
    // Best-effort: la cache non deve mai bloccare la Dashboard.
  }
}

async function removeDashboardCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Best-effort.
  }
}

/**
 * Rimozione immediata di tutte le cache di un actor: logout, cambio account,
 * revoca nota (§15, §21).
 *
 * «La pulizia differita dei file non deve consentire di riaprire il
 * contenuto»: la rimozione avviene qui e subito, non a un prossimo avvio.
 */
export async function clearDashboardCache(input: {
  actorId: string;
  /** Limita la pulizia a una sola identità; omesso, pulisce tutto l'actor. */
  identityId?: string;
}): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const actorPrefix = PREFIX + input.actorId;

    const targets = keys.filter((key) => {
      if (!key.startsWith(actorPrefix)) {
        return false;
      }

      if (!input.identityId) {
        return true;
      }

      return key.split("|")[1] === input.identityId;
    });

    if (targets.length > 0) {
      await AsyncStorage.multiRemove(targets);
    }
  } catch {
    // Best-effort.
  }
}

/** Pulizia dei payload oltre la retention, senza estendere la visibilità. */
export async function pruneDashboardCache(now: number): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(PREFIX),
    );

    const stale: string[] = [];

    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);

      if (!raw) {
        continue;
      }

      try {
        const parsed: unknown = JSON.parse(raw);

        if (
          isRecord(parsed) &&
          typeof parsed.fetchedAt === "number" &&
          isBeyondRetention({ fetchedAt: parsed.fetchedAt, now })
        ) {
          stale.push(key);
        }
      } catch {
        // Record illeggibile: va rimosso comunque.
        stale.push(key);
      }
    }

    if (stale.length > 0) {
      await AsyncStorage.multiRemove(stale);
    }
  } catch {
    // Best-effort.
  }
}
