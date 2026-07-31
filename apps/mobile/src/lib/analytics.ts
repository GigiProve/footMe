/**
 * Sink di analitiche minimo, senza vendor e senza rete.
 *
 * Prima di questo file il progetto non aveva alcuna forma di instrumentazione
 * (nessun Sentry / Amplitude / Mixpanel / PostHog / Segment, nessun helper di
 * tracking). Il §25 della Home chiede di "predisporre eventi tecnici": quello
 * che serve è il punto di raccolta e i nomi degli eventi, non un fornitore.
 * Quando arriverà, si registra un sink con `setAnalyticsSink` e nulla dei call
 * site cambia.
 *
 * Contratto: `trackEvent` non solleva MAI e non va awaited. Un evento perso è
 * accettabile; un'eccezione che risale in un handler di scroll non lo è.
 */

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export type AnalyticsEvent = {
  name: string;
  props: AnalyticsProps;
  at: string;
};

export type AnalyticsSink = (event: AnalyticsEvent) => void;

let sink: AnalyticsSink | null = null;

export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next;
}

export function trackEvent(name: string, props: AnalyticsProps = {}): void {
  if (!sink) {
    return;
  }

  try {
    sink({ name, props, at: new Date().toISOString() });
  } catch {
    // Un sink difettoso non deve poter rompere l'interfaccia.
  }
}
