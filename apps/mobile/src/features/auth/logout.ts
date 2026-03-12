import { queryClient } from "../../lib/query-client";
import { supabase } from "../../lib/supabase";

export async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  queryClient.clear();
}
