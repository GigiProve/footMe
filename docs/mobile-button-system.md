# Mobile Button System

## Audit iniziale

### Componenti e pattern trovati

| Tipo | Dove | Pattern trovato | Note |
| --- | --- | --- | --- |
| `src/ui/Button/Button.tsx` | design system mobile | `primary`, `secondary`, `hero`, `ghost` | Unico bottone custom, senza size, icone o loading centralizzato |
| `Button` | `app/(auth)/*`, `app/messages/[conversationId].tsx`, `app/(tabs)/announcements.tsx`, `app/(tabs)/profile.tsx`, `app/(onboarding)/profile.tsx`, `src/components/ui/media-picker-field.tsx` | CTA di form e step | Varianti legacy miste tra `primary`, `secondary`, `hero`, `ghost` |
| `Pressable` action | `app/(tabs)/index.tsx`, `messages.tsx`, `network.tsx`, `announcements.tsx`, `profile.tsx`, `onboarding/profile.tsx` | refresh, sign-out, connect, accept/reject, save, cancel, add/remove, filter pill | Padding, radius, bordi e gerarchia non uniformi |
| `Pressable` card/row | `messages.tsx`, `network.tsx`, `onboarding/profile.tsx`, `select-field.tsx`, `date-picker-field.tsx` | card tappabili, picker trigger, option rows | Non tutte sono CTA: alcune restano primitive di navigazione/input |

### Varianti effettivamente viste prima del refactor

| Categoria | Esempi |
| --- | --- |
| CTA principali | `Accedi`, `Registrati`, `Invia candidatura`, `Pubblica annuncio`, `Salva profilo`, `Conferma profilo`, `Invia messaggio` |
| CTA secondarie | `Continua con Google`, `Indietro`, `Annulla`, `Aggiorna dati reali`, `Apri chat`, `Scrivi ora` |
| Azioni leggere | link auth, `← Torna ai messaggi`, `Rimuovi` |
| Azioni distruttive / sensibili | `Rimuovi` (stagione esperienza) |
| Pill/chip action | filtri rete, posizione, ruolo, boolean selector onboarding/profile, ruolo annuncio |

### Inconsistenze riscontrate

- `hero`, `primary`, `ghost` e numerose `Pressable` inline replicavano gerarchie quasi uguali con naming diverso.
- Padding verticali trovati: `10`, `12`, `13`, `14`; radius trovati: `14`, `16`, `18`, `20`, `full`.
- Alcuni disabled state cambiavano solo il booleano, altri avevano anche stile dedicato.
- Il loading era gestito solo tramite testo dinamico, senza affordance comune.
- Le pill dei filtri cambiavano colore attivo tra `textPrimary`, `accent`, `accentStrong`, `hero`.
- Azioni secondarie come `Esci`, `Aggiorna`, `Salva`, `Apri chat` non seguivano una stessa tassonomia.

### Proposta di consolidamento

- Un solo componente condiviso `Button` per CTA, link, chip e azioni distruttive leggere.
- `IconButton` disponibile per futuri casi icon-only con label accessibile obbligatoria.
- Un solo linguaggio visivo: height per size, radius per categoria, loading/disabled centralizzati, pressed feedback comune.

## Tassonomia finale

| Variante | Scopo UX | Usa quando | Non usare quando | Priorità | Background | Testo | Bordo | Pressed / disabled | Icone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `primary` | CTA dominante della view | submit, continue, save finale | annulla, azioni parallele, navigazione leggera | 1 | `colors.accent` | `colors.inkInvert` | `colors.accent` | opacity 0.88 / 0.56 | leading/trailing |
| `secondary` | alternativa importante alla CTA primaria | back, cancel, open chat, refresh | azioni irreversibili | 2 | `colors.surface` | `colors.textPrimary` | `colors.borderStrong` | opacity 0.88 / 0.56 | leading/trailing |
| `tertiary` | azione contestuale leggera | completamento opzionale, support action | CTA dominante | 3 | trasparente | `colors.textPrimary` | trasparente | opacity 0.88 / 0.56 | leading/trailing |
| `danger` | azione distruttiva esplicita | delete/remove/disconnect irreversibile | rifiuta, chiudi, annulla | 1 distruttiva | `colors.danger` | `colors.inkInvert` | `colors.danger` | opacity 0.88 / 0.56 | leading/trailing |
| `link` | micro-action e navigazione testuale | auth switch, back text, inline remove | CTA principali | 4 | trasparente | `colors.accentStrong` | trasparente | opacity 0.88 / 0.56 | leading/trailing |
| `icon` | icon-only action | toolbar, close, overflow, utility action | quando serve testo visibile | 4 | trasparente | `colors.accentStrong` | trasparente | opacity 0.88 / 0.56 | icona obbligatoria |
| `chipAction` | filtri e selezioni multiple | toggle, filtri, boolean selector, role chips | submit o destructive primary | contestuale | `colors.background` / `colors.accentStrong` selected | `colors.textPrimary` / `colors.inkInvert` selected | `colors.border` / `colors.accentStrong` selected | opacity 0.88 / 0.56 | opzionale |

### Size

| Size | Altezza minima | Uso |
| --- | --- | --- |
| `sm` | `44` | chip, inline action, utility CTA |
| `md` | `48` | default app |
| `lg` | `52` | CTA più importante e form step |

## Regole UX obbligatorie

- Al massimo una `primary` dominante per sezione/schermata.
- `danger` solo per azioni semanticamente distruttive o irreversibili.
- `secondary` per alternative alla CTA principale (`Annulla`, `Indietro`, `Aggiorna`, `Messaggia`).
- `link`/`tertiary` per navigazione o azioni leggere.
- `chipAction` per filtri e toggle, mai per submit.
- `loading` disabilita sempre l’interazione e mostra spinner coerente.
- `disabled` usa sempre lo stesso trattamento di opacità via componente condiviso.
- `icon` / `IconButton` richiedono sempre `label` o `accessibilityLabel`.
- Touch target minimo mobile: `44px`.

## Implementazione tecnica

- Nessuna libreria esterna introdotta: il progetto ha già token, primitive e `Ionicons`.
- Nuovi file:
  - `apps/mobile/src/ui/Button/button-tokens.ts`
  - `apps/mobile/src/ui/Button/Button.tsx`
  - `apps/mobile/src/ui/Button/IconButton.tsx`
  - `apps/mobile/src/ui/Button/Button.test.tsx`
- Token usati: `colors`, `spacing`, `radius`, `sizes`, `typography`.
- Prop supportate dal componente condiviso:
  - `variant`
  - `size`
  - `label`
  - `onPress`
  - `disabled`
  - `loading`
  - `fullWidth`
  - `leftIcon`
  - `rightIcon`
  - `destructive`
  - `accessibilityLabel`
  - `testID`

## Migrazione eseguita

### Mapping legacy → nuovo

| Prima | Dopo |
| --- | --- |
| `Button variant="hero"` | `Button variant="primary"` |
| `Button variant="ghost"` | `Button variant="tertiary"` |
| Link auth via `Pressable` + `Text` | `Button variant="link"` |
| Refresh / sign-out / cancel / save inline via `Pressable` | `Button variant="secondary"` o `link` in base al contesto |
| Pill selector custom | `Button variant="chipAction" selected={...}` |
| `Rimuovi` come `Pressable` testuale | `Button variant="link" destructive` |

### File migrati

- `apps/mobile/app/(auth)/sign-in.tsx`
- `apps/mobile/app/(auth)/sign-up.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/messages.tsx`
- `apps/mobile/app/messages/[conversationId].tsx`
- `apps/mobile/app/(tabs)/network.tsx`
- `apps/mobile/app/(tabs)/announcements.tsx`
- `apps/mobile/app/(tabs)/profile.tsx`
- `apps/mobile/app/(onboarding)/profile.tsx`
- `apps/mobile/src/test/react-native.tsx`
- `apps/mobile/src/ui/index.ts`
- `apps/mobile/src/styles/tokens/colors.ts`

### TODO residui

- `SelectField` e `DatePickerField` mantengono `Pressable` perché agiscono come primitive di input e non come CTA del design system.
- Le card tappabili delle liste messaggi/network restano `Pressable` perché sono pattern di navigazione, non bottoni d’azione.

## Esempi

### Corretto

```tsx
<Button
  label="Salva profilo"
  loading={isSaving}
  onPress={handleSave}
  variant="primary"
/>

<Button
  label="Annulla"
  onPress={handleCancel}
  variant="secondary"
/>

<Button
  label="Calciatori"
  onPress={() => setFilter("player")}
  selected={filter === "player"}
  size="sm"
  variant="chipAction"
/>
```

### Errato

```tsx
// secondaria promossa inutilmente a primary
<Button label="Annulla" variant="primary" />

// azione distruttiva ambigua
<Button label="Conferma" destructive variant="secondary" />

// pill reinventata inline
<Pressable style={{ paddingHorizontal: 14, borderRadius: 999 }} />
```

## Regole per futuri contributi

- Non aggiungere nuove varianti senza passare dal design system condiviso.
- Se una nuova CTA sembra “quasi uguale” a una esistente, va mappata a una variante già presente.
- Se l’azione è distruttiva, il copy deve essere esplicito (`Rimuovi stagione`, `Elimina account`, `Disconnetti`).
- Per icon-only usare `IconButton` o `Button variant="icon"` con accessibilità completa.
- Le schermate nuove devono partire dal componente condiviso, non da `Pressable` stilizzate a mano.
