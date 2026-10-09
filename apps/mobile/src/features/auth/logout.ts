import { queryClient } from "../../lib/query-client";
import { supabase } from "../../lib/supabase";
import { clearDashboardCache } from "../dashboard/cache/dashboard-cache";
import { saveLastAccountProfile } from "./last-account";

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

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  queryClient.clear();
}
