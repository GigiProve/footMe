# BIO Section Tests

## Automated checks

- `npm run lint:mobile`
  - Esito: ✅
  - Note: restano solo warning preesistenti fuori scope in `announcements.tsx` e `recruiting-service.ts`.
- `npm run typecheck:mobile`
  - Esito: ✅
- `npm run test:mobile -- src/features/profiles/profile-form-utils.test.ts src/features/profiles/bio-section.test.tsx src/features/discovery/discovery-service.test.ts`
  - Esito: ✅

## Scenari coperti

### Validazione bio

- [x] Bio inferiore a 20 caratteri
- [x] Bio valida
- [x] Bio a 400 caratteri
- [x] Tentativo oltre 400 caratteri
- [x] Bio con soli spazi
- [x] Bio con pattern ripetitivi/spam evidenti
- [x] Bio vuota gestita come stato legacy/optional

### UI componente Bio

- [x] Stato vuoto readonly con testo `Da completare`
- [x] Edit mode con textarea multilinea
- [x] Contatore caratteri dinamico
- [x] Messaggio errore vicino al campo
- [x] Stato near-limit del contatore
- [x] Espansione `Mostra di più` / `Mostra meno`

### Profilo pubblico / discovery

- [x] Il risultato profilo in `Rete` riceve il campo `bio` dal layer di discovery
- [x] La Bio viene mostrata sotto il nome nel card profilo discovery
- [x] Compatibilità con `bio: null`, `bio: undefined`, `bio: ""`

### Salvataggio

- [x] Validazione condivisa applicata in modifica profilo
- [x] Validazione condivisa applicata anche nel completamento onboarding
- [x] Nessun input oltre 400 caratteri viene normalizzato/salvato

## Verifica visuale

- Preview screenshot di riferimento fornita per la PR:
  - https://github.com/user-attachments/assets/94de7dcf-c56e-4a09-9a3d-5d83073eb0a6

## Limiti noti della verifica locale

- In sandbox non era disponibile un simulatore React Native nativo, quindi la verifica visuale è stata effettuata tramite preview statica aderente ai token/UI implementati e test dei componenti.
