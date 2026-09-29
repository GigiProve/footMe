/**
 * Stato contrattuale e condizione: gli unici valori che il dominio conosce.
 *
 * `player_profiles.contract_status` è una colonna `text` senza vincolo, quindi
 * il backend accetterebbe qualsiasi stringa. Proprio per questo l'elenco vive
 * in un posto solo: "in trattativa", "prestito" o "cerca squadra" non sono
 * stati del prodotto e non vanno introdotti dall'interfaccia (§K.4).
 */
export type PlayerContractStatus = "tesserato" | "svincolato" | "";

export const CONTRACT_STATUS_OPTIONS: readonly {
  label: string;
  value: Exclude<PlayerContractStatus, "">;
}[] = [
  { label: "Tesserato", value: "tesserato" },
  { label: "Svincolato", value: "svincolato" },
] as const;

export const PLAYER_CONDITION_OPTIONS: readonly {
  label: string;
  value: string;
}[] = [
  { label: "In attività", value: "in_attivita" },
  { label: "Infortunato", value: "infortunato" },
  { label: "In riabilitazione", value: "riabilitazione" },
] as const;
