# React Best Practices per footMe

## Obiettivo

Questo documento adatta al progetto footMe le linee guida pubblicate da Vercel in **Introducing React Best Practices**, concentrandosi su quello che e' davvero applicabile oggi a un'app **Expo + React Native + React 19**.

Usalo come riferimento quando implementi o modifichi schermate, componenti, hook e servizi React nel repository.

## Ambito

- stack corrente: `apps/mobile`
- framework UI: React Native con Expo
- librerie gia' presenti: React 19, Expo Router, Vitest, ESLint
- backend/data layer: Supabase

## Regole operative da seguire

### 1. Evitare async waterfalls

Quando due operazioni non dipendono una dall'altra, devono partire in parallelo.

**Da preferire**

- `Promise.all(...)` per fetch indipendenti
- avviare il caricamento il prima possibile
- fare `await` solo nel punto in cui il dato serve davvero

**Da evitare**

- catene di `await` sequenziali quando i dati sono indipendenti
- `useEffect` che scatena un fetch e poi un secondo fetch non necessario

### 2. Le dipendenze degli hook sono obbligatorie

In footMe la regola `react-hooks/exhaustive-deps` va trattata come vincolante.

Quindi:

- non disabilitare la regola per evitare warning
- se una funzione e' usata in un `useEffect`, renderla stabile con `useCallback` solo quando serve davvero
- far dipendere gli effect dai valori reali che usano

Obiettivo: evitare side effect incoerenti, dati stantii e reload incompleti.

### 3. Stato e fetching vanno tenuti vicini alla UI che li usa

Per questo progetto:

- i dati di feature restano nelle schermate, nei custom hook o nei servizi della feature
- il `SessionProvider` deve continuare a occuparsi solo di stato di sessione/autenticazione condiviso
- non introdurre context globali per stato locale di una singola schermata

### 4. Ridurre i re-render senza micro-ottimizzazioni premature

Preferire:

- componenti piccoli e separati per sezioni con responsabilita' chiare
- stato locale vicino al componente che lo modifica
- valori derivati semplici calcolati inline

Da evitare:

- usare `useMemo` o `useCallback` in modo preventivo senza un problema reale
- context troppo larghi che forzano re-render non necessari
- soluzioni basate su `memo` prima di aver semplificato la struttura del componente

### 5. Liste grandi: usare i pattern nativi efficienti

Quando una schermata mostra molte righe o card:

- preferire `FlatList` o `SectionList`
- evitare render completi con molti elementi in `ScrollView` se la lista cresce

Per liste piccole o blocchi editoriali, `ScrollView` resta accettabile.

### 6. Import e bundle: evitare nuove aggregazioni pesanti

Vercel raccomanda di evitare barrel import troppo ampi per limitare codice caricato inutilmente.

Nel repository valgono queste regole:

- **non introdurre nuovi barrel file cross-feature**
- preferire import diretti per moduli di feature, servizi e utilita'
- i barrel piccoli gia' esistenti del design system (`src/ui`, `src/theme/tokens`) possono restare, perche' sono locali, stabili e limitati

### 7. Caricare tardi cio' che non serve subito

Per funzionalita' non critiche al primo paint:

- valuta `import()` dinamici solo se riducono davvero il lavoro iniziale
- evita librerie nuove o costose dentro il render path principale se possono vivere dietro un'interazione

### 8. Preferire loading state espliciti e progressive disclosure

Con React 19 e React Native:

- usa loading state chiari e locali per schermo/sezione
- introduci `Suspense` solo dove porta un beneficio reale e leggibile
- non aggiungere complessita' architetturale senza un vantaggio misurabile

## Come applicarle in footMe

Quando lavori su codice React/React Native:

1. controlla se ci sono fetch seriali evitabili
2. verifica le dipendenze di ogni `useEffect`
3. chiediti se lo stato puo' stare piu' vicino al componente che lo usa
4. evita nuovi context o barrel generici senza una motivazione chiara
5. per liste lunghe, passa a componenti virtualizzati

## Checklist rapida per future richieste

- [ ] fetch indipendenti in parallelo
- [ ] nessun `useEffect` con dipendenze mancanti
- [ ] stato locale collocato vicino alla UI
- [ ] nessun nuovo barrel cross-feature
- [ ] nessuna ottimizzazione prematura con `useMemo`/`useCallback`
- [ ] liste grandi renderizzate con componenti virtualizzati

## Riferimenti

- Vercel, **Introducing React Best Practices**
- linee guida UX/UI mobile del progetto: `docs/mobile-ux-ui-guidelines.md`
