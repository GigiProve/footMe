/**
 * Guardia di sessione comune a tutte le route (HOM-15 §293–§297).
 *
 * Una sola, nel layout radice: legge la route corrente e la sessione e, quando
 * una route protetta monta senza sessione, rimanda al login ricordando il
 * target (§297); con sessione ma onboarding da completare rimanda
 * all'onboarding, come già facevano le tab. La regola di cosa è pubblico vive
 * in `session-guard-presentation.ts`. Non renderizza nulla.
 */
import { useEffect, useRef } from "react";
import {
  useGlobalSearchParams,
  usePathname,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";

import { pendingAuthTarget } from "./pending-auth-target";
import { decideSessionGuard, pendingTargetForRoute } from "./session-guard-presentation";
import { useSession } from "./use-session";

export function SessionGuard() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const navigationKey = useRootNavigationState()?.key;
  const { isLoading, needsOnboarding, session } = useSession();
  const hasSession = Boolean(session);
  // La sessione al passaggio precedente: distingue «arrivo senza sessione» da logout/scadenza.
  const hadSessionRef = useRef(false);
  // Un solo redirect per route: i re-render nel frattempo non lo ripetono.
  const redirectedFromRef = useRef<string | null>(null);

  useEffect(() => {
    const hadSession = hadSessionRef.current;
    hadSessionRef.current = hasSession;

    const decision = decideSessionGuard({ hadSession, hasSession, isLoading, needsOnboarding, segments });

    if (decision.kind !== "redirect") {
      if (decision.kind === "allow") {
        redirectedFromRef.current = null;
      }
      return;
    }
    // Navigare prima che il navigatore radice sia montato lancia un errore.
    if (!navigationKey || redirectedFromRef.current === pathname) {
      return;
    }
    redirectedFromRef.current = pathname;

    if (decision.rememberTarget) {
      const target = pendingTargetForRoute(pathname, segments, params);
      if (target) {
        void pendingAuthTarget.store(target);
      }
    }
    router.replace(decision.href as never);
  }, [hasSession, isLoading, navigationKey, needsOnboarding, params, pathname, router, segments]);

  return null;
}
