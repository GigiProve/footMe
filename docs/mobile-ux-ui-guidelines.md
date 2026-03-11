# footMe Mobile UX/UI Guidelines

## Obiettivo del documento

Definire l'interfaccia, i pattern, le icone e le interazioni principali di footMe per iOS e Android.

Il riferimento UX esplicito e' LinkedIn mobile: footMe deve comunicare professionalita', densita' informativa, fiducia e networking, adattando questi principi al contesto del calcio dilettantistico.

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

## Personalita' visiva

### Tono visivo

- professionale
- credibile
- pulito
- contemporaneo
- sportivo ma non aggressivo

### Riferimento cromatico

Il repository ha gia' una base colori in `apps/mobile/src/theme/tokens.ts`.

- `accent #0D7A43`: colore identitario footMe per CTA primarie e stati positivi
- `background #F5F2E9` e `surface #FFFDFC`: superfici calde e premium
- `textPrimary #14261D`: testo principale
- `border #D9D0C0`: separatori e outline
- `hero #C96E3D`: evidenza editoriale, recruiting premium, alert contestuali

### Traduzione dello stile "simile a LinkedIn"

Per avvicinarsi a LinkedIn, il linguaggio UI deve usare:

- header semplici e stabili
- card feed con bordo leggero e gerarchia contenuto > decorazione
- profili modulari a sezioni
- tab bar persistente
- search bar dominante nelle schermate ad alta scoperta
- CTA sobrie, piene e molto leggibili
- grande uso di avatar, badge, meta-informazioni e contatori

Da evitare:

- gradienti forti
- animazioni vistose
- layout troppo editoriali
- icone troppo illustrative o playful

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
- stato attivo con colore `accent`
- stato inattivo con `textMuted`
- badge numerico su Messaggi e Network quando necessario

### Top app bar

La top bar deve variare poco tra le sezioni principali:

- avatar o logo profilo in alto a sinistra
- search bar tappabile al centro o full width
- icona notifiche in alto a destra

Questo e' il pattern piu' vicino a LinkedIn e deve diventare la base delle schermate Home, Network e Annunci.

## Mappa delle schermate principali

### 1. Home / Feed

Obiettivo: mostrare contenuti dei contatti, societa' seguite, update professionali e annunci rilevanti.

Struttura:

- top bar con avatar, search, notifiche
- composer compatto
- moduli feed
- card annunci sponsorizzati o suggeriti integrate nel feed

Pattern chiave:

- composer "Condividi un aggiornamento"
- post card con avatar, nome, ruolo, squadra, tempo, contenuto, media
- barra azioni: Mi interessa, Commenta, Salva, Condividi internamente
- separazione visiva leggera tra card

### 2. Network

Obiettivo: gestire collegamenti e suggerimenti.

Struttura:

- search e filtri rapidi
- inviti ricevuti
- suggeriti per te
- persone visitate di recente

Pattern chiave:

- card persona con CTA primaria "Collegati"
- CTA secondaria "Segui"
- contesto sintetico: ruolo, club, categoria, regione, disponibilita'

### 3. Messaggi

Obiettivo: permettere conversazioni 1:1 con un'esperienza essenziale e professionale.

Struttura:

- search conversazioni
- elenco thread
- thread detail con composer sticky

Pattern chiave:

- lista conversazioni molto densa ma leggibile
- unread dot o badge
- anteprima ultimo messaggio
- quick actions da swipe leggere solo se davvero utili

### 4. Annunci

Obiettivo: supportare recruiting e candidature.

Struttura:

- search bar
- filtri sticky
- lista annunci
- dettaglio annuncio
- CTA candidatura persistente nel dettaglio

Pattern chiave:

- card annuncio con ruolo, categoria, regione, benefit, data
- stato salvato
- stato candidatura
- evidenza forte di match con il profilo utente

### 5. Profilo

Obiettivo: rendere il profilo il centro dell'identita' professionale, come avviene su LinkedIn.

Struttura:

- hero profilo con foto, nome, ruolo, club, localita'
- availability status
- summary
- esperienze sportive / carriera
- media highlights
- statistiche
- licenze o competenze
- attivita' recenti

Pattern chiave:

- sezione header ad alta fiducia
- moduli editabili a blocchi
- CTA contestuali: Messaggio, Collegati, Segui, Candidati
- progressivo completamento profilo con nudges

## Pattern UI fondamentali

### 1. Search pattern

footMe deve usare una search bar molto prominente, ispirata a LinkedIn.

Regole:

- search sempre visibile o immediatamente accessibile in Home, Network e Annunci
- placeholder guidati: "Cerca giocatori, allenatori, squadre..."
- filtri avanzati in bottom sheet
- ricerche recenti e suggerimenti salvati

### 2. Card pattern

Le card sono il pattern dominante dell'app.

Specifiche:

- fondo `surface`
- bordo `border`
- radius medio
- shadow minima
- padding interno costante
- gerarchia: header > body > azioni

Tipologie:

- profile card
- post card
- announcement card
- club card
- message preview card

### 3. CTA pattern

#### CTA primarie

Uso:

- Collegati
- Candidati
- Completa profilo
- Pubblica annuncio

Stile:

- filled
- colore `accent`
- testo bianco
- altezza minima 44

#### CTA secondarie

Uso:

- Segui
- Messaggio
- Modifica
- Salva

Stile:

- outline su `borderStrong`
- testo `textPrimary`

#### CTA terziarie

Uso:

- Mostra altro
- Visualizza tutti
- Rimuovi filtro

Stile:

- testo semplice
- nessun contenitore pesante

### 4. Form pattern

I form devono seguire un modello professionale e lineare.

Regole:

- un solo obiettivo per schermata o per step
- label sempre visibile
- helper text breve
- validazione inline
- CTA sticky in fondo quando il task e' critico

Per onboarding e recruiting:

- usare progressione step-by-step
- salvare bozze
- precompilare dal profilo quando possibile

### 5. Bottom sheet pattern

Da usare per:

- filtri avanzati
- quick actions sul profilo
- segnalazioni o blocco
- selezione disponibilita'

Regole:

- altezza iniziale media
- chiusura con swipe down e tap esterno
- CTA primaria nel footer per conferma

### 6. Empty, loading, error states

### Empty state

Deve sempre:

- spiegare il valore della sezione
- suggerire l'azione successiva
- usare una CTA unica e chiara

Esempi:

- "Nessun collegamento ancora. Inizia dal tuo ruolo o dalla tua regione."
- "Nessun annuncio salvato. Esplora nuove opportunita'."

### Loading

Pattern:

- skeleton su feed, card profilo, lista annunci
- spinner solo per attese corte o azioni bloccanti

### Error

Pattern:

- messaggio breve
- linguaggio chiaro
- CTA "Riprova"

## Icon system

### Famiglia icone

Per mantenere coerenza iOS/Android si raccomanda un set lineare, semplice e professionale:

- stile outline per stato default
- stile filled per stato attivo
- stroke regolare
- niente icone cartoon o decorative

### Mappa icone principali

| Funzione | Icona raccomandata | Uso |
| --- | --- | --- |
| Home | `house` / `house.fill` | Tab Home |
| Network | `person.2` / `person.2.fill` | Collegamenti, suggeriti |
| Messaggi | `bubble.left.and.bubble.right` | Inbox e chat |
| Annunci | `megaphone` / `briefcase` | Recruiting e opportunita' |
| Profilo | `person.crop.circle` | Profilo utente |
| Cerca | `magnifyingglass` | Search bar |
| Notifiche | `bell` / `bell.fill` | Centro notifiche |
| Salva | `bookmark` / `bookmark.fill` | Post, annunci, profili |
| Like/interesse | `hand.thumbsup` o `heart` | Interazione contenuti |
| Commento | `bubble.left` | Commenti |
| Condividi | `paperplane` o `arrowshape.turn.up.right` | Condivisione interna |
| Disponibilita' | `checkmark.seal` o `bolt.badge.clock` | Stato aperto a opportunita' |
| Video highlights | `play.rectangle` | Media sportivi |
| Statistiche | `chart.bar` | Dati performance |
| Club | `shield` | Team e societa' |
| Posizione/area | `mappin.and.ellipse` | Regione e localita' |
| Modifica | `pencil` | Edit profilo/contenuti |
| Filtri | `line.3.horizontal.decrease.circle` | Search e discovery |

Nota: i nomi sono un riferimento semantico. Su Android il mapping deve restare equivalente usando Material Symbols o libreria cross-platform coerente.

## Interaction patterns

### Micro-interazioni principali

### Tap

Il tap e' l'interazione dominante.

Usi principali:

- apertura card
- attivazione CTA
- navigazione ai dettagli
- focus sulla search

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

- "Mostra altro"
- "Mostra meno"

## Pattern di interazione per schermata

### Feed

- pull-to-refresh
- like/comment/save/share dalla action row
- tap su avatar o nome apre profilo
- tap su media apre viewer
- tap su annuncio embedded apre dettaglio annuncio

### Profilo

- header con azioni sticky in alto
- sezioni espandibili per carriera e media
- edit entry point visibili ma non invadenti
- floating nudge per completamento profilo se incompleto

### Networking

- tap rapido su "Collegati"
- feedback immediato con stato inviato
- suggerimenti rinfrescabili
- filtri veloci per ruolo, categoria, regione

### Annunci

- filtri sticky
- salvataggio con un tap
- candidatura guidata con conferma finale
- stato candidatura visibile subito nella card e nel dettaglio

### Messaggi

- tap thread apre conversazione
- composer sempre accessibile
- stato inviato/letto discreto
- allegati o media in fase successiva, non protagonisti nell'MVP

## Content patterns

### Struttura dei profili

Come in LinkedIn, il profilo deve essere costruito come una sequenza di moduli professionali.

### Profilo giocatore

Ordine raccomandato:

1. hero identity
2. ruolo e disponibilita'
3. summary
4. carriera stagionale
5. statistiche
6. highlights video
7. foto e gallery
8. preferenze di mobilita'

### Profilo allenatore

Ordine raccomandato:

1. hero identity
2. licenze
3. filosofia di gioco
4. esperienze
5. categorie allenate
6. disponibilita'
7. contenuti tecnici

### Profilo staff

Ordine raccomandato:

1. hero identity
2. specializzazione
3. esperienze
4. certificazioni
5. disponibilita'

### Profilo societa'

Ordine raccomandato:

1. hero club
2. categoria, campionato, citta'
3. about club
4. staff
5. rosa
6. annunci attivi
7. update recenti
8. shop in fase successiva

## LinkedIn-inspired patterns da adottare esplicitamente

Per soddisfare l'indicazione di rendere l'app piu' simile possibile a LinkedIn, footMe deve adottare i seguenti pattern strutturali:

1. **Feed come punto di ingresso principale**
2. **Top search sempre molto visibile**
3. **Profilo come pagina modulare a blocchi professionali**
4. **Network come sezione dedicata a inviti e suggeriti**
5. **Messaggistica separata e persistente**
6. **Notifiche accessibili da top bar**
7. **Gerarchia dei contenuti densa ma pulita**
8. **Card con meta-informazioni, badge e CTA discrete**

Le differenze distintive footMe devono stare nei contenuti:

- carriera sportiva invece di esperienza lavorativa generica
- statistiche e highlights invece di soli post professionali
- annunci calcistici invece di job generici
- disponibilita' sportiva e mobilita' geografica come segnali chiave

## Motion e feedback

Le animazioni devono essere sobrie.

Linee guida:

- durata 120-220ms per micro-transizioni
- easing morbido
- feedback press con opacity o scale minima
- niente motion scenografico nel feed

Feedback richiesti:

- conferma visiva immediata su salva, collega, candidati
- toast brevi per azioni riuscite
- stato loading locale sulle CTA

## Accessibilita'

Requisiti minimi:

- target touch >= 44x44
- contrasto elevato per testo e CTA
- label chiare per screen reader
- icone mai lasciate senza testo nelle azioni critiche
- non affidare significato solo al colore

## Priorita' di progettazione per MVP

Ordine consigliato:

1. navigazione globale
2. feed home
3. profilo professionale
4. networking
5. annunci recruiting
6. messaggi
7. notifiche

## Deliverable UX raccomandati

Questo documento deve guidare la produzione dei prossimi artefatti:

- wireframe low fidelity delle 5 sezioni principali
- component inventory mobile
- libreria UI base
- flussi onboarding per ruolo
- flusso candidatura ad annuncio
- flusso collegamento e messaggio

## Decisione finale di design

La UI di footMe deve essere progettata come **"LinkedIn per il calcio dilettantistico"**:

- stessa chiarezza strutturale
- stessa logica di networking professionale
- stessa densita' informativa controllata
- stessa centralita' del profilo e del feed

con un livello visivo e semantico adattato al mondo football tramite ruolo, statistiche, highlights, club, annunci e disponibilita' sportiva.
