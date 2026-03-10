import {
  PropsWithChildren,
  createContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { supabase } from "../../lib/supabase";

type AppProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type SessionContextValue = {
  isLoading: boolean;
  needsOnboarding: boolean;
  profile: AppProfile | null;
  refreshProfile: () => Promise<void>;
  session: Session | null;
};

export const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);

  async function refreshProfile() {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession?.user) {
      setProfile(null);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", currentSession.user.id)
      .maybeSingle();

    setProfile(data ?? null);
  }

  useEffect(() => {
    let isMounted = true;

    async function hydrateProfile(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .maybeSingle();

      if (isMounted) {
        setProfile(data ?? null);
      }
    }

    async function bootstrap() {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(initialSession);

      if (initialSession?.user) {
        await hydrateProfile(initialSession.user.id);
      }

      setIsLoading(false);
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        setSession(nextSession);

        if (!nextSession?.user) {
          setProfile(null);
          setIsLoading(false);
          return;
        }

        hydrateProfile(nextSession.user.id).finally(() => setIsLoading(false));
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      needsOnboarding: !!session && !profile,
      profile,
      refreshProfile,
      session,
    }),
    [isLoading, profile, session],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
