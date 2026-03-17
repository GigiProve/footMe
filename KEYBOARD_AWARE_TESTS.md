# Keyboard aware tests

## Verifiche automatiche

- Helper unit test per il nuovo wrapper:
  - calcolo del padding inferiore con tastiera + safe area;
  - calcolo del target di scroll quando il campo attivo finisce sotto la tastiera;
  - presenza del dismiss wrapper e aggiornamento del padding all’apertura tastiera.

File:

- `/home/runner/work/footMe/footMe/apps/mobile/src/components/ui/keyboard-aware-scroll-view.test.tsx`

## Verifiche manuali previste

- Focus su input email/password in login e registrazione.
- Focus sui campi base e multilinea nell’onboarding profilo.
- Editing profilo con bio, presentazione, filosofia di gioco, esperienza e altri campi lunghi.
- Ricerca rete con tastiera aperta e dismiss tramite tap fuori.
- Annunci:
  - form nuovo annuncio lato club;
  - cover message candidatura lato player.
- Conversazione messaggi:
  - focus sul composer multilinea;
  - crescita del campo mentre il testo aumenta;
  - raggiungibilità dei pulsanti `Condividi contatto` e `Invia messaggio`.

## Risultato atteso

- Il campo attivo resta visibile quando la tastiera si apre.
- Il form aggiunge spazio inferiore dinamico sufficiente per CTA e contenuto finale.
- Il tap fuori dal campo chiude la tastiera senza impedire la pressione dei pulsanti.
- I campi multilinea già in focus possono richiedere un nuovo auto-scroll mentre crescono.
