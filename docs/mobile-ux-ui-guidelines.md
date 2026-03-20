# footMe Mobile UX/UI Guidelines

## Obiettivo del documento

Definire l'interfaccia, i pattern, le icone e le interazioni principali di footMe per iOS e Android.

Il riferimento UX esplicito e' LinkedIn mobile: footMe deve comunicare professionalita', densita' informativa, fiducia e networking, adattando questi principi al contesto del calcio dilettantistico.

> **Documentazione correlata**
>
> - [Design System](./design-system.md) — token esatti, component inventory, file structure
> - [Mobile Button System](./mobile-button-system.md) — tassonomia, varianti e regole dei bottoni

---

## Design direction

### Posizionamento UX

footMe deve apparire come:

- il luogo professionale dove costruire identita' sportiva
- il punto di incontro tra talenti, allenatori, staff e societa'
- un'app affidabile, ordinata e credibile, non una social app caotica

### Principi guida

1. **Professional first**  
   Ogni schermata deve far percepire il valore professionale del profilo prima dell'intrattenimento.

2. **Molto simile a LinkedIn nella struttura**  
   Feed, profili, networking, messaggi e notifiche devono richiamare pattern familiari a chi usa LinkedIn mobile.

3. **Sport identity second layer**  
   Il calcio deve emergere attraverso contenuti, metriche, badge, tag di ruolo e media, senza perdere il rigore di un prodotto professionale.

4. **Mobile-first e thumb-friendly**  
   Le azioni principali devono stare nel raggio del pollice: tab bar, CTA sticky, bottom sheet, quick actions.

5. **Alta leggibilita' e gerarchia forte**  
   Layout modulari, card chiare, spaziature coerenti, sezioni facilmente scansionabili.

6. **Design-system-first**  
   Ogni elemento visivo deve essere costruito a partire dai token e dalle primitive centralizzate. Nessun colore hardcoded, nessun magic number, nessun testo senza `AppText`.

---

## Design system foundation

Il design system di footMe vive in `apps/mobile/src/styles/tokens/` ed e' riesportato via `src/theme/tokens.ts`.

Per la documentazione completa dei token e dei componenti vedere **[design-system.md](./design-system.md)**.

### Scelta tecnica

- Solo React Native + `Pressable` + `StyleSheet` + theme centralizzato.
- Nessuna UI library esterna preconfezionata (no Restyle, no Tamagui, no NativeBase).
- L'obiettivo e' centralizzare il design system senza imporre un look generico.

### Livelli del sistema

| Livello | Cosa contiene | Dove vive |
| --- | --- | --- |
| **Token** | colori, spacing, typography, radius, shadows, sizes, opacity, borders, textPresets, zIndex | `src/styles/tokens/` |
| **Primitive UI (Level 1)** | AppText, Button, Card, Input, Badge, AppAvatar, AppChip, AppSection, AppDivider, AppEmptyState, AppLoader, AppListItem, Icon, IconButton | `src/ui/` |
| **Componenti di prodotto (Level 2)** | ProfileHeader, ProfileSection, ProfileField, BioSection, ContactSection, PersonalInfoSection, PlayerSportsSection, FootballPositionPicker, StatusBadge, ClubRegistrationRequestCard, MediaPickerField, WheelPicker, DatePickerField | `src/features/` e `src/components/ui/` |

### Regole operative

- Tutti i testi devono usare `AppText` con un `preset` semantico, mai `<Text style={{...}}>` inline.
- Tutti i colori devono venire da `colors`, mai stringa hex inline.
- Tutte le spaziature devono usare `spacing[N]`, mai numeri arbitrari.
- Tutte le card di sezione devono usare `AppSection` o il componente `Card`, mai `View` con stili ad hoc.

---

## Personalita' visiva

### Tono visivo

- professionale
- credibile
- pulito
- contemporaneo
- sportivo ma non aggressivo

### Riferimento cromatico

I colori ufficiali vivono in `src/styles/tokens/colors.ts`.

| Token | Valore | Uso |
| --- | --- | --- |
| `accent` | `#0A66C2` | CTA primarie, link, elementi interattivi |
| `accentStrong` | `#004182` | Stato attivo, hero elements |
| `accentSoft` | `#E8F3FF` | Background chip, highlight leggeri |
| `background` | `#F4F8FB` | Sfondo app |
| `backgroundStrong` | `#E7F0F8` | Cover area, sfondi sezione |
| `surface` | `#FFFFFF` | Card, sheet, modali |
| `surfaceMuted` | `#EEF3F8` | Superfici disabilitate, placeholder |
| `textPrimary` | `#1D2226` | Titoli, body text |
| `textSecondary` | `#5E6E7E` | Descrizioni, metadati |
| `textMuted` | `#7A8896` | Hint, timestamp |
| `border` | `#D6E1EB` | Divisori, bordi card |
| `borderStrong` | `#A8BECE` | Bordi CTA secondarie |
| `hero` | `#004182` | Hero headline, deep link |
| `heroSoft` | `#DCEBFA` | Hero background |
| `danger` | `#B42318` | Azioni distruttive |
| `dangerSoft` | `#FEE4E2` | Background danger |
| `success` | `#027A48` | Stati positivi |
| `successSoft` | `#D1FADF` | Background successo |
| `warning` | `#B54708` | Avvisi |
| `warningSoft` | `#FEF0C7` | Background warning |
| `inkInvert` | `#FFFFFF` | Testo su sfondo scuro |

### Scala tipografica

I text preset semantici vivono in `src/styles/tokens/textPresets.ts` e sono consumati tramite `<AppText preset="...">`.

| Preset | Size | Weight | Colore default | Uso |
| --- | --- | --- | --- | --- |
| `display` | 34 | 800 | textPrimary | Hero onboarding, splash |
| `h1` | 28 | 800 | textPrimary | Titoli pagina |
| `h2` | 24 | 800 | textPrimary | Titoli sezione |
| `h3` | 20 | 700 | textPrimary | Titoli card |
| `title` | 17 | 700 | textPrimary | Nomi lista, gruppi campi |
| `body` | 16 | 400 | textPrimary | Body copy default |
| `bodySmall` | 14 | 400 | textSecondary | Metadati, descrizioni |
| `caption` | 12 | 700 | textSecondary | Label, timestamp |
| `meta` | 12 | 700 | textMuted | Label uppercase, hint micro |

### Traduzione dello stile "simile a LinkedIn"

Per avvicinarsi a LinkedIn, il linguaggio UI deve usare:

- header semplici e stabili
- card feed con bordo leggero e gerarchia contenuto > decorazione
- profili modulari a sezioni (`AppSection`)
- tab bar persistente
- search bar dominante nelle schermate ad alta scoperta
- CTA sobrie, piene e molto leggibili (`Button variant="primary"`)
- grande uso di avatar (`AppAvatar`), badge (`Badge`, `AppChip`), meta-informazioni e contatori

Da evitare:

- gradienti forti
- animazioni vistose
- layout troppo editoriali
- icone troppo illustrative o playful
- `<Text>` con stili inline — usare sempre `<AppText preset="...">` 
- colori e spaziature hardcoded — usare sempre token

---

## Information architecture

### Navigazione primaria

La struttura principale deve essere il piu' possibile vicina a LinkedIn mobile:

1. **Home**
2. **Network**
3. **Messaggi**
4. **Annunci**
5. **Profilo**

### Tab bar inferiore

Pattern raccomandato:

- icona sopra, label sotto
- stato attivo con colore `accent` (`#0A66C2`)
- stato inattivo con `textMuted` (`#7A8896`)
- badge numerico su Messaggi e Network quando necessario
- altezza tab bar: `sizes.tabBarHeight` (72px)

### Top app bar

La top bar deve variare poco tra le sezioni principali:

- avatar (tramite `AppAvatar size="sm"`) o logo profilo in alto a sinistra
- search bar tappabile al centro o full width
- icona notifiche in alto a destra

Questo e' il pattern piu' vicino a LinkedIn e deve diventare la base delle schermate Home, Network e Annunci.

---

## Mappa delle schermate principali

### 1. Home / Feed

Obiettivo: mostrare contenuti dei contatti, societa' seguite, update professionali e annunci rilevanti.

Struttura:

- top bar con avatar (`AppAvatar`), search, notifiche
- composer compatto
- moduli feed
- card annunci sponsorizzati o suggeriti integrate nel feed

Pattern chiave:

- composer "Condividi un aggiornamento"
- post card con avatar, nome, ruolo, squadra, tempo, contenuto, media
- barra azioni: Mi interessa, Commenta, Salva, Condividi internamente
- separazione visiva leggera tra card (`AppDivider`)

### 2. Network

Obiettivo: gestire collegamenti e suggerimenti.

Struttura:

- search e filtri rapidi (`AppChip variant="default|selected"`)
- inviti ricevuti
- suggeriti per te
- persone visitate di recente

Pattern chiave:

- card persona con CTA primaria "Collegati" (`Button variant="primary" size="sm"`)
- CTA secondaria "Segui" (`Button variant="secondary" size="sm"`)
- contesto sintetico: ruolo, club, categoria, regione, disponibilita'
- lista con `AppListItem` + `AppAvatar size="md"` + metadati via `AppText preset="bodySmall"`

### 3. Messaggi

Obiettivo: permettere conversazioni 1:1 con un'esperienza essenziale e professionale.

Struttura:

- search conversazioni
- elenco thread (`AppListItem` con avatar e anteprima)
- thread detail con composer sticky

Pattern chiave:

- lista conversazioni molto densa ma leggibile
- unread dot o badge (`Badge variant="accent"`)
- anteprima ultimo messaggio (`AppText preset="bodySmall"`)
- quick actions da swipe leggere solo se davvero utili

### 4. Annunci

Obiettivo: supportare recruiting e candidature.

Struttura:

- search bar
- filtri sticky (`AppChip`)
- lista annunci (`Card` con contenuti strutturati)
- dettaglio annuncio
- CTA candidatura persistente nel dettaglio (`Button variant="primary" fullWidth`)

Pattern chiave:

- card annuncio con ruolo, categoria, regione, benefit, data
- stato salvato
- stato candidatura
- evidenza forte di match con il profilo utente

### 5. Profilo

Obiettivo: rendere il profilo il centro dell'identita' professionale, come avviene su LinkedIn.

Struttura implementata:

- **ProfileHeader**: cover area + avatar (`AppAvatar size="xl"`) + nome (`AppText preset="h1"`) + ruolo (`AppText preset="title"`) + badge (`AppChip variant="accent"`)
- **ProfileSection** / **AppSection**: card bianca con titolo (`AppText preset="h3"`), divider, e contenuto
- **ProfileField**: campo con label (`AppText preset="meta"`) e valore readonly/editabile
- sezioni specifiche: BioSection, ContactSection, PersonalInfoSection, PlayerSportsSection

Pattern chiave:

- header ad alta fiducia con cover e avatar overlapato
- moduli editabili a blocchi: tap sull'icona edit per passare a edit mode
- readonly mode privilegiato — i campi compilati mostrano sfondo `accentSoft`, quelli vuoti sfondo `surfaceMuted` con placeholder "Da completare"
- CTA contestuali: Messaggio, Collegati, Segui, Candidati
- progressivo completamento profilo con nudges

---

## Componenti primitivi (Level 1)

Tutte le primitive vivono in `src/ui/` e sono esportate da `src/ui/index.ts`.
Per la documentazione completa con esempi di codice, vedere **[design-system.md](./design-system.md)**.

### AppText

Primitiva tipografica universale. Ogni testo visibile deve passare da `AppText`.

```tsx
<AppText preset="h1">Titolo pagina</AppText>
<AppText preset="body" color="textSecondary">Descrizione</AppText>
<AppText preset="meta">LABEL CAMPO</AppText>
```

Props: `preset`, `color`, `align`, `numberOfLines`, `style`, `testID`

### Button

CTA unificata con varianti, size, loading e icone.

Varianti: `primary`, `secondary`, `tertiary`, `danger`, `link`, `icon`, `chipAction`  
Sizes: `sm` (44px), `md` (48px), `lg` (52px)

Per la tassonomia completa e le regole UX, vedere **[mobile-button-system.md](./mobile-button-system.md)**.

### Card

Superficie contenitore con bordo e elevazione opzionale.

Varianti: `default` (surface + border), `muted` (surfaceMuted), `inverse` (surfaceInverse)

### Input

Input testuale con label, stato focus/filled e scroll keyboard-aware.

### AppAvatar

Avatar circolare o rettangolare arrotondato con fallback icon.

Sizes: `sm` (32px), `md` (48px), `lg` (72px), `xl` (104px)

```tsx
<AppAvatar imageUrl={player.avatarUrl} size="lg" />
<AppAvatar imageUrl={club.logoUrl} size="md" rounded />
```

### AppChip

Tag compatto per filtri e selezioni.

Varianti: `default`, `selected`, `accent`, `muted`

```tsx
<AppChip label="Attaccante" variant="accent" />
<AppChip label="Under 21" onPress={toggle} variant={active ? "selected" : "default"} />
```

### AppSection

Card sezione stile LinkedIn: titolo, descrizione opzionale, divider, contenuto.

```tsx
<AppSection title="Esperienze" description="Le tue esperienze calcistiche">
  <ExperienceCard ... />
</AppSection>
```

### AppDivider

Linea separatrice orizzontale 1px con spacing opzionale.

### AppEmptyState

Placeholder standardizzato per stati vuoti con icona, titolo, descrizione e azione.

```tsx
<AppEmptyState
  icon="football-outline"
  title="Nessuna esperienza"
  description="Aggiungi la tua prima esperienza calcistica."
  action={<Button label="Aggiungi" onPress={...} />}
/>
```

### AppLoader

Indicatore di caricamento centrato con label opzionale.

```tsx
<AppLoader label="Caricamento profilo..." />
```

### AppListItem

Riga lista generica con accessori leading/trailing.

```tsx
<AppListItem
  leading={<AppAvatar imageUrl={url} size="sm" />}
  trailing={<Icon name="chevron-forward" />}
  onPress={goToProfile}
>
  <AppText preset="title">Mario Rossi</AppText>
  <AppText preset="bodySmall">Centrocampista - AS Roma</AppText>
</AppListItem>
```

### Badge

Badge di stato con varianti colore: `default`, `inverse`, `accent`, `hero`, `selected`.

### Icon / IconButton

Sistema icone basato su Ionicons. Outline per stato default, filled per stato attivo.

---

## Componenti di prodotto (Level 2)

Costruiti sopra le primitive, vivono in `src/features/` e `src/components/ui/`.

### Profilo

| Componente | Descrizione |
| --- | --- |
| `ProfileHeader` | Cover + avatar + nome + meta + badge, con toggle edit |
| `ProfileSection` / `ProfileSectionCard` | Wrapper card per sezioni profilo (usa AppText h3 + AppDivider) |
| `ProfileField` | Campo con label meta e valore readonly/editabile |
| `BioSection` | Sezione bio con display/edit mode |
| `ContactSection` | Info contatto con controlli visibilita' |
| `PersonalInfoSection` | Campi dati personali |
| `PlayerSportsSection` | Statistiche e posizione sportiva |

### Form specializzati

| Componente | Descrizione |
| --- | --- |
| `FootballPositionPicker` | Selettore visuale ruolo/posizione su campo |
| `WheelPicker` | Selettore a rotella per altezza/peso |
| `MediaPickerField` | Picker immagini/video con preview |
| `DatePickerField` | Input data con picker nativo |
| `NationalityAutocompleteInput` | Autocomplete nazionalita' con bandiere emoji |
| `ResidenceCityInput` | Autocomplete citta' italiane con selezione obbligatoria |
| `PhoneInputWithCountryCode` | Input telefono con prefisso paese |

### Admin

| Componente | Descrizione |
| --- | --- |
| `StatusBadge` | Indicatore stato verifica club (usa AppText) |
| `ClubRegistrationRequestCard` | Card richiesta club con metadati (usa AppText + Card) |
| `EmptyState` | Wrapper admin di AppEmptyState |

---

## Pattern UI fondamentali

### 1. Search pattern

footMe deve usare una search bar molto prominente, ispirata a LinkedIn.

Regole:

- search sempre visibile o immediatamente accessibile in Home, Network e Annunci
- placeholder guidati: "Cerca giocatori, allenatori, squadre..."
- filtri avanzati in bottom sheet
- ricerche recenti e suggerimenti salvati
- filtri rapidi come `AppChip` con `variant="selected"` per lo stato attivo

### 2. Card pattern

Le card sono il pattern dominante dell'app. Usare sempre il componente `Card` o `AppSection`.

Specifiche implementate:

- fondo `surface` (`#FFFFFF`)
- bordo `border` (`#D6E1EB`), `borders.thin` (1px)
- `radius[24]` (24px)
- `shadows.card` per elevazione opzionale
- padding interno `spacing[18]` (18px)
- gap interno `spacing[12]` (12px)
- gerarchia: header > body > azioni

Varianti Card disponibili:

| Variante | Background | Bordo | Uso |
| --- | --- | --- | --- |
| `default` | `surface` | `border` + 1px | Card standard |
| `muted` | `surfaceMuted` | nessuno | Card secondaria |
| `inverse` | `surfaceInverse` | nessuno | Card su sfondo scuro |

Tipologie di card di prodotto:

- profile card (ProfileHeader + ProfileSection)
- announcement card (Card + AppText presets)
- club card (Card + AppAvatar rounded + AppText)
- message preview card (AppListItem dentro Card)
- experience card (AppSection + ProfileField)

### 3. CTA pattern

Le CTA sono gestite dal componente unificato `Button`. Per la documentazione completa vedere **[mobile-button-system.md](./mobile-button-system.md)**.

#### CTA primarie (`Button variant="primary"`)

Uso: Collegati, Candidati, Completa profilo, Pubblica annuncio, Salva profilo

Stile: filled `accent` (`#0A66C2`), testo `inkInvert`, min-height `sizes.touchTarget` (44px)

#### CTA secondarie (`Button variant="secondary"`)

Uso: Segui, Messaggio, Modifica, Annulla, Indietro

Stile: outline `borderStrong`, testo `textPrimary`

#### CTA terziarie (`Button variant="tertiary"`)

Uso: Mostra altro, Visualizza tutti, Rimuovi filtro

Stile: testo `textPrimary`, nessun contenitore pesante

#### CTA distruttive (`Button variant="danger"`)

Uso: Elimina, Rimuovi, Disconnetti

Stile: filled `danger`, testo `inkInvert`

#### CTA link (`Button variant="link"`)

Uso: link auth, navigazione leggera, azioni inline

Stile: testo `accentStrong`, nessun contenitore

#### CTA chip (`Button variant="chipAction"`)

Uso: filtri toggle, boolean selector, ruolo

Stile: bordo `border`, quando selected sfondo `accentStrong` + testo `inkInvert`

Regola fondamentale: **al massimo una `primary` per sezione/schermata**. In liste dense usare `secondary` anche per l'azione principale della card.

### 4. Form pattern

I form devono seguire un modello professionale e lineare.

Regole:

- un solo obiettivo per schermata o per step
- label sempre visibile (tramite prop `label` dell'Input o `AppText preset="meta"`)
- helper text breve
- validazione inline
- CTA sticky in fondo quando il task e' critico

Per onboarding e recruiting:

- usare progressione step-by-step
- salvare bozze
- precompilare dal profilo quando possibile

#### Input component

Il componente `Input` (`src/ui/Input/Input.tsx`) gestisce centralmente:

- label opzionale (`AppText preset` di fatto via prop)
- stato focus con bordo `accentStrong` e sfondo `surface`
- stato filled con bordo `accentSoft` e sfondo `surface`
- stato default con bordo `border` e sfondo `background`
- supporto multiline con `minHeight` da `sizes.multilineFieldMinHeight`
- integrazione automatica con `KeyboardAwareScrollView`

#### Componenti form specializzati

| Componente | Uso |
| --- | --- |
| `Input` | Testo singolo/multiline |
| `FootballPositionPicker` | Selezione ruolo su campo visuale |
| `WheelPicker` | Altezza, peso, valori numerici a rotella |
| `MediaPickerField` | Upload foto/video con preview |
| `DatePickerField` | Selezione data |
| `NationalityAutocompleteInput` | Autocomplete nazionalita' con bandiera |
| `ResidenceCityInput` | Autocomplete citta' italiane |
| `PhoneInputWithCountryCode` | Telefono con prefisso internazionale |

#### Gestione tastiera nei form — KeyboardAwareForm

L'utente deve **sempre** vedere il campo in cui sta scrivendo.
Mai coprire un input con la tastiera: e' una regola UX di base, non una feature opzionale.

Ogni schermata che contiene input di testo deve essere wrappata con il componente `KeyboardAwareForm` (`src/components/ui/keyboard-aware-form.tsx`).

Questo componente:

- rileva l'apertura e la chiusura della tastiera su iOS e Android
- aggiunge padding dinamico in fondo alla schermata (default 24px extra per CTA)
- scrolla automaticamente verso il campo attivo
- tiene i pulsanti (Salva, Continua, Conferma) sempre visibili sopra la tastiera
- chiude la tastiera con tap fuori dall'input
- supporta campi singoli, multilinea (bio, descrizioni) e form complessi

Esempio di utilizzo:

```tsx
<Screen>
  <KeyboardAwareForm contentContainerStyle={styles.container}>
    <Input label="Nome" value={name} onChangeText={setName} />
    <Input label="Bio" multiline value={bio} onChangeText={setBio} />
    <Button label="Salva" onPress={handleSave} variant="primary" />
  </KeyboardAwareForm>
</Screen>
```

Regole operative:

- **usare sempre `KeyboardAwareForm`** per schermate con input: onboarding, profilo, bio, esperienze, contatti, annunci, chat composer
- **non usare `ScrollView` o `View` nudi** come contenitore di form
- per schermate di sola lettura o liste senza input, usare `KeyboardAwareScrollView` direttamente
- non fare fix locali per la tastiera nelle singole schermate: la soluzione e' centralizzata

### 5. Readonly vs Edit mode

Il profilo footMe adotta un pattern chiaro di separazione tra lettura e modifica:

- **Readonly mode** (default): i campi compilati mostrano sfondo `accentSoft` con bordo `accentSoft`, i campi vuoti mostrano sfondo `surfaceMuted` con bordo `border` e testo "Da completare"
- **Edit mode**: attivato dal pulsante edit nell'header, sostituisce i campi readonly con `Input` editabili
- Il toggle edit/view e' controllato da un singolo stato `isEditing` nel `ProfileHeader`

### 6. Bottom sheet pattern

Da usare per:

- filtri avanzati
- quick actions sul profilo
- segnalazioni o blocco
- selezione disponibilita'

Regole:

- altezza iniziale media
- chiusura con swipe down e tap esterno
- CTA primaria nel footer per conferma (`Button variant="primary" fullWidth`)

### 7. Empty, loading, error states

#### Empty state — `AppEmptyState`

Componente centralizzato con icona, titolo, descrizione e azione opzionale.

Deve sempre:

- spiegare il valore della sezione
- suggerire l'azione successiva
- usare una CTA unica e chiara

```tsx
<AppEmptyState
  icon="people-outline"
  title="Nessun collegamento ancora"
  description="Inizia dal tuo ruolo o dalla tua regione."
  action={<Button label="Esplora rete" variant="primary" onPress={...} />}
/>
```

#### Loading — `AppLoader`

Componente centralizzato con spinner e label opzionale.

Pattern:

- skeleton su feed, card profilo, lista annunci (futuro)
- `AppLoader` per attese corte o azioni bloccanti
- loading inline sulle CTA tramite `Button loading={true}`

```tsx
<AppLoader label="Caricamento profilo..." />
```

#### Error

Pattern:

- messaggio breve via `AppText preset="body"`
- linguaggio chiaro
- CTA "Riprova" (`Button variant="secondary"`)

---

## Spacing e layout rhythm

Tutte le spaziature usano i token da `spacing.ts`. Scala: 0, 2, 4, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 28, 32, 40, 48, 56, 64.

| Contesto | Token | Valore |
| --- | --- | --- |
| Padding schermata orizzontale | `spacing[20]` | 20px |
| Padding schermata verticale | `spacing[24]` | 24px |
| Gap tra sezioni | `spacing[12]` | 12px |
| Gap interno card | `spacing[12]` – `spacing[14]` | 12-14px |
| Gap interno campi form | `spacing[8]` | 8px |
| Gap titolo-sottotitolo | `spacing[4]` | 4px |
| Gap badge row | `spacing[8]` | 8px |
| Padding interno card | `spacing[18]` | 18px |

L'app deve dare sensazione di ordine sistemico. Non costruire schermate con spaziature ad hoc.

---

## Icon system

### Famiglia icone

footMe usa Ionicons (`@expo/vector-icons/Ionicons`) cross-platform.

Per mantenere coerenza:

- stile outline per stato default (`-outline` suffix)
- stile filled per stato attivo (no suffix)
- stroke regolare
- niente icone cartoon o decorative
- size da token: `sizes.iconSm` (16), `sizes.iconMd` (20), `sizes.iconLg` (24), `sizes.iconXl` (32)

### Mappa icone principali

| Funzione | Icona Ionicons | Uso |
| --- | --- | --- |
| Home | `home-outline` / `home` | Tab Home |
| Network | `people-outline` / `people` | Collegamenti, suggeriti |
| Messaggi | `chatbubbles-outline` / `chatbubbles` | Inbox e chat |
| Annunci | `megaphone-outline` / `megaphone` | Recruiting e opportunita' |
| Profilo | `person-circle-outline` / `person-circle` | Profilo utente |
| Cerca | `search-outline` | Search bar |
| Notifiche | `notifications-outline` / `notifications` | Centro notifiche |
| Salva | `bookmark-outline` / `bookmark` | Post, annunci, profili |
| Like/interesse | `heart-outline` / `heart` | Interazione contenuti |
| Commento | `chatbubble-outline` | Commenti |
| Condividi | `share-outline` | Condivisione interna |
| Video highlights | `play-circle-outline` | Media sportivi |
| Statistiche | `stats-chart-outline` | Dati performance |
| Club | `shield-outline` / `shield` | Team e societa' |
| Posizione/area | `location-outline` | Regione e localita' |
| Modifica | `create-outline` | Edit profilo/contenuti |
| Chiudi | `close-outline` | Chiusura modale/edit |
| Filtri | `options-outline` | Search e discovery |
| Football | `football-outline` | Contesto sportivo |

---

## Interaction patterns

### Micro-interazioni principali

### Tap

Il tap e' l'interazione dominante.

Usi principali:

- apertura card
- attivazione CTA
- navigazione ai dettagli
- focus sulla search

Feedback: `opacity.pressed` (0.88) su tutti gli elementi tappabili.

### Long press

Da limitare ai contesti ad alta utilita':

- quick actions su messaggi
- gestione post propri
- copia o segnala contenuti

### Swipe

Uso moderato, non invasivo:

- pull-to-refresh su feed, network e annunci
- swipe down per chiudere bottom sheet
- eventuale swipe in messaggi solo per archiviare o segnare come letto

### Sticky action

Da usare nei task ad alta intenzione:

- Candidati ad annuncio
- Salva profilo
- Completa onboarding

### Inline expansion

Come su LinkedIn, i contenuti lunghi devono aprirsi inline con:

- "Mostra altro" (`Button variant="link"`)
- "Mostra meno" (`Button variant="link"`)

---

## Pattern di interazione per schermata

### Feed

- pull-to-refresh
- like/comment/save/share dalla action row
- tap su avatar (`AppAvatar`) o nome apre profilo
- tap su media apre viewer
- tap su annuncio embedded apre dettaglio annuncio

### Profilo

- `ProfileHeader` con toggle edit/view
- sezioni in `AppSection` / `ProfileSection` con contenuti readonly o editabili
- edit entry point tramite icona nel header (pencil → X quando attivo)
- floating nudge per completamento profilo se incompleto

### Networking

- tap rapido su "Collegati" (`Button variant="primary" size="sm"`)
- feedback immediato con stato inviato
- suggerimenti rinfrescabili
- filtri veloci per ruolo, categoria, regione (`AppChip`)

### Annunci

- filtri sticky (`AppChip`)
- salvataggio con un tap
- candidatura guidata con conferma finale
- stato candidatura visibile subito nella card e nel dettaglio

### Messaggi

- tap thread apre conversazione (via `AppListItem`)
- composer sempre accessibile (`KeyboardAwareForm`)
- stato inviato/letto discreto
- allegati o media in fase successiva, non protagonisti nell'MVP

---

## Content patterns

### Struttura dei profili

Come in LinkedIn, il profilo deve essere costruito come una sequenza di moduli professionali.

Ogni sezione usa `AppSection` (o il wrapper `ProfileSection`) con:
- titolo in `AppText preset="h3"`
- descrizione in `AppText preset="bodySmall"` (opzionale)
- `AppDivider` tra header e contenuto
- campi in `ProfileField` con label `AppText preset="meta"` e valore readonly/editabile

### Profilo giocatore

Ordine raccomandato:

1. `ProfileHeader` — hero identity (cover + avatar xl + nome h1 + ruolo title + badge `AppChip`)
2. `PlayerSportsSection` — ruolo (FootballPositionPicker), altezza/peso (WheelPicker), piede, disponibilita'
3. `BioSection` — summary
4. esperienze stagionali (AppSection + esperienza card)
5. statistiche
6. highlights video (MediaPickerField)
7. `ContactSection` — contatti con visibilita'
8. `PersonalInfoSection` — dati personali, citta' (ResidenceCityInput), nazionalita' (NationalityAutocompleteInput)

### Profilo allenatore

Ordine raccomandato:

1. `ProfileHeader` — hero identity
2. licenze
3. filosofia di gioco
4. esperienze
5. categorie allenate
6. disponibilita'
7. contenuti tecnici

### Profilo staff

Ordine raccomandato:

1. `ProfileHeader` — hero identity
2. specializzazione
3. esperienze
4. certificazioni
5. disponibilita'

### Profilo societa'

Ordine raccomandato:

1. `ProfileHeader` con `clubMode=true` — hero club (logo `AppAvatar rounded` + nome)
2. categoria, campionato, citta'
3. about club
4. staff
5. rosa
6. annunci attivi
7. update recenti
8. shop in fase successiva

---

## LinkedIn-inspired patterns da adottare esplicitamente

Per soddisfare l'indicazione di rendere l'app piu' simile possibile a LinkedIn, footMe deve adottare i seguenti pattern strutturali:

1. **Feed come punto di ingresso principale**
2. **Top search sempre molto visibile**
3. **Profilo come pagina modulare a blocchi professionali** (tramite `AppSection`)
4. **Network come sezione dedicata a inviti e suggeriti** (filtri con `AppChip`)
5. **Messaggistica separata e persistente**
6. **Notifiche accessibili da top bar**
7. **Gerarchia dei contenuti densa ma pulita** (tramite text presets: h1 > h3 > title > body > bodySmall > caption > meta)
8. **Card con meta-informazioni, badge e CTA discrete** (tramite `Card` + `AppChip` + `Button variant="secondary"`)
9. **Un solo primary action per view** — mai due `Button variant="primary"` nella stessa sezione
10. **Contenuto prima dei controlli** — readonly mode privilegiato, edit mode separato
11. **Status e disponibilita' espressi con badge/chip** — mai testo casuale, sempre `AppChip` o `Badge`

Le differenze distintive footMe devono stare nei contenuti:

- carriera sportiva invece di esperienza lavorativa generica
- statistiche e highlights invece di soli post professionali
- annunci calcistici invece di job generici
- disponibilita' sportiva e mobilita' geografica come segnali chiave

---

## Motion e feedback

Le animazioni devono essere sobrie.

Linee guida:

- durata 120-220ms per micro-transizioni
- easing morbido
- feedback press con `opacity.pressed` (0.88) — centralizzato nei componenti
- niente motion scenografico nel feed
- stato disabled con `opacity.disabled` (0.56) — centralizzato nei componenti

Feedback richiesti:

- conferma visiva immediata su salva, collega, candidati
- toast brevi per azioni riuscite
- stato loading locale sulle CTA (`Button loading={true}` con spinner centralizzato)

---

## Accessibilita'

Requisiti minimi:

- target touch >= `sizes.touchTarget` (44px)
- contrasto elevato per testo e CTA (palette colori progettata per WCAG AA)
- label chiare per screen reader (`accessibilityLabel` su tutti i `Button` e `IconButton`)
- icone mai lasciate senza testo nelle azioni critiche (`IconButton` richiede `label`)
- non affidare significato solo al colore — stati sempre espressi anche con testo o icona

---

## Priorita' di progettazione per MVP

Ordine consigliato:

1. navigazione globale
2. feed home
3. profilo professionale
4. networking
5. annunci recruiting
6. messaggi
7. notifiche

---

## Deliverable UX raccomandati

Questo documento deve guidare la produzione dei prossimi artefatti:

- wireframe low fidelity delle 5 sezioni principali
- component inventory mobile (gia' documentato in [design-system.md](./design-system.md))
- libreria UI base (gia' implementata in `src/ui/`)
- flussi onboarding per ruolo
- flusso candidatura ad annuncio
- flusso collegamento e messaggio
- Figma component library (basata sui token e primitive documentati)

---

## Decisione finale di design

La UI di footMe deve essere progettata come **"LinkedIn per il calcio dilettantistico"**:

- stessa chiarezza strutturale
- stessa logica di networking professionale
- stessa densita' informativa controllata
- stessa centralita' del profilo e del feed
- stessa disciplina sistemica: token centralizzati, componenti riusabili, zero duplicazione

con un livello visivo e semantico adattato al mondo football tramite ruolo, statistiche, highlights, club, annunci e disponibilita' sportiva.

Ogni contributo UI deve partire dai componenti esistenti (`AppText`, `Button`, `Card`, `AppSection`, `AppAvatar`, `AppChip`, etc.) e dai token centralizzati. Nessun colore hardcoded, nessun magic number, nessun `<Text style={{...}}>` inline.
