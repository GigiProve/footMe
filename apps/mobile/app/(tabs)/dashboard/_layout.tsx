import { Stack } from "expo-router";

import { DashboardIdentityProvider } from "../../../src/features/dashboard/identity/DashboardIdentityProvider";

/**
 * Stack annidato nella tab Dashboard (DAS-REV-08 §4).
 *
 * Il Centro Squadre deve mostrare la bottom navigation **con Dashboard
 * selezionata**. Una route sorella nelle tab (`href: null`) l'avrebbe mostrata
 * senza nessuna tab attiva; una route fuori dalle tab non l'avrebbe mostrata
 * affatto. Un figlio della tab è l'unica forma che soddisfa entrambe le cose.
 *
 * Il provider di identità sale qui dalla sola `index`: è lo stesso contesto —
 * quale Società si sta gestendo — e condividerlo evita che il Centro debba
 * rileggerlo o, peggio, sceglierlo per conto proprio. Resta comunque locale
 * alla Dashboard: Home, Cerca, Messaggi e Profilo non lo vedono.
 */
export default function DashboardLayout() {
  return (
    <DashboardIdentityProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        {/* DAS-REV-12 §6: l'hub Struttura societaria è una figlia della tab,
            non una schermata intermedia fra Dashboard e centri — le
            scorciatoie dirette di "Aree di gestione" restano tali. */}
        <Stack.Screen name="structure" />
        <Stack.Screen name="teams" />
        <Stack.Screen name="team/[teamId]" />
        {/* DAS-REV-10 §9: le tre viste di consultazione di Stagioni e
            storico sono figlie della stessa tab — bottom navigation
            visibile, Dashboard selezionata. I flussi focalizzati stanno
            invece in app/team-seasons/. */}
        <Stack.Screen name="seasons/index" />
        <Stack.Screen name="seasons/inactive" />
        <Stack.Screen name="seasons/[teamId]" />
        {/* DAS-REV-11 §4: negli screen 01, 02, 08 e 10 la bottom navigation
            resta visibile con Dashboard selezionata. Ricerca, form di
            richiesta e revisione del consenso stanno invece in
            app/society-link/, e la landing pubblica in app/society-invite/. */}
        <Stack.Screen name="network/index" />
        <Stack.Screen name="network/history" />
        <Stack.Screen name="network/[relationshipId]" />
        {/* DAS-REV-13 §6: il Centro Amministratori è raggiunto da due
            ingressi — Dashboard Società e hub Struttura societaria — e
            nessuno dei due deve passare da una pagina intermedia. Qui la
            bottom navigation resta visibile con Dashboard selezionata
            (screen 01); ricerca, composer e invito esterno sono flussi
            focalizzati in app/admin-invite/, e la landing pubblica sta in
            app/admin-invite/[token]. */}
        <Stack.Screen name="admins" />
        {/* DAS-REV-14 §4: lo screen 01 «mantiene Home | Cerca | Dashboard |
            Messaggi | Profilo, con Dashboard selezionata». Gli screen 02–12
            sono flussi focalizzati e stanno in app/club-roles/ e
            app/society-admin/. */}
        <Stack.Screen name="roles" />
        {/* DAS-REV-15 §5: «Percorso principale: Dashboard Società →
            Posizioni aperte. Apri direttamente il Centro, senza imporre il
            passaggio attraverso Struttura societaria.» Qui la bottom
            navigation resta visibile con Dashboard selezionata (screen
            01/03/04/06).

            DAS-REV-17 §6 porta qui anche il dettaglio gestionale della
            singola Position: «Le pagine di dettaglio mantengono la
            navigazione Home | Cerca | Dashboard | Messaggi | Profilo, con
            Dashboard selezionata.» Editor e anteprima restano flussi
            focalizzati in app/position-manage/. */}
        <Stack.Screen name="positions/index" />
        <Stack.Screen name="positions/[id]" />
        {/* DAS-REV-19 §6: «Il Centro conserva la bottom navigation Home |
            Cerca | Dashboard | Messaggi | Profilo, con Dashboard
            selezionata.» Lo stesso vale per il dettaglio dell'invito
            inviato e per quello della richiesta ricevuta, che sono pagine
            gestionali della Società. Composer e superfici del destinatario
            stanno invece in app/member-invite/ e app/invitation/. */}
        <Stack.Screen name="invites/index" />
        <Stack.Screen name="invites/[inviteId]" />
        <Stack.Screen name="invites/request/[requestId]" />
        {/* DAS-REV-20 §6: «Nel centro principale mantieni Home | Cerca |
            Dashboard | Messaggi | Profilo, Dashboard selezionata», e lo
            stesso vale per dettaglio del link, persone collegate e
            dettaglio della persona, che sono pagine gestionali della
            Società. Composer in app/team-link/, landing pubblica in
            app/team-invite/ e percorso del destinatario in app/team-join/
            restano flussi focalizzati senza bottom navigation. */}
        <Stack.Screen name="join-links/index" />
        <Stack.Screen name="join-links/[linkId]/index" />
        <Stack.Screen name="join-links/[linkId]/people/index" />
        <Stack.Screen name="join-links/[linkId]/people/[assignmentId]" />
        {/* DAS-REV-21 §6: «Gestione societaria Team | Dashboard Società →
            Struttura società → squadra → Organico → persona». Nel PNG lo
            screen 21 mostra la bottom navigation con Dashboard selezionata.
            Il dettaglio del singolo incarico (screen 22), il form condiviso
            e le conferme sono flussi focalizzati in app/role-link/. */}
        <Stack.Screen name="people/index" />
        <Stack.Screen name="people/[profileId]" />
        {/* DAS-REV-22 §11: «Bottom navigation canonica Home | Cerca |
            Dashboard | Messaggi | Profilo. Dashboard selezionata nelle
            superfici di questa task.» Centro, elenco di una Position e
            dettaglio della candidatura sono tutti e tre pagine gestionali
            della Società: in questo pack non esiste nessun flusso
            focalizzato, perché non si compone niente — si consulta. */}
        <Stack.Screen name="applications/index" />
        <Stack.Screen name="applications/[applicationId]" />
        <Stack.Screen name="applications/position/[positionId]" />
        {/* DAS-REV-23 §28: «Bottom navigation canonica … Dashboard
            selezionata nelle pagine della tavola aperte dal relativo
            percorso.» Gli screen 01-04 sono pagine **personali**, non
            gestionali: vivono qui per la bottom navigation, non per il
            contesto Società — e infatti non usano l'identità della
            Dashboard. app/applications/ resta come reindirizzamento. */}
        <Stack.Screen name="my-applications/index" />
        <Stack.Screen name="my-applications/[id]" />
        {/* DAS-REV-24 §5, §25: «Home | Cerca | Dashboard | Messaggi | Profilo
            → Dashboard Società → Shortlist», con Dashboard selezionata. Il
            centro, la vista base del pool di una Position e il dettaglio di
            una lista personalizzata sono tutte pagine gestionali della
            Società: in questo pack non esiste nessun flusso focalizzato.
            app/shortlist/ resta come reindirizzamento (§26). */}
        <Stack.Screen name="shortlist/index" />
        <Stack.Screen name="shortlist/position/[positionId]" />
        <Stack.Screen name="shortlist/list/[listId]" />
        {/* DAS-REV-25 §15: la scheda interna sta dentro la tab Dashboard,
            perché §4 vuole la bottom navigation sugli screen 05/08/14/15. */}
        <Stack.Screen name="shortlist/entry/[entryId]" />
        {/* DAS-REV-28 §4: «Centro con Dashboard selezionata; wizard e
            selector focalizzati senza bottom navigation». Il wizard sta in
            app/event-compose/. */}
        <Stack.Screen name="events/index" />
      </Stack>
    </DashboardIdentityProvider>
  );
}
