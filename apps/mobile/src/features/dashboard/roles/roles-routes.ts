/**
 * Destinazioni canoniche di Ruoli e permessi (§30).
 *
 * Un posto solo, perché il Centro Amministratori, l'hub e l'editor non
 * possano divergere. `from` conserva l'origine: §30 vuole che il back torni
 * al Centro Amministratori della stessa Society.
 *
 * Il livello granulare (screen 05) **non** è qui: è una superficie a schermo
 * intero montata dentro l'editor, non una route. §30 chiede che «il ritorno
 * dal granulare non perda modifiche già confermate nel role editor», e il
 * draft vive nell'editor: una route sorella lo lascerebbe fuori portata o
 * imporrebbe uno store globale per un dato che dura quanto una schermata.
 */
export const ROLES_HREFS = {
  /** Centro Ruoli e permessi (screen 01). Bottom navigation visibile. */
  center: (from?: "admins" | "structure") =>
    from
      ? `/(tabs)/dashboard/roles?from=${from}`
      : "/(tabs)/dashboard/roles",
  /**
   * Editor del ruolo (screen 02 e 03). Senza `roleId` è la creazione.
   *
   * Un solo controller per i due stati: §4 dice che «i dodici screen non
   * richiedono dodici controller separati».
   */
  editor: (input?: { roleId?: string }) =>
    "/club-roles/editor" +
    (input?.roleId ? `?roleId=${encodeURIComponent(input.roleId)}` : ""),
} as const;
