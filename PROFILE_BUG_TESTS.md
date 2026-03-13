## Validazioni eseguite

### CLI / test automatici

- ✅ `cd /home/runner/work/footMe/footMe && npm run lint:mobile`
  - Risultato: **pass**
  - Note: restano solo warning pre-esistenti in file non toccati (`announcements.tsx`, `recruiting-service.ts`).

- ✅ `cd /home/runner/work/footMe/footMe && npm run typecheck:mobile`
  - Risultato: **pass**

- ✅ `cd /home/runner/work/footMe/footMe && npm run test:mobile -- src/features/onboarding/create-initial-profile.test.ts`
  - Risultato: **pass** (7 test)

- ✅ `cd /home/runner/work/footMe/footMe && npm run test:mobile -- src/features/profiles/media-upload-service.test.ts`
  - Risultato: **pass** (3 test)

- ✅ `cd /home/runner/work/footMe/footMe && npm run test:mobile -- src/features/profiles/profile-service.test.ts`
  - Risultato: **pass** (4 test)

## Scenari coperti

### Profilo esistente / legacy

- ✅ Profilo player esistente con fetch completo e career entries
  - Verificato da `profile-service.test.ts`
  - Risultato: caricamento corretto dei dati player e contatti

- ✅ Profilo club_admin con fetch selettivo senza query player career
  - Verificato da `profile-service.test.ts`
  - Risultato: caricamento corretto solo dei dati club

- ✅ Profilo legacy con campi null/mancanti
  - Scenario: `city`, `region`, `nationality`, contatti, array staff e booleani legacy null
  - Verificato da `profile-service.test.ts`
  - Risultato: normalizzazione sicura, fallback coerenti, nessun crash atteso in UI

### Nuovo profilo / onboarding step 2

- ✅ Salvataggio profilo player con trim dei dati base
  - Verificato da `create-initial-profile.test.ts`
  - Risultato: payload profilo e contatti normalizzati correttamente

- ✅ Salvataggio profilo club con slug corretto
  - Verificato da `create-initial-profile.test.ts`
  - Risultato: slug accent-safe confermato

- ✅ Validazione campi base obbligatori
  - Verificato da `create-initial-profile.test.ts`
  - Risultato: errore esplicito con elenco dei campi mancanti

- ✅ Validazione dati società obbligatori
  - Verificato da `create-initial-profile.test.ts`
  - Risultato: messaggio specifico sui campi società mancanti

- ✅ Creazione profilo senza immagine
  - Verificato da `create-initial-profile.test.ts`
  - Risultato: `avatar_url` salvato come `null`, foto non obbligatoria

### Storage / upload avatar

- ✅ Upload asset verso bucket centralizzato `profile-media`
  - Verificato da `media-upload-service.test.ts`
  - Risultato: upload usa bucket corretto e path coerente

- ✅ Errore permessi libreria media
  - Verificato da `media-upload-service.test.ts`
  - Risultato: errore dedicato e chiaro

- ✅ Errore bucket mancante
  - Verificato da `media-upload-service.test.ts`
  - Risultato: mapping su errore specifico `bucket_not_found`, pronto per UX non bloccante

## Verifiche manuali basate su codice

- ✅ Il fallback avatar resta disponibile in UI tramite `withDefaultProfileAvatar(...)`
- ✅ L'onboarding non richiede più la foto profilo per il save dati base
- ✅ I save successivi del profilo non forzano più il placeholder SVG nel database quando l'avatar è assente
- ✅ Il bucket usato dal client è coerente con la migrazione storage (`profile-media`)

## Limiti residui

- Non è stata eseguita una verifica runtime contro un ambiente Supabase reale, quindi la presenza effettiva del bucket va confermata anche nell'ambiente deployato.
- Non è stata acquisita una prova UI runtime da app Expo in questo sandbox; la copertura è stata fatta via lint, typecheck, test mirati e review del flusso.
