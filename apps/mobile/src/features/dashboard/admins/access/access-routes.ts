/**
 * Destinazioni dell'accesso amministrativo (§30).
 *
 * Sono flussi focalizzati: §4 dice che «gli screen 02–12 sono flussi
 * focalizzati senza bottom navigation». Vivono quindi fuori dalle tab, e il
 * back torna al Centro Amministratori o al dettaglio che li ha aperti.
 *
 * Il picker delle squadre (screen 08) e la selezione del nuovo Owner
 * (screen 11) non sono qui: §16 dice «non creare una route autonoma per
 * questo elenco», e §19 che il pannello «resta sovrapposto al dettaglio».
 */
export const ACCESS_HREFS = {
  /** Dettaglio amministratore (screen 06) e variante Owner (screen 11). */
  detail: (profileId: string) =>
    `/society-admin/${encodeURIComponent(profileId)}`,
  /** Dettaglio di un invito ancora aperto (screen 10). */
  invite: (inviteId: string) =>
    `/society-admin/invite?inviteId=${encodeURIComponent(inviteId)}`,
  /** Vista di sola lettura dei permessi effettivi (§14). */
  permissions: (profileId: string) =>
    `/society-admin/permissions?profileId=${encodeURIComponent(profileId)}`,
  /** Modifica dell'ambito (screen 07, con il picker 08 sovrapposto). */
  scope: (profileId: string) =>
    `/society-admin/scope?profileId=${encodeURIComponent(profileId)}`,
  /** Conferma del trasferimento (screen 12). */
  transfer: (newOwnerId: string) =>
    `/society-admin/transfer?newOwnerId=${encodeURIComponent(newOwnerId)}`,
} as const;
