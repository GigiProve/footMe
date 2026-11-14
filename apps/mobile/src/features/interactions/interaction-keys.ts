/**
 * Query key del dominio interazioni (HOM-07 §10).
 *
 * L'identità corrente dipende dall'utente E dalla preferenza Dashboard: la key
 * porta solo l'utente, perché la preferenza è letta dentro la queryFn e un
 * cambio account non deve mai riusare l'identità di qualcun altro.
 */

export const INTERACTION_QK = {
  /** L'identità di interazione risolta (e l'elenco da cui deriva), per utente. */
  identity: (profileId: string) => ["interaction-identity", profileId] as const,
};
