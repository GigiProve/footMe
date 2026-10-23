/**
 * Link, messaggio e condivisione dell'invito amministrativo (§12, §14).
 *
 * «Usa il sistema di deep link/app link del prodotto e i domini reali
 * configurati.» Il prodotto ne ha uno solo — `EXPO_PUBLIC_INVITE_WEB_ORIGIN`
 * più lo schema `footme://` — già usato dagli inviti procuratore→assistito e
 * dalla Rete societaria: qui cambia soltanto il percorso.
 *
 * Nel link entra **solo** il token (§27): niente email, ruolo, ambito, nome
 * della Società o id interni come parametri autorevoli.
 */
import { Share } from "react-native";
import * as Clipboard from "expo-clipboard";

import { createPendingLinkStore } from "../../../lib/pending-deep-link";

const WEB_ORIGIN = process.env.EXPO_PUBLIC_INVITE_WEB_ORIGIN ?? "";

const APP_SCHEME_PREFIX = "footme://admin-invite/";

export function buildAdminInviteUrl(token: string): string {
  if (WEB_ORIGIN) {
    return `${WEB_ORIGIN.replace(/\/+$/, "")}/admin-invite/${token}`;
  }

  return `${APP_SCHEME_PREFIX}${token}`;
}

export type ShareOutcome = "shared" | "dismissed" | "unavailable";

/**
 * §12: «Non integrare una UI proprietaria WhatsApp, non richiedere rubrica e
 * non inviare messaggi automaticamente per conto dell'actor.» La
 * condivisione è la share sheet di sistema e nient'altro.
 *
 * Il valore restituito dice che cosa è successo alla **sheet**, non al
 * messaggio: §12 vieta di definire consegnato un invito solo perché la sheet
 * si è aperta.
 */
export async function shareAdminInvite(message: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ message });

    return result.action === Share.sharedAction ? "shared" : "dismissed";
  } catch {
    return "unavailable";
  }
}

/** Fallback standard quando il native share non è disponibile (§12). */
export async function copyAdminInviteLink(link: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(link);

    return true;
  } catch {
    return false;
  }
}

/**
 * Invito aperto prima dell'autenticazione (§14).
 *
 * «Preserva un riferimento sicuro all'invito durante l'autenticazione …
 * risolvi nuovamente Society, destinatario, ruolo, scope e stato dal backend
 * al ritorno.» Il token messo da parte non prova nulla: serve solo a non
 * perdere il percorso fra login, registrazione e onboarding.
 *
 * Il meccanismo è quello condiviso di `lib/pending-deep-link.ts`: §14 chiede
 * di usare «meccanismi di continuità già autorizzati dal prodotto», non di
 * scriverne un terzo.
 */
export const pendingAdminInvite = createPendingLinkStore(
  "@footme/pending-admin-invite/v1",
);

/**
 * Chiave di idempotenza di una mutazione (§19).
 *
 * «I retry di create/accept/reject riusano la stessa chiave finché l'esito
 * non è conosciuto.» Nasce una volta per decisione dell'utente e sopravvive
 * ai retry; cambia solo quando cambia la proposta.
 */
export function newAdminOperationKey(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;

  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return `adm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
