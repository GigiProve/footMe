import {
  PropsWithChildren,
  createContext,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Linking } from "react-native";

import { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { completeOAuthSessionFromUrl } from "./oauth";
import { supabase } from "../../lib/supabase";

type AppProfile = {
  avatar_url: string | null;
  club_name: string | null;
  city: string | null;
  id: string;
  full_name: string | null;
  region: string | null;
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

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url, region, city")
      .eq("id", userId)
      .maybeSingle();

    if (!data) {
      return null;
    }

    const nextProfile: AppProfile = {
      ...data,
      club_name: null,
    };

    if (nextProfile.role === "club_admin") {
      const { data: club } = await supabase
        .from("clubs")
        .select("name")
        .eq("owner_profile_id", userId)
        .maybeSingle();

      nextProfile.club_name = club?.name ?? null;
    }

    return nextProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession?.user) {
      setProfile(null);
      return;
    }

    const nextProfile = await loadProfile(currentSession.user.id);
    setProfile(nextProfile);
  }, [loadProfile]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateProfile(userId: string) {
      const nextProfile = await loadProfile(userId);

      if (isMounted) {
        setProfile(nextProfile);
      }
    }

    async function bootstrap() {
      const initialUrl = await Linking.getInitialURL();

      if (initialUrl) {
        try {
          await completeOAuthSessionFromUrl(initialUrl);
        } catch (error) {
          console.warn("[auth] OAuth callback bootstrap failed", error);
        }
      }

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

    const urlSubscription = Linking.addEventListener("url", ({ url }) => {
      completeOAuthSessionFromUrl(url).catch((error) => {
        console.warn("[auth] OAuth callback failed", error);
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      urlSubscription.remove();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      isLoading,
      needsOnboarding: !!session && !profile,
      profile,
      refreshProfile,
      session,
    }),
    [isLoading, profile, refreshProfile, session],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
