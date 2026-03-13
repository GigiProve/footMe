# Sport experiences fix tests

## Validazione eseguita

### 1. Baseline repository

- `npm ci`
- `npm run lint:mobile`
- `npm run typecheck:mobile`
- `npm run test:mobile`

### Esito baseline

- `lint:mobile`: ok con warning pre-esistenti non correlati
- `typecheck:mobile`: ok
- `test:mobile`: inizialmente bloccato da optional native packages mancanti in questo environment; dopo il fix locale dei package opzionali è stato possibile eseguire la suite

## Test mirati eseguiti

Comando:

```bash
cd /home/runner/work/footMe/footMe
npm run test:mobile -- src/features/profiles/player-sports.test.ts src/features/profiles/player-sports-section.test.tsx src/features/profiles/profile-service-update.test.ts
```

### Esito

- 3 file test eseguiti
- 9 test passati
- 0 test falliti nei test mirati

## Scenari coperti

### Salvataggio

- [x] aggiunta nuova esperienza
- [x] modifica esperienza esistente
- [x] eliminazione esperienza rimossa dal payload
- [x] salvataggio misto di più esperienze (entry esistente + nuova entry)
- [x] preservazione di `team_logo_url`
- [x] preservazione di `competition_name`, statistiche e `sort_order`

Dettaglio copertura:

- `profile-service-update.test.ts`
  - verifica che il save player usi il nuovo RPC atomico `save_player_profile_details`
  - verifica che le nuove esperienze vengano serializzate senza `id` nel payload RPC

### Parsing / mapping

- [x] parsing del form in payload persistibile
- [x] ordinamento per stagione
- [x] normalizzazione stagione

Dettaglio copertura:

- `player-sports.test.ts`

### View mode / card

- [x] rendering badge automatici
- [x] rendering statistiche in formato compatto inline
- [x] ordine esperienze per stagione più recente

Dettaglio copertura:

- `player-sports-section.test.tsx`

## Verifiche manuali effettuate

- [x] revisione del diff per confermare che la sezione esperienze in readonly è ora sotto "Informazioni personali"
- [x] revisione del componente `ExperienceCard` per confermare il layout compatto:
  - nome squadra in evidenza
  - categoria + stagione su riga secondaria
  - statistiche inline
  - badge compatti

## Suite completa

Comando:

```bash
cd /home/runner/work/footMe/footMe
npm run test:mobile
```

### Esito

La suite completa ora è **verde**:

- 24 file test passati
- 80 test passati
- 0 test falliti

Oltre ai test mirati sulle esperienze, sono stati corretti i test UI che fallivano sotto React 19 creando i renderer fuori da `act(...)`:

- `src/ui/sidebar/AppSidebar.test.tsx`
- `src/ui/Button/Button.test.tsx`
- `src/components/ui/screen.test.tsx`
- `src/components/ui/date-picker-field.test.tsx`
- `src/components/ui/media-picker-field.test.tsx`

## Regressioni controllate

- [x] profili senza esperienze: empty state ancora gestito
- [x] profili con una sola esperienza: card compatta leggibile
- [x] profili con più esperienze: ordinamento e card uniformi
- [x] profili con dati logo/statistiche incompleti: fallback numerici e logo shield ancora presenti

## Note residue

- La validazione visiva dell'Experience Card resta confermata tramite revisione del rendering e screenshot del layout aggiornato
- Restano warning non bloccanti di lint in file non correlati al task
