import { queryClient } from "../../lib/query-client";
import { supabase } from "../../lib/supabase";
import { drainContentEventsForSignOut } from "../content-insights/content-events-service";
import { clearDashboardCache } from "../dashboard/cache/dashboard-cache";
import { discardFeedEvents, flushFeedEvents } from "../feed/feed-events-service";
import { resetUserInteractions } from "../interactions/reset-user-interactions";
import { clearPushStateForLogout } from "../notifications/push/push-service";
import { saveLastAccountProfile } from "./last-account";
import { pendingAuthTarget } from "./pending-auth-target";

type LogoutOptions = {
  avatarUrl?: string | null;
  email?: string | null;
  fullName?: string | null;
  /**
   * Actor che sta uscendo. Serve a rendere **subito** inaccessibili le cache
   * private della sua Dashboard (DAS-REV-02 §15, §21): `queryClient.clear()`
   * svuota solo la memoria, non i record su AsyncStorage, che sopravvivrebbero
   * al logout e sarebbero rileggibili al prossimo accesso con un altro
   * account sullo stesso dispositivo.
   */
  profileId?: string | null;
};

export async function logout(options?: LogoutOptions) {
  if (options?.email) {
    await saveLastAccountProfile({
      avatarUrl: options.avatarUrl ?? null,
      email: options.email,
      fullName: options.fullName ?? null,
    });
  }

  if (options?.profileId) {
    // Prima del signOut: la pulizia non deve dipendere dall'esito della
    // chiamata di rete.
    await clearDashboardCache({ actorId: options.profileId });
  }

  // HOM-15 §297: un target da riprendere dopo il login non sopravvive al logout.
  await pendingAuthTarget.clear();

  // HOM-05: gli eventi analytics in coda sono dell'utente che esce.
  await drainContentEventsForSignOut();
  // HOM-13 §259: stessa regola per gli eventi Feed. Il primo lotto parte subito
  // (la chiamata prende la coda in modo sincrono), il resto è dell'utente che esce.
  void flushFeedEvents();
  discardFeedEvents();

  // HOM-07: Mi piace e Salvati stanno in store di modulo che `queryClient.clear()`
  // non tocca. Prima del signOut, come la pulizia della Dashboard.
  resetUserInteractions();

  // HOM-14 §274: il device smette di ricevere le push dell'account che esce. Prima
  // del signOut (la RPC vuole la sessione); non lancia e ha un tetto di tempo.
  await clearPushStateForLogout();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  queryClient.clear();
}
