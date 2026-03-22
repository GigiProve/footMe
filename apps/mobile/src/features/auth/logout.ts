import { queryClient } from "../../lib/query-client";
import { supabase } from "../../lib/supabase";
import { saveLastAccountProfile } from "./last-account";

type LogoutOptions = {
  avatarUrl?: string | null;
  email?: string | null;
  fullName?: string | null;
};

export async function logout(options?: LogoutOptions) {
  if (options?.email) {
    await saveLastAccountProfile({
      avatarUrl: options.avatarUrl ?? null,
      email: options.email,
      fullName: options.fullName ?? null,
    });
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  queryClient.clear();
}
