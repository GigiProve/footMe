## Bug 1 — Profilo esistente non si carica più

- **Root cause**
  - Il fetch profilo faceva cast diretto dei record Supabase verso tipi UI stretti senza normalizzare i dati legacy.
  - Array e booleani dei profili ruolo-specifici (`coach_profiles`, `staff_profiles`, `player_profiles`) potevano arrivare `null`, mancanti o incompleti e finire in rendering/header con assunzioni non sicure.
  - L'header profilo usava accessi fragili su array legacy (`coached_clubs[0]`, `preferred_regions[0]`) che potevano rompere il rendering.
- **File coinvolti**
  - `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/profile-service.ts`
  - `/home/runner/work/footMe/footMe/apps/mobile/app/(tabs)/profile.tsx`
  - `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/profile-service.test.ts`
- **Fix implementato**
  - Introdotto adapter difensivo `normalizeUserProfile(...)` con normalizzazione di:
    - shape base profilo
    - record ruolo-specifici
    - contatti
    - career entries
  - Aggiunti fallback coerenti per `city`, `region`, `nationality`, `contacts`, `birthDate`, `age`, `profileImage` e array legacy.
  - Resi sicuri gli accessi dell'header profilo con optional chaining sugli array.
- **Rischio regressioni**
  - **Basso**: la UI ora riceve sempre una shape stabile e backward-compatible.
  - Attenzione futura se vengono aggiunti nuovi campi ruolo-specifici senza estendere il normalizer.

## Bug 2 — Upload immagine profilo fallisce con “Bucket not found”

- **Root cause**
  - Il bucket storage era hardcoded nel service upload senza classificazione degli errori.
  - In caso di bucket mancante/configurazione storage non applicata, il flusso restituiva solo l'errore grezzo Supabase (`Bucket not found`) senza distinguere problema tecnico da errore utente.
  - L'onboarding mostrava un messaggio generico di caricamento fallito, poco chiaro rispetto al fatto che la foto è opzionale.
- **File coinvolti**
  - `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/media-upload-service.ts`
  - `/home/runner/work/footMe/footMe/apps/mobile/app/(onboarding)/profile.tsx`
  - `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/media-upload-service.test.ts`
  - `/home/runner/work/footMe/footMe/supabase/migrations/20260312_profile_media_storage.sql`
- **Fix implementato**
  - Centralizzata la costante `PROFILE_MEDIA_BUCKET = "profile-media"`.
  - Introdotta classificazione errori con `ProfileMediaUploadError` (`bucket_not_found`, `permission_denied`, `file_read_failed`, `upload_failed`, `public_url_failed`).
  - Migliorato il messaging onboarding:
    - per avatar opzionale fallito: messaggio esplicito che si può continuare e aggiungere la foto più tardi
    - log tecnico strutturato lato sviluppo con bucket, field e folder.
- **Verifica bucket**
  - Il codice usa in modo coerente il bucket `profile-media`.
  - È presente la migrazione che crea bucket e policy: `/home/runner/work/footMe/footMe/supabase/migrations/20260312_profile_media_storage.sql`.
  - Se l'errore persiste in ambiente reale, il problema residuo è di configurazione/deploy della migrazione storage, non di naming nel client.
- **Rischio regressioni**
  - **Basso** sul client.
  - **Medio** operativo se qualche ambiente non ha ancora applicato la migrazione storage.

## Bug 3 — “Dati base non completi” anche se i campi sono compilati

- **Root cause**
  - Il salvataggio step base usava validazione generica, senza separare chiaramente campi obbligatori, opzionali e dettagli tecnici.
  - L'avatar veniva trasformato subito nel placeholder di default e non trattato come dato realmente opzionale.
  - Gli errori tecnici di persistenza e quelli di validazione venivano mostrati con lo stesso titolo UX (`Dati base non completi`), mascherando la causa reale.
- **File coinvolti**
  - `/home/runner/work/footMe/footMe/apps/mobile/src/features/onboarding/create-initial-profile.ts`
  - `/home/runner/work/footMe/footMe/apps/mobile/app/(onboarding)/profile.tsx`
  - `/home/runner/work/footMe/footMe/apps/mobile/src/features/onboarding/create-initial-profile.test.ts`
  - `/home/runner/work/footMe/footMe/apps/mobile/app/(tabs)/profile.tsx`
- **Fix implementato**
  - Introdotta `validateBaseProfileStep(...)` con elenco esplicito dei campi mancanti.
  - Introdotto `BaseProfileValidationError` per distinguere errori UX da errori tecnici.
  - L'avatar ora viene salvato come `null` se assente sia nella creazione iniziale sia nei successivi save profilo/onboarding dettagli, mentre il fallback visuale resta gestito solo in UI.
  - Lo step 2 non considera più la foto profilo come requisito.
  - Gli alert onboarding ora distinguono:
    - validazione incompleta
    - errore tecnico di salvataggio.
- **Rischio regressioni**
  - **Basso**: il fallback avatar resta presente in UI via `withDefaultProfileAvatar`.
  - Da mantenere coerente in futuro se si introduce validazione server-side più restrittiva.

## Problemi di configurazione trovati

- Il repository contiene la migrazione storage per `profile-media`, quindi il naming client è coerente.
- Se il runtime reale continua a mostrare `Bucket not found`, bisogna verificare che la migrazione storage sia stata applicata all'ambiente Supabase target.

## Hardening aggiunto

- Normalizzazione dati legacy prima del rendering.
- Null safety su campi opzionali e array legacy.
- Distinzione errori di validazione vs errori tecnici.
- Logging strutturato per errori upload media.
- Persistenza avatar opzionale con fallback solo lato UI.
