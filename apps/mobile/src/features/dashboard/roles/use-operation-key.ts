/**
 * Chiave idempotente legata al contenuto del comando (§27).
 *
 * «Stessa chiave e stesso payload identifica la stessa operazione; stessa
 * chiave e payload diverso va respinta. Il riuso della chiave dopo un errore
 * di rete non deve trasformare una retry in un nuovo trasferimento.»
 *
 * Una chiave generata una volta per schermata soddisfa la prima metà e rompe
 * la seconda: se l'utente corregge il draft dopo un fallimento, il server
 * vedrebbe la stessa chiave con un payload diverso e rifiuterebbe. Una chiave
 * generata a ogni tap soddisfa la seconda e rompe la prima: un doppio tocco
 * diventerebbe due comandi.
 *
 * Qui la chiave vive quanto il **contenuto**: cambia con il draft, resta la
 * stessa finché il draft non cambia. Un retry dello stesso tentativo è
 * idempotente; un tentativo diverso è un'operazione diversa, ed è giusto che
 * lo sia.
 */
import { useRef } from "react";

import { newAdminOperationKey } from "../admins/operation-key";

export function useOperationKey(signature: string): () => string {
  const stateRef = useRef<{ key: string; signature: string } | null>(null);

  return () => {
    if (!stateRef.current || stateRef.current.signature !== signature) {
      stateRef.current = { key: newAdminOperationKey(), signature };
    }

    return stateRef.current.key;
  };
}
