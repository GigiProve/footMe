/**
 * Destinazioni canoniche del Centro Amministratori (§6, §24).
 *
 * Un posto solo, perché Dashboard, hub e centro non possano divergere: §6
 * chiede che i due ingressi passino «la stessa Society canonica» e non
 * aggiungano «una pagina intermedia tra l'entry e il centro».
 *
 * `from` conserva l'origine (§24): il back deve tornare all'hub se si è
 * arrivati dall'hub e alla Dashboard se si è arrivati dalla Dashboard.
 */
export const ADMIN_HREFS = {
  /** Il centro stesso. */
  center: (from?: "dashboard" | "structure") =>
    from
      ? `/(tabs)/dashboard/admins?from=${from}`
      : "/(tabs)/dashboard/admins",
  /** Ricerca della persona da invitare (screen 02). */
  search: "/admin-invite/search",
  /** Configurazione dell'invito interno (screen 03). */
  configure: (input: { profileId: string; query?: string }) =>
    `/admin-invite/configure?profileId=${encodeURIComponent(input.profileId)}` +
    (input.query ? `&query=${encodeURIComponent(input.query)}` : ""),
  /**
   * Percorso esterno (screen 05). Con `inviteId` è la **ricondivisione** di
   * una proposta già creata: §12 la vuole in sola lettura, non un form nuovo
   * che genererebbe un duplicato.
   */
  external: (input?: { inviteId?: string; query?: string }) =>
    "/admin-invite/external" +
    (input?.inviteId
      ? `?inviteId=${encodeURIComponent(input.inviteId)}`
      : input?.query
        ? `?query=${encodeURIComponent(input.query)}`
        : ""),
  /** Revisione del consenso da parte del destinatario (screen 04). */
  review: (inviteId: string) =>
    `/admin-invite/review?inviteId=${encodeURIComponent(inviteId)}`,
  /**
   * Ruoli e permessi: la destinazione reale del sistema condiviso.
   *
   * Oggi è la schermata owner-gated introdotta prima della Dashboard.
   * DAS-REV-14 la sostituirà con l'editor completo; il centro continuerà a
   * puntare qui perché è l'unico indirizzo canonico esistente.
   */
  roles: "/club-admin/permissions",
} as const;
