/**
 * Stato della richiesta in compilazione (§12, §14, §15).
 *
 * «Non creare ancora SocietyMembership o MembershipAssignment»: qui non
 * esiste nessuna chiamata di rete, ed è uno stato locale che lo resta fino a
 * «Invia richiesta».
 *
 * Form e riepilogo sono due route dello stesso Stack, non due rami di un
 * indice in stato: §14 chiede che «Modifica torni al form senza perdere i
 * valori», e una schermata condizionale non ripristinerebbe lo scroll né la
 * posizione del focus.
 *
 * `nonce` nasce una volta sola per sessione di compilazione. Combinato con
 * l'impronta della proposta produce la chiave idempotente di §15: stessa
 * proposta, stessa chiave anche dopo dieci render; proposta diversa, chiave
 * diversa — che è il modo in cui §14 impedisce «due richieste
 * involontarie» dopo un tentativo ambiguo.
 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { newRoleLinkNonce, roleLinkOperationKey } from "../operation-key";
import type { RoleRequestDraft } from "../role-link-types";

type RoleRequestContextValue = {
  clubId: string;
  draft: RoleRequestDraft;
  isDirty: boolean;
  operationKey: string;
  setDraft: (next: RoleRequestDraft) => void;
};

const EMPTY: RoleRequestDraft = {
  customRole: "",
  profileType: null,
  roleId: null,
  scopeType: "team",
  teamId: null,
  teamLabel: null,
};

const RoleRequestContext = createContext<RoleRequestContextValue | null>(null);

export function RoleRequestProvider({
  children,
  clubId,
}: {
  children: ReactNode;
  clubId: string;
}) {
  const [draft, setDraft] = useState<RoleRequestDraft>(EMPTY);
  const [nonce] = useState(newRoleLinkNonce);

  const value = useMemo<RoleRequestContextValue>(() => {
    const signature = [
      clubId,
      draft.profileType ?? "",
      draft.roleId ?? "",
      draft.customRole.trim().toLowerCase(),
      draft.scopeType,
      draft.scopeType === "team" ? (draft.teamId ?? "") : "",
    ].join("|");

    return {
      clubId,
      draft,
      /* "Significativa" è una scelta fatta davvero, non un form aperto:
         §46 — «Se non ci sono modifiche non chiedere conferma». */
      isDirty:
        draft.roleId !== null ||
        draft.teamId !== null ||
        draft.customRole.trim().length > 0,
      operationKey: roleLinkOperationKey(nonce, signature),
      setDraft,
    };
  }, [clubId, draft, nonce]);

  return (
    <RoleRequestContext.Provider value={value}>
      {children}
    </RoleRequestContext.Provider>
  );
}

export function useRoleRequestDraft(): RoleRequestContextValue {
  const value = useContext(RoleRequestContext);

  if (!value) {
    throw new Error("useRoleRequestDraft fuori da RoleRequestProvider");
  }

  return value;
}
