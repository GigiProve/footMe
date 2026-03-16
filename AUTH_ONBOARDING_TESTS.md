# Auth & Onboarding — Test Report

## Overview

Questo documento descrive i casi di test verificati per il flusso di
autenticazione e onboarding di FootMe.

---

## 1. Login / Sign-in UI

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Layout sign-in | Social buttons (Google/Apple) sono in cima alla card, seguiti da divisore "oppure con email" e poi form email/password | ✅ Implementato |
| Layout sign-up | Social buttons (Google/Apple) sono in cima alla card, seguiti da divisore "oppure con email" e poi form email/password | ✅ Implementato |
| Pulsante "Continua con Google" | Visibile in cima al form, disabilitato durante il processo OAuth | ✅ Implementato |
| Pulsante "Continua con Apple" | Visibile solo su iOS, placeholder pronto per integrazione futura | ✅ Implementato |
| Login email/password | Form con email e password, pulsante "Accedi" | ✅ Esistente |
| Errori di login | Messaggi utente leggibili, log tecnici in console | ✅ Esistente |

---

## 2. Autenticazione con Google (OAuth)

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Utente nuovo con Google | Account creato automaticamente, `authProvider` = `"google"` rilevato dalla sessione | ✅ Implementato |
| Utente esistente con Google | Login riconosciuto, routing verso app | ✅ Implementato |
| `authProvider` rilevato dalla sessione | Letto da `session.user.app_metadata.provider` nell'`AppProfile` | ✅ Implementato |
| `authProvider` salvato nel profilo | Campo `auth_provider` salvato in `profiles` tramite `createInitialProfile` | ✅ Implementato |
| Stato loading durante OAuth | Pulsante disabilitato con testo "Connessione a Google..." | ✅ Esistente |

---

## 3. Placeholder Apple Sign-In

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Pulsante Apple visibile su iOS | Visibile solo su `Platform.OS === "ios"` | ✅ Implementato |
| `authProvider: "apple"` nel tipo | Tipo `AppRole` aggiornato con `"apple"` | ✅ Implementato |
| Handler Apple stub | Usa `handleOAuthSignIn("apple")` come placeholder | ✅ Implementato |

---

## 4. Modello utente — `authProvider`

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| `AppProfile.authProvider` aggiunto | Tipo aggiornato in `session-provider.tsx` | ✅ Implementato |
| Rilevamento automatico da sessione | Letto da `session.user.app_metadata.provider` | ✅ Implementato |
| Valore `null` per utenti legacy | Colonna nullable, retrocompatibile | ✅ Implementato |
| Migrazione DB `auth_provider` | Colonna `text` con CHECK constraint aggiunta a `profiles` | ✅ Implementato |

---

## 5. Nuovi ruoli — `agent` e `director`

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Tipo `AppRole` aggiornato | Include `"agent"` e `"director"` | ✅ Implementato |
| Migrazione DB enum `app_role` | `ALTER TYPE app_role ADD VALUE` per `agent` e `director` | ✅ Implementato |
| Card ruolo "Procuratore" visibile | Visibile nell'onboarding `step === "role"` | ✅ Implementato |
| Card ruolo "Dirigente" visibile | Visibile nell'onboarding `step === "role"` | ✅ Implementato |
| `roleLabels` aggiornato in profile.tsx | Mappa completa per tutti i 6 ruoli | ✅ Implementato |
| `agent`/`director` non creano profili speciali | `createInitialProfile` non esegue upsert su tabelle aggiuntive per questi ruoli | ✅ Implementato |

---

## 6. Routing post-login

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Utente già profilato | Routing diretto all'app (`/(tabs)`) | ✅ Esistente |
| Utente nuovo | Routing verso onboarding (`/(onboarding)/profile`) | ✅ Esistente |
| Utente con onboarding incompleto | Il flusso onboarding riprende dal punto interrotto | ✅ Esistente |

---

## 7. Selezione ruolo

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| 6 ruoli disponibili | Player, Coach, Staff, Club, Agent, Director | ✅ Implementato |
| Ruolo obbligatorio | CTA "Continua" passa al passo successivo solo dopo selezione | ✅ Esistente |
| Card selezionabile con stato visivo | Bordo `hero` + sfondo `heroSoft` quando selezionata | ✅ Esistente |
| Salvataggio ruolo nel profilo | Passato a `createInitialProfile` via state `role` | ✅ Esistente |

---

## 8. Form "Informazioni essenziali"

### Campo Nome e Cognome

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Auto-formattazione nome | `formatPersonName` capitalizza prima lettera, minuscolo il resto | ✅ Implementato |
| Auto-formattazione cognome | Stessa logica di `formatPersonName` | ✅ Implementato |
| Input "giuseppe" → "Giuseppe" | Primo accesso al carattere capitalizzato | ✅ Implementato |

### Campo Nazionalità

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Autocomplete con filtro testo | Filtra le opzioni mentre si digita nel modale | ✅ Implementato |
| Flag emoji accanto alla nazione | Generato da codice ISO con `getFlagEmoji()` | ✅ Implementato |
| Selezione chiude il modale | Tap su un'opzione seleziona e chiude | ✅ Implementato |
| Possibilità di rimuovere la selezione | Pulsante "Rimuovi selezione" nel modale | ✅ Implementato |
| Compatibilità con `NATIONALITY_OPTIONS` esistenti | Riusa la lista già presente in `profile-form-utils` | ✅ Implementato |

### Campo Residenza

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Suggerimenti città reali | `searchItalianCities` attivo da 2+ caratteri | ✅ Implementato |
| Formato suggerimento | "Nome città (Provincia)" | ✅ Implementato |
| Solo città selezionate dal picker | Il valore `onChange` viene popolato solo dopo selezione | ✅ Implementato |
| Impossibile salvare testo libero | Inserimento libero non popola `value`, solo la selezione | ✅ Implementato |
| Pulsante clear per re-inserimento | Icona ✕ per azzerare la selezione | ✅ Implementato |

### Campo Numero di telefono

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Prefisso separato dal numero | Picker prefisso + input numerico separati | ✅ Implementato |
| Flag e codice nel picker | Es. 🇮🇹 +39 | ✅ Implementato |
| Ricerca paese nel picker | Input di ricerca filtra per nome o codice | ✅ Implementato |
| Default Italia (+39) | Prefisso preimpostato a `+39` | ✅ Implementato |
| Input numerico | Solo cifre accettate via `replace(/[^0-9]/g, "")` | ✅ Implementato |
| Salvataggio combinato | `createInitialProfile` combina `phoneCountryCode` + `phoneNumber` | ✅ Implementato |

### Campo Sesso

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| OptionPill per selezione rapida | UI compatta e touch-friendly | ✅ Esistente |
| Obbligatorio (valore default) | Default `"male"` preimpostato | ✅ Esistente |

### Campo Data di nascita

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Calendario nativo | `DatePickerField` con `@react-native-community/datetimepicker` | ✅ Esistente |
| Chiusura automatica dopo selezione | Il picker si chiude dopo la scelta della data | ✅ Esistente |
| Date future bloccate | `maximumDate` impostato a oggi | ✅ Esistente |

---

## 9. Salvataggio profilo

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Campi obbligatori validati | `validateBaseProfileStep` lancia `BaseProfileValidationError` se mancanti | ✅ Esistente |
| `auth_provider` salvato | Campo `auth_provider` incluso nell'upsert `profiles` | ✅ Implementato |
| `phoneCountryCode` + `phoneNumber` combinati | `createInitialProfile` combina e salva in `profile_private_contacts` | ✅ Implementato |
| Errori mostrati all'utente | `Alert.alert` con messaggi leggibili in caso di errore | ✅ Esistente |
| Loading state durante salvataggio | Pulsante disabilitato con testo "Salvataggio..." | ✅ Esistente |

---

## 10. Retrocompatibilità

| Caso | Comportamento atteso | Stato |
|------|---------------------|-------|
| Utenti email/password legacy | `auth_provider` è `null` nel DB, non c'è break | ✅ Garantito (colonna nullable) |
| Utenti con profilo già completato | `authProvider: null` nell'AppProfile finché non ricaricato | ✅ Garantito |
| Utenti con `club_admin` role | Enum rimane valido, aggiunta non-breaking | ✅ Garantito |
| Utenti con dati parziali | Flusso onboarding gestisce valori mancanti | ✅ Esistente |
| `AppSidebar.test.tsx` aggiornato | Fixture di test aggiornate con `authProvider: null` | ✅ Implementato |

---

## 11. Componenti creati / aggiornati

| Componente | Percorso | Descrizione |
|-----------|---------|-------------|
| `NationalityAutocompleteInput` | `src/components/ui/nationality-autocomplete-input.tsx` | Autocomplete nazionalità con flag emoji |
| `ResidenceCityInput` | `src/components/ui/residence-city-input.tsx` | Autocomplete città italiane con selezione obbligatoria |
| `PhoneInputWithCountryCode` | `src/components/ui/phone-input-with-country-code.tsx` | Picker prefisso internazionale + input numero |

---

## 12. File modificati

| File | Modifica |
|------|---------|
| `app/(auth)/sign-in.tsx` | Reorder: social buttons prima del form email/password |
| `app/(auth)/sign-up.tsx` | Reorder: social buttons prima del form email/password |
| `app/(onboarding)/profile.tsx` | Nuovi componenti, nuovi ruoli, `formatPersonName`, `authProvider` |
| `src/features/auth/session-provider.tsx` | `authProvider` aggiunto a `AppProfile`, rilevamento da sessione |
| `src/features/onboarding/create-initial-profile.ts` | `AppRole` espanso con `agent`/`director`, `authProvider` e `phoneCountryCode` |
| `src/features/profiles/profile-form-utils.ts` | `formatPersonName` utility aggiunta |
| `app/(tabs)/profile.tsx` | `roleLabels` aggiornato con `agent` e `director` |
| `src/ui/sidebar/AppSidebar.test.tsx` | Fixture aggiornate con `authProvider: null` |
| `src/features/onboarding/create-initial-profile.test.ts` | Test aggiornato con `auth_provider: null` atteso |
| `supabase/migrations/20260316_auth_provider_and_new_roles.sql` | Migrazione DB: `auth_provider` + enum `app_role` |

---

## 13. TODO futuri — Apple Sign-In reale

- Integrare `expo-apple-authentication` per l'accesso Apple nativo su iOS
- Configurare il bundle identifier e le capabilities in Xcode
- Gestire il flusso di revoca del token Apple
- Gestire il caso "hide my email" di Apple (email generata automaticamente)
- Testare su device fisico iOS (Apple Sign-In non funziona nel simulatore)
- Aggiornare `handleOAuthSignIn("apple")` con il vero flusso Supabase + Apple JWT

---

## 14. Criticità residue

- **Apple Sign-In**: Solo placeholder. Richiede configurazione Xcode + Provisioning Profile.
- **Google Sign-In su Expo Go**: L'OAuth con Supabase richiede deep link configurati correttamente.
- **Campi `agent`/`director` nel profilo**: Non hanno sezioni sportive dedicate nel profilo avanzato. Da implementare nelle prossime iterazioni.
