/**
 * HOM-06.1 §77 — limiti d'uso della Edge Function. Moduli puri, con il tempo
 * iniettato, senza import Deno.
 *
 * Due strumenti, entrambi in memoria dell'isolate (best effort: un isolate nuovo
 * riparte da zero; il limite DURO per utente sta nel database, vedi index.ts, che
 * conta gli snapshot per `fetched_by`):
 *   * SlidingWindowLimiter: al massimo `max` tentativi per chiave in `windowMs`;
 *     conta anche i tentativi falliti, che nel database non lasciano traccia;
 *   * NegativeCache: ricorda per poco un URL che ha già fallito, così un client
 *     (o un utente) che insiste non rilancia ogni volta fetch e DNS.
 */

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Registra un tentativo; false se la chiave ha già esaurito la finestra. */
  take(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) {
      this.prune(t);
    }
    return true;
  }

  private prune(t: number): void {
    for (const [key, list] of this.hits) {
      if (list.every((h) => t - h >= this.windowMs)) {
        this.hits.delete(key);
      }
    }
  }
}

export class NegativeCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number = 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.entries.size >= this.maxEntries) {
      // Scarta la voce più vecchia (Map mantiene l'ordine di inserimento).
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}
