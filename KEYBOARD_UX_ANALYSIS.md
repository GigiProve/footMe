# Keyboard UX analysis

## Cause del problema

- Le schermate con form usano prevalentemente `ScrollView` o `View` semplici senza una soluzione comune per tastiera, safe area e auto-scroll del campo attivo.
- Il componente condiviso `Input` gestiva solo lo stato visuale di focus; non notificava il contenitore quando un campo riceveva focus e non aiutava nei casi multilinea che crescono in altezza.
- Solo `/home/runner/work/footMe/footMe/apps/mobile/app/(tabs)/profile.tsx` impostava `keyboardShouldPersistTaps="handled"`, quindi il comportamento era parziale e incoerente.
- I form con CTA finali (`Salva`, `Accedi`, `Registrati`, `Invia messaggio`, `Invia candidatura`) non aggiungevano spazio dinamico quando la tastiera compariva.
- Le schermate auth (`sign-in`, `sign-up`) usavano un `View` centrato, quindi su schermi piccoli la tastiera poteva coprire input e pulsanti.

## Schermate impattate

- `/home/runner/work/footMe/footMe/apps/mobile/app/(auth)/sign-in.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/app/(auth)/sign-up.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/app/(onboarding)/profile.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/app/(tabs)/profile.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/app/(tabs)/network.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/app/(tabs)/announcements.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/app/messages/[conversationId].tsx`

## Componenti coinvolti

- `/home/runner/work/footMe/footMe/apps/mobile/src/ui/Input/Input.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/bio-section.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/profile-screen-components.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/player-sports-section.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/contact-section.tsx`

## Soluzione proposta

- Introdurre un wrapper globale riusabile `KeyboardAwareScrollView` in `/home/runner/work/footMe/footMe/apps/mobile/src/components/ui/keyboard-aware-scroll-view.tsx`.
- Il wrapper:
  - ascolta apertura/chiusura tastiera su iOS e Android;
  - calcola padding inferiore dinamico includendo tastiera e safe area bottom;
  - forza `keyboardShouldPersistTaps="handled"` per non rompere CTA e altri elementi premibili;
  - abilita dismiss della tastiera con tap fuori dal campo;
  - espone un contesto interno per chiedere lo scroll automatico del campo attivo.
- Aggiornare `Input` per:
  - forwardare correttamente il ref del `TextInput`;
  - notificare il wrapper quando riceve focus;
  - riallineare i campi multilinea mentre crescono.
- Migrare al wrapper globale tutte le schermate con form testuali.

## Rischi di regressione

- La misura del campo attivo dipende dalle API native `measure`; se un ref non è disponibile il fallback è safe e non deve causare crash, ma l’auto-scroll può saltare quel singolo caso.
- Nella schermata conversazione il composer non è più separato da una `ScrollView` interna dedicata: il vantaggio è un comportamento keyboard-aware coerente, ma va verificato il feeling su thread molto lunghi.
- I `ScrollView` annidati già presenti nei componenti di suggerimento/autocomplete restano invariati: il nuovo wrapper migliora il caso principale del form, ma i nested scroll richiedono attenzione futura se comparissero edge case specifici.
