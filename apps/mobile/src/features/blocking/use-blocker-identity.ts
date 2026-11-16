/**
 * Chi blocca (HOM-12 §8–§13, D8). Mai un selector «Blocca come…» (§9): è l'identità
 * d'interazione corrente (`useInteractionIdentity`, ultima identità Dashboard).
 *
 * Per una Società serve `can_block_identity` (o essere titolare, D3): la capability si
 * legge dall'elenco identità della Dashboard, che condivide la cache del provider ma
 * non ne richiede il montaggio. Finché l'identità non è risolta non si offre nulla —
 * meglio una voce che compare un istante dopo che un Block come persona per errore.
 * Senza identità risolta (query finita, nessuna riga) vale l'identità personale.
 */

import { useQuery } from "@tanstack/react-query";

import { DASHBOARD_QK } from "../dashboard/dashboard-keys";
import { fetchDashboardIdentities } from "../dashboard/identity/identity-service";
import { useInteractionIdentity } from "../interactions/use-interaction-identity";
import { personalIdentityRef, hasBlockCapability } from "./blocking-presentation";
import type { BlockIdentityRef } from "./blocking-types";

export type BlockerIdentity = {
  blocker: BlockIdentityRef | null;
  /** `true` solo per una Società con la capability (o titolare). */
  societyCapable: boolean;
  isLoading: boolean;
};

export function useBlockerIdentity(
  profile: { id: string; role?: string | null } | null,
): BlockerIdentity {
  const profileId = profile?.id ?? "";
  const { identity, isLoading } = useInteractionIdentity(profileId);
  const isSociety = identity?.type === "society";

  const dashboardQuery = useQuery({
    enabled: isSociety && profileId.length > 0,
    queryFn: fetchDashboardIdentities,
    queryKey: DASHBOARD_QK.identities(profileId),
    staleTime: 5 * 60 * 1000,
  });

  if (identity) {
    const dashboardIdentity = isSociety
      ? dashboardQuery.data?.find((candidate) => candidate.id === identity.id)
      : null;

    return {
      blocker: { id: identity.id, type: identity.type },
      isLoading: false,
      societyCapable: isSociety && hasBlockCapability(dashboardIdentity),
    };
  }

  return {
    blocker: isLoading ? null : personalIdentityRef(profile),
    isLoading: !!isLoading,
    societyCapable: false,
  };
}
