import { supabase } from "../../../lib/supabase";
import {
  DASHBOARD_CAPABILITIES,
  type DashboardCapability,
  type DashboardIdentity,
  type DashboardIdentityKind,
} from "../dashboard-types";

type IdentityRow = {
  avatar_url: string | null;
  capabilities: string[] | null;
  identity_id: string;
  identity_kind: string;
  is_owner: boolean;
  is_verified: boolean;
  name: string;
};

const KINDS: readonly DashboardIdentityKind[] = ["person", "society", "media"];

function isKnownKind(value: string): value is DashboardIdentityKind {
  return (KINDS as readonly string[]).includes(value);
}

function isKnownCapability(value: string): value is DashboardCapability {
  return (DASHBOARD_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Le identità che l'actor autenticato può aprire.
 *
 * L'elenco arriva intero dal database: il client non filtra, non deduce e non
 * aggiunge. Una Società seguita, affiliata o semplicemente collegata non
 * compare, perché la RPC non la restituisce — non perché il client la nasconda.
 *
 * Un `identity_kind` sconosciuto (client più vecchio del backend) viene
 * scartato invece di essere reso: §15 chiede che un elemento non
 * interpretabile non faccia crashare la pagina. Lo stesso vale per una
 * capability che questa versione del client non conosce.
 */
export async function fetchDashboardIdentities(): Promise<DashboardIdentity[]> {
  const { data, error } = await supabase.rpc("fetch_dashboard_identities");

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as IdentityRow[];

  return rows.reduce<DashboardIdentity[]>((identities, row) => {
    if (!isKnownKind(row.identity_kind)) {
      return identities;
    }

    identities.push({
      avatarUrl: row.avatar_url,
      capabilities: (row.capabilities ?? []).filter(isKnownCapability),
      id: row.identity_id,
      isOwner: row.is_owner,
      isVerified: row.is_verified,
      kind: row.identity_kind,
      name: row.name,
      // Lo scope multiplo non è ancora modellato nel backend: la colonna
      // esiste nel tipo client perché §10 la richiede, e resta null finché
      // il pack competente non introduce l'assegnazione per Squadra.
      scopeLabel: null,
    });

    return identities;
  }, []);
}

