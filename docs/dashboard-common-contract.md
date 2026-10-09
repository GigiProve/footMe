# ProLink Dashboard — Common Contract

**Codice task:** DAS-REV-00 — Common Contract Dashboard premium
**Versione contratto:** 1.0
**Stato:** registrato come riferimento normativo per il backlog Dashboard (DAS-REV)
**Data di registrazione:** 2026-10-09
**Fonte di pianificazione:** foglio "Piano consolidato" di `DAS_Audit_globale_completo.xlsx` (documento esterno al repository)

Documenti collegati:

- [`dashboard-recognition-map.md`](./dashboard-recognition-map.md) — ricognizione del repository e mappatura regola → implementazione
- [`dashboard-rev01-rev02-plan.md`](./dashboard-rev01-rev02-plan.md) — piano tecnico dei due pack successivi

> Questo documento registra le regole. **Non** descrive lo stato di implementazione:
> per quello vale esclusivamente la mappatura di ricognizione. Una regola presente
> qui non implica codice esistente.

---

## Obiettivo

Definire il contratto comune di prodotto, UX, UI, integrazione e qualità da applicare
alle task DAS-REV successive, trasformando la Dashboard PROLINK in una superficie
operativa mobile coerente, leggibile e premium.

DAS-REV-00 **non** richiede di ricostruire la Dashboard, implementare tutti i moduli o
ridisegnare altre sezioni. Stabilisce le regole condivise e il metodo di integrazione
nel progetto esistente.

Il risultato deve ridurre duplicazioni e ambiguità: un solo impianto Dashboard,
componenti riutilizzabili, contesti di identità espliciti, domini funzionali preservati.

Non esiste una schermata utente chiamata "Common Contract". I master visuali della
Foundation sono di competenza di DAS-REV-01; i valori visuali indicativi presenti qui
non sostituiscono i token esistenti né l'approvazione di quei master.

---

## CC-01 — Perimetro e gerarchia delle fonti

Il Piano consolidato è una sequenza di lavoro, non una specifica sufficiente a
sviluppare una funzione.

Pacchetto di consegna minimo per ogni pack:

- questa versione del Common Contract, o una successiva esplicitamente approvata;
- la task specifica, con obiettivo, scope, routing, regole e criteri di accettazione;
- il mockup approvato, quando necessario;
- le dipendenze di dominio realmente necessarie, con la versione disponibile;
- la mappatura delle task precedenti sostituite o riutilizzate.

Le regole testuali esplicite prevalgono su incongruenze accidentali del mockup. Un
mockup non introduce da solo permessi, entità, pubblicazioni, contatori o stati di
business.

Una deroga al Common Contract richiede: regola interessata, modifica, approvazione.
Non vale il criterio implicito "l'ultimo testo vince".

Un conflitto che tocca privacy, ownership, lifecycle, autorizzazioni o un comportamento
già approvato va descritto e sottoposto a decisione. Si prosegue sulle parti
indipendenti; non si inventa una soluzione di prodotto per sbloccare il conflitto.

**Stati da tenere distinti sempre:** progettato · approvato · presente nel codice ·
verificato con test · rilasciato. Nessuno implica il successivo.

---

## CC-02 — Continuità con il prodotto esistente

La Dashboard è una superficie di gestione dei domini PROLINK, non una seconda
implementazione di quei domini.

Preservare identificativi canonici, dati, collegamenti, lifecycle, routing funzionante
e autorizzazioni corrette. Prima di proporre un nuovo componente, endpoint, selector o
servizio, verificare se ne esiste uno compatibile.

Una sovrapposizione richiede una decisione documentata: riuso diretto, adattamento
limitato, estrazione condivisa o sostituzione motivata. Non creare varianti come
`DashboardProfile`, `DashboardSaved`, `DashboardShortlist`, `SearchV2` o un secondo
editor editoriale.

Posizioni aperte e Candidature già funzionanti vanno conservate; i pack DAS-REV
intervengono sulle differenze verificate. Idem per Cerca, Profili, Messaggi e
pubblicazione dei contenuti.

Non dedurre da un difetto visuale la causa tecnica: righe duplicate a video non
dimostrano duplicati nel database. Separare evidenza osservata, ipotesi e verifica nel
codice.

Non introdurre nuove librerie, sistemi di stato, code, motori di ricerca o design system
solo per uniformare questa sezione. Ogni necessità infrastrutturale va dimostrata e
affrontata nel pack competente.

---

## CC-03 — Confini dei domini

### Identità e profili

Usare il modello di identità esistente, riconducibile ai concetti **PERSON**, **SOCIETY**
e **MEDIA**. Mappare le denominazioni tecniche legacy senza rinominare enum, tabelle o
API.

- **Actor** = la persona autenticata che esegue un'operazione.
- **Identità gestita** = il soggetto per conto del quale opera.

Non confondere l'amministratore tecnico con la Società o il Media rappresentati.

Calciatore, Allenatore, Staff, Procuratore, Dirigente e Tifoso sono ruoli o tipologie di
profilo del modello canonico; **non** diventano identità Dashboard separate.

La Dashboard non replica Modifica profilo: le azioni pertinenti aprono i moduli REV-PROF
canonici. Per la Società valgono REV-PROF-17 e REV-PROF-18 nelle versioni approvate.

### Società, Squadre e affiliate

- La **Società** è un'entità autonoma.
- La **Squadra del club** è un'unità organizzativa appartenente alla Società.
- Un'**affiliata** resta una Società autonoma collegata da una relazione di affiliazione.

Una Squadra non acquisisce automaticamente identità SOCIETY, verifica, Dashboard
autonoma, Store, messaggistica o Follow indipendenti. La vista operativa della Squadra è
distinta dalla sua vista pubblica nel contesto della Società.

Il profilo pubblico della Squadra mantiene la struttura approvata Organico / Media; il
dettaglio operativo non ne riscrive il design.

Organico, appartenenza, stagione, inviti, candidature, shortlist e privilegi
amministrativi sono concetti distinti. Una shortlist non crea membership; un ruolo
sportivo non concede accesso gestionale.

### Ricerca, Salvati, Follow e Shortlist

Riutilizzare CER e i rispettivi domini globali. La Dashboard può mostrare preview,
conteggi e accessi contestuali; non crea indici o liste personali parallele.

Seguire, salvare e aggiungere a shortlist sono azioni differenti, con icone e permessi
distinti.

### Post, Articoli e Media

POST e ARTICLE restano i formati del dominio editoriale HOM. Usare HOM-06.1 e HOM-06.2
nelle versioni approvate per composer, identità editoriale, bozze, anteprima e
programmazione.

Il widget "Bozze e programmati" mostra riferimenti agli stessi contenuti, non copie. Le
modalità "Collega link" e "Incolla articolo", quando incluse in HOM-06.2, si raggiungono
tramite quel flusso: nessun editor Dashboard-specifico.

Mantenere distinte identità autore, stato del contenuto e processing dei media. Una
Società che pubblica un Articolo resta SOCIETY, non diventa MEDIA.

### Messaggi, Gruppi, Comunicazioni e Notifiche

Conversation, Message, partecipanti, unread, delivery, read receipt e Push Messaggi
appartengono al core MES. I Gruppi non introducono una chat tecnica parallela.

**Communication** resta un'entità distinta, con audience, destinatari, letture e
lifecycle propri. Non diventa POST, ARTICLE, Conversation o Message perché condivide un
editor o una riga di elenco.

Riutilizzare componenti di editing, servizi di asset o infrastruttura di scheduling dove
compatibili, mantenendo separati contratti, accessi, dati e transizioni di dominio. Le
bozze di Comunicazioni non confluiscono nell'elenco editoriale "Bozze e programmati".
Nessuna bozza diventa visibile nelle superfici pubbliche per effetto di questa
integrazione.

"Crea post da questa comunicazione", quando previsto dal pack dedicato, apre il composer
HOM per un contenuto indipendente e richiede conferma di pubblicazione. Non esporta
destinatari, letture, metadati privati o allegati interni.

Messaggi e campanella usano i rispettivi aggregatori. Non generare doppio unread né una
notifica in campanella per ogni Message. Gli alert operativi (es. invio programmato
fallito) seguono le regole del loro dominio e del Centro Notifiche.

---

## CC-04 — Architettura informativa operativa

La Dashboard deve far capire **cosa richiede attenzione**, **quale azione compiere**,
**dove gestire il resto**.

Gerarchia:

1. **Da gestire** — attività concrete che richiedono un intervento.
2. **Azioni rapide** — poche azioni realmente frequenti e autorizzate.
3. **Aree di gestione** — moduli e accessi alle funzioni pertinenti.

Non è obbligatorio mostrare tutte e tre le sezioni in ogni contesto. Un riepilogo
compatto può accompagnare la struttura; posizione e resa definitive si verificano nei
master Foundation.

"Da controllare" (terminologia legacy) non deve diventare una seconda lista parallela a
"Da gestire".

Evitare: directory infinita di card, seconda Home, feed sociale, pannello di statistiche
come apertura principale. Ogni modulo deve avere scopo, informazione utile o prossima
azione chiara.

Le sezioni assenti non lasciano spazi vuoti. L'assenza di urgenze non richiede una card
"Tutto sotto controllo". Un'azione rapida non duplica la stessa CTA immediatamente sopra
o sotto.

---

## CC-05 — Shell e navigazione

Bottom navigation canonica:

**Home | Cerca | Dashboard | Messaggi | Profilo**

Dashboard è selezionata nelle superfici del relativo stack. Aprendo un'altra area
canonica si segue la navigazione di quella destinazione.

L'header principale usa "Dashboard". Non aggiungere ricerca globale, campanella,
launcher +, filtri generici o un secondo menu di navigazione. Le funzioni globali già
previste altrove restano lì.

**Non introdurre gear o hamburger flottanti sopra i contenuti.** Se gli elementi
osservati nel video sono strumenti di sviluppo, verificarne l'isolamento dagli ambienti
utente; non eliminare alla cieca funzionalità necessarie alla build tecnica.

I flussi focalizzati di creazione/modifica non hanno una seconda shell Dashboard né
bottom navigation sovrapposta alla tastiera. Riutilizzare il pattern editoriale/form del
dominio di destinazione.

Preservare origine e contesto di ritorno: il back da un dettaglio ripristina lista,
filtri e posizione di scorrimento della stessa identità, quando ancora validi. Il cambio
di identità porta la nuova Dashboard all'inizio.

---

## CC-06 — Dashboard Identity

Il cambio di Dashboard Identity è **locale alla Dashboard**. Non cambia l'identità di
pubblicazione, commento, Home, Cerca, Messaggi o Profilo.

Tre casi:

- **Una sola identità personale:** header "Dashboard", senza avatar/nome/selector
  ridondanti.
- **Una sola identità organizzativa:** logo/avatar, nome e tipo; nessun dropdown.
- **Più identità:** selector compatto, apertura del bottom sheet "Dashboard di".

Il selector elenca solo identità gestibili dall'actor corrente. Ogni riga: nome, tipo,
avatar/logo, stato selezionato. Il check di verifica compare solo se reale; "Profilo
ufficiale" non è un badge alternativo.

Il tap seleziona e chiude lo sheet, senza passaggio "Conferma". Header aggiornato
immediatamente e dati precedenti rimossi: si mostra la cache valida della nuova identità
oppure skeleton.

> **Vietato** mostrare il nome di una Società sopra contenuti personali di una persona,
> anche per un singolo stato transitorio intenzionalmente gestito.

Memorizzare l'ultima scelta per utente e ripristinarla solo se ancora autorizzata.
Altrimenti fallback valido: personale se disponibile, oppure altra identità ammessa
dalla policy. Nessuna aggregazione automatica di dati di più Società.

Un'apertura contestuale "Gestisci in Dashboard" può selezionare l'identità pertinente
previa autorizzazione. Il passaggio a editor o Messaggi trasferisce esplicitamente il
contesto e lo fa rivalidare dalla destinazione; non modifica un'identità globale in modo
implicito.

---

## CC-07 — Composizione, capability e scope

Una sola Foundation compone la Dashboard a partire da: actor, Dashboard Identity,
capability, scope organizzativo, feature abilitate, dati disponibili.

Non creare una pagina completa hardcoded per ruolo. Due amministratori della stessa
Società possono vedere moduli diversi senza che esistano due sistemi Dashboard.

Ordine logico obbligatorio: **autorizzazione e compatibilità → composizione → priorità e
presentazione**.

Un modulo non autorizzato è **assente**, non una card disabilitata o "403". Un modulo
autorizzato ma senza attività può mostrare un empty state utile. Leggere non implica
creare, modificare o eliminare.

Nascondere le azioni non autorizzate. `disabled` serve per condizioni temporanee
comprensibili (salvataggio in corso, campi incompleti), non per pubblicizzare permessi
inesistenti.

Il backend valida ogni lettura sensibile e ogni mutazione sulla risorsa e sul contesto
correnti. Le capability restituite al client migliorano la UX ma non sostituiscono il
controllo server-side. Un feature flag non conferisce autorizzazione.

La revoca nota di una capability rimuove modulo o azione. La revoca dell'identità
interrompe richieste, rende inaccessibili cache e schermate private, rimuove l'identità
dal selector, attiva un fallback sicuro. Nessun dato sensibile dietro un banner o nello
stack ripristinabile.

La revoca organizzativa non provoca logout globale. Una sessione scaduta segue il flusso
di autenticazione dell'app.

---

## CC-08 — Contratto dei moduli

Definire o riutilizzare un **registro stabile di moduli** riconosciuti dal client. Niente
page builder o UI arbitraria pilotata da payload non validati.

Il contratto logico deve poter descrivere:

- ID e tipo del modulo;
- versione di schema rilevante;
- identità e scope cui appartengono i dati;
- titolo ed eventuale sottotitolo;
- stato di caricamento e contenuto;
- conteggi, preview e riferimenti canonici;
- azioni disponibili e destinazioni note;
- ordine base ed eventuale prominence;
- metadata di freshness utili alla riconciliazione.

Sono **concetti**, non nomi obbligatori di campi o endpoint. Mappare prima i contratti
esistenti; documentare solo i gap.

Separare presentazione, dati di dominio e autorizzazioni. Lo stato visuale `error` di un
modulo non equivale a `FAILED` di una pubblicazione.

I conteggi provengono da dati reali coerenti con identità, filtri, stato e permission.
Non usare il numero di righe di una preview paginata come totale. Nessun dato
dimostrativo in produzione.

Un modulo sconosciuto può essere ignorato con diagnostica non sensibile. Un payload
incompatibile produce un fallback locale quando sicuro; una composizione non
interpretabile in modo sicuro richiede il fallback globale.

---

## CC-09 — Riepilogo e priorità

Il riepilogo è opzionale, operativo e compatto: indicativamente **2–4 indicatori**
raggruppati in una superficie leggera. Non una grande card per ogni numero.

Niente metriche di vanità o zeri decorativi. Le analisi di performance possono avere un
accesso dedicato se autorizzate e realmente disponibili; non sostituiscono le attività da
gestire.

Una priorità indica **oggetto, motivo e azione** (es. nuove candidature da valutare; una
pubblicazione programmata non riuscita). Indicativamente **1–3 priorità**, con accesso
alla gestione completa.

Il ranking è deterministico e spiegabile internamente. Non esporre punteggi, percentuali
artificiali o classificazioni "critiche" senza ragione operativa reale.

Errori API, caricamenti falliti, nuovi follower e attività sociali generiche **non** sono
priorità operative.

Ordinamento stabile durante lettura e scroll. Le variazioni si applicano nei **punti
sicuri** definiti da DAS-REV-02: caricamento iniziale, refresh esplicito, conclusione
coerente di un'azione. Non riordinare la pagina a ogni risposta asincrona.

Le rimozioni necessarie per sicurezza hanno effetto immediato. Una risorsa eliminata o
una priorità risolta va riconciliata anche nei conteggi e nelle preview correlate.

---

## CC-10 — Direzione visuale premium

Usare il design system PROLINK esistente: font, blu principale, icone, radius,
superfici, stati e componenti. Nessuna nuova identità grafica Dashboard.

Direzione editoriale e sobria: base chiara, gerarchia tipografica evidente, spaziatura
controllata, righe leggibili, poche superfici raggruppate. Evitare neon, gradienti
decorativi, ombre pesanti e dashboard desktop ridotte su smartphone.

Preferire whitespace e divider alle card annidate. Una card rappresenta un'unità
significativa, non è il contenitore obbligatorio di ogni campo o riga.

Riferimenti dimensionali **per il successivo master**, non nuovi hardcode:

| Elemento | Riferimento indicativo |
| --- | --- |
| Titolo schermata | ~24–28 |
| Titolo sezione | ~17–20 |
| Titolo riga | ~15–17 |
| Testo | ~14–16 |
| Metadata | ~13 o più, quando possibile |
| Padding orizzontale | ~20–24, adattato ai dispositivi compatti |

Interpretare i valori nelle unità logiche della piattaforma. Individuare i token
corrispondenti e verificare il font scaling prima di introdurre eccezioni. Non fissare
l'altezza delle righe impedendo l'espansione di nomi lunghi e testo dinamico.

Il blu PROLINK identifica azioni e selezione con moderazione. Verde, arancio e rosso
indicano significati reali, non categorie di persona o giudizi di qualità. Uno stato deve
essere comprensibile anche senza colore.

Densità, padding, radius e gerarchia finali si fissano nei mockup approvati e si
applicano ai componenti condivisi. Non cambiare token globali con effetti fuori scope
senza verifica e approvazione.

---

## CC-11 — Componenti e micro-interazioni

Privilegiare un set condiviso: header, identity row, section header, righe operative,
pulsanti, chip, menu, bottom sheet, stati locali/globali.

È un **inventario funzionale**: non richiede un componente nuovo per ogni nome né un
framework generico prima di un caso reale.

Le righe mostrano titolo, contesto indispensabile, pochi metadata e azioni pertinenti.
L'intera riga può aprire il dettaglio; azioni secondarie (bookmark, menu) hanno tap
target separati e non attivano la navigazione.

Chevron quando rende chiara l'apertura; omissibile se altre azioni e il pattern condiviso
rendono evidente l'interazione.

CTA con verbi specifici: "Gestisci candidature", "Nuova posizione", "Salva modifiche".
Evitare "Apri" o "Vai" se la destinazione non è chiara.

Una sola CTA primaria dominante per sezione o flusso. Nei menu righe leggere, azioni
distruttive separate. Nessuna funzione placeholder.

**Preview Posizioni:** nessuna scadenza, descrizione completa, CTA "Candidati" o score
artificiale; usare il componente canonico coerente con CER-06. Scadenza e azioni complete
restano nel dettaglio o nella gestione di dominio.

**Griglie Media dei profili:** valgono le regole REV-PROF — niente icona Salvati sulle
anteprime dove esclusa; la funzione resta nel dettaglio. L'esclusione non si estende ai
bookmark di altre superfici che li prevedono.

---

## CC-12 — Terminologia e tassonomie

UI in italiano, con queste denominazioni coerenti:

| Usare | Non usare |
| --- | --- |
| Procuratore | Agente (per il ruolo PROLINK) |
| Tifoso | Appassionato |
| Società | — (entità organizzativa) |
| Squadra / Squadra del club | Team |
| Società affiliate | — (entità autonome affiliate) |
| Posizioni aperte | Annunci (per l'area operativa) |

L'uniformità **non** autorizza a sostituire indiscriminatamente stringhe nei dati o negli
identificativi storici.

Ruoli, categorie, stagioni, squadre, geografie e qualifiche derivano dalle tassonomie
canoniche di onboarding, profili e domini operativi. Salvare **identificativi**, non solo
label.

Formati di date, numeri e plurali seguono la localizzazione del prodotto. Non esporre
enum come `published`, ID tecnici, `null` o nomi di fallback non localizzati.

---

## CC-13 — Loading, empty, error e offline

Separare stato pagina, stato modulo, connettività e refresh. Una Dashboard leggibile da
cache può essere contemporaneamente offline.

Al primo caricamento: header, identità già nota e skeleton Foundation subito. Prima di
conoscere la composizione si usano placeholder generici; dopo l'eligibility skeleton
specifici. Niente pagina bianca o grande spinner centrale come esperienza principale.

Mostrare progressivamente i moduli disponibili senza attendere il più lento. Impedire
skeleton infiniti e flicker evitabile.

**Errore locale** — gli altri moduli restano utilizzabili:

> "Non siamo riusciti a caricare le posizioni."
> CTA: "Riprova" (limitata al modulo o dominio fallito).

**Global Error** — solo quando non esiste una Dashboard sufficientemente affidabile da
mostrare; conservare header e identità nota:

> "Non riusciamo a caricare la Dashboard"
> "Riprova tra poco."
> CTA: "Riprova". Nessuna CTA operativa basata su dati non caricati.

**Empty** = risposta valida senza attività, non richiesta fallita trasformata in lista
vuota. Distinguere empty globale e di modulo. Mostrare una prossima azione pertinente
solo se autorizzata; non obbligare a tutorial, setup o nuove creazioni.

**Offline con cache utilizzabile:** mostrare i dati e un indicatore discreto
"Sei offline · Dati non aggiornati". Nessun overlay disabilitante globale.

**Offline senza cache:** "Sei offline", "Connettiti a Internet per caricare la tua
Dashboard.", "Riprova". Non fingere che la Dashboard sia vuota.

Le azioni offline seguono il dominio. Nessuna coda universale per invii, candidature o
pubblicazioni. Quando serve: "Connessione assente. Riprova quando sei online."

Gli errori autorizzativi richiedono rivalutazione di sessione, identità e capability, non
retry di rete. Non esporre stack trace, codici HTTP o dettagli infrastrutturali nella UI.

---

## CC-14 — Cache, richieste e aggiornamento

Le chiavi di cache distinguono almeno **utente**, **Dashboard Identity** e **contesto di
autorizzazione rilevante**. Le cache per modulo includono il relativo ID e la versione di
configurazione/schema quando necessaria.

Riutilizzare dati della stessa identità solo se ancora utilizzabili. Stale-while-refresh
senza mai mostrare contenuti di un altro utente o contesto.

Ogni richiesta è riconducibile al contesto e a una generazione/versione della richiesta.
Dopo uno switch: cancellare le richieste precedenti quando possibile, in ogni caso
ignorarne le risposte obsolete.

Pull-to-refresh rivaluta accesso, capability, feature, composizione, priorità e dati, non
solo i contatori. Durante il refresh la Dashboard resta visibile. Un errore temporaneo
non cancella cache valide: feedback leggero e retry.

Definire freshness per esigenze del dominio, non un TTL universale arbitrario. Aggiornare
al ritorno in foreground quando necessario, gestendo riconnessioni e fluttuazioni di rete
senza richieste duplicate.

Logout e cambio account rendono inaccessibili le cache private precedenti. Nessuna
conservazione indefinita senza policy di retention.

> La revoca remota non è rilevabile istantaneamente da un dispositivo offline.
> **DAS-REV-02 deve esplicitare** una durata massima o altra policy prudente per
> l'accesso offline ai dati organizzativi, con limitazioni quando l'autorizzazione non è
> più sufficientemente recente. Non promettere revoca offline immediata né consentire
> accesso indefinito.

Retry limitati e policy centralizzata per le letture transient. Le mutazioni non
idempotenti non si ritentano automaticamente senza protezioni. Riconciliare summary,
priorità, conteggi e preview per evitare contraddizioni evidenti.

---

## CC-15 — Form, salvataggio e feedback

Creazione e modifica usano flussi focalizzati, non un form completo sopra una lista
gestionale. Riutilizzare selector, validazioni e campi canonici.

Errori vicino al campo, annunciati, con focus al punto utile e senza cancellare i dati.
"Campi mancanti" da solo non basta.

Durante il salvataggio: dati visibili, loading nella CTA, doppio submit impedito. Patch
mirate quando il dominio lo consente, preservando i campi non modificati.

Conflitti di versione gestiti senza overwrite silenzioso, soprattutto in contesti
multi-amministratore. Non sostituire il backend con valori vuoti in caso di errore di
caricamento.

Optimistic update solo con rollback affidabile. Una priorità non è risolta finché
l'operazione non è confermata.

Le modifiche non salvate seguono il dominio: un form senza autosave chiede conferma prima
di perdere modifiche; un editor con bozze riutilizza il proprio flusso "conserva/elimina
bozza". Nessuna seconda conferma universale incompatibile con HOM.

Foto, crop, upload e asset usano i moduli condivisi. Errori o permessi dispositivo negati
preservano il resto del form.

Feedback leggero contestuale per salvataggi e operazioni ordinarie. Nessuna schermata
celebrativa per ogni aggiunta a shortlist, modifica o invio completato.

Le conferme distruttive identificano oggetto e conseguenze reali. Chiudere, archiviare,
rimuovere un collegamento ed eliminare sono azioni distinte: la grafica non ne modifica il
significato.

---

## CC-16 — Routing, preview e deep link

Le CTA aprono la risorsa canonica corretta con ID e contesto necessari. Non salvare copie
dei dati per costruire una seconda pagina Dashboard.

Rivalidare autorizzazione e disponibilità anche all'apertura da link. Se una risorsa non
esiste più: fallback contestuale e aggiornamento di row, conteggi e priorità; nessuna
destinazione nota lasciata rotta.

Usare URL e schema **ufficialmente configurati nel progetto**. La presenza legacy di
`footme://` richiede verifica e una strategia di compatibilità nel pack interessato, non
la sostituzione con un dominio PROLINK inventato.

Inviti e link riservati mantengono la semantica di token, scadenza e autorizzazione del
loro dominio. Non confonderli con link pubblici al profilo.

---

## CC-17 — Responsive e accessibilità

Smartphone come dispositivo primario, una colonna, scroll naturale. Verificare almeno le
larghezze logiche **320, 375, 390/393, 430**, con safe area superiori e inferiori, iOS e
Android.

Provare tastiera aperta, nomi lunghi, label localizzate, testo dinamico, liste dense,
sheet e menu. Nessun overflow orizzontale, clipping dei contenuti essenziali o ultimo
campo irraggiungibile.

Target interattivi almeno **44×44 pt** dove applicabile, rispettando gli standard della
piattaforma e i componenti condivisi. Contrasto almeno **WCAG AA**; non ridurre
leggibilità per ottenere densità apparente.

Label alle icone, stato selezionato e disabled accessibili, ordine di focus coerente,
annunci degli errori. Ripristinare il focus dopo sheet, selector e dialog.

Non annunciare via screen reader dati nascosti per permission. Rispettare reduced motion.
Se un ordinamento usa drag and drop, offrire azioni accessibili equivalenti.

Le CTA sticky rispettano safe area e tastiera, con spazio sufficiente perché il contenuto
sottostante resti raggiungibile.

---

## CC-18 — Privacy, analytics e diagnostica

Backend e serializer proteggono campi privati e risorse non autorizzate. Nascondere solo
il rendering client non è sufficiente: anche cache, log, crash report, push e anteprime
possono causare esposizione.

Usare la naming convention analytics esistente. Ogni pack identifica pochi eventi utili
per apertura, navigazione, azione, completamento ed errore, senza duplicare eventi già
prodotti dal dominio di destinazione.

Parametri minimizzati: tipo di modulo, tipo di identità, superficie di origine, categoria
tecnica dell'esito, durata o stato di connettività quando necessari. Un correlation ID
tecnico non incorpora dati personali.

**Mai nelle analytics di prodotto:** nomi, recapiti, testo libero, query sensibili, bio,
note di valutazione, messaggi, contenuti di bozze, elenchi di destinatari, URL completi,
token di invito. Nessun nuovo identificativo persistente di persone o organizzazioni
senza policy esplicita e necessità documentata.

Distinguere analytics di prodotto, osservabilità tecnica e audit di sicurezza. Un audit
autorizzativo può riferirsi ad actor, entità e azione: va nel sistema protetto previsto,
con accessi e retention adeguati, non nel tracking UX.

Niente payload sensibili completi nei messaggi di errore. Usare classificazioni tecniche
interne per distinguere rete, timeout, server, autorizzazione, risorsa assente, payload
incompatibile, rate limit e manutenzione.

---

## CC-19 — Migrazione del backlog e rilascio

Le 77 task precedenti restano fonte di tracciabilità finché la sostituzione non è
verificata. **DAS-REV-00 non le annulla e non autorizza a eliminarle dal task tracker.**

Per ogni nuovo pack indicare: codici origine, requisiti conservati, accorpamenti,
cambiamenti espliciti, esclusioni, dipendenze. Un requisito non sparisce perché il numero
di task si riduce.

Una task legacy esce dal backlog attivo dopo copertura completa, approvazione della
sostituzione e conservazione di un archivio con riferimenti a documenti, mockup e
discussioni. La rimozione dal tracker resta un'operazione separata da autorizzare.

Il piano di 41 voci attive organizza il lavoro; non misura lo sforzo né implica riduzione
di funzionalità. **Store resta in DAS-HOLD-01** e non viene implementato indirettamente
tramite componenti generici.

Migrazioni applicative o di dati solo nel pack competente, con compatibilità, test e
rollback documentati. Non cancellare dati legacy, creare membership, concedere permessi o
rendere pubblici contenuti per semplificare la nuova UI.

Rilascio incrementale. Con feature flag, evitare doppie mutazioni e due source of truth
durante la transizione. DAS-REV-40 verifica l'integrazione complessiva, senza sostituire i
test obbligatori di ogni pack.

---

## CC-20 — Verifica funzionale e visuale dei pack successivi

Ogni task di implementazione specifica i test realmente pertinenti. Copertura comune
minima:

1. Identità personale unica, organizzativa unica e selector multi-identità.
2. Cambio identità con rete lenta e risposta precedente tardiva: nessun dato misto.
3. Stessa Società con actor e scope differenti: moduli e azioni corretti.
4. Revoca di accesso o capability, anche tra rendering e tap.
5. Chiamata diretta non autorizzata all'API: rifiuto server-side.
6. Initial loading, errore parziale, retry locale, Global Error ed empty valido.
7. Offline con cache, senza cache, e con autorizzazione organizzativa non
   sufficientemente recente.
8. Refresh riuscito o fallito, ritorno in foreground, logout e cambio account.
9. Conteggi coerenti, pagination senza duplicati, rimozione di risorse non più
   disponibili.
10. Navigazione al dominio corretto e ritorno con contesto valido.
11. Salvataggio, doppio submit, conflitto, protezione delle modifiche non salvate.
12. Tastiera, Dynamic Type, screen reader, contrasto, tap target.
13. Assenza di dati privati in payload pubblici, analytics e log non autorizzati.

Non serve ripetere ogni test del prodotto in ogni pack: eseguire i test condivisi
interessati dal delta e i regression test delle dipendenze toccate, motivando gli elementi
non applicabili.

**Per i pack con UI:**

1. Aprire il master approvato a risoluzione utile e identificarne gli stati.
2. Avviare l'app nel contesto corretto.
3. Catturare screenshot delle schermate implementate e degli stati critici.
4. Confrontarli con il master allo stesso viewport: gerarchia, typography, densità,
   spacing, allineamenti, colori, azioni, safe area.
5. Correggere le differenze rilevanti e ripetere il confronto.
6. Verificare anche i viewport e gli stati accessibili previsti.

L'aderenza visuale non giustifica testo tagliato, contrasto insufficiente o una regola di
business errata. Le tolleranze si fissano con il master; niente pixel-perfect su un
riferimento illeggibile.

Eseguire lint, type checking, test e build disponibili per le parti modificate.
**Riportare comandi ed esiti reali.** Se ambiente, backend o dipendenze impediscono una
verifica, indicare cosa non è stato eseguito e perché; non dichiararlo superato.

---

## CC-21 — Riferimenti disponibili e prossimi pack

Sono riferimenti di **audit** (non prova dello stato del repository o del rilascio): le
due parti delle task legacy, il pacchetto mockup, il video della Dashboard Società
esistente.

Aggiornamento dei riferimenti visuali:

- **DAS-01.3** — la versione reinviata è disponibile come riferimento della composizione
  modulare; non trattarla come file mancante o corrotto. I suoi stati non autorizzano a
  mostrare tutti i moduli a tutti gli actor.
- **DAS-03.1** — usare la versione disponibile come riferimento strutturale; la bassa
  risoluzione non consente confronto pixel-perfect. Il nuovo master Società sarà prodotto
  nel pack dedicato, senza richiedere una versione che l'utente non possiede.
- **DAS-03.11.5** — riferimento visuale mancante, da rigenerare nel blocco Gruppi a
  partire da testo e regole consolidate. Non è dipendenza bloccante per la Foundation.

Sequenza iniziale del Piano consolidato:

1. **DAS-REV-00** — Common Contract Dashboard premium: regole, mappatura tecnica, metodo.
2. **DAS-REV-01** — Foundation: shell, identity e composizione; master visuali,
   approvazione e task implementativa. Consolida DAS-01.1, DAS-01.2, DAS-01.3, DAS-03.3.3.
3. **DAS-REV-02** — Foundation: priorità, cache e stati; dettaglio e implementazione dei
   comportamenti condivisi. Consolida DAS-01.4 e DAS-01.5.

Non anticipare i moduli delle wave successive per riempire schermate dimostrative. Le
fixture per sviluppo e test devono essere riconoscibili, isolate e mai usate come dati
reali.

---

## CC-22 — Definition of Done

### DAS-REV-00 assegnata da sola

Completata quando:

- il contratto è registrato e versionato nella documentazione pertinente;
- shell, identity, composition, componenti visuali e domini esistenti sono stati
  ricogniti con riferimenti a file reali;
- per ogni regola è chiaro cosa è presente, cosa va riutilizzato e cosa manca;
- i conflitti sono espliciti, senza decisioni di prodotto nascoste;
- DAS-REV-01 e DAS-REV-02 hanno confini e dipendenze tecniche identificati;
- nessuna funzionalità applicativa, permission o dato è stato modificato anticipatamente;
- non sono state eliminate task, documenti o implementazioni legacy.

Output richiesti: ricognizione, file di documentazione, componenti/token/servizi/modelli/
route riutilizzabili con percorsi reali, mappatura CC → implementazione e pack
destinatario dei gap, dipendenze (disponibili / non implementate / non verificabili),
conflitti e decisioni necessarie, piano tecnico limitato a DAS-REV-01 e DAS-REV-02,
controlli eseguiti e limitazioni.

Non sono richiesti screenshot di un'interfaccia non ancora implementata. Lint, build e
test applicativi possono essere non pertinenti in un'assegnazione documentale: va
dichiarato, senza simulare una validazione dell'app.

### Conformità delle task di implementazione successive

Ogni pack consegna anche: file applicativi modificati, componenti riutilizzati o
estratti, contratti/API e migrazioni toccate, verifiche funzionali, screenshot e confronto
visuale quando pertinenti, risultati dei controlli, limiti residui.

Non dichiarare "nessuna regressione" in assoluto: indicare superfici verificate, esiti e
aree non testate. La sola creazione del codice o la sola build non costituiscono
completamento del pack.

---

## Principio finale obbligatorio

La Dashboard PROLINK è un unico ambiente operativo, composto in base all'identità gestita
e ai permessi reali. Il suo valore deriva da priorità comprensibili, azioni pertinenti e
informazioni affidabili, presentate con una UI mobile essenziale e coerente. Il redesign
riutilizza i domini esistenti, mantiene separati i contesti personali e organizzativi,
protegge i dati anche negli stati transitori e sostituisce il backlog legacy in modo
tracciabile.

**Premium significa chiarezza, consistenza e qualità dell'interazione, non
moltiplicazione di card, indicatori o sistemi paralleli.**

---

## Changelog

| Versione | Data | Nota |
| --- | --- | --- |
| 1.0 | 2026-10-09 | Prima registrazione nel repository (DAS-REV-00). Nessuna deroga approvata. |
