# FootMe — Script completo per mockup Figma

> Questo documento contiene tutte le specifiche necessarie per ricreare fedelmente ogni schermata dell'app FootMe in Figma. L'app e' un network professionale per il calcio dilettantistico italiano, costruita con React Native (Expo). Lo stile visivo e' ispirato a LinkedIn: pulito, professionale, card-based, con gerarchia tipografica chiara.

---

## 1. DESIGN SYSTEM — TOKEN

### 1.1 Colori

| Nome | Hex | Uso |
|------|-----|-----|
| background | `#F4F8FB` | Sfondo globale di tutte le schermate |
| backgroundStrong | `#E7F0F8` | Sfondo cover area del profilo |
| surface | `#FFFFFF` | Sfondo card, input, elementi in primo piano |
| surfaceMuted | `#EEF3F8` | Sfondo card muted, placeholder avatar, edit button |
| textPrimary | `#1D2226` | Testo principale (nomi, titoli, body) |
| textSecondary | `#5E6E7E` | Testo secondario (meta, descrizioni) |
| textMuted | `#7A8896` | Testo tenue (label, placeholder, caption) |
| textInverseMuted | `rgba(255,255,255,0.78)` | Testo su sfondo scuro (muted) |
| textInverseSoft | `rgba(255,255,255,0.84)` | Testo su sfondo scuro (soft) |
| accent | `#0A66C2` | Colore primario (pulsanti, link, focus) |
| accentStrong | `#004182` | Accent intenso (pulsanti hover, testo link) |
| accentSoft | `#E8F3FF` | Sfondo accent leggero (badge, avatar fallback) |
| hero | `#004182` | Colore hero per brand e badge speciali |
| heroSoft | `#DCEBFA` | Sfondo hero leggero |
| border | `#D6E1EB` | Bordo card e divisori |
| borderStrong | `#A8BECE` | Bordo pulsanti secondary |
| danger | `#B42318` | Azioni distruttive |
| dangerSoft | `#FEE4E2` | Sfondo danger leggero |
| dangerStrong | `#912018` | Testo danger intenso |
| inkInvert | `#FFFFFF` | Testo su sfondo scuro/accent |
| surfaceInverse | `#1D2226` | Sfondo scuro (hero banner, card inverse) |
| surfaceOverlay | `rgba(255,255,255,0.16)` | Overlay su sfondo scuro |
| success | `#16A34A` | Colore successo |
| successSoft | `#DCFCE7` | Sfondo successo leggero |
| warning | `#D97706` | Colore avviso |
| warningSoft | `#FEF3C7` | Sfondo avviso leggero |
| buttonDisabled | `#A7C6E6` | Sfondo pulsanti disabilitati |
| shadow | `rgba(15, 23, 42, 0.08)` | Colore ombre |

### 1.2 Spacing (scala in px)

```
0, 4, 6, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48
```

### 1.3 Border Radius (scala in px)

```
8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, full (999 = cerchio perfetto)
```

- **Card default:** radius 12
- **Pulsanti standard:** radius 16
- **Chip e badge:** radius full (999)
- **Hero banner:** radius 28
- **Input:** radius 16

### 1.4 Ombre

| Livello | shadowRadius | shadowOffset Y | elevation | Uso |
|---------|-------------|----------------|-----------|-----|
| subtle | 6px | 2px | 1 | Righe lista, sollevamento leggero |
| card | 18px | 8px | 3 | Card contenuto (quando elevated) |
| elevated | 24px | 12px | 6 | Modali, elementi flottanti |

Tutte le ombre usano `rgba(15, 23, 42, 0.08)` come colore.

### 1.5 Tipografia — 11 varianti semantiche

| Variante | Font Size | Font Weight | Line Height | Uso |
|----------|-----------|-------------|-------------|-----|
| displayLg | 34px | 800 (Extra Bold) | 38px | Nome app "footMe" nel hero |
| displaySm | 28px | 800 | 32px | Titoli schermata, valori grandi |
| headingLg | 24px | 800 | 28px | Intestazioni pagina |
| headingMd | 20px | 800 | 28px | Titoli sezione (SectionCard) |
| headingSm | 18px | 800 | 24px | Titoli sottosezione, nomi nelle card |
| titleMd | 17px | 700 (Bold) | 24px | Titoli card, nomi contatti |
| titleSm | 16px | 700 | 22px | Titoli righe lista |
| bodyLg | 16px | 400 (Regular) | 24px | Testo body principale |
| bodySm | 14px | 400 | 22px | Testo secondario, descrizioni |
| caption | 12px | 700 | 22px | Etichette piccole, timestamp |
| overline | 12px | 700 | 22px | Label sezione (MAIUSCOLO, letterSpacing 1.2px) |

**Colori testo disponibili:**
- `primary` → #1D2226
- `secondary` → #5E6E7E
- `muted` → #7A8896
- `accent` → #0A66C2
- `accentStrong` → #004182
- `hero` → #004182
- `danger` → #B42318
- `success` → #16A34A
- `warning` → #D97706
- `inverse` → #FFFFFF
- `inverseMuted` → rgba(255,255,255,0.78)
- `inverseSoft` → rgba(255,255,255,0.84)

---

## 2. DESIGN SYSTEM — COMPONENTI

### 2.1 Screen (contenitore globale)

Ogni schermata e' avvolta da un contenitore SafeAreaView:
- **Sfondo:** #F4F8FB (background)
- **Padding orizzontale:** 20px
- **Padding verticale:** 24px
- **Layout:** flex: 1

### 2.2 Button

**7 varianti:**

| Variante | Sfondo | Bordo | Testo | Uso |
|----------|--------|-------|-------|-----|
| primary | #0A66C2 | #0A66C2 | #FFFFFF | CTA principale (1 per schermo) |
| secondary | #FFFFFF | #A8BECE (1px) | #1D2226 | Azioni alternative |
| tertiary | trasparente | nessuno | #1D2226 | Azioni leggere |
| danger | #B42318 | #B42318 | #FFFFFF | Azioni distruttive |
| link | trasparente | nessuno | #004182 | Link testuali |
| icon | trasparente | nessuno | #004182 | Solo icona, circolare |
| chipAction | #F4F8FB | #D6E1EB (1px) | #1D2226 | Filtri toggle |

**chipAction selezionato:** sfondo #004182, testo #FFFFFF

**3 dimensioni:**

| Size | Altezza | Padding H | Font Size | Weight |
|------|---------|-----------|-----------|--------|
| sm | 44px | 12px | 14px | 700 |
| md | 48px | 16px | 16px | 800 |
| lg | 52px | 18px | 17px | 800 |

**Radius:** 16px per standard, 999 per chip e icon

**Stati:**
- Pressed: opacity 0.88
- Disabled: opacity 0.56
- Loading: opacity 0.74

### 2.3 Card

- **Padding:** 18px
- **Gap interno:** 12px
- **Radius:** 12px
- **Bordo:** 1px #D6E1EB

| Variante | Sfondo | Bordo |
|----------|--------|-------|
| default | #FFFFFF | #D6E1EB (1px) |
| muted | #EEF3F8 | nessuno |
| inverse | #1D2226 | nessuno |

`elevated`: aggiunge ombra `card` (18px blur, 8px offset Y)

### 2.4 Badge

- **Padding:** 12px orizzontale, 8px verticale
- **Radius:** 999 (pillola)
- **Font:** 12px, bold (700)

| Variante | Sfondo | Testo |
|----------|--------|-------|
| default | #F4F8FB | #1D2226 |
| muted | #EEF3F8 | #1D2226 |
| inverse | rgba(255,255,255,0.16) | #FFFFFF |
| accent | #E8F3FF | #1D2226 |
| hero | #DCEBFA | #004182 |
| selected | #1D2226 | #FFFFFF |

### 2.5 Avatar

Immagine circolare con fallback a iniziali.

| Size | Dimensione | Iniziali font |
|------|-----------|---------------|
| sm | 32px | 12px |
| md | 44px | 14px |
| lg | 64px | 20px |
| xl | 104px | 34px |

- **Fallback (con iniziali):** sfondo #E8F3FF, testo #004182, bold
- **Fallback (vuoto):** sfondo #EEF3F8
- **Variante square:** radius 12px invece di circolare

### 2.6 Input

- **Altezza minima:** 44px
- **Padding:** 16px orizzontale, 14px verticale
- **Bordo:** 1px, radius 16px
- **Sfondo base:** #F4F8FB
- **Placeholder:** colore #7A8896

**Stati:**
- **Vuoto:** bordo #D6E1EB, sfondo #F4F8FB
- **Focus:** bordo #004182, sfondo #FFFFFF
- **Con valore:** bordo #E8F3FF, sfondo #FFFFFF
- **Multiline:** altezza minima 110px, testo allineato in alto

**Label (opzionale):** sopra l'input, colore #1D2226, bold

### 2.7 SectionCard

Card con titolo + icona modifica opzionale + divisore + contenuto.

```
┌──────────────────────────────────┐
│  Titolo sezione           [✏️]  │
│  Descrizione opzionale           │
│──────────────────────────────────│
│  Contenuto figli                 │
│  ...                             │
└──────────────────────────────────┘
```

- **Titolo:** headingMd (20px, 800)
- **Descrizione:** bodySm, secondary
- **Icona modifica:** cerchio 36px, sfondo #EEF3F8, icona "create-outline" 18px colore #5E6E7E
- **Divisore:** 1px #D6E1EB tra header e contenuto
- **Gap contenuto:** 14px

### 2.8 ScreenHeader

Header compatto per tab non-home.

```
┌──────────────────────────────────┐
│  Titolo schermata      [Azione] │
│  Sottotitolo opzionale           │
└──────────────────────────────────┘
```

- **Titolo:** displaySm (28px, 800)
- **Sottotitolo:** bodySm, secondary
- **Layout:** row, space-between, gap 12px

### 2.9 ModalHeader

Header per modali full-screen.

```
┌──────────────────────────────────┐
│  [X]      Titolo modale    [__] │
└──────────────────────────────────┘
```

- **Pulsante chiudi (X):** cerchio 44px, sfondo #EEF3F8, icona "close" 24px
- **Titolo:** headingSm (18px, 800), centrato
- **Spaziatore destro:** 44px (bilancia la X)
- **Padding:** 20px orizzontale, 12px verticale

### 2.10 StatCard

Card metrica compatta.

```
┌─────────────┐
│  ETICHETTA  │  ← overline (12px, 700, MAIUSCOLO, #7A8896)
│  42         │  ← displaySm (28px, 800)
└─────────────┘
```

- **Padding:** 16px
- **Radius:** 12px
- **Gap:** 10px
- **flex: 1** (si espande in riga)

| Tono | Sfondo | Colore valore |
|------|--------|---------------|
| default | #FFFFFF | #1D2226 |
| accent | #E8F3FF | #1D2226 |
| hero | #DCEBFA | #004182 |
| muted | #EEF3F8 | #1D2226 |

### 2.11 EmptyState

Stato vuoto centrato.

```
        [icona 40px]
    Titolo centrato
  Descrizione centrata
     [Azione CTA]
```

- **Padding:** 32px verticale, 20px orizzontale
- **Gap:** 12px
- **Icona:** 40px, colore #7A8896
- **Titolo:** titleMd (17px, 700), centrato
- **Descrizione:** bodySm (14px, 400), secondary, centrato

### 2.12 ListItem

Riga pressabile per liste.

```
┌──────────────────────────────────┐
│  [Avatar]  Titolo       [→]    │
│            Sottotitolo          │
└──────────────────────────────────┘
```

- **Padding:** 12px verticale, 16px orizzontale
- **Radius:** 12px
- **Sfondo:** #FFFFFF
- **Gap:** 12px
- **Pressed:** opacity 0.82

### 2.13 ChipGroup

Riga orizzontale di chip toggle (wrap automatico).

- **Gap:** 8px
- **flexWrap:** wrap
- Ogni chip e' un Button `chipAction` size sm
- Il chip selezionato ha sfondo #004182 e testo #FFFFFF

### 2.14 Divider

Linea orizzontale di separazione.

- **Altezza:** 0.5px (hairline)
- **Colore:** #D6E1EB

### 2.15 ProfileField (campo readonly)

Campo label + valore per la vista profilo readonly.

```
ETICHETTA                      ← overline style (12px, 700, MAIUSCOLO, letterSpacing 1.2, #5E6E7E)
┌──────────────────────────┐
│  Valore del campo        │   ← 14px regular, #1D2226
└──────────────────────────┘
```

- **Sfondo con valore:** #E8F3FF (accentSoft), bordo #E8F3FF
- **Sfondo vuoto:** #EEF3F8 (surfaceMuted), bordo #D6E1EB
- **Testo vuoto:** "Da completare" in #5E6E7E
- **Radius:** 18px
- **Padding:** 16px orizzontale, 14px verticale

### 2.16 ProfileHeader

Header del profilo con cover, avatar e info.

```
┌──────────────────────────────────┐
│  ████████████████████████████████│  ← Cover area: sfondo #E7F0F8, altezza 132px, radius 24
│  ███████████████████ ▌ stripe ▌ │     Stripe decorativa: 52px larga, rgba(255,255,255,0.35)
└──────────────────────────────────┘
   ┌──────┐                    [✏️]    ← Edit button: cerchio 40px, sfondo #EEF3F8
   │Avatar│  ← 104px, circolare, bordo 4px bianco, margine -52px (sovrappone la cover)
   └──────┘
   Nome Completo                        ← 30px, 800 weight, #1D2226
   Ruolo · Posizione                    ← 17px, 700 weight, #1D2226
   Info secondaria                      ← 14px, 400, #5E6E7E
   [Badge 1] [Badge 2]                 ← Pillole: sfondo #E8F3FF, testo #004182, 12px bold
```

Per club_admin: avatar quadrato (radius 24), placeholder con icona scudo se manca logo.

---

## 3. NAVIGAZIONE

### 3.1 Tab Bar

5 tab in basso, altezza 72px:

| Tab | Label | Icona (attiva / inattiva) |
|-----|-------|--------------------------|
| 1 | Home | home / home-outline |
| 2 | Profilo | person-circle / person-circle-outline |
| 3 | Rete | people / people-outline |
| 4 | Messaggi | chatbubble-ellipses / chatbubble-ellipses-outline |
| 5 | Annunci | megaphone / megaphone-outline |

Icone: Ionicons. Tab attiva: colore #0A66C2. Tab inattiva: colore #7A8896.

### 3.2 Flusso navigazione

```
Auth Stack:
  ├─ Sign In
  └─ Sign Up

Onboarding Stack:
  └─ Multi-step profile creation

Main Tab Stack:
  ├─ Home
  ├─ Profilo
  │  └─ [Modali edit per sezione]
  ├─ Rete
  ├─ Messaggi
  │  └─ Dettaglio conversazione (push)
  └─ Annunci

Route aggiuntive:
  ├─ Profilo club (push)
  ├─ Impostazioni (push)
  └─ Admin Dashboard (route group separato)
```

---

## 4. SCHERMATE — MOCKUP DETTAGLIATI

> **Frame Figma:** iPhone 15 Pro (393 × 852px). Ogni schermata si disegna dentro il SafeAreaView con padding 20px orizzontale e 24px verticale, sfondo #F4F8FB.

---

### 4.1 SIGN IN

**Tipo:** Schermata auth, centrata verticalmente.

**Contenuto dall'alto in basso:**

1. **Header testo** (gap 10px):
   - Overline colore hero: `"Welcome Back"`
   - displayLg: `"Accedi a footMe"`
   - bodyLg secondary: `"Entra nel network del calcio dilettantistico con un accesso pulito, rapido e orientato alla tua identita' sportiva."`

2. **Card** (gap 14px):
   - Input label vuoto, placeholder: `"Email"`
   - Input secureTextEntry, placeholder: `"Password"`
   - Button primary fullWidth: `"Accedi"`
   - Divider con testo overline centrato muted: `"oppure continua con"`
   - Button secondary fullWidth: `"Continua con Google"`
   - Button secondary fullWidth (solo iOS): `"Continua con Apple"`

3. **Link centrato:**
   - Button link sm: `"Non hai un account? Crea il tuo profilo"`

**Stato loading:** Button primary mostra `"Accesso in corso..."` con opacity 0.74

---

### 4.2 SIGN UP

**Tipo:** Schermata auth, identica struttura del Sign In.

**Differenze:**
- Overline: `"Join The Network"`
- displayLg: `"Crea il tuo account"`
- bodyLg: `"Entra nel portale con una registrazione essenziale e completa il tuo posizionamento sportivo nel passo successivo."`
- 3 input: `"Email"`, `"Password"`, `"Conferma password"`
- Button primary: `"Registrati"` / loading: `"Creazione account..."`
- Testo divider: `"oppure registrati con"`
- Link: `"Hai gia' un account? Accedi"`

**Alert successo:** `"Controlla la tua email"` — `"Se la conferma email e' attiva, completa la verifica prima di accedere."`

---

### 4.3 ONBOARDING

**Tipo:** Form multi-step full-screen.

L'onboarding ha 6+ step in base al ruolo scelto. Ogni step ha:
- Indicatore di progresso in alto
- Titolo dello step
- Campi del form
- Pulsante "Avanti" / "Indietro"

**Step 1 — Scelta ruolo:**
3 card selezionabili con emoji + titolo + descrizione:
- ⚽ **Calciatore**: `"Metti in evidenza caratteristiche tecniche, disponibilita' e carriera stagione dopo stagione."`
- 🧠 **Allenatore**: `"Presenta licenze, filosofia di gioco e disponibilita' verso nuove opportunita'."`
- 🏋️ **Staff**: `"Valorizza specializzazione, certificazioni e ambiti di collaborazione tecnica."`

**Step 2 — Informazioni personali:**
- Input: `"Nome e cognome"`
- DatePicker: `"Data di nascita"`
- Select: `"Nazionalità"` (lista nazioni)
- Input: `"Città"`
- Select: `"Regione"` (regioni italiane)

**Step 3 — Genere:**
- Selezione genere

**Step 4 — Bio e avatar:**
- MediaPicker per foto profilo
- Input multiline: `"Bio"` (presentazione pubblica)
- Toggle: `"Aperto a nuove opportunità"`

**Step 5 — Contatti:**
- Input: `"Email di contatto"`
- Input: `"Telefono"`
- Input: `"Instagram"`
- Input: `"Sito web"`
- Select: `"Visibilità contatti"` (pubblica / solo connessioni / privata)

**Step 6+ — Specifici per ruolo:**

*Calciatore:*
- Select: `"Posizione primaria"` (Portiere/Difensore/Centrocampista/Attaccante)
- Multi-select: `"Posizioni secondarie"`
- Select: `"Piede preferito"` (Destro/Sinistro/Ambidestro)
- ChipGroup: `"Categorie preferite"`
- Multi-select: `"Regioni di interesse"`
- Lista esperienze: squadra, categoria, stagione, presenze, gol, assist

*Allenatore:*
- Input: `"Licenze"` (es. UEFA B, UEFA A)
- Input: `"Club attuali o passati"`
- Select: `"Categorie allenate"`
- Input multiline: `"Filosofia di gioco"`
- MediaPicker: Video tecnico

*Staff:*
- Input: `"Specializzazione"` (es. Preparatore atletico, Fisioterapista)
- Input: `"Anni di esperienza"`
- Input: `"Certificazioni"`

---

### 4.4 HOME

**Tipo:** Dashboard principale, scrollabile.

**Contenuto dall'alto in basso (gap 18px):**

1. **Hero Banner** (card inverse, radius 28, padding 24):
   - Badge piccola in alto a sinistra: sfondo rgba(255,255,255,0.16), testo #FFFFFF
     - overline inverseSoft: `"Amateur Football Network"`
   - displayLg inverse: `"footMe"`
   - bodyLg inverseSoft: `"Il tuo profilo sportivo, la tua rete di contatti e le opportunita' giuste nello stesso posto."`

2. **Riga stat (2 card affiancate, gap 12):**
   - Card elevated (flex 1):
     - overline muted: `"Profilo"`
     - titleMd: `"Mario Rossi"` (nome utente)
     - bodySm secondary: `"Calciatore · Difensore"` (ruolo)
   - StatCard tone muted:
     - Label: `"Stato backend"`
     - Value: `"Collegato"`

3. **Riga stat (highlight dinamici, 2+ StatCard affiancati):**
   Esempio per calciatore:
   - StatCard tone accent: label `"Connessioni"`, value `"12"`
   - StatCard tone hero: label `"Opportunita'"`, value `"5"`
   - StatCard tone muted: label `"Messaggi"`, value `"3"`

4. **Card info:**
   - overline: `"Landing autenticata"`
   - headingSm: `"Dashboard iniziale del network calcistico"`
   - bodySm secondary: `"Lazio · Roma · ASD Roma Est"` (dati profilo)
   - Badge hero (condizionale): `"Aperto a nuove opportunita'"`
   - Button secondary sm: `"Aggiorna dati reali"`

5. **Button secondary sm:** `"Esci"`

---

### 4.5 PROFILO (vista readonly)

**Tipo:** Tab principale, scrollabile con KeyboardAwareForm. La vista e' SEMPRE readonly — ogni sezione ha un'icona matita che apre una modale di modifica.

**Contenuto dall'alto in basso (gap 18px):**

1. **ProfileHeader** (vedi spec componente 2.16):
   - Cover area #E7F0F8, altezza 132px, radius 24, stripe decorativa
   - Avatar 104px sovrapposto alla cover (margine -52px)
   - Edit button: cerchio 40px in alto a destra
   - Nome: `"Marco Bianchi"` (30px, 800)
   - Primary meta: `"Calciatore · Difensore"` (17px, 700)
   - Secondary meta: `"Roma · Lazio"` (14px, 400, secondary)
   - Badges: `["Aperto a trasferimenti"]` pillole accent

2. **SectionCard: "Informazioni personali"** (con matita edit)
   - Field: `"NOME E COGNOME"` → `"Marco Bianchi"`
   - Field: `"DATA DI NASCITA"` → `"15/03/1998"`
   - Field: `"NAZIONALITÀ"` → `"Italia"`
   - Field: `"CITTÀ"` → `"Roma"`
   - Field: `"REGIONE"` → `"Lazio"`

3. **SectionCard: "Storico stagioni"** (solo club_admin, con matita)
   - Descrizione: `"Storico delle categorie in cui il club ha militato."`
   - Lista stagioni con anno e categoria

4. **SectionCard: "Esperienze calcistiche"** (solo player, con matita)
   - Descrizione: `"Squadra, categoria, stagione e numeri chiave del percorso calcistico."`
   - Card per ogni esperienza con: squadra, categoria, stagione, presenze/gol/assist
   - Stato vuoto: `"Nessuna esperienza calcistica salvata."`

5. **SectionCard: "Presentazione"** (con matita)
   - Descrizione: `"Disponibilità e descrizione pubblica del profilo"`
   - Testo bio o stato vuoto

6. **SectionCard specifiche per ruolo** (con matita):

   *Player:*
   - Sezione con caratteristiche: altezza, peso, statistiche
   - Categorie preferite (chip read-only)
   - Regioni di interesse (chip read-only)

   *Coach:*
   - Licenze, club, filosofia

   *Staff:*
   - Specializzazione, certificazioni

   *Club Admin:*
   - Info club: nome, fondazione, colori, sede

7. **SectionCard: "Profilo sportivo"** (solo player, con matita)
   - Descrizione: `"Ruolo e piede preferito leggibili rapidamente anche in consultazione."`
   - Posizione primaria, secondarie, piede preferito

8. **SectionCard: "Media"** (con matita)
   - Player: `"Video highlights"` o `"Nessun video highlights caricato"`
   - Coach: `"Video tecnico"` o `"Nessun video tecnico caricato"`
   - Club: `"Logo società"` + `"Gallery media"`

9. **Sezione Contatti** (con matita overlay in alto a destra)
   - Email, telefono, social, sito web
   - Visibilita' contatti

**Stato loading:** `"Sto recuperando i dati professionali del tuo account..."`

---

### 4.6 PROFILO — MODALE DI MODIFICA (pattern)

Ogni sezione si modifica tramite una modale full-screen. Pattern comune:

```
┌──────────────────────────────────────┐
│  [X]       Titolo modale       [__] │  ← ModalHeader
├──────────────────────────────────────┤
│                                      │
│  Campo 1                             │  ← Form scrollabile
│  ┌────────────────────────────┐      │
│  │  Input                     │      │
│  └────────────────────────────┘      │
│                                      │
│  Campo 2                             │
│  ┌────────────────────────────┐      │
│  │  Input                     │      │
│  └────────────────────────────┘      │
│                                      │
│  ...                                 │
│                                      │
├──────────────────────────────────────┤
│  [    Salva modifiche    ]           │  ← Footer sticky, Button primary fullWidth
└──────────────────────────────────────┘
```

- **Sfondo:** #F4F8FB
- **ModalHeader:** X + titolo centrato + spaziatore
- **Form:** KeyboardAwareScrollView, padding 20px, gap 16px
- **Footer:** padding 20px, con Button primary fullWidth

**8 modali totali:**

| Modale | Titolo | Campi principali |
|--------|--------|-----------------|
| EditPersonalInfoModal | `"Informazioni personali"` | Nome, data nascita, nazionalita', citta', regione |
| EditBioModal | `"Presentazione"` | Avatar picker, bio multiline, toggle trasferimento |
| EditContactModal | `"Informazioni contatto"` | Email, telefono, Instagram, sito web, visibilita' |
| EditPlayerSportsModal | `"Profilo sportivo"` | Posizioni, piede, categorie, regioni, esperienze, video |
| EditCoachInfoModal | `"Profilo allenatore"` | Licenze, club, categorie, filosofia, video |
| EditStaffInfoModal | `"Profilo staff"` | Specializzazione, esperienza, certificazioni |
| EditClubInfoModal | `"Informazioni societa'"` | Nome, fondazione, colori, sede, campo, contatti club, logo, gallery |
| EditClubSeasonsModal | `"Storico stagioni"` | Lista stagioni con anno + categoria, aggiungi/rimuovi |

**Alert successo dopo salvataggio:** `"Profilo aggiornato"` — `"Le informazioni professionali sono state salvate."`

---

### 4.7 RETE (Network)

**Tipo:** Tab con ricerca e connessioni, scrollabile.

**Contenuto dall'alto in basso (gap 16px):**

1. **ScreenHeader:**
   - Titolo: `"Rete"`
   - Sottotitolo: `"Gestisci connessioni e cerca profili e opportunita'"`

2. **Riga stat (2 StatCard, gap 12):**
   - StatCard default: `"CONNESSIONI ATTIVE"` → `"12"`
   - StatCard muted: `"DA GESTIRE"` → `"3"`

3. **Card: Stato della rete**
   - headingSm: `"Stato della rete"`

   **Se nessuna richiesta:**
   - bodySm secondary: `"Nessuna richiesta in attesa. Usa la ricerca qui sotto per ampliare il tuo network."`

   **Se richieste in arrivo** (per ogni richiesta):
   - Card muted:
     - titleSm: `"Luigi Verdi"` (nome)
     - bodySm secondary: `"Calciatore · Attaccante"` (ruolo · posizione)
     - bodySm secondary: `"Milano · Lombardia"` (citta' · regione)
     - Riga azioni (2 pulsanti, gap 10):
       - Button primary flex1: `"Accetta"`
       - Button secondary flex1: `"Rifiuta"`

   **Connessioni accettate** (max 3):
   - titleSm: `"Connessioni pronte per la chat"`
   - Card muted per ognuna:
     - titleSm: nome
     - bodySm secondary: ruolo · posizione
     - Button secondary fullWidth: `"Apri chat"` / loading: `"Apertura chat..."`

   **Richieste in uscita:**
   - bodySm secondary: `"Richieste inviate in attesa: 2"`

4. **Card: Filtri ricerca**
   - ChipGroup mode: `["Profili", "Opportunita'"]`
   - Input placeholder: `"Cerca per nome o profilo"` (mode profili) / `"Cerca per annuncio o societa'"` (mode opportunita')
   - Input placeholder: `"Regione"`

   **Se mode "Profili":**
   - caption: `"Ruolo"`
   - ChipGroup: `["Tutti", "Calciatori", "Allenatori", "Staff", "Procuratori", "Dirigenti", "Societa'"]`

   - caption: `"Posizione"`
   - ChipGroup: `["Tutte", "Portiere", "Difensore", "Centrocampista", "Attaccante"]`

5. **Risultati:**

   **Stato vuoto profili:**
   - EmptyState icon search-outline: `"Nessun profilo trovato"` / `"Nessun profilo trovato con i filtri attuali."`

   **Stato vuoto opportunita':**
   - EmptyState icon megaphone-outline: `"Nessuna opportunita'"` / `"Nessuna opportunita' trovata con i filtri attuali."`

   **Card risultato profilo:**
   - headingSm: `"Andrea Conti"` (nome)
   - PublicBioBlock: testo bio (se presente)
   - bodySm secondary: `"Calciatore · Centrocampista"`
   - bodySm secondary: `"Torino · Piemonte"`
   - bodySm secondary (condizionale): stato connessione (`"Connessi"` / `"Richiesta inviata"` / `"Richiesta ricevuta"` / `"Richiesta chiusa"` / `"Bloccata"`)

   **Azioni per stato connessione:**
   - Connessi: Button secondary fullWidth `"Messaggia"`
   - Richiesta ricevuta: riga `"Accetta"` + `"Rifiuta"`
   - Richiesta inviata: Badge `"Richiesta in attesa"`
   - Bloccata: Badge `"Connessione bloccata"`
   - Nessuna connessione: Button secondary fullWidth `"Connettiti"`

   **Card risultato opportunita':**
   - headingSm: `"Cercasi difensore U21"` (titolo)
   - bodySm secondary: `"ASD Roma Est · Difensore"`
   - bodySm secondary: `"Lazio · Promozione"`
   - Badge accent (condizionale): `"Rimborso spese"` (compenso)

---

### 4.8 MESSAGGI

**Tipo:** Tab inbox, scrollabile.

**Contenuto dall'alto in basso (gap 16px):**

1. **ScreenHeader:**
   - Titolo: `"Messaggi"`
   - Sottotitolo: `"Gestisci le tue conversazioni e contatta le connessioni"`
   - Azione destra: Button link sm `"Aggiorna"`

2. **Riga stat (2 StatCard, gap 12):**
   - StatCard default: `"CONVERSAZIONI"` → `"8"`
   - StatCard muted: `"NON LETTI"` → `"3"`

3. **Card: Pronti a scriverti**
   - headingSm: `"Pronti a scriverti"`

   **Se nessuna connessione pronta:**
   - bodySm secondary: `"Nessuna connessione pronta per una nuova chat. Vai in Rete per ampliare il tuo network professionale."`

   **Connessioni pronte (max 3):**
   - Card muted per ognuna:
     - titleSm: `"Franco Neri"` (nome)
     - bodySm secondary: `"Allenatore"` (ruolo)
     - bodySm secondary: `"Napoli · Campania"` (localita')
     - Button secondary fullWidth: `"Scrivi ora"` / loading: `"Apertura chat..."`

4. **Sezione: Conversazioni recenti**
   - headingSm: `"Conversazioni recenti"`

   **Se inbox vuota:**
   - EmptyState icon chatbubbles-outline:
     - Titolo: `"Inbox vuota"`
     - Descrizione: `"Accetta una connessione o avvia una chat dalla tab Rete."`

   **Card conversazione** (Pressable, per ogni conversazione):
   ```
   ┌────────────────────────────────────────┐
   │  Marco Bianchi              [3]       │  ← headingSm + badge non letti (cerchio #004182)
   │  Calciatore · Difensore               │  ← bodySm secondary
   │  Roma · Lazio                          │  ← bodySm secondary
   │  Ciao, ho visto il tuo profilo e      │  ← bodyLg (max 2 righe)
   │  sarei interessato a parlare...        │
   │  22/03/2026, 14:30                    │  ← caption muted
   └────────────────────────────────────────┘
   ```

   - Sfondo: #FFFFFF
   - Bordo: 1px #D6E1EB
   - Radius: 12px
   - Padding: 18px
   - Gap: 8px
   - Badge non letti: cerchio minWidth 28px, sfondo #004182, testo #FFFFFF caption
   - Pressed: opacity 0.82
   - Messaggio vuoto: `"Nessun messaggio ancora inviato: apri la chat per iniziare."`
   - Timestamp vuoto: `"Conversazione pronta"`

---

### 4.9 DETTAGLIO CONVERSAZIONE

**Tipo:** Schermata push da tab Messaggi.

**Contenuto dall'alto in basso (gap 16px):**

1. **Header scuro** (sfondo #1D2226, radius 24, padding interno):
   - Button link sm: `"← Torna ai messaggi"`
   - displaySm inverse: `"Marco Bianchi"` (nome interlocutore)
   - bodySm inverseMuted: `"Conversazione privata 1:1 del network footMe."`

2. **Se in caricamento:**
   - Card: bodySm secondary `"Caricamento conversazione in corso..."`

3. **Se nessun messaggio:**
   - Card: bodySm secondary `"Nessun messaggio ancora inviato. Usa il box qui sotto per rompere il ghiaccio."`

4. **Lista messaggi:**

   **Messaggio testuale proprio (allineato a destra):**
   ```
                        ┌──────────────────────┐
                        │  Tu                  │  ← titleSm
                        │  Testo del messaggio │  ← bodySm
                        │  14:30               │  ← caption
                        └──────────────────────┘
   ```
   Sfondo: #0A66C2 (accent), testo bianco

   **Messaggio testuale altrui (allineato a sinistra):**
   ```
   ┌──────────────────────┐
   │  Marco Bianchi       │  ← titleSm
   │  Testo del messaggio │  ← bodySm
   │  14:28               │  ← caption
   └──────────────────────┘
   ```
   Sfondo: #FFFFFF (surface), testo scuro

   **Card contatto condiviso:**
   - Card con nome e numero di telefono
   - Numero tappabile/copiabile

5. **Card composer** (in basso, radius 22, gap 12):
   - Input multiline placeholder: `"Scrivi un messaggio professionale e diretto"`
   - Button secondary: `"Condividi contatto"`
   - Button primary: `"Invia messaggio"` / loading: `"Invio in corso..."`

---

### 4.10 ANNUNCI — VISTA GIOCATORE

**Tipo:** Tab, scrollabile.

**Contenuto dall'alto in basso (gap 16px):**

1. **ScreenHeader:**
   - Titolo: `"Opportunita'"`
   - Sottotitolo: `"Consulta le opportunita' attive, salva e candidati"`

2. **Card avviso ruolo** (solo per non-calciatori):
   - bodyLg: `"In questa fase la candidatura e' disponibile per i profili giocatore. Gli altri ruoli possono comunque esplorare il mercato."`

3. **Se vuoto:**
   - EmptyState icon megaphone-outline: `"Nessun annuncio"`

4. **Card annuncio** (per ogni annuncio):
   - headingSm: `"Cercasi difensore U21"` (titolo)
   - bodySm secondary: `"ASD Roma Est · Difensore"`
   - bodySm secondary: `"Lazio · Eta' 18-21"`
   - bodyLg: `"Cerchiamo un difensore giovane per la nostra prima squadra..."` (descrizione)
   - Badge accent: `"Rimborso spese"` (compenso)
   - Badge (se candidato): `"Candidatura: Inviata"` (stato candidatura)

   **Riga azioni (gap 10):**
   - Button secondary sm: `"Salva"` o `"Salvato"`
   - Button primary sm (solo calciatore): `"Candidati"` o `"Gia' candidato"`

   **Se selezionato per candidatura (espansione):**
   - titleSm: `"Messaggio di presentazione"`
   - Input multiline: `"Scrivi in poche righe il tuo profilo e perche' sei adatto all'annuncio"`
   - Riga azioni:
     - Button secondary sm: `"Annulla"`
     - Button primary sm: `"Invia candidatura"` / loading: `"Invio..."`

---

### 4.11 ANNUNCI — VISTA SOCIETA' (Club Admin)

**Tipo:** Tab, scrollabile. Visibile solo per ruolo club_admin.

**Contenuto dall'alto in basso (gap 16px):**

1. **ScreenHeader:**
   - Titolo: `"Annunci societa'"`
   - Sottotitolo: `"Stai pubblicando per ASD Roma Est."` oppure `"Completa l'onboarding societa' per pubblicare annunci."`

2. **Card: Nuovo annuncio**
   - headingSm: `"Nuovo annuncio"`
   - Input: `"Titolo annuncio"`
   - ChipGroup posizioni: `["Portiere", "Difensore", "Centrocampista", "Attaccante"]`
   - Riga 2 input (gap):
     - Input number: `"Eta' min"`
     - Input number: `"Eta' max"`
   - Input: `"Categoria"`
   - Input: `"Regione"`
   - Input: `"Rimborso o benefit"`
   - Input multiline (altezza 120px): `"Descrizione annuncio"`
   - Button primary fullWidth: `"Pubblica annuncio"` / loading: `"Pubblicazione..."`

3. **Sezione: Annunci pubblicati**
   - headingSm: `"Annunci pubblicati"`

   **Se vuoto:**
   - EmptyState icon megaphone-outline: `"Nessun annuncio"`

   **Card annuncio pubblicato (muted):**
   - titleSm: `"Cercasi difensore U21"`
   - bodySm secondary: `"Difensore · Lazio"`
   - bodySm secondary: `"Stato: active"`

4. **Sezione: Candidature ricevute**
   - headingSm: `"Candidature ricevute"`

   **Se vuoto:**
   - EmptyState icon people-outline: `"Nessuna candidatura"`

   **Card candidatura:**
   - titleSm: `"Andrea Conti"` (nome candidato)
   - bodySm secondary: `"Annuncio: Cercasi difensore U21"`
   - bodySm secondary: `"Ricerca: Difensore · Stato Inviata"`
   - bodyLg: `"Sono un difensore con 5 anni di esperienza..."` (messaggio) oppure bodySm muted: `"Nessun messaggio allegato."`

**Label stati candidatura:** `"Inviata"` / `"In revisione"` / `"Shortlist"` / `"Rifiutata"` / `"Ritirata"`

---

### 4.12 PROFILO CLUB

**Tipo:** Schermata push, scrollabile.

**Contenuto dall'alto in basso (gap 16px):**

1. **Freccia indietro** (Pressable)

2. **Card principale:**
   - Riga header:
     - Logo club: 56×56px, radius 14 (se presente)
     - Colonna:
       - headingMd: `"ASD Roma Est"` (nome club)
       - bodySm secondary: `"Roma, Lazio"` (citta', regione)
   - Badge verifica: stato verifica del club

3. **Card descrizione** (se presente):
   - titleMd: `"Descrizione"`
   - bodySm secondary: testo descrizione

4. **Card informazioni:**
   - titleMd: `"Informazioni"`
   - Righe info (label → valore):
     - `"Anno di fondazione"` → `"1985"`
     - `"Colori sociali"` → `"Rosso e giallo"`
     - `"Nazione"` → `"Italia"`
     - `"Sede"` → `"Via Roma 1, Roma"`
     - `"Campo"` → `"Campo sportivo Centrale"`

5. **Card contatti:**
   - titleMd: `"Contatti"`
   - Righe tappabili:
     - `"Email"` → `"info@asdromaest.it"`
     - `"Telefono"` → `"+39 06 1234567"`
     - `"Sito web"` → `"www.asdromaest.it"`
   - Se nessun contatto: bodySm muted `"Nessun contatto disponibile."`

6. **Card responsabile** (se presente):
   - titleMd: `"Responsabile"`
   - bodySm secondary: `"Mario Rossi"`

7. **Link segnalazione** (centrato):
   - bodySm muted: `"Segnala o rivendica questa società"`

**Modali:**
- **Rivendica societa':** ModalHeader `"Rivendica società"`, form con ruolo + email + messaggio
- **Segnala societa':** ModalHeader `"Segnala società"`, form con motivo, Button danger `"Invia segnalazione"`

**Stato loading:** spinner centrato
**Stato non trovato:** `"Società non trovata."` + pulsante indietro

---

### 4.13 IMPOSTAZIONI

**Tipo:** Schermata placeholder.

**Contenuto:**
- Button link sm: `"Torna indietro"`
- Card:
  - Badge accent: `"Impostazioni"`
  - displaySm: `"Area impostazioni in preparazione"`
  - bodyLg secondary: `"Questa schermata e' pronta come destinazione del drawer. I controlli di configurazione verranno aggiunti nei prossimi step senza rompere la navigazione utente."`
  - Button secondary: `"Vai alla home"`

---

### 4.14 ADMIN DASHBOARD

**Tipo:** Schermata admin separata, accessibile da impostazioni.

**Contenuto:**
- ScreenHeader: `"Dashboard Admin"`
- Lista richieste registrazione club con:
  - Nome club, stato verifica, data richiesta
  - Badge stato (pending/approved/rejected)
  - Filtri per stato
- EmptyState se nessuna richiesta

### 4.15 ADMIN DETTAGLIO CLUB

**Tipo:** Schermata dettaglio richiesta club.

**Contenuto:**
- ModalHeader o navigazione back
- Dati completi della richiesta di registrazione
- Azioni: Approva / Rifiuta con conferma

---

## 5. VARIANTI PER RUOLO

Per i mockup, creare almeno queste varianti del profilo:

### 5.1 Calciatore (Player)
- ProfileHeader con avatar circolare
- Sezioni: Info personali, Esperienze calcistiche, Presentazione, Profilo sportivo (posizioni, piede), Media (video), Contatti
- Badges possibili: "Aperto a trasferimenti"

### 5.2 Allenatore (Coach)
- ProfileHeader con avatar circolare
- Sezioni: Info personali, Presentazione, Info allenatore (licenze, filosofia), Media (video tecnico), Contatti

### 5.3 Staff
- ProfileHeader con avatar circolare
- Sezioni: Info personali, Presentazione, Info staff (specializzazione, certificazioni), Contatti

### 5.4 Societa' (Club Admin)
- ProfileHeader con avatar QUADRATO (logo club, radius 24) o placeholder scudo
- Sezioni: Storico stagioni, Presentazione, Info club, Media (logo + gallery), Contatti

---

## 6. STATI DA MOCKARE

Per ogni schermata, creare almeno 2 varianti:

| Stato | Descrizione |
|-------|-------------|
| **Caricamento** | Testo "Caricamento..." o skeleton placeholder |
| **Vuoto** | EmptyState con icona + messaggio |
| **Con dati** | Vista completa con dati di esempio |
| **Errore** | Alert nativo con messaggio di errore |

Per i pulsanti, mostrare:
- **Default** (stato normale)
- **Pressed** (opacity 0.88)
- **Disabled** (opacity 0.56)
- **Loading** (opacity 0.74 + testo "...in corso")

Per gli input:
- **Vuoto** con placeholder
- **Focus** (bordo #004182)
- **Con valore** (bordo #E8F3FF)

---

## 7. DATI DI ESEMPIO PER I MOCKUP

### Profilo calciatore
```
Nome: Marco Bianchi
Data nascita: 15/03/1998
Nazionalita': Italia
Citta': Roma
Regione: Lazio
Bio: "Difensore centrale con 8 anni di esperienza nel calcio dilettantistico.
     Affidabile in marcatura e forte nel gioco aereo. Cerco una squadra ambiziosa
     in Promozione o Eccellenza nel Lazio."
Posizione primaria: Difensore
Posizioni secondarie: Centrocampista
Piede preferito: Destro
Aperto a trasferimenti: Si'
Esperienze:
  - ASD Roma Est, Promozione, 2023/2024, 28 presenze, 3 gol, 1 assist
  - Virtus Latina, Prima Categoria, 2021/2023, 52 presenze, 5 gol, 4 assist
Contatti:
  Email: marco.bianchi@email.it
  Telefono: +39 333 1234567
  Instagram: @marco.bianchi98
```

### Profilo allenatore
```
Nome: Giuseppe Verdi
Data nascita: 22/08/1975
Nazionalita': Italia
Citta': Milano
Regione: Lombardia
Bio: "Allenatore UEFA B con 15 anni di esperienza nelle categorie dilettantistiche.
     Credo nel calcio propositivo e nella valorizzazione dei giovani."
Licenze: UEFA B
Filosofia: "Gioco di possesso, pressing alto, attenzione alla fase di costruzione dal basso."
Contatti:
  Email: giuseppe.verdi@email.it
  Telefono: +39 348 7654321
```

### Profilo societa'
```
Nome club: ASD Roma Est
Anno fondazione: 1985
Colori sociali: Rosso e giallo
Citta': Roma
Regione: Lazio
Sede: Via della Magliana 45, Roma
Campo: Centro Sportivo Olimpia
Descrizione: "Societa' storica del calcio dilettantistico romano. Attiva dalla
             Terza Categoria alla Promozione con settore giovanile."
Email: info@asdromaest.it
Telefono: +39 06 5551234
Sito: www.asdromaest.it
Stagioni:
  - 2023/2024: Promozione
  - 2022/2023: Prima Categoria
  - 2021/2022: Prima Categoria
```

### Connessioni di esempio
```
- Luigi Neri, Attaccante, Napoli · Campania (connesso)
- Andrea Conti, Centrocampista, Torino · Piemonte (richiesta inviata)
- Franco Russo, Allenatore, Firenze · Toscana (richiesta ricevuta)
```

### Annuncio di esempio
```
Titolo: Cercasi difensore U21
Club: ASD Roma Est
Posizione: Difensore
Eta': 18-21
Categoria: Promozione
Regione: Lazio
Compenso: Rimborso spese
Descrizione: "Cerchiamo un difensore centrale giovane e motivato per rinforzare
             la nostra rosa in vista della prossima stagione. Richiesta esperienza
             minima in Prima Categoria."
```

### Conversazione di esempio
```
Interlocutore: Luigi Neri
Messaggi:
  - Luigi: "Ciao Marco, ho visto il tuo profilo. Giochi ancora a Roma?" (14:28)
  - Tu: "Ciao Luigi! Si', sono ancora al Roma Est. Tu come stai?" (14:30)
  - Luigi: "Bene grazie! Ti contatto perche' stiamo cercando un difensore." (14:32)
```

---

## 8. NOTE FINALI PER IL DESIGNER

1. **Font di sistema:** L'app usa il font di sistema iOS/Android (San Francisco su iOS). Per Figma, usa Inter o SF Pro come equivalente.

2. **Icone:** Tutte le icone provengono da Ionicons (stile outline per inattivo, filled per attivo). Referenza: https://ionic.io/ionicons

3. **Nessun orb decorativo:** Lo sfondo e' sempre piatto #F4F8FB. Nessun cerchio decorativo o gradiente.

4. **Densita' LinkedIn:** L'app deve sembrare un network professionale, non un social media. Card compatte, tanta informazione visibile senza scroll, gerarchia tipografica chiara.

5. **Solo una CTA primaria per schermata:** Il pulsante primary (#0A66C2) appare al massimo una volta per schermata. Tutto il resto e' secondary, tertiary o link.

6. **Lingua:** Tutta l'interfaccia e' in italiano. I testi sopra sono quelli esatti dall'app.

7. **Responsive:** L'app e' solo mobile. Frame iPhone 15 Pro (393×852) come riferimento principale.

8. **Tab bar:** Sempre visibile sulle 5 schermate tab. Nascosta su schermate push (conversazione, club, impostazioni) e modali (edit profilo).
